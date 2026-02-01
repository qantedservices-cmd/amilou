import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
    const groupId = searchParams.get('groupId')

    // Get user's groups
    const userGroups = await prisma.groupMember.findMany({
      where: { userId: session.user.id },
      select: { groupId: true, group: { select: { name: true } } }
    })
    const groupIds = groupId ? [groupId] : userGroups.map(g => g.groupId)

    if (groupIds.length === 0) {
      return NextResponse.json({
        year,
        month,
        sessions: [],
        sessionDates: [],
        totalSessions: 0,
        members: []
      })
    }

    // Calculate date range
    let startDate: Date
    let endDate: Date

    if (month) {
      startDate = new Date(year, month - 1, 1)
      endDate = new Date(year, month, 0, 23, 59, 59)
    } else {
      startDate = new Date(year, 0, 1)
      endDate = new Date(year, 11, 31, 23, 59, 59)
    }

    // Get group members for reference
    const groupMembers = await prisma.groupMember.findMany({
      where: { groupId: { in: groupIds } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        group: { select: { id: true, name: true } }
      }
    })
    const memberUserIds = [...new Set(groupMembers.map(m => m.userId))]

    const allMembers = groupMembers
      .filter(m => m.role === 'MEMBER')
      .map(m => ({ id: m.user.id, name: m.user.name }))

    // ============================================
    // 1. GroupSession (Cours Montmagny) - BLEU
    // ============================================
    const groupSessions = await prisma.groupSession.findMany({
      where: {
        groupId: { in: groupIds },
        date: { gte: startDate, lte: endDate }
      },
      include: {
        group: { select: { id: true, name: true } },
        attendance: {
          include: { user: { select: { id: true, name: true, email: true } } }
        },
        recitations: {
          include: {
            user: { select: { id: true, name: true } },
            surah: { select: { number: true, nameFr: true, nameAr: true } }
          }
        }
      },
      orderBy: { date: 'desc' }
    })

    const sessionsFromGroup = groupSessions.map(gs => {
      const presentAttendance = gs.attendance.filter(a => a.present)
      const absentAttendance = gs.attendance.filter(a => !a.present)

      const participants = presentAttendance.map(att => {
        const userRecitations = gs.recitations.filter(r => r.userId === att.userId)
        return {
          userId: att.userId,
          userName: att.user.name || att.user.email,
          entries: userRecitations.map(r => ({
            surahNumber: r.surah.number,
            surahName: r.surah.nameFr,
            verseStart: r.verseStart,
            verseEnd: r.verseEnd,
            status: r.status,
            comment: r.comment
          }))
        }
      })

      return {
        id: gs.id,
        type: 'group' as const,
        color: '#3B82F6', // Bleu
        date: gs.date.toISOString().split('T')[0],
        weekNumber: gs.weekNumber,
        groupId: gs.groupId,
        groupName: gs.group.name,
        notes: gs.notes,
        participants,
        presentCount: presentAttendance.length,
        totalMembers: gs.attendance.length,
        absentMembers: absentAttendance.map(a => a.user.name || a.user.email),
        recitationCount: gs.recitations.length
      }
    })

    // ============================================
    // 2. Progress (Famille Amilou) - VERT
    // ============================================
    const progressEntries = await prisma.progress.findMany({
      where: {
        userId: { in: memberUserIds },
        date: { gte: startDate, lte: endDate }
      },
      include: {
        user: { select: { id: true, name: true } },
        surah: { select: { number: true, nameFr: true, nameAr: true } },
        program: { select: { code: true, nameFr: true } }
      },
      orderBy: { date: 'desc' }
    })

    // Group Progress by date to create "sessions"
    const progressByDate: Record<string, typeof progressEntries> = {}
    for (const entry of progressEntries) {
      const dateKey = new Date(entry.date).toISOString().split('T')[0]
      if (!progressByDate[dateKey]) {
        progressByDate[dateKey] = []
      }
      progressByDate[dateKey].push(entry)
    }

    const sessionsFromProgress = Object.entries(progressByDate).map(([dateKey, entries]) => {
      // Group by user
      const byUser: Record<string, typeof entries> = {}
      for (const e of entries) {
        if (!byUser[e.userId]) byUser[e.userId] = []
        byUser[e.userId].push(e)
      }

      const participants = Object.entries(byUser).map(([userId, userEntries]) => ({
        userId,
        userName: userEntries[0].user.name || 'Inconnu',
        entries: userEntries.map(e => ({
          surahNumber: e.surahNumber,
          surahName: e.surah?.nameFr || `Sourate ${e.surahNumber}`,
          verseStart: e.verseStart,
          verseEnd: e.verseEnd,
          program: e.program.nameFr,
          status: null,
          comment: e.comment
        }))
      }))

      // Determine group name from participants
      const firstUserId = entries[0].userId
      const userGroup = groupMembers.find(m => m.userId === firstUserId)

      return {
        id: `progress-${dateKey}`,
        type: 'progress' as const,
        color: '#10B981', // Vert
        date: dateKey,
        weekNumber: null,
        groupId: userGroup?.groupId || null,
        groupName: userGroup?.group.name || 'Famille',
        notes: null,
        participants,
        presentCount: participants.length,
        totalMembers: participants.length,
        absentMembers: [],
        recitationCount: entries.length
      }
    })

    // ============================================
    // Merge and sort all sessions
    // ============================================
    const allSessions = [...sessionsFromGroup, ...sessionsFromProgress]
    allSessions.sort((a, b) => b.date.localeCompare(a.date))

    // Get unique dates for calendar highlighting
    const sessionDates = allSessions.map(s => ({ date: s.date, type: s.type, color: s.color }))

    return NextResponse.json({
      year,
      month,
      sessions: allSessions,
      sessionDates,
      totalSessions: allSessions.length,
      members: allMembers
    })
  } catch (error) {
    console.error('Error fetching calendar sessions:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des séances' },
      { status: 500 }
    )
  }
}
