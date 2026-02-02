import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// Daily programs in order
const DAILY_PROGRAMS = ['MEMORIZATION', 'CONSOLIDATION', 'REVISION', 'READING']

// Get Sunday (week start) from a date
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay()
  d.setDate(d.getDate() - dow)
  return d
}

// Get all dates for a week starting from Sunday
function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    dates.push(d)
  }
  return dates
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart') // Format: YYYY-MM-DD
    const userId = searchParams.get('userId')

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

    // Determine week start date
    let weekStart: Date
    if (weekStartParam) {
      weekStart = new Date(weekStartParam)
      weekStart.setHours(0, 0, 0, 0)
      // Ensure it's a Sunday
      const dow = weekStart.getDay()
      if (dow !== 0) {
        weekStart.setDate(weekStart.getDate() - dow)
      }
    } else {
      weekStart = getWeekStart(new Date())
    }

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)

    // Get all programs
    const programs = await prisma.program.findMany({
      where: { code: { in: DAILY_PROGRAMS } },
      orderBy: { code: 'asc' }
    })

    // Get completions for the week
    const completions = await prisma.dailyProgramCompletion.findMany({
      where: {
        userId: targetUserId,
        date: {
          gte: weekStart,
          lt: weekEnd
        }
      },
      include: { program: true }
    })

    // Build a matrix: { programId: { dayIndex: completed } }
    const weekDates = getWeekDates(weekStart)
    const completionMatrix: Record<string, Record<number, boolean>> = {}

    for (const program of programs) {
      completionMatrix[program.id] = {}
      for (let i = 0; i < 7; i++) {
        completionMatrix[program.id][i] = false
      }
    }

    for (const completion of completions) {
      const date = new Date(completion.date)
      date.setHours(0, 0, 0, 0)
      const dayIndex = Math.round((date.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000))
      if (dayIndex >= 0 && dayIndex < 7 && completionMatrix[completion.programId]) {
        completionMatrix[completion.programId][dayIndex] = completion.completed
      }
    }

    // Sort programs in the correct order
    const sortedPrograms = DAILY_PROGRAMS
      .map(code => programs.find(p => p.code === code))
      .filter(Boolean)

    // Get user's program settings (objectives)
    const programSettings = await prisma.userProgramSettings.findMany({
      where: {
        userId: targetUserId,
        isActive: true,
        programId: { in: programs.map(p => p.id) }
      }
    })

    // Build objectives map: { programId: { quantity, unit, period } }
    const objectives: Record<string, { quantity: number; unit: string; period: string } | null> = {}
    for (const program of programs) {
      const setting = programSettings.find(s => s.programId === program.id)
      objectives[program.id] = setting
        ? { quantity: setting.quantity, unit: setting.unit, period: setting.period }
        : null
    }

    return NextResponse.json({
      weekStart: weekStart.toISOString(),
      weekDates: weekDates.map(d => d.toISOString()),
      programs: sortedPrograms,
      completions: completionMatrix,
      objectives
    })
  } catch (error) {
    console.error('Error fetching program completions:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des programmes' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId, completions } = await request.json()
    // completions: { programId: { dayIndex: { date: string, completed: boolean } } }

    // Check permissions for modifying another user
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

    // Validate programs
    const programIds = Object.keys(completions)
    const programs = await prisma.program.findMany({
      where: { id: { in: programIds } }
    })
    const validProgramIds = new Set(programs.map(p => p.id))

    // Process each completion
    const operations = []
    for (const programId of programIds) {
      if (!validProgramIds.has(programId)) continue

      const programCompletions = completions[programId]
      for (const dayIndex of Object.keys(programCompletions)) {
        const { date, completed } = programCompletions[dayIndex]
        const dateObj = new Date(date)
        dateObj.setHours(0, 0, 0, 0)

        if (completed) {
          operations.push(
            prisma.dailyProgramCompletion.upsert({
              where: {
                userId_programId_date: {
                  userId: targetUserId,
                  programId,
                  date: dateObj
                }
              },
              update: { completed: true },
              create: {
                userId: targetUserId,
                programId,
                date: dateObj,
                completed: true,
                createdBy: session.user.id
              }
            })
          )
        } else {
          // Delete the record if unchecked
          operations.push(
            prisma.dailyProgramCompletion.deleteMany({
              where: {
                userId: targetUserId,
                programId,
                date: dateObj
              }
            })
          )
        }
      }
    }

    await Promise.all(operations)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving program completions:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'enregistrement' },
      { status: 500 }
    )
  }
}
