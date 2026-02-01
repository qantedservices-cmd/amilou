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

    const groupSession = await prisma.groupSession.findUnique({
      where: { id },
      include: {
        group: true,
        attendance: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        recitations: {
          include: {
            user: { select: { id: true, name: true } },
            surah: { select: { number: true, nameFr: true, nameAr: true, totalVerses: true } }
          },
          orderBy: [
            { userId: 'asc' },
            { surahNumber: 'desc' }
          ]
        },
      },
    })

    if (!groupSession) {
      return NextResponse.json({ error: 'Séance non trouvée' }, { status: 404 })
    }

    // Check if user is member of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: groupSession.groupId,
        userId: session.user.id,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    return NextResponse.json({ ...groupSession, myRole: membership.role })
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la séance' },
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

    const { id } = await params
    const { attendance, notes } = await request.json()

    const groupSession = await prisma.groupSession.findUnique({
      where: { id },
      select: { groupId: true },
    })

    if (!groupSession) {
      return NextResponse.json({ error: 'Séance non trouvée' }, { status: 404 })
    }

    // Check if user is global admin or group admin/referent
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    const isGlobalAdmin = currentUser?.role === 'ADMIN'

    if (!isGlobalAdmin) {
      const membership = await prisma.groupMember.findFirst({
        where: {
          groupId: groupSession.groupId,
          userId: session.user.id,
          role: { in: ['ADMIN', 'REFERENT'] },
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: 'Vous devez être administrateur ou référent pour modifier la séance' },
          { status: 403 }
        )
      }
    }

    // Update session notes if provided
    if (notes !== undefined) {
      await prisma.groupSession.update({
        where: { id },
        data: { notes },
      })
    }

    // Update attendance records
    if (attendance && Array.isArray(attendance)) {
      for (const att of attendance) {
        await prisma.sessionAttendance.updateMany({
          where: {
            sessionId: id,
            userId: att.userId,
          },
          data: {
            present: att.present ?? false,
            excused: att.excused ?? false,
            note: att.note,
          },
        })
      }
    }

    // Fetch updated session
    const updated = await prisma.groupSession.findUnique({
      where: { id },
      include: {
        group: true,
        attendance: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la séance' },
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

    const groupSession = await prisma.groupSession.findUnique({
      where: { id },
      select: { groupId: true },
    })

    if (!groupSession) {
      return NextResponse.json({ error: 'Séance non trouvée' }, { status: 404 })
    }

    // Check if user is admin
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: groupSession.groupId,
        userId: session.user.id,
        role: 'ADMIN',
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Vous devez être administrateur pour supprimer une séance' },
        { status: 403 }
      )
    }

    await prisma.groupSession.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la séance' },
      { status: 500 }
    )
  }
}
