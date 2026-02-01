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
      select: { groupId: true }
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

    // Get GroupSessions with attendance and recitations
    const groupSessions = await prisma.groupSession.findMany({
      where: {
        groupId: { in: groupIds },
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        group: { select: { id: true, name: true } },
        attendance: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
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

    // Get group members for reference
    const groupMembers = await prisma.groupMember.findMany({
      where: {
        groupId: { in: groupIds },
        role: 'MEMBER' // Only students
      },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    })

    const allMembers = groupMembers.map(m => ({
      id: m.user.id,
      name: m.user.name
    }))

    // Transform sessions for calendar view
    const sessions = groupSessions.map(gs => {
      const presentAttendance = gs.attendance.filter(a => a.present)
      const absentAttendance = gs.attendance.filter(a => !a.present)

      // Group recitations by user
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

    // Get unique dates for calendar highlighting
    const sessionDates = sessions.map(s => s.date)

    return NextResponse.json({
      year,
      month,
      sessions,
      sessionDates,
      totalSessions: sessions.length,
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
