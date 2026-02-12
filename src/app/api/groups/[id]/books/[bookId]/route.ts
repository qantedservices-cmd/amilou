import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getEffectiveUserId } from '@/lib/impersonation'
import prisma from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; bookId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id: groupId, bookId } = await params
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

    // Get group members
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    })

    // Get book chapters
    const chapters = await prisma.bookChapter.findMany({
      where: { bookId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, titleAr: true, totalItems: true, depth: true, parentId: true },
    })

    const chapterIds = chapters.map((c) => c.id)
    const memberIds = members.map((m) => m.user.id)

    // Get progress for all members
    const progress = await prisma.userItemProgress.findMany({
      where: {
        userId: { in: memberIds },
        completed: true,
        item: { chapterId: { in: chapterIds } },
      },
      include: {
        item: { select: { chapterId: true } },
      },
    })

    // Build progress matrix: userId -> chapterId -> count
    const matrix: Record<string, Record<string, number>> = {}
    for (const p of progress) {
      if (!matrix[p.userId]) matrix[p.userId] = {}
      const chapId = p.item.chapterId
      matrix[p.userId][chapId] = (matrix[p.userId][chapId] || 0) + 1
    }

    // Total completed per member
    const memberProgress = members.map((m) => {
      const userProgress = matrix[m.user.id] || {}
      const totalCompleted = Object.values(userProgress).reduce((a, b) => a + b, 0)
      return {
        user: m.user,
        role: m.role,
        totalCompleted,
        chapterProgress: userProgress,
      }
    })

    return NextResponse.json({
      chapters,
      members: memberProgress,
    })
  } catch (error) {
    console.error('Error fetching group book progress:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la progression du groupe' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; bookId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id: groupId, bookId } = await params
    const { userId } = await getEffectiveUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Check REFERENT or ADMIN
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
          { error: 'Seul le référent peut retirer un livre du groupe' },
          { status: 403 }
        )
      }
    }

    await prisma.groupBook.delete({
      where: { groupId_bookId: { groupId, bookId } },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing book from group:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du livre du groupe' },
      { status: 500 }
    )
  }
}
