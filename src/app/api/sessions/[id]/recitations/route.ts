import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/sessions/[id]/recitations - List recitations for a session
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id: sessionId } = await params

    const recitations = await prisma.surahRecitation.findMany({
      where: { sessionId },
      include: {
        user: { select: { id: true, name: true } },
        surah: { select: { number: true, nameFr: true, nameAr: true, totalVerses: true } }
      },
      orderBy: [
        { userId: 'asc' },
        { surahNumber: 'desc' }
      ]
    })

    return NextResponse.json(recitations)
  } catch (error) {
    console.error('Error fetching recitations:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des récitations' },
      { status: 500 }
    )
  }
}

// POST /api/sessions/[id]/recitations - Add recitation(s) to a session
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id: sessionId } = await params
    const body = await request.json()

    // Support both single recitation and array of recitations
    const recitations = Array.isArray(body) ? body : [body]

    // Validate session exists
    const groupSession = await prisma.groupSession.findUnique({
      where: { id: sessionId },
      include: { group: true }
    })

    if (!groupSession) {
      return NextResponse.json({ error: 'Séance non trouvée' }, { status: 404 })
    }

    const createdRecitations = []

    for (const rec of recitations) {
      const { userId, surahNumber, type, verseStart, verseEnd, status, comment } = rec

      if (!userId || !surahNumber || !verseStart || !verseEnd || !status) {
        continue // Skip invalid entries
      }

      // Get surah info for validation
      const surah = await prisma.surah.findUnique({
        where: { number: surahNumber }
      })

      if (!surah) continue

      // Create recitation
      const recitation = await prisma.surahRecitation.create({
        data: {
          sessionId,
          userId,
          surahNumber,
          type: type || 'MEMORIZATION',
          verseStart,
          verseEnd: Math.min(verseEnd, surah.totalVerses),
          status,
          comment,
          createdBy: session.user.id,
        },
        include: {
          user: { select: { id: true, name: true } },
          surah: { select: { number: true, nameFr: true, nameAr: true, totalVerses: true } }
        }
      })

      createdRecitations.push(recitation)

      // Update SurahMastery if status is VALIDATED or better
      if (status === 'VALIDATED' || status === 'KNOWN') {
        await prisma.surahMastery.upsert({
          where: {
            userId_surahNumber: { userId, surahNumber }
          },
          update: {
            status,
            validatedWeek: groupSession.weekNumber,
            validatedAt: groupSession.date,
            verseStart,
            verseEnd: Math.min(verseEnd, surah.totalVerses),
            updatedAt: new Date()
          },
          create: {
            userId,
            surahNumber,
            status,
            validatedWeek: groupSession.weekNumber,
            validatedAt: groupSession.date,
            verseStart,
            verseEnd: Math.min(verseEnd, surah.totalVerses),
          }
        })
      } else if (status === 'AM' || status === 'PARTIAL') {
        // Only create/update if no existing VALIDATED status
        const existing = await prisma.surahMastery.findUnique({
          where: { userId_surahNumber: { userId, surahNumber } }
        })

        if (!existing || (existing.status !== 'VALIDATED' && existing.status !== 'KNOWN')) {
          await prisma.surahMastery.upsert({
            where: {
              userId_surahNumber: { userId, surahNumber }
            },
            update: {
              status,
              verseStart,
              verseEnd: Math.min(verseEnd, surah.totalVerses),
              updatedAt: new Date()
            },
            create: {
              userId,
              surahNumber,
              status,
              verseStart,
              verseEnd: Math.min(verseEnd, surah.totalVerses),
            }
          })
        }
      }
    }

    return NextResponse.json(createdRecitations, { status: 201 })
  } catch (error) {
    console.error('Error creating recitations:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création des récitations' },
      { status: 500 }
    )
  }
}
