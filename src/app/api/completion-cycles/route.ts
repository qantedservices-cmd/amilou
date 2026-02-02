import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // REVISION | LECTURE | all

    const where: { userId: string; type?: string } = { userId }
    if (type && type !== 'all') {
      where.type = type
    }

    const cycles = await prisma.completionCycle.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      take: 50
    })

    // Calculate stats
    const revisionCycles = cycles.filter(c => c.type === 'REVISION')
    const lectureCycles = cycles.filter(c => c.type === 'LECTURE')

    // Average days between cycles
    const avgRevisionDays = revisionCycles.length > 1
      ? Math.round(revisionCycles.reduce((sum, c) => sum + (c.daysToComplete || 0), 0) / (revisionCycles.length - 1))
      : null

    const avgLectureDays = lectureCycles.length > 1
      ? Math.round(lectureCycles.reduce((sum, c) => sum + (c.daysToComplete || 0), 0) / (lectureCycles.length - 1))
      : null

    // Days since last cycle
    const lastRevision = revisionCycles[0]
    const lastLecture = lectureCycles[0]
    const now = new Date()

    const daysSinceRevision = lastRevision
      ? Math.floor((now.getTime() - new Date(lastRevision.completedAt).getTime()) / (24 * 60 * 60 * 1000))
      : null

    const daysSinceLecture = lastLecture
      ? Math.floor((now.getTime() - new Date(lastLecture.completedAt).getTime()) / (24 * 60 * 60 * 1000))
      : null

    return NextResponse.json({
      cycles,
      stats: {
        revision: {
          totalCycles: revisionCycles.length,
          lastDate: lastRevision?.completedAt || null,
          daysSinceLast: daysSinceRevision,
          averageDays: avgRevisionDays
        },
        lecture: {
          totalCycles: lectureCycles.length,
          lastDate: lastLecture?.completedAt || null,
          daysSinceLast: daysSinceLecture,
          averageDays: avgLectureDays
        }
      }
    })
  } catch (error) {
    console.error('Error fetching completion cycles:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des cycles' },
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

    const userId = session.user.id
    const body = await request.json()
    const { type, completedAt, notes } = body

    if (!type || !['REVISION', 'LECTURE'].includes(type)) {
      return NextResponse.json({ error: 'Type invalide (REVISION ou LECTURE)' }, { status: 400 })
    }

    if (!completedAt) {
      return NextResponse.json({ error: 'Date de complétion requise' }, { status: 400 })
    }

    // Find last cycle of same type to calculate days
    const lastCycle = await prisma.completionCycle.findFirst({
      where: { userId, type },
      orderBy: { completedAt: 'desc' }
    })

    let daysToComplete: number | null = null
    if (lastCycle) {
      const lastDate = new Date(lastCycle.completedAt)
      const newDate = new Date(completedAt)
      daysToComplete = Math.floor((newDate.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000))
    }

    const cycle = await prisma.completionCycle.create({
      data: {
        userId,
        type,
        completedAt: new Date(completedAt),
        daysToComplete,
        notes: notes || null
      }
    })

    return NextResponse.json(cycle)
  } catch (error) {
    console.error('Error creating completion cycle:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du cycle' },
      { status: 500 }
    )
  }
}
