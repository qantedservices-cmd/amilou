import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const programId = searchParams.get('programId')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = { userId: session.user.id }
    if (programId) {
      where.programId = programId
    }

    const progress = await prisma.progress.findMany({
      where,
      include: {
        program: true,
        surah: true,
      },
      orderBy: { date: 'desc' },
      take: limit,
    })

    return NextResponse.json(progress)
  } catch (error) {
    console.error('Error fetching progress:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'avancement' },
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

    const { programId, date, surahNumber, verseStart, verseEnd, repetitions, comment } = await request.json()

    if (!programId || !surahNumber || !verseStart || !verseEnd) {
      return NextResponse.json(
        { error: 'Données incomplètes' },
        { status: 400 }
      )
    }

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
        userId: session.user.id,
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
      },
    })

    return NextResponse.json(progress)
  } catch (error) {
    console.error('Error creating progress:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'enregistrement de l\'avancement' },
      { status: 500 }
    )
  }
}
