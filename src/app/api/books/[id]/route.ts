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

    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        chapters: {
          where: { parentId: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            children: {
              orderBy: { sortOrder: 'asc' },
              include: {
                _count: { select: { items: true } },
              },
            },
            _count: { select: { items: true } },
          },
        },
      },
    })

    if (!book) {
      return NextResponse.json({ error: 'Livre non trouvé' }, { status: 404 })
    }

    // Get user progress for this book
    const allChapterIds = await prisma.bookChapter.findMany({
      where: { bookId: id },
      select: { id: true },
    })
    const chapterIds = allChapterIds.map((c) => c.id)

    const completedCount = await prisma.userItemProgress.count({
      where: {
        userId,
        completed: true,
        item: { chapterId: { in: chapterIds } },
      },
    })

    return NextResponse.json({
      ...book,
      userProgress: {
        completed: completedCount,
        total: book.totalItems,
        percentage: book.totalItems > 0
          ? Math.round((completedCount / book.totalItems) * 100)
          : 0,
      },
    })
  } catch (error) {
    console.error('Error fetching book:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du livre' },
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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const book = await prisma.book.update({
      where: { id },
      data: {
        title: body.title,
        titleAr: body.titleAr,
        titleEn: body.titleEn,
        author: body.author,
        authorAr: body.authorAr,
        type: body.type,
        discipline: body.discipline,
      },
    })

    return NextResponse.json(book)
  } catch (error) {
    console.error('Error updating book:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du livre' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    const { id } = await params
    await prisma.book.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting book:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du livre' },
      { status: 500 }
    )
  }
}
