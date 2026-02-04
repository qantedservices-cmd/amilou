import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // Format: YYYY-MM
    const date = searchParams.get('date') // Format: YYYY-MM-DD (for specific day)
    const userId = searchParams.get('userId')

    // Support impersonation - use effective user ID when no explicit userId provided
    const { userId: effectiveUserId } = await getEffectiveUserId()
    const targetUserId = userId || effectiveUserId!
    if (targetUserId !== session.user.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      })
      if (!['ADMIN', 'MANAGER', 'REFERENT'].includes(currentUser?.role || '')) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
    }

    // If specific date requested, return that week's data with today's score
    if (date) {
      const targetDate = new Date(date)
      targetDate.setHours(0, 0, 0, 0)
      const dow = targetDate.getDay()
      const weekStart = new Date(targetDate)
      weekStart.setDate(targetDate.getDate() - dow)

      const attendance = await prisma.dailyAttendance.findUnique({
        where: {
          userId_date: {
            userId: targetUserId,
            date: weekStart,
          },
        },
      })

      const dayFields = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
      const dayField = dayFields[dow]
      const todayScore = attendance ? (attendance[dayField] as number) : 0

      return NextResponse.json({
        attendance,
        todayScore,
        dayOfWeek: dow,
        dayField,
        weekStart: weekStart.toISOString(),
      })
    }

    let startDate: Date
    let endDate: Date

    if (month) {
      const [year, monthNum] = month.split('-').map(Number)
      startDate = new Date(year, monthNum - 1, 1)
      endDate = new Date(year, monthNum, 0)
    } else {
      // Default to current month
      const now = new Date()
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }

    const attendance = await prisma.dailyAttendance.findMany({
      where: {
        userId: targetUserId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    })

    return NextResponse.json(attendance)
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'assiduité' },
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

    const { date, score, dayOfWeek, userId } = await request.json()

    if (!date) {
      return NextResponse.json({ error: 'Date requise' }, { status: 400 })
    }

    // Validate score (0-5)
    const validScore = Math.min(Math.max(Math.round(score ?? 0), 0), 5)

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

    // Get start of the week (Sunday) for the given date
    const weekDate = new Date(date)
    weekDate.setHours(0, 0, 0, 0)
    const dow = weekDate.getDay()
    const weekStart = new Date(weekDate)
    weekStart.setDate(weekDate.getDate() - dow)

    // Map day of week to field name
    const dayFields = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayField = dayFields[dayOfWeek ?? dow]

    // Find existing record
    const existing = await prisma.dailyAttendance.findUnique({
      where: {
        userId_date: {
          userId: targetUserId,
          date: weekStart,
        },
      },
    })

    // Build update data - only update the specific day
    const updateData: Record<string, number | string | null> = {
      [dayField]: validScore,
    }

    const attendance = await prisma.dailyAttendance.upsert({
      where: {
        userId_date: {
          userId: targetUserId,
          date: weekStart,
        },
      },
      update: updateData,
      create: {
        userId: targetUserId,
        date: weekStart,
        sunday: dayField === 'sunday' ? validScore : 0,
        monday: dayField === 'monday' ? validScore : 0,
        tuesday: dayField === 'tuesday' ? validScore : 0,
        wednesday: dayField === 'wednesday' ? validScore : 0,
        thursday: dayField === 'thursday' ? validScore : 0,
        friday: dayField === 'friday' ? validScore : 0,
        saturday: dayField === 'saturday' ? validScore : 0,
        createdBy: session.user.id,
      },
    })

    return NextResponse.json(attendance)
  } catch (error) {
    console.error('Error saving attendance:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'enregistrement de l\'assiduité' },
      { status: 500 }
    )
  }
}
