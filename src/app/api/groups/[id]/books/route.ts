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

    const { id: groupId } = await params
    const { userId } = await getEffectiveUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Verify membership
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })

    if (user?.role !== 'ADMIN') {
      const membership = await prisma.groupMember.findFirst({
        where: { groupId, userId },
      })
      if (!membership) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
    }

    const groupBooks = await prisma.groupBook.findMany({
      where: { groupId },
      include: {
        book: {
          include: {
            _count: { select: { chapters: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(groupBooks)
  } catch (error) {
    console.error('Error fetching group books:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des livres du groupe' },
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

    const { id: groupId } = await params
    const { userId } = await getEffectiveUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Check REFERENT or ADMIN role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })

    if (user?.role !== 'ADMIN') {
      const membership = await prisma.groupMember.findFirst({
        where: { groupId, userId, role: 'REFERENT' },
      })
      if (!membership) {
        return NextResponse.json(
          { error: 'Seul le référent peut assigner des livres' },
          { status: 403 }
        )
      }
    }

    const { bookId, isRequired } = await request.json()

    if (!bookId) {
      return NextResponse.json({ error: 'bookId requis' }, { status: 400 })
    }

    const groupBook = await prisma.groupBook.create({
      data: {
        groupId,
        bookId,
        assignedBy: userId,
        isRequired: isRequired || false,
      },
      include: { book: true },
    })

    return NextResponse.json(groupBook, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ce livre est déjà assigné à ce groupe' },
        { status: 409 }
      )
    }
    console.error('Error assigning book to group:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'assignation du livre' },
      { status: 500 }
    )
  }
}
