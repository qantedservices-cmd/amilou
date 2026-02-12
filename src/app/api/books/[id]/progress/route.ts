import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getEffectiveUserId } from '@/lib/impersonation'
import prisma from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const { userId } = await getEffectiveUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Get all chapters for this book
    const chapters = await prisma.bookChapter.findMany({
      where: { bookId: id },
      select: { id: true, totalItems: true, parentId: true },
    })

    const chapterIds = chapters.map((c) => c.id)

    // Get completed items per chapter
    const progressByChapter = await prisma.userItemProgress.groupBy({
      by: ['itemId'],
      where: {
        userId,
        completed: true,
        item: { chapterId: { in: chapterIds } },
      },
    })

    // Map item to chapter
    const completedItemIds = progressByChapter.map((p) => p.itemId)
    const completedItems = completedItemIds.length > 0
      ? await prisma.bookItem.findMany({
          where: { id: { in: completedItemIds } },
          select: { id: true, chapterId: true },
        })
      : []

    const chapterCompletionMap: Record<string, number> = {}
    for (const item of completedItems) {
      chapterCompletionMap[item.chapterId] =
        (chapterCompletionMap[item.chapterId] || 0) + 1
    }

    const totalCompleted = completedItems.length
    const book = await prisma.book.findUnique({
      where: { id },
      select: { totalItems: true },
    })

    return NextResponse.json({
      totalCompleted,
      totalItems: book?.totalItems || 0,
      percentage: book?.totalItems
        ? Math.round((totalCompleted / book.totalItems) * 100)
        : 0,
      chapterProgress: chapterCompletionMap,
    })
  } catch (error) {
    console.error('Error fetching progress:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la progression' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId } = await getEffectiveUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { itemIds, completed, notes, rating } = body

    if (!itemIds || !Array.isArray(itemIds)) {
      return NextResponse.json(
        { error: 'itemIds requis (tableau)' },
        { status: 400 }
      )
    }

    const now = new Date()
    const results = []

    for (const itemId of itemIds) {
      const result = await prisma.userItemProgress.upsert({
        where: {
          userId_itemId: { userId, itemId },
        },
        create: {
          userId,
          itemId,
          completed: completed ?? true,
          completedAt: completed !== false ? now : null,
          notes: notes || null,
          rating: rating || null,
        },
        update: {
          completed: completed ?? true,
          completedAt: completed !== false ? now : null,
          ...(notes !== undefined ? { notes } : {}),
          ...(rating !== undefined ? { rating } : {}),
        },
      })
      results.push(result)
    }

    return NextResponse.json({ updated: results.length })
  } catch (error) {
    console.error('Error updating progress:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la progression' },
      { status: 500 }
    )
  }
}
