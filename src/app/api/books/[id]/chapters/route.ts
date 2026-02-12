import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
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

    const chapters = await prisma.bookChapter.findMany({
      where: { bookId: id, parentId: null },
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
    })

    return NextResponse.json(chapters)
  } catch (error) {
    console.error('Error fetching chapters:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des chapitres' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const chapter = await prisma.bookChapter.create({
      data: {
        bookId: id,
        parentId: body.parentId || null,
        title: body.title,
        titleAr: body.titleAr,
        titleEn: body.titleEn,
        chapterNumber: body.chapterNumber || 0,
        depth: body.depth || 0,
        totalItems: 0,
        sortOrder: body.sortOrder || 0,
      },
    })

    return NextResponse.json(chapter, { status: 201 })
  } catch (error) {
    console.error('Error creating chapter:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du chapitre' },
      { status: 500 }
    )
  }
}
