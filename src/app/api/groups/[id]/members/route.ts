import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'

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
    const { email, name, role } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    // Check if user is admin or referent of this group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: session.user.id,
        role: { in: ['ADMIN', 'REFERENT'] },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Vous devez être administrateur ou référent pour ajouter des membres' },
        { status: 403 }
      )
    }

    // Find or create user by email
    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    })

    if (!user) {
      // Create the user with a default password
      const defaultPassword = await bcrypt.hash('changeme123', 12)
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          password: defaultPassword,
        },
        select: { id: true, name: true, email: true },
      })
    } else if (name && !user.name) {
      // Update name if user exists but has no name
      await prisma.user.update({
        where: { id: user.id },
        data: { name },
      })
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

// PATCH: Toggle isActive (activate/deactivate) - ADMIN or REFERENT
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const { memberId, isActive } = await request.json()

    if (!memberId || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'memberId et isActive requis' }, { status: 400 })
    }

    // Check if user is admin or referent of this group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: session.user.id,
        role: { in: ['ADMIN', 'REFERENT'] },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Vous devez être administrateur ou référent pour modifier les membres' },
        { status: 403 }
      )
    }

    // Cannot deactivate yourself
    if (memberId === session.user.id && !isActive) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas vous désactiver vous-même' },
        { status: 400 }
      )
    }

    await prisma.groupMember.updateMany({
      where: {
        groupId: id,
        userId: memberId,
      },
      data: { isActive },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error toggling member:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la modification du membre' },
      { status: 500 }
    )
  }
}

// DELETE: Remove member permanently - ADMIN only (or self-removal)
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

    // Allow user to remove themselves
    const isSelf = memberId === session.user.id

    if (!isSelf) {
      // Only ADMIN can delete members
      const membership = await prisma.groupMember.findFirst({
        where: {
          groupId: id,
          userId: session.user.id,
          role: 'ADMIN',
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: 'Seul un administrateur peut supprimer des membres' },
          { status: 403 }
        )
      }
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
