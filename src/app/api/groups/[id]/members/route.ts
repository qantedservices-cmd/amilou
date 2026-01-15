import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

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
    const { email, role } = await request.json()

    // Check if user is admin of this group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: session.user.id,
        role: 'ADMIN',
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Vous devez être administrateur pour ajouter des membres' },
        { status: 403 }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé avec cet email' },
        { status: 404 }
      )
    }

    // Check if already a member
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: user.id,
      },
    })

    if (existingMember) {
      return NextResponse.json(
        { error: 'Cet utilisateur est déjà membre du groupe' },
        { status: 400 }
      )
    }

    const member = await prisma.groupMember.create({
      data: {
        groupId: id,
        userId: user.id,
        role: role || 'MEMBER',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json(member)
  } catch (error) {
    console.error('Error adding member:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'ajout du membre' },
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

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({ error: 'ID du membre requis' }, { status: 400 })
    }

    // Check if user is admin of this group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: session.user.id,
        role: 'ADMIN',
      },
    })

    // Allow user to remove themselves
    const isSelf = memberId === session.user.id

    if (!membership && !isSelf) {
      return NextResponse.json(
        { error: 'Vous devez être administrateur pour retirer des membres' },
        { status: 403 }
      )
    }

    await prisma.groupMember.deleteMany({
      where: {
        groupId: id,
        userId: memberId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing member:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du membre' },
      { status: 500 }
    )
  }
}
