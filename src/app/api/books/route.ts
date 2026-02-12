import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getEffectiveUserId } from '@/lib/impersonation'
import prisma from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const discipline = searchParams.get('discipline')
    const type = searchParams.get('type')
    const collectionId = searchParams.get('collectionId')
    const search = searchParams.get('search')

    const where: any = {}
    if (discipline) where.discipline = discipline
    if (type) where.type = type
    if (collectionId) where.collectionId = collectionId
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { titleAr: { contains: search } },
        { author: { contains: search, mode: 'insensitive' } },
      ]
    }

    const books = await prisma.book.findMany({
      where,
      orderBy: [{ collectionLevel: 'asc' }, { sortOrder: 'asc' }],
      include: {
        _count: {
          select: { chapters: true },
        },
      },
    })

    return NextResponse.json(books)
  } catch (error) {
    console.error('Error fetching books:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des livres' },
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

    // Only ADMIN can create system books
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const body = await request.json()
    const { title, titleAr, titleEn, author, authorAr, type, discipline, source } = body

    if (!title || !type) {
      return NextResponse.json(
        { error: 'Titre et type requis' },
        { status: 400 }
      )
    }

    const book = await prisma.book.create({
      data: {
        title,
        titleAr,
        titleEn,
        author,
        authorAr,
        type,
        discipline: discipline || 'GENERAL',
        source: source || 'MANUAL',
        isSystem: user?.role === 'ADMIN',
        totalItems: 0,
        sortOrder: 0,
      },
    })

    return NextResponse.json(book, { status: 201 })
  } catch (error) {
    console.error('Error creating book:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du livre' },
      { status: 500 }
    )
  }
}
