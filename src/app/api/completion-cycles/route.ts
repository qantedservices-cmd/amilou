import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// Helper function to recalculate daysToComplete for all cycles of a type in chronological order
async function recalculateDaysToComplete(userId: string, type: string) {
  const cycles = await prisma.completionCycle.findMany({
    where: { userId, type },
    orderBy: { completedAt: 'asc' } // Chronological order
  })

  for (let i = 0; i < cycles.length; i++) {
    let daysToComplete: number | null = null
    if (i > 0) {
      const prevDate = new Date(cycles[i - 1].completedAt)
      const currDate = new Date(cycles[i].completedAt)
      daysToComplete = Math.floor((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000))
    }

    if (cycles[i].daysToComplete !== daysToComplete) {
      await prisma.completionCycle.update({
        where: { id: cycles[i].id },
        data: { daysToComplete }
      })
    }
  }
}

// Helper function to calculate hizbCount from memorization progress
async function calculateHizbCount(userId: string, completedAt: Date): Promise<number | null> {
  // Get user's memorization settings
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      memorizationStartSurah: true,
      memorizationStartVerse: true,
      memorizationDirection: true
    }
  })

  // Get the MEMORIZATION program
  const memorizationProgram = await prisma.program.findFirst({
    where: { code: 'MEMORIZATION' }
  })

  if (!memorizationProgram) return null

  // Find the last memorization entry before or on the cycle date
  const lastMemorization = await prisma.progress.findFirst({
    where: {
      userId,
      programId: memorizationProgram.id,
      date: { lte: completedAt }
    },
    orderBy: [
      { date: 'desc' },
      { surahNumber: 'desc' },
      { verseEnd: 'desc' }
    ]
  })

  if (!lastMemorization) return null

  // Get the hizb for the last memorized verse
  const verse = await prisma.verse.findUnique({
    where: {
      surahNumber_verseNumber: {
        surahNumber: lastMemorization.surahNumber,
        verseNumber: lastMemorization.verseEnd
      }
    }
  })

  if (!verse?.hizb) return null

  // Round up to include the full hizb if at the beginning of a hizb
  const currentHizb = Math.ceil(verse.hizb)

  // Calculate hizb count based on direction
  const startSurah = user?.memorizationStartSurah || 1
  const startVerse = user?.memorizationStartVerse || 1
  const direction = user?.memorizationDirection || 'FORWARD'

  // Get the hizb for the start position
  const startVerseData = await prisma.verse.findUnique({
    where: {
      surahNumber_verseNumber: {
        surahNumber: startSurah,
        verseNumber: startVerse
      }
    }
  })

  const startHizb = startVerseData?.hizb ? Math.floor(startVerseData.hizb) : 1

  if (direction === 'FORWARD') {
    // Counting from start towards An-Nas
    return currentHizb - startHizb + 1
  } else {
    // Counting from start towards Al-Fatiha (reverse)
    // In this case, start would be at a higher hizb number
    return startHizb - currentHizb + 1
  }
}

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

    // Only count positive daysToComplete for average
    const validRevisionDays = revisionCycles.filter(c => c.daysToComplete && c.daysToComplete > 0)
    const avgRevisionDays = validRevisionDays.length > 0
      ? Math.round(validRevisionDays.reduce((sum, c) => sum + (c.daysToComplete || 0), 0) / validRevisionDays.length)
      : null

    const validLectureDays = lectureCycles.filter(c => c.daysToComplete && c.daysToComplete > 0)
    const avgLectureDays = validLectureDays.length > 0
      ? Math.round(validLectureDays.reduce((sum, c) => sum + (c.daysToComplete || 0), 0) / validLectureDays.length)
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
          averageDays: avgRevisionDays,
          lastHizbCount: lastRevision?.hizbCount || null
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
    const { type, completedAt, notes, hizbCount: providedHizbCount, surahNumber, verseNumber } = body

    if (!type || !['REVISION', 'LECTURE'].includes(type)) {
      return NextResponse.json({ error: 'Type invalide (REVISION ou LECTURE)' }, { status: 400 })
    }

    if (!completedAt) {
      return NextResponse.json({ error: 'Date de complétion requise' }, { status: 400 })
    }

    let hizbCount: number | null = null

    if (type === 'REVISION') {
      if (providedHizbCount !== undefined && providedHizbCount !== null) {
        // Use provided value
        hizbCount = providedHizbCount
      } else if (surahNumber && verseNumber) {
        // Calculate from provided surah/verse
        const verse = await prisma.verse.findUnique({
          where: {
            surahNumber_verseNumber: {
              surahNumber: parseInt(surahNumber),
              verseNumber: parseInt(verseNumber)
            }
          }
        })
        if (verse?.hizb) {
          hizbCount = Math.ceil(verse.hizb)
        }
      } else {
        // Try to calculate automatically
        hizbCount = await calculateHizbCount(userId, new Date(completedAt))
      }

      // If still no hizbCount and no providedHizbCount, check if we need user input
      if (hizbCount === null && providedHizbCount === undefined) {
        // Check if there's any memorization data
        const memorizationProgram = await prisma.program.findFirst({
          where: { code: 'MEMORIZATION' }
        })

        if (memorizationProgram) {
          const hasMemorization = await prisma.progress.findFirst({
            where: { userId, programId: memorizationProgram.id }
          })

          if (!hasMemorization) {
            return NextResponse.json({
              needsMemorizationInput: true,
              message: 'Aucune donnée de mémorisation trouvée. Veuillez saisir votre position actuelle.'
            }, { status: 200 })
          }
        }
      }
    }

    // Create the cycle
    const cycle = await prisma.completionCycle.create({
      data: {
        userId,
        type,
        completedAt: new Date(completedAt),
        daysToComplete: null, // Will be recalculated
        hizbCount,
        notes: notes || null
      }
    })

    // Recalculate daysToComplete for all cycles of this type
    await recalculateDaysToComplete(userId, type)

    // Fetch the updated cycle
    const updatedCycle = await prisma.completionCycle.findUnique({
      where: { id: cycle.id }
    })

    return NextResponse.json(updatedCycle)
  } catch (error) {
    console.error('Error creating completion cycle:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du cycle' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const { id, completedAt, notes, hizbCount } = body

    if (!id) {
      return NextResponse.json({ error: 'ID du cycle requis' }, { status: 400 })
    }

    // Verify ownership
    const existingCycle = await prisma.completionCycle.findFirst({
      where: { id, userId }
    })

    if (!existingCycle) {
      return NextResponse.json({ error: 'Cycle non trouvé' }, { status: 404 })
    }

    const cycle = await prisma.completionCycle.update({
      where: { id },
      data: {
        completedAt: completedAt ? new Date(completedAt) : existingCycle.completedAt,
        notes: notes !== undefined ? (notes || null) : existingCycle.notes,
        hizbCount: hizbCount !== undefined ? hizbCount : existingCycle.hizbCount
      }
    })

    // Recalculate daysToComplete if date changed
    if (completedAt) {
      await recalculateDaysToComplete(userId, existingCycle.type)
    }

    // Fetch the updated cycle
    const updatedCycle = await prisma.completionCycle.findUnique({
      where: { id: cycle.id }
    })

    return NextResponse.json(updatedCycle)
  } catch (error) {
    console.error('Error updating completion cycle:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la modification du cycle' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID du cycle requis' }, { status: 400 })
    }

    // Verify ownership and get type for recalculation
    const existingCycle = await prisma.completionCycle.findFirst({
      where: { id, userId }
    })

    if (!existingCycle) {
      return NextResponse.json({ error: 'Cycle non trouvé' }, { status: 404 })
    }

    const cycleType = existingCycle.type

    await prisma.completionCycle.delete({
      where: { id }
    })

    // Recalculate daysToComplete for remaining cycles
    await recalculateDaysToComplete(userId, cycleType)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting completion cycle:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du cycle' },
      { status: 500 }
    )
  }
}
