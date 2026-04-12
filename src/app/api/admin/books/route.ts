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

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { title, titleAr, author, authorAr, discipline, type, totalPages, chapters } =
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
          isSystem: true,
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

    return NextResponse.json(book, { status: 201 })
  } catch (error) {
    console.error('Error creating admin book:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du livre' },
      { status: 500 }
    )
  }
}
