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

    // Get group members
    const groupMembers = await prisma.groupMember.findMany({
      where: { groupId: { in: groupIds } },
      include: { user: { select: { id: true, name: true, email: true } } }
    })
    const memberUserIds = [...new Set(groupMembers.map(m => m.userId))]

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

    // Get all progress entries for group members in date range
    const progressEntries = await prisma.progress.findMany({
      where: {
        userId: { in: memberUserIds },
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        user: { select: { id: true, name: true } },
        surah: { select: { number: true, nameFr: true, nameAr: true } },
        program: { select: { code: true, nameFr: true } }
      },
      orderBy: { date: 'desc' }
    })

    // Group by date
    const sessionsByDate: Record<string, {
      date: string
      participants: {
        userId: string
        userName: string
        entries: {
          surahNumber: number
          surahName: string
          verseStart: number
          verseEnd: number
          program: string
        }[]
      }[]
    }> = {}

    for (const entry of progressEntries) {
      const dateKey = new Date(entry.date).toISOString().split('T')[0]

      if (!sessionsByDate[dateKey]) {
        sessionsByDate[dateKey] = {
          date: dateKey,
          participants: []
        }
      }

      // Find or create participant
      let participant = sessionsByDate[dateKey].participants.find(p => p.userId === entry.userId)
      if (!participant) {
        participant = {
          userId: entry.userId,
          userName: entry.user.name || 'Inconnu',
          entries: []
        }
        sessionsByDate[dateKey].participants.push(participant)
      }

      participant.entries.push({
        surahNumber: entry.surahNumber,
        surahName: entry.surah?.nameFr || `Sourate ${entry.surahNumber}`,
        verseStart: entry.verseStart,
        verseEnd: entry.verseEnd,
        program: entry.program.nameFr
      })
    }

    // Get all group members for attendance comparison
    const allMembers = [...new Map(groupMembers.map(m => [m.userId, {
      id: m.user.id,
      name: m.user.name
    }])).values()]

    // Convert to array and add absent members info
    const sessions = Object.values(sessionsByDate).map(session => {
      const presentUserIds = session.participants.map(p => p.userId)
      const absentMembers = allMembers.filter(m => !presentUserIds.includes(m.id))

      return {
        ...session,
        presentCount: session.participants.length,
        totalMembers: allMembers.length,
        absentMembers: absentMembers.map(m => m.name)
      }
    })

    // Sort by date descending
    sessions.sort((a, b) => b.date.localeCompare(a.date))

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
