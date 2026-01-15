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
    const progressId = searchParams.get('progressId')
    const userId = searchParams.get('userId')

    const where: Record<string, unknown> = {}

    if (progressId) {
      where.progressId = progressId
    }

    if (userId) {
      where.evaluatedId = userId
    } else {
      // By default, show evaluations where user is evaluated or evaluator
      where.OR = [
        { evaluatedId: session.user.id },
        { evaluatorId: session.user.id },
      ]
    }

    const evaluations = await prisma.evaluation.findMany({
      where,
      include: {
        progress: {
          include: {
            program: true,
            surah: true,
          },
        },
        evaluator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        evaluated: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        surah: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(evaluations)
  } catch (error) {
    console.error('Error fetching evaluations:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des évaluations' },
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

    const { progressId, evaluatedId, surahNumber, verseNumber, comment, rating } = await request.json()

    if (!progressId || !evaluatedId || !surahNumber || !verseNumber || !comment) {
      return NextResponse.json({ error: 'Données incomplètes' }, { status: 400 })
    }

    // Verify progress entry exists
    const progress = await prisma.progress.findUnique({
      where: { id: progressId },
    })

    if (!progress) {
      return NextResponse.json({ error: 'Entrée de progression non trouvée' }, { status: 404 })
    }

    // Verify verse is within the progress range
    if (progress.surahNumber !== surahNumber ||
        verseNumber < progress.verseStart ||
        verseNumber > progress.verseEnd) {
      return NextResponse.json(
        { error: 'Le verset n\'est pas dans la plage de progression' },
        { status: 400 }
      )
    }

    const evaluation = await prisma.evaluation.create({
      data: {
        progressId,
        evaluatorId: session.user.id,
        evaluatedId,
        surahNumber,
        verseNumber,
        comment,
        rating: rating || null,
      },
      include: {
        progress: {
          include: {
            program: true,
            surah: true,
          },
        },
        evaluator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        evaluated: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        surah: true,
      },
    })

    return NextResponse.json(evaluation)
  } catch (error) {
    console.error('Error creating evaluation:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'évaluation' },
      { status: 500 }
    )
  }
}
