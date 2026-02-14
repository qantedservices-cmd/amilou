import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId } = await getEffectiveUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const threshold = parseInt(searchParams.get('threshold') || '7')

    // Check if user is ADMIN or REFERENT
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    })

    const isAdmin = user?.role === 'ADMIN'

    // Get groups where user is referent
    const referentGroups = await prisma.groupMember.findMany({
      where: {
        userId,
        role: { in: ['REFERENT', 'ADMIN'] }
      },
      include: {
        group: { select: { id: true, name: true } }
      }
    })

    if (!isAdmin && referentGroups.length === 0) {
      return NextResponse.json([])
    }

    // Get members of managed groups
    const groupIds = isAdmin
      ? (await prisma.group.findMany({ select: { id: true } })).map(g => g.id)
      : referentGroups.map(g => g.groupId)

    const groupMembers = await prisma.groupMember.findMany({
      where: { groupId: { in: groupIds } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        group: { select: { name: true } }
      }
    })

    // Deduplicate users and track their groups
    const userGroups = new Map<string, { name: string; email: string; groupName: string }>()
    for (const member of groupMembers) {
      if (member.userId === userId) continue // Skip self
      if (!userGroups.has(member.userId)) {
        userGroups.set(member.userId, {
          name: member.user.name || member.user.email,
          email: member.user.email,
          groupName: member.group.name
        })
      }
    }

    const now = new Date()
    const results: Array<{
      userId: string
      name: string
      daysSinceActivity: number
      lastActivityDate: string | null
      groupName: string
    }> = []

    for (const [memberId, info] of userGroups) {
      // Find most recent activity across ALL relevant tables
      const [lastCompletion, lastProgress, lastAttendance, lastMastery, lastRecitation, lastSession] = await Promise.all([
        prisma.dailyProgramCompletion.findFirst({
          where: { userId: memberId },
          orderBy: { date: 'desc' },
          select: { date: true }
        }),
        prisma.progress.findFirst({
          where: { userId: memberId },
          orderBy: { date: 'desc' },
          select: { date: true }
        }),
        prisma.dailyAttendance.findFirst({
          where: { userId: memberId },
          orderBy: { date: 'desc' },
          select: { date: true }
        }),
        prisma.surahMastery.findFirst({
          where: { userId: memberId },
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true }
        }),
        prisma.surahRecitation.findFirst({
          where: { userId: memberId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true }
        }),
        prisma.sessionAttendance.findFirst({
          where: { userId: memberId, present: true },
          include: { session: { select: { date: true } } },
          orderBy: { session: { date: 'desc' } }
        })
      ])

      const dates: Date[] = []
      if (lastCompletion?.date) dates.push(new Date(lastCompletion.date))
      if (lastProgress?.date) dates.push(new Date(lastProgress.date))
      if (lastAttendance?.date) dates.push(new Date(lastAttendance.date))
      if (lastMastery?.updatedAt) dates.push(new Date(lastMastery.updatedAt))
      if (lastRecitation?.createdAt) dates.push(new Date(lastRecitation.createdAt))
      if (lastSession?.session?.date) dates.push(new Date(lastSession.session.date))

      const lastActivity = dates.length > 0
        ? new Date(Math.max(...dates.map(d => d.getTime())))
        : null

      const daysSince = lastActivity
        ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
        : 999

      if (daysSince >= threshold) {
        results.push({
          userId: memberId,
          name: info.name,
          daysSinceActivity: daysSince,
          lastActivityDate: lastActivity ? lastActivity.toISOString() : null,
          groupName: info.groupName
        })
      }
    }

    // Sort by daysSinceActivity descending
    results.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching inactive students:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des alertes' },
      { status: 500 }
    )
  }
}
