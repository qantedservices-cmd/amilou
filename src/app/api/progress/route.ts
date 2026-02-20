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
    const programId = searchParams.get('programId')
    const userId = searchParams.get('userId')
    const limitParam = parseInt(searchParams.get('limit') || '100')
    const limit = Math.min(Math.max(limitParam, 1), 1000) // Bounds: 1-1000

    // Support impersonation
    const { userId: effectiveUserId, isImpersonating } = await getEffectiveUserId()

    // Get current user to check if admin
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    const isAdmin = currentUser?.role === 'ADMIN'

    // Build where clause
    const where: Record<string, unknown> = {}

    if (isImpersonating) {
      // When impersonating, show the impersonated user's data
      where.userId = effectiveUserId
    } else if (isAdmin) {
      // Admin can see all or filter by user
      if (userId && userId !== 'all') {
        where.userId = userId
      }
    } else {
      // Regular users only see their own data
      where.userId = session.user.id
    }

    if (programId && programId !== 'all') {
      where.programId = programId
    }

    const progress = await prisma.progress.findMany({
      where,
      include: {
        program: true,
        surah: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
      orderBy: { date: 'desc' },
      take: limit,
    })

    return NextResponse.json(progress)
  } catch (error) {
    console.error('Error fetching progress:', error)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'avancement" },
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

    const { programId, date, surahNumber, verseStart, verseEnd, repetitions, comment, userId } = await request.json()

    if (!programId || !surahNumber || !verseStart || !verseEnd) {
      return NextResponse.json(
        { error: 'Données incomplètes' },
        { status: 400 }
      )
    }

    // Check if admin and userId provided
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    const isAdmin = currentUser?.role === 'ADMIN'
    const targetUserId = (isAdmin && userId) ? userId : session.user.id

    // Verify surah exists and verse range is valid
    const surah = await prisma.surah.findUnique({
      where: { number: surahNumber },
    })

    if (!surah) {
      return NextResponse.json({ error: 'Sourate non trouvée' }, { status: 400 })
    }

    if (verseStart < 1 || verseEnd > surah.totalVerses || verseStart > verseEnd) {
      return NextResponse.json(
        { error: `Versets invalides. La sourate ${surah.nameFr} a ${surah.totalVerses} versets.` },
        { status: 400 }
      )
    }

    const progress = await prisma.progress.create({
      data: {
        userId: targetUserId,
        programId,
        date: date ? new Date(date) : new Date(),
        surahNumber,
        verseStart,
        verseEnd,
        repetitions,
        comment,
        createdBy: session.user.id,
      },
      include: {
        program: true,
        surah: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
    })

    return NextResponse.json(progress)
  } catch (error) {
    console.error('Error creating progress:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement de l'avancement" },
      { status: 500 }
    )
  }
}
