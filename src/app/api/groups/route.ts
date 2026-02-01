import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Check if user is ADMIN
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    const isAdmin = currentUser?.role === 'ADMIN'

    // Get groups where user is a member (or all groups if admin)
    if (isAdmin) {
      // Admin sees all groups
      const allGroups = await prisma.group.findMany({
        include: {
          members: {
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
          },
          _count: {
            select: { members: true },
          },
        },
      })

      const groups = allGroups.map(group => {
        const myMembership = group.members.find(m => m.userId === session.user.id)
        return {
          ...group,
          myRole: myMembership?.role || 'ADMIN',
          memberCount: group._count.members,
        }
      })

      return NextResponse.json(groups)
    }

    // Non-admin: only groups where user is member
    const memberships = await prisma.groupMember.findMany({
      where: { userId: session.user.id },
      include: {
        group: {
          include: {
            members: {
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
            },
            _count: {
              select: { members: true },
            },
          },
        },
      },
    })

    const groups = memberships.map(m => ({
      ...m.group,
      myRole: m.role,
      memberCount: m.group._count.members,
    }))

    return NextResponse.json(groups)
  } catch (error) {
    console.error('Error fetching groups:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des groupes' },
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

    const { name, description, sessionFrequency } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Nom du groupe requis' }, { status: 400 })
    }

    // Create group and add creator as admin
    const group = await prisma.group.create({
      data: {
        name,
        description,
        sessionFrequency: sessionFrequency || 'WEEKLY',
        members: {
          create: {
            userId: session.user.id,
            role: 'ADMIN',
          },
        },
      },
      include: {
        members: {
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
        },
        _count: {
          select: { members: true },
        },
      },
    })

    return NextResponse.json({
      ...group,
      myRole: 'ADMIN',
      memberCount: group._count.members,
    })
  } catch (error) {
    console.error('Error creating group:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du groupe' },
      { status: 500 }
    )
  }
}
