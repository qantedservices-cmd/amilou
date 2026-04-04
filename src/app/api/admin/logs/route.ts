import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const type = searchParams.get('type') || 'all'
    const period = searchParams.get('period') || 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Period filter
    let dateFilter: Date | undefined
    if (period === 'today') {
      dateFilter = new Date()
      dateFilter.setHours(0, 0, 0, 0)
    } else if (period === '7d') {
      dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    } else if (period === '30d') {
      dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }

    type LogEntry = {
      id: string
      type: 'login' | 'login-fail' | 'invitation-sent' | 'invitation-accepted'
      date: Date
      userId: string | null
      userName: string | null
      userEmail: string
      details: Record<string, unknown>
    }

    const entries: LogEntry[] = []

    const includeLogins = type === 'all' || type === 'login' || type === 'login-fail'
    const includeInvitations = type === 'all' || type === 'invitation'

    if (includeLogins) {
      const loginWhere: any = {}
      if (userId) loginWhere.userId = userId
      if (type === 'login') loginWhere.success = true
      if (type === 'login-fail') loginWhere.success = false
      if (dateFilter) loginWhere.createdAt = { gte: dateFilter }

      const loginLogs = await prisma.loginLog.findMany({
        where: loginWhere,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      })

      for (const log of loginLogs) {
        entries.push({
          id: log.id,
          type: log.success ? 'login' : 'login-fail',
          date: log.createdAt,
          userId: log.userId,
          userName: log.user?.name || null,
          userEmail: log.email,
          details: {
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
          },
        })
      }
    }

    if (includeInvitations) {
      const inviteWhere: any = {}
      if (userId) inviteWhere.invitedBy = userId
      if (dateFilter) inviteWhere.sentAt = { gte: dateFilter }

      const inviteLogs = await prisma.invitationLog.findMany({
        where: inviteWhere,
        include: {
          inviter: { select: { id: true, name: true, email: true } },
          group: { select: { name: true } },
        },
        orderBy: { sentAt: 'desc' },
      })

      for (const inv of inviteLogs) {
        entries.push({
          id: inv.id + '-sent',
          type: 'invitation-sent',
          date: inv.sentAt,
          userId: inv.invitedBy,
          userName: inv.inviter?.name || null,
          userEmail: inv.email,
          details: {
            inviteName: inv.name,
            role: inv.role,
            groupName: inv.group?.name || null,
            status: inv.status === 'PENDING' && inv.expiresAt < new Date() ? 'EXPIRED' : inv.status,
          },
        })

        if (inv.status === 'ACCEPTED' && inv.acceptedAt) {
          entries.push({
            id: inv.id + '-accepted',
            type: 'invitation-accepted',
            date: inv.acceptedAt,
            userId: null,
            userName: inv.name,
            userEmail: inv.email,
            details: {
              role: inv.role,
              groupName: inv.group?.name || null,
            },
          })
        }
      }
    }

    // Sort by date descending
    entries.sort((a, b) => b.date.getTime() - a.date.getTime())

    // Paginate
    const total = entries.length
    const totalPages = Math.ceil(total / limit)
    const paged = entries.slice((page - 1) * limit, page * limit)

    return NextResponse.json({
      logs: paged,
      total,
      page,
      totalPages,
    })
  } catch (error) {
    console.error('Error fetching admin logs:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
