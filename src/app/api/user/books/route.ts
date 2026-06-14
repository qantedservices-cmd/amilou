import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getEffectiveUserId } from '@/lib/impersonation'
import { checkDataVisibility } from '@/lib/permissions'
import prisma from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId: effectiveUserId } = await getEffectiveUserId()
    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    let userId = effectiveUserId

    // Support viewing another user's books (for admin/referent)
    const { searchParams } = new URL(request.url)
    const requestedUserId = searchParams.get('userId')
    if (requestedUserId && requestedUserId !== userId) {
      const visibility = await checkDataVisibility(userId, requestedUserId, 'stats')
      if (!visibility.canView) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
      userId = requestedUserId
    }

    // Get personal books
    const personalBooks = await prisma.userBook.findMany({
      where: { userId },
      include: {
        book: {
          include: { _count: { select: { chapters: true } } },
        },
      },
    })

    // Get group books (via group memberships)
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    })

    const groupIds = memberships.map((m) => m.groupId)

    const groupBooks = groupIds.length > 0
      ? await prisma.groupBook.findMany({
          where: { groupId: { in: groupIds } },
          include: {
            book: {
              include: { _count: { select: { chapters: true } } },
            },
            group: { select: { id: true, name: true } },
          },
        })
      : []

    // Combine and deduplicate
    const seenBookIds = new Set<string>()
    const result: any[] = []

    for (const pb of personalBooks) {
      seenBookIds.add(pb.bookId)
      result.push({
        ...pb.book,
        source: 'personal',
        isPersonal: true,
      })
    }

    for (const gb of groupBooks) {
      if (!seenBookIds.has(gb.bookId)) {
        seenBookIds.add(gb.bookId)
        result.push({
          ...gb.book,
          source: 'group',
          groupName: gb.group.name,
          groupId: gb.group.id,
          isPersonal: false,
        })
      }
    }

    // Aggregate progress counts in 2 queries instead of 2 per book (N+1 fix)
    const allBookIds = result.map((b) => b.id)

    // 1. All chapters for all books, grouped by bookId
    const allChapters = allBookIds.length > 0
      ? await prisma.bookChapter.findMany({
          where: { bookId: { in: allBookIds } },
          select: { id: true, bookId: true },
        })
      : []

    const chapterIdsByBook = new Map<string, string[]>()
    for (const ch of allChapters) {
      const list = chapterIdsByBook.get(ch.bookId)
      if (list) list.push(ch.id)
      else chapterIdsByBook.set(ch.bookId, [ch.id])
    }

    // 2. All completed items for the user, joined with chapter
    const allChapterIds = allChapters.map((c) => c.id)
    const completedProgress = allChapterIds.length > 0
      ? await prisma.userItemProgress.findMany({
          where: {
            userId,
            completed: true,
            item: { chapterId: { in: allChapterIds } },
          },
          select: { item: { select: { chapterId: true } } },
        })
      : []

    const completedCountByChapter = new Map<string, number>()
    for (const p of completedProgress) {
      const chId = p.item?.chapterId
      if (!chId) continue
      completedCountByChapter.set(chId, (completedCountByChapter.get(chId) || 0) + 1)
    }

    for (const book of result) {
      const chapters = chapterIdsByBook.get(book.id) || []
      let completedCount = 0
      for (const chId of chapters) {
        completedCount += completedCountByChapter.get(chId) || 0
      }
      book.completedItems = completedCount
      book.percentage = book.totalItems > 0
        ? Math.round((completedCount / book.totalItems) * 100)
        : 0
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching user books:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de vos livres' },
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

    const { userId } = await getEffectiveUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { bookId } = await request.json()
    if (!bookId) {
      return NextResponse.json({ error: 'bookId requis' }, { status: 400 })
    }

    const userBook = await prisma.userBook.create({
      data: {
        userId,
        bookId,
        isPersonal: true,
      },
      include: { book: true },
    })

    return NextResponse.json(userBook, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ce livre est déjà dans votre liste' },
        { status: 409 }
      )
    }
    console.error('Error adding user book:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'ajout du livre' },
      { status: 500 }
    )
  }
}
