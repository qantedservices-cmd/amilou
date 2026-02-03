import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// Couleurs par groupe
const GROUP_COLORS: Record<string, string> = {
  'Cours Montmagny': '#3B82F6', // Bleu
  'Famille': '#8B5CF6',          // Violet
  'Groupe Amilou': '#10B981',    // Vert
}

function getGroupColor(groupName: string): string {
  return GROUP_COLORS[groupName] || '#6B7280' // Gris par défaut
}

// Get ISO week number from date
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

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
    // Count total sessions (all time) per group
    // ============================================
    const totalSessionsAllTime = await prisma.groupSession.count({
      where: { groupId: { in: groupIds } }
    })

    const totalSessionsThisYear = await prisma.groupSession.count({
      where: {
        groupId: { in: groupIds },
        date: {
          gte: new Date(year, 0, 1),
          lte: new Date(year, 11, 31, 23, 59, 59)
        }
      }
    })

    // Get all sessions for numbering (ordered by date ascending)
    const allGroupSessionsForNumbering = await prisma.groupSession.findMany({
      where: { groupId: { in: groupIds } },
      select: { id: true, groupId: true, date: true },
      orderBy: { date: 'asc' }
    })

    // Create session number maps (per group)
    const sessionNumberMap: Record<string, { globalNumber: number; yearNumber: number }> = {}
    const groupCounters: Record<string, { global: number; year: Record<number, number> }> = {}

    for (const s of allGroupSessionsForNumbering) {
      if (!groupCounters[s.groupId]) {
        groupCounters[s.groupId] = { global: 0, year: {} }
      }
      groupCounters[s.groupId].global++

      const sessionYear = s.date.getFullYear()
      if (!groupCounters[s.groupId].year[sessionYear]) {
        groupCounters[s.groupId].year[sessionYear] = 0
      }
      groupCounters[s.groupId].year[sessionYear]++

      sessionNumberMap[s.id] = {
        globalNumber: groupCounters[s.groupId].global,
        yearNumber: groupCounters[s.groupId].year[sessionYear]
      }
    }

    // Get total per group
    const totalPerGroup: Record<string, { global: number; year: number }> = {}
    for (const gId of groupIds) {
      totalPerGroup[gId] = {
        global: groupCounters[gId]?.global || 0,
        year: groupCounters[gId]?.year[year] || 0
      }
    }

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
            surahNameAr: r.surah.nameAr,
            verseStart: r.verseStart,
            verseEnd: r.verseEnd,
            status: r.status,
            comment: r.comment
          }))
        }
      })

      const numbers = sessionNumberMap[gs.id] || { globalNumber: 0, yearNumber: 0 }
      const totals = totalPerGroup[gs.groupId] || { global: 0, year: 0 }

      return {
        id: gs.id,
        type: 'group' as const,
        color: getGroupColor(gs.group.name),
        date: gs.date.toISOString().split('T')[0],
        weekNumber: gs.weekNumber,
        groupId: gs.groupId,
        groupName: gs.group.name,
        notes: gs.notes,
        participants,
        presentCount: presentAttendance.length,
        totalMembers: gs.attendance.length,
        absentMembers: absentAttendance.map(a => a.user.name || a.user.email),
        recitationCount: gs.recitations.length,
        sessionNumber: numbers.globalNumber,
        sessionNumberYear: numbers.yearNumber,
        totalSessionsGroup: totals.global,
        totalSessionsGroupYear: totals.year
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
          surahNameAr: e.surah?.nameAr,
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

      const groupName = userGroup?.group.name || 'Groupe Amilou'
      return {
        id: `progress-${dateKey}`,
        type: 'progress' as const,
        color: getGroupColor(groupName),
        date: dateKey,
        weekNumber: null,
        groupId: userGroup?.groupId || null,
        groupName,
        notes: null,
        participants,
        presentCount: participants.length,
        totalMembers: participants.length,
        absentMembers: [],
        recitationCount: entries.length,
        sessionNumber: null,
        sessionNumberYear: null,
        totalSessionsGroup: null,
        totalSessionsGroupYear: null
      }
    })

    // ============================================
    // Merge and sort all sessions
    // Filter out Progress-based sessions when a real GroupSession exists for the same date/group
    // ============================================
    const groupSessionDates = new Set(
      sessionsFromGroup.map(s => `${s.date}-${s.groupId}`)
    )
    const filteredProgressSessions = sessionsFromProgress.filter(s =>
      !groupSessionDates.has(`${s.date}-${s.groupId}`)
    )
    const allSessions = [...sessionsFromGroup, ...filteredProgressSessions]
    allSessions.sort((a, b) => b.date.localeCompare(a.date))

    // Group sessions by date for calendar (multiple sessions per day)
    const sessionsByDate: Record<string, { date: string; weekNumber: number; sessions: { type: string; color: string; groupName: string }[] }> = {}
    for (const s of allSessions) {
      if (!sessionsByDate[s.date]) {
        const dateObj = new Date(s.date)
        sessionsByDate[s.date] = {
          date: s.date,
          weekNumber: s.weekNumber || getWeekNumber(dateObj),
          sessions: []
        }
      }
      sessionsByDate[s.date].sessions.push({
        type: s.type,
        color: s.color,
        groupName: s.groupName
      })
    }
    const sessionDates = Object.values(sessionsByDate)

    return NextResponse.json({
      year,
      month,
      sessions: allSessions,
      sessionDates,
      totalSessions: allSessions.length,
      totalSessionsAllTime,
      totalSessionsThisYear,
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
