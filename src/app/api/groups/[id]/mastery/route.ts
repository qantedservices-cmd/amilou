import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'

// Helper: get the Sunday (start of week) for a given date
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sunday
  d.setDate(d.getDate() - day)
  return d
}

// Helper: ISO 8601 week number
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // Set to nearest Thursday: current date + 4 - current day number (Mon=1, Sun=7)
  const dayNum = d.getUTCDay() || 7 // Make Sunday=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// Helper: find or create session for the current week (Sunday-Saturday)
// Ensures only one session per week per group
async function findOrCreateWeekSession(groupId: string, createdBy: string) {
  const today = new Date()
  const weekStart = getWeekStart(today)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7) // Next Sunday 00:00

  // Look for an existing session in this week
  const existing = await prisma.groupSession.findFirst({
    where: {
      groupId,
      date: { gte: weekStart, lt: weekEnd }
    },
    orderBy: { date: 'asc' }
  })

  if (existing) return existing

  return prisma.groupSession.create({
    data: {
      groupId,
      date: today,
      weekNumber: getISOWeekNumber(today),
      createdBy
    }
  })
}

// GET /api/groups/[id]/mastery - Get mastery matrix for a group
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId: effectiveUserId } = await getEffectiveUserId()
    const { id: groupId } = await params

    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Check if user is a member of this group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: effectiveUserId
      }
    })

    // Also check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: effectiveUserId },
      select: { role: true }
    })

    if (!membership && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Get group info
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true }
    })

    if (!group) {
      return NextResponse.json({ error: 'Groupe non trouvé' }, { status: 404 })
    }

    // Get all members (excluding REFERENT-only members based on the Samir rule)
    // REFERENT who is also in Amilou as MEMBER should only show their data in Amilou
    const members = await prisma.groupMember.findMany({
      where: {
        groupId,
        role: 'MEMBER' // Only get MEMBER role, not REFERENT-only
      },
      include: {
        user: {
          select: { id: true, name: true }
        }
      },
      orderBy: { user: { name: 'asc' } }
    })

    // Also get REFERENT for permission check but don't include in matrix
    const referent = await prisma.groupMember.findFirst({
      where: { groupId, role: 'REFERENT' },
      include: { user: { select: { id: true, name: true } } }
    })

    // Get all surahs
    const surahs = await prisma.surah.findMany({
      orderBy: { number: 'asc' },
      select: { number: true, nameAr: true, nameFr: true, totalVerses: true }
    })

    // Get all mastery data for members of this group
    const memberIds = members.map(m => m.userId)
    const masteryData = await prisma.surahMastery.findMany({
      where: {
        userId: { in: memberIds }
      },
      select: {
        userId: true,
        surahNumber: true,
        status: true,
        validatedWeek: true
      }
    })

    // Get all comments from SurahRecitation for these members in this group's sessions
    const groupSessions = await prisma.groupSession.findMany({
      where: { groupId },
      select: { id: true, weekNumber: true, date: true },
      orderBy: { date: 'asc' }
    })
    const sessionIds = groupSessions.map(s => s.id)
    const sessionWeekMap = new Map(groupSessions.map(s => [s.id, s.weekNumber]))

    // Build session number map (chronological order per group)
    const sessionNumberMap = new Map<string, number>()
    const sessionDateMap = new Map<string, string>()
    groupSessions.forEach((s, idx) => {
      sessionNumberMap.set(s.id, idx + 1)
      sessionDateMap.set(s.id, s.date.toISOString())
    })
    const nextSessionNumber = groupSessions.length + 1
    const totalSessions = groupSessions.length

    const recitations = await prisma.surahRecitation.findMany({
      where: {
        sessionId: { in: sessionIds },
        userId: { in: memberIds },
        comment: { not: null }
      },
      select: {
        id: true,
        userId: true,
        surahNumber: true,
        comment: true,
        sessionId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    // Build comments map: userId -> surahNumber -> array of comments with session info
    const commentsMap: Record<string, Record<number, Array<{
      id: string
      comment: string
      weekNumber: number | null
      sessionNumber: number | null
      sessionId: string | null
      sessionDate: string | null
      createdAt: string
    }>>> = {}
    for (const r of recitations) {
      if (!r.comment) continue
      if (!commentsMap[r.userId]) {
        commentsMap[r.userId] = {}
      }
      if (!commentsMap[r.userId][r.surahNumber]) {
        commentsMap[r.userId][r.surahNumber] = []
      }
      commentsMap[r.userId][r.surahNumber].push({
        id: r.id,
        comment: r.comment,
        weekNumber: sessionWeekMap.get(r.sessionId) || null,
        sessionNumber: sessionNumberMap.get(r.sessionId) || null,
        sessionId: r.sessionId,
        sessionDate: sessionDateMap.get(r.sessionId) || null,
        createdAt: r.createdAt.toISOString()
      })
    }

    // Build mastery map: userId -> surahNumber -> { status, validatedWeek }
    const masteryMap: Record<string, Record<number, { status: string; validatedWeek: number | null }>> = {}
    for (const m of masteryData) {
      if (!masteryMap[m.userId]) {
        masteryMap[m.userId] = {}
      }
      masteryMap[m.userId][m.surahNumber] = {
        status: m.status,
        validatedWeek: m.validatedWeek
      }
    }

    // Auto-fill mastery from Progress (MEMORIZATION) for surahs fully memorized but not yet in SurahMastery
    const memorizationProgram = await prisma.program.findFirst({
      where: { code: 'MEMORIZATION' }
    })

    if (memorizationProgram) {
      const progressEntries = await prisma.progress.findMany({
        where: {
          userId: { in: memberIds },
          programId: memorizationProgram.id,
        },
        select: {
          userId: true,
          surahNumber: true,
          verseStart: true,
          verseEnd: true,
        }
      })

      // Build coverage: userId -> surahNumber -> Set<verseNumber>
      const coverage: Record<string, Record<number, Set<number>>> = {}
      for (const entry of progressEntries) {
        if (!coverage[entry.userId]) coverage[entry.userId] = {}
        if (!coverage[entry.userId][entry.surahNumber]) coverage[entry.userId][entry.surahNumber] = new Set()
        for (let v = entry.verseStart; v <= entry.verseEnd; v++) {
          coverage[entry.userId][entry.surahNumber].add(v)
        }
      }

      // Build surah total verses map
      const surahTotalMap = new Map(surahs.map(s => [s.number, s.totalVerses]))

      // Inject virtual "V" (validé) status for fully memorized surahs without existing mastery
      for (const userId of memberIds) {
        if (!coverage[userId]) continue
        for (const [surahNumStr, verses] of Object.entries(coverage[userId])) {
          const surahNum = parseInt(surahNumStr)
          const totalVerses = surahTotalMap.get(surahNum) || 0
          if (verses.size >= totalVerses && totalVerses > 0) {
            if (!masteryMap[userId]?.[surahNum]) {
              if (!masteryMap[userId]) masteryMap[userId] = {}
              masteryMap[userId][surahNum] = { status: 'V', validatedWeek: null }
            }
          }
        }
      }
    }

    // Determine which surahs have data
    const surahsWithData = new Set<number>()
    for (const m of masteryData) {
      surahsWithData.add(m.surahNumber)
    }
    // Also add surahs from auto-filled mastery
    for (const userId of Object.keys(masteryMap)) {
      for (const surahNum of Object.keys(masteryMap[userId])) {
        surahsWithData.add(parseInt(surahNum))
      }
    }

    // Group consecutive surahs without data
    const surahGroups: Array<{ type: 'surah'; number: number; nameAr: string; nameFr: string; totalVerses: number } | { type: 'collapsed'; start: number; end: number }> = []
    let collapsedStart: number | null = null

    for (const surah of surahs) {
      if (surahsWithData.has(surah.number)) {
        // If we were collapsing, end the collapsed section
        if (collapsedStart !== null) {
          surahGroups.push({
            type: 'collapsed',
            start: collapsedStart,
            end: surah.number - 1
          })
          collapsedStart = null
        }
        surahGroups.push({
          type: 'surah',
          number: surah.number,
          nameAr: surah.nameAr,
          nameFr: surah.nameFr,
          totalVerses: surah.totalVerses
        })
      } else {
        // Start or continue collapsing
        if (collapsedStart === null) {
          collapsedStart = surah.number
        }
      }
    }

    // Handle trailing collapsed section
    if (collapsedStart !== null) {
      surahGroups.push({
        type: 'collapsed',
        start: collapsedStart,
        end: 114
      })
    }

    // Check if current user is REFERENT
    const isReferent = membership?.role === 'REFERENT' || user?.role === 'ADMIN'

    // Build allSurahs map for expanded collapsed ranges
    const allSurahsMap: Record<number, { nameAr: string; nameFr: string; totalVerses: number }> = {}
    for (const s of surahs) {
      allSurahsMap[s.number] = { nameAr: s.nameAr, nameFr: s.nameFr, totalVerses: s.totalVerses }
    }

    return NextResponse.json({
      group,
      members: members.map(m => ({
        id: m.userId,
        name: m.user.name
      })),
      surahGroups,
      allSurahsMap,
      masteryMap,
      commentsMap,
      isReferent,
      referent: referent ? { id: referent.userId, name: referent.user.name } : null,
      nextSessionNumber,
      totalSessions
    })
  } catch (error) {
    console.error('Error fetching mastery:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/groups/[id]/mastery - Update a mastery entry (REFERENT only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId: effectiveUserId } = await getEffectiveUserId()
    const { id: groupId } = await params

    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Check if user is REFERENT of this group or ADMIN
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: effectiveUserId,
        role: 'REFERENT'
      }
    })

    const user = await prisma.user.findUnique({
      where: { id: effectiveUserId },
      select: { role: true }
    })

    if (!membership && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul le référent peut modifier' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, surahNumber, status, validatedWeek } = body

    if (!userId || !surahNumber) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    // Verify the user is a member of this group
    const targetMember = await prisma.groupMember.findFirst({
      where: { groupId, userId }
    })

    if (!targetMember) {
      return NextResponse.json({ error: 'Utilisateur non membre du groupe' }, { status: 400 })
    }

    if (status === null || status === '') {
      // Delete the mastery entry
      await prisma.surahMastery.deleteMany({
        where: { userId, surahNumber }
      })
      return NextResponse.json({ success: true, deleted: true })
    }

    // Upsert the mastery entry
    const mastery = await prisma.surahMastery.upsert({
      where: {
        userId_surahNumber: { userId, surahNumber }
      },
      create: {
        userId,
        surahNumber,
        status,
        validatedWeek: validatedWeek || null,
        validatedAt: validatedWeek ? new Date() : null
      },
      update: {
        status,
        validatedWeek: validatedWeek || null,
        validatedAt: validatedWeek ? new Date() : null
      }
    })

    return NextResponse.json({ success: true, mastery })
  } catch (error) {
    console.error('Error updating mastery:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/groups/[id]/mastery - Add a comment (creates SurahRecitation)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId: effectiveUserId } = await getEffectiveUserId()
    const { id: groupId } = await params

    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Check if user is REFERENT of this group or ADMIN
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: effectiveUserId,
        role: 'REFERENT'
      }
    })

    const user = await prisma.user.findUnique({
      where: { id: effectiveUserId },
      select: { role: true }
    })

    if (!membership && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul le référent peut ajouter des commentaires' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, surahNumber, comment, sessionNumber, verseStart: reqVerseStart, verseEnd: reqVerseEnd, weekNumber } = body

    if (!userId || !surahNumber || !comment) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    // Get surah info for default verse range
    const surah = await prisma.surah.findUnique({
      where: { number: surahNumber },
      select: { totalVerses: true }
    })
    const totalVerses = surah?.totalVerses || 1
    const verseStart = reqVerseStart || 1
    const verseEnd = reqVerseEnd || totalVerses

    let sessionRecord: any

    if (sessionNumber) {
      // Resolve session by chronological number
      const allSessions = await prisma.groupSession.findMany({
        where: { groupId },
        orderBy: { date: 'asc' }
      })

      if (sessionNumber <= allSessions.length) {
        // Use existing session
        sessionRecord = allSessions[sessionNumber - 1]
      } else {
        // Find or create session for current week (one per week rule)
        sessionRecord = await findOrCreateWeekSession(groupId, effectiveUserId)
      }
    } else {
      // No session number: find or create for current week
      sessionRecord = await findOrCreateWeekSession(groupId, effectiveUserId)
    }

    // Create the recitation with comment
    const recitation = await prisma.surahRecitation.create({
      data: {
        sessionId: sessionRecord.id,
        userId,
        surahNumber,
        type: 'MEMORIZATION',
        verseStart,
        verseEnd,
        status: 'V',
        comment,
        createdBy: effectiveUserId
      }
    })

    // Calculate session number for response
    const allSessionsForNumber = await prisma.groupSession.findMany({
      where: { groupId },
      orderBy: { date: 'asc' },
      select: { id: true }
    })
    const responseSessionNumber = allSessionsForNumber.findIndex(s => s.id === sessionRecord.id) + 1

    return NextResponse.json({
      success: true,
      comment: {
        id: recitation.id,
        comment: recitation.comment,
        weekNumber: sessionRecord.weekNumber,
        sessionNumber: responseSessionNumber,
        sessionId: sessionRecord.id,
        sessionDate: sessionRecord.date.toISOString(),
        createdAt: recitation.createdAt.toISOString()
      }
    })
  } catch (error) {
    console.error('Error adding comment:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH /api/groups/[id]/mastery - Edit a comment (text and/or session)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId: effectiveUserId } = await getEffectiveUserId()
    const { id: groupId } = await params

    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Check if user is REFERENT of this group or ADMIN
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: effectiveUserId,
        role: 'REFERENT'
      }
    })

    const user = await prisma.user.findUnique({
      where: { id: effectiveUserId },
      select: { role: true }
    })

    if (!membership && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul le référent peut modifier les commentaires' }, { status: 403 })
    }

    const body = await request.json()
    const { commentId, comment, sessionNumber } = body

    if (!commentId) {
      return NextResponse.json({ error: 'ID du commentaire manquant' }, { status: 400 })
    }

    // Get the existing recitation
    const recitation = await prisma.surahRecitation.findUnique({
      where: { id: commentId }
    })

    if (!recitation) {
      return NextResponse.json({ error: 'Commentaire non trouvé' }, { status: 404 })
    }

    const updateData: any = {}

    // Update comment text if provided
    if (comment !== undefined) {
      updateData.comment = comment
    }

    // Update session if sessionNumber provided
    if (sessionNumber !== undefined) {
      const allSessions = await prisma.groupSession.findMany({
        where: { groupId },
        orderBy: { date: 'asc' }
      })

      if (sessionNumber > 0 && sessionNumber <= allSessions.length) {
        updateData.sessionId = allSessions[sessionNumber - 1].id
      } else if (sessionNumber > allSessions.length) {
        // Find or create session for current week (one per week rule)
        const weekSession = await findOrCreateWeekSession(groupId, effectiveUserId)
        updateData.sessionId = weekSession.id
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 })
    }

    const updated = await prisma.surahRecitation.update({
      where: { id: commentId },
      data: updateData
    })

    return NextResponse.json({ success: true, updated })
  } catch (error) {
    console.error('Error editing comment:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/groups/[id]/mastery - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId: effectiveUserId } = await getEffectiveUserId()
    const { id: groupId } = await params

    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Check if user is REFERENT of this group or ADMIN
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: effectiveUserId,
        role: 'REFERENT'
      }
    })

    const user = await prisma.user.findUnique({
      where: { id: effectiveUserId },
      select: { role: true }
    })

    if (!membership && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul le référent peut supprimer des commentaires' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('commentId')

    if (!commentId) {
      return NextResponse.json({ error: 'ID du commentaire manquant' }, { status: 400 })
    }

    // Delete the recitation
    await prisma.surahRecitation.delete({
      where: { id: commentId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
