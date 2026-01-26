import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// Get Sunday (week start) from a date
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay()
  d.setDate(d.getDate() - dow)
  return d
}

// Default weekly objectives to create for new users
const DEFAULT_OBJECTIVES = ['Tafsir']

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

    // Check if user has any objectives, if not create defaults
    const existingCount = await prisma.weeklyObjective.count({
      where: { userId: targetUserId }
    })

    if (existingCount === 0) {
      // Get TAFSIR program for linking
      const tafsirProgram = await prisma.program.findFirst({
        where: { code: 'TAFSIR' }
      })

      // Create default objectives
      for (const name of DEFAULT_OBJECTIVES) {
        await prisma.weeklyObjective.create({
          data: {
            userId: targetUserId,
            name,
            programId: name === 'Tafsir' ? tafsirProgram?.id : null,
            isCustom: false,
            isActive: true
          }
        })
      }
    }

    // Get all active objectives for the user
    const objectives = await prisma.weeklyObjective.findMany({
      where: {
        userId: targetUserId,
        isActive: true
      },
      include: {
        program: true,
        completions: {
          where: {
            weekStartDate: weekStart
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    // Transform to include completion status
    const objectivesWithStatus = objectives.map(obj => ({
      id: obj.id,
      name: obj.name,
      programId: obj.programId,
      programCode: obj.program?.code || null,
      isCustom: obj.isCustom,
      completed: obj.completions.length > 0 ? obj.completions[0].completed : false,
      completionId: obj.completions.length > 0 ? obj.completions[0].id : null
    }))

    return NextResponse.json({
      weekStart: weekStart.toISOString(),
      objectives: objectivesWithStatus
    })
  } catch (error) {
    console.error('Error fetching weekly objectives:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des objectifs' },
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

    const { userId, objectiveId, weekStart, completed } = await request.json()

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

    // Validate objective belongs to user
    const objective = await prisma.weeklyObjective.findFirst({
      where: {
        id: objectiveId,
        userId: targetUserId
      }
    })

    if (!objective) {
      return NextResponse.json({ error: 'Objectif non trouvé' }, { status: 404 })
    }

    const weekStartDate = new Date(weekStart)
    weekStartDate.setHours(0, 0, 0, 0)

    if (completed) {
      await prisma.weeklyObjectiveCompletion.upsert({
        where: {
          weeklyObjectiveId_weekStartDate: {
            weeklyObjectiveId: objectiveId,
            weekStartDate: weekStartDate
          }
        },
        update: { completed: true },
        create: {
          weeklyObjectiveId: objectiveId,
          weekStartDate: weekStartDate,
          completed: true,
          createdBy: session.user.id
        }
      })
    } else {
      await prisma.weeklyObjectiveCompletion.deleteMany({
        where: {
          weeklyObjectiveId: objectiveId,
          weekStartDate: weekStartDate
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving weekly objective completion:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'enregistrement' },
      { status: 500 }
    )
  }
}
