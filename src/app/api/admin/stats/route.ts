import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Vérifier le rôle admin ou manager
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!currentUser || !['ADMIN', 'MANAGER'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')

    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    // Get users to analyze (filtered by group if specified)
    let userIds: string[] = []

    if (groupId) {
      const groupMembers = await prisma.groupMember.findMany({
        where: { groupId },
        select: { userId: true }
      })
      userIds = groupMembers.map(m => m.userId)
    } else {
      const users = await prisma.user.findMany({
        where: { role: { not: 'ADMIN' } },
        select: { id: true }
      })
      userIds = users.map(u => u.id)
    }

    // Get memorization program
    const memorizationProgram = await prisma.program.findFirst({
      where: { code: 'MEMORIZATION' }
    })

    // Build user stats
    const userStats = await Promise.all(
      userIds.map(async (userId) => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true }
        })

        if (!user) return null

        // Get memorization progress
        const memorizationEntries = await prisma.progress.findMany({
          where: {
            userId,
            program: { code: 'MEMORIZATION' }
          },
          include: { program: true }
        })

        // Calculate unique memorized verses
        const memorizedVerses = new Set<string>()
        for (const entry of memorizationEntries) {
          for (let v = entry.verseStart; v <= entry.verseEnd; v++) {
            memorizedVerses.add(`${entry.surahNumber}:${v}`)
          }
        }
        const totalMemorizedVerses = memorizedVerses.size
        const totalPages = Math.round(totalMemorizedVerses / 15)

        // Get daily logs for attendance
        const dailyLogs = await prisma.dailyLog.findMany({
          where: {
            userId,
            date: { gte: startOfYear }
          },
          select: { date: true }
        })

        // Calculate active weeks
        const activeWeeks = new Set<string>()
        dailyLogs.forEach(log => {
          const date = new Date(log.date)
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          activeWeeks.add(weekStart.toISOString().split('T')[0])
        })

        const totalWeeksSinceYearStart = Math.ceil(
          (now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000)
        )

        const attendanceRate = totalWeeksSinceYearStart > 0
          ? Math.round((activeWeeks.size / totalWeeksSinceYearStart) * 100)
          : 0

        // Calculate trend (compare last 2 weeks)
        const twoWeeksAgo = new Date(now)
        twoWeeksAgo.setDate(now.getDate() - 14)
        const oneWeekAgo = new Date(now)
        oneWeekAgo.setDate(now.getDate() - 7)

        const logsLastWeek = await prisma.dailyLog.count({
          where: {
            userId,
            date: { gte: oneWeekAgo }
          }
        })

        const logsPreviousWeek = await prisma.dailyLog.count({
          where: {
            userId,
            date: { gte: twoWeeksAgo, lt: oneWeekAgo }
          }
        })

        let trend: 'up' | 'stable' | 'down' = 'stable'
        if (logsLastWeek > logsPreviousWeek) trend = 'up'
        else if (logsLastWeek < logsPreviousWeek) trend = 'down'

        // Determine status
        let status: 'active' | 'medium' | 'alert' = 'active'
        if (attendanceRate < 30) status = 'alert'
        else if (attendanceRate < 60) status = 'medium'

        // Check if inactive (no logs in last 2 weeks)
        const recentLogs = await prisma.dailyLog.count({
          where: {
            userId,
            date: { gte: twoWeeksAgo }
          }
        })

        return {
          id: userId,
          name: user.name || user.email?.split('@')[0] || 'Utilisateur',
          email: user.email,
          totalPages,
          totalVerses: totalMemorizedVerses,
          attendanceRate,
          activeWeeksCount: activeWeeks.size,
          trend,
          status,
          isInactive: recentLogs === 0
        }
      })
    )

    // Filter out nulls and sort by pages (descending)
    const validStats = userStats
      .filter(Boolean)
      .sort((a, b) => (b?.totalPages || 0) - (a?.totalPages || 0))

    // Calculate global attendance
    const totalAttendance = validStats.reduce((sum, u) => sum + (u?.attendanceRate || 0), 0)
    const globalAttendanceRate = validStats.length > 0
      ? Math.round(totalAttendance / validStats.length)
      : 0

    // Count inactive users
    const inactiveUsersCount = validStats.filter(u => u?.isInactive).length

    // Get available groups
    const groups = await prisma.group.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })

    // Login stats
    const now7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const now30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const lastLoginsByUser = await prisma.loginLog.groupBy({
      by: ['userId'],
      where: { success: true, userId: { not: null } },
      _max: { createdAt: true },
      _count: true,
    })

    const lastLogins: Record<string, string> = {}
    const loginCounts: Record<string, number> = {}
    let activeCount = 0
    let mediumCount = 0
    let inactiveLoginCount = 0

    for (const entry of lastLoginsByUser) {
      if (!entry.userId) continue
      const lastDate = entry._max.createdAt!
      lastLogins[entry.userId] = lastDate.toISOString()
      loginCounts[entry.userId] = entry._count
      if (lastDate > now7d) activeCount++
      else if (lastDate > now30d) mediumCount++
      else inactiveLoginCount++
    }

    const usersWithLogins = new Set(lastLoginsByUser.map(e => e.userId).filter(Boolean))
    const allUserIds = validStats.map(u => u?.id).filter(Boolean)
    const neverConnected = allUserIds.filter(id => !usersWithLogins.has(id!)).length

    // Invitation stats
    const pendingInvites = await prisma.invitationLog.count({
      where: {
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      }
    })

    const inviteLogs = await prisma.invitationLog.findMany({
      select: { email: true, status: true, expiresAt: true },
      orderBy: { sentAt: 'desc' },
    })

    const inviteStatuses: Record<string, string> = {}
    for (const inv of inviteLogs) {
      if (!inviteStatuses[inv.email]) {
        inviteStatuses[inv.email] = inv.status === 'PENDING' && inv.expiresAt < new Date()
          ? 'EXPIRED'
          : inv.status
      }
    }

    return NextResponse.json({
      users: validStats,
      globalAttendanceRate,
      inactiveUsersCount,
      totalUsers: validStats.length,
      groups,
      loginStats: {
        activeCount,
        mediumCount,
        inactiveCount: inactiveLoginCount,
        neverConnected,
        pendingInvites,
      },
      lastLogins,
      loginCounts,
      inviteStatuses,
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    )
  }
}
