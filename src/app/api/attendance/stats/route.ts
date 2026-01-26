import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// Daily programs
const DAILY_PROGRAMS = ['MEMORIZATION', 'CONSOLIDATION', 'REVISION', 'READING']

// Get Sunday (week start) from a date
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay()
  d.setDate(d.getDate() - dow)
  return d
}

// Get ISO week number
function getISOWeekNumber(date: Date): { week: number; year: number } {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const week = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return { week, year: d.getFullYear() }
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const period = searchParams.get('period') || 'week' // week, month, year
    const weekParam = searchParams.get('week') ? parseInt(searchParams.get('week')!) : null
    const monthParam = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
    const yearParam = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()

    // Check permissions for viewing another user
    const targetUserId = userId || session.user.id
    if (targetUserId !== session.user.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      })
      if (!['ADMIN', 'MANAGER', 'REFERENT'].includes(currentUser?.role || '')) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
    }

    const now = new Date()
    let startDate: Date
    let endDate: Date
    let totalDays: number

    // Determine period range
    if (period === 'week') {
      const currentWeekInfo = getISOWeekNumber(now)
      const targetWeek = weekParam || currentWeekInfo.week
      const targetYear = yearParam

      // Get Monday of target ISO week
      const simple = new Date(targetYear, 0, 1 + (targetWeek - 1) * 7)
      const dow = simple.getDay()
      const monday = new Date(simple)
      if (dow <= 4) {
        monday.setDate(simple.getDate() - simple.getDay() + 1)
      } else {
        monday.setDate(simple.getDate() + 8 - simple.getDay())
      }

      // Get Sunday before Monday
      startDate = new Date(monday)
      startDate.setDate(monday.getDate() - 1)
      startDate.setHours(0, 0, 0, 0)

      endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + 7)

      totalDays = 7
    } else if (period === 'month') {
      const targetMonth = monthParam !== null ? monthParam : now.getMonth()
      startDate = new Date(yearParam, targetMonth, 1)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(yearParam, targetMonth + 1, 1)
      totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
    } else {
      // year
      startDate = new Date(yearParam, 0, 1)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(yearParam + 1, 0, 1)
      totalDays = 365 + (yearParam % 4 === 0 ? 1 : 0)
    }

    // Get all programs
    const programs = await prisma.program.findMany({
      where: { code: { in: DAILY_PROGRAMS } }
    })
    const programMap = new Map(programs.map(p => [p.id, p]))

    // Get completions for the period
    const completions = await prisma.dailyProgramCompletion.findMany({
      where: {
        userId: targetUserId,
        completed: true,
        date: {
          gte: startDate,
          lt: endDate
        }
      }
    })

    // Calculate stats per program
    const programStats: Record<string, { completed: number; total: number; percentage: number }> = {}
    for (const program of programs) {
      const completedDays = completions.filter(c => c.programId === program.id).length
      programStats[program.code] = {
        completed: completedDays,
        total: totalDays,
        percentage: Math.round((completedDays / totalDays) * 100)
      }
    }

    // Get weekly objectives stats
    const objectives = await prisma.weeklyObjective.findMany({
      where: {
        userId: targetUserId,
        isActive: true
      },
      include: { program: true }
    })

    // Count weeks in period
    let totalWeeks: number
    if (period === 'week') {
      totalWeeks = 1
    } else if (period === 'month') {
      // Weeks that have at least one day in this month
      totalWeeks = Math.ceil(totalDays / 7)
    } else {
      totalWeeks = 52 + (getISOWeekNumber(new Date(yearParam, 0, 1)).week === 1 ? 1 : 0)
    }

    // Get objective completions for the period
    const objectiveCompletions = await prisma.weeklyObjectiveCompletion.findMany({
      where: {
        weeklyObjectiveId: { in: objectives.map(o => o.id) },
        completed: true,
        weekStartDate: {
          gte: startDate,
          lt: endDate
        }
      }
    })

    const objectiveStats = objectives.map(obj => {
      const completedWeeks = objectiveCompletions.filter(c => c.weeklyObjectiveId === obj.id).length
      return {
        id: obj.id,
        name: obj.name,
        programCode: obj.program?.code || null,
        isCustom: obj.isCustom,
        completed: completedWeeks,
        total: totalWeeks,
        percentage: totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0
      }
    })

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalDays,
      totalWeeks,
      programStats,
      objectiveStats
    })
  } catch (error) {
    console.error('Error fetching attendance stats:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    )
  }
}
