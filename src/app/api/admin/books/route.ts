import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

interface ChapterInput {
  title: string
  titleAr?: string
  pageStart?: number
  pageEnd?: number
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    // Any authenticated user can create books

    const { title, titleAr, author, authorAr, discipline, type, totalPages, chapters, groupId } =
      await request.json()

    if (!title || !totalPages || totalPages < 1) {
      return NextResponse.json(
        { error: 'Titre et nombre de pages requis' },
        { status: 400 }
      )
    }

    const book = await prisma.$transaction(async (tx) => {
      const newBook = await tx.book.create({
        data: {
          title,
          titleAr: titleAr || null,
          author: author || null,
          authorAr: authorAr || null,
          discipline: discipline || 'GENERAL',
          type: type || 'MATN',
          source: 'MANUAL',
          totalItems: totalPages,
          isSystem: user?.role === 'ADMIN',
          sortOrder: 0,
        },
      })

      const chaptersToCreate: ChapterInput[] =
        chapters && chapters.length > 0
          ? chapters
          : [{ title, titleAr: titleAr || undefined, pageStart: 1, pageEnd: totalPages }]

      for (let i = 0; i < chaptersToCreate.length; i++) {
        const ch = chaptersToCreate[i]
        const pageStart = ch.pageStart || 1
        const pageEnd = ch.pageEnd || totalPages
        const chapterPageCount = Math.max(1, pageEnd - pageStart + 1)

        const chapter = await tx.bookChapter.create({
          data: {
            bookId: newBook.id,
            title: ch.title || title,
            titleAr: ch.titleAr || null,
            chapterNumber: i + 1,
            depth: 0,
            totalItems: chapterPageCount,
            sortOrder: i,
          },
        })

        const items = []
        for (let p = pageStart; p <= pageEnd; p++) {
          items.push({
            chapterId: chapter.id,
            itemNumber: p,
            title: `Page ${p}`,
          })
        }

        if (items.length > 0) {
          await tx.bookItem.createMany({ data: items })
        }
      }

      return newBook
    })

    // If groupId provided, assign book to group
    if (groupId) {
      await prisma.groupBook.create({
        data: {
          groupId,
          bookId: book.id,
          assignedBy: session.user.id,
        },
      })
    }

    // If no groupId and user is not ADMIN, add to personal books
    if (!groupId && user?.role !== 'ADMIN') {
      await prisma.userBook.create({
        data: {
          userId: session.user.id,
          bookId: book.id,
          isPersonal: true,
        },
      })
    }

    return NextResponse.json(book, { status: 201 })
  } catch (error) {
    console.error('Error creating admin book:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du livre' },
      { status: 500 }
    )
  }
}
