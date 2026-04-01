import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

async function checkAdmin() {
  const session = await auth()
  if (!session?.user?.id) return null
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })
  return user?.role === 'ADMIN' ? session.user.id : null
}

// GET — List all groups with members
export async function GET() {
  try {
    const adminId = await checkAdmin()
    if (!adminId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const groups = await prisma.group.findMany({
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          },
          orderBy: { user: { name: 'asc' } }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(groups)
  } catch (error) {
    console.error('Error fetching groups:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}

// POST — Add member to group or create group
export async function POST(request: Request) {
  try {
    const adminId = await checkAdmin()
    if (!adminId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const body = await request.json()

    // Add member to group
    if (body.action === 'addMember') {
      const { groupId, userId, role, isStudent } = body
      const existing = await prisma.groupMember.findUnique({
        where: { userId_groupId: { userId, groupId } }
      })
      if (existing) {
        return NextResponse.json({ error: 'Déjà membre de ce groupe' }, { status: 400 })
      }
      const member = await prisma.groupMember.create({
        data: {
          userId,
          groupId,
          role: role || 'MEMBER',
          isStudent: isStudent !== false,
        },
        include: { user: { select: { id: true, name: true, email: true } } }
      })
      return NextResponse.json(member)
    }

    // Remove member from group
    if (body.action === 'removeMember') {
      const { groupId, userId } = body
      await prisma.groupMember.delete({
        where: { userId_groupId: { userId, groupId } }
      })
      return NextResponse.json({ success: true })
    }

    // Update member role/isStudent
    if (body.action === 'updateMember') {
      const { groupId, userId, role, isStudent } = body
      const data: Record<string, unknown> = {}
      if (role !== undefined) data.role = role
      if (isStudent !== undefined) data.isStudent = isStudent
      const member = await prisma.groupMember.update({
        where: { userId_groupId: { userId, groupId } },
        data,
        include: { user: { select: { id: true, name: true, email: true } } }
      })
      return NextResponse.json(member)
    }

    // Create new group
    if (body.action === 'createGroup') {
      const { name } = body
      if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
      const group = await prisma.group.create({
        data: { name: name.trim() },
        include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } }
      })
      return NextResponse.json(group)
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  } catch (error) {
    console.error('Error managing groups:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
