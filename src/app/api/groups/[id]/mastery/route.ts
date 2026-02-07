import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'

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
      select: { id: true, weekNumber: true, date: true }
    })
    const sessionIds = groupSessions.map(s => s.id)
    const sessionWeekMap = new Map(groupSessions.map(s => [s.id, s.weekNumber]))

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

    // Build comments map: userId -> surahNumber -> array of { id, comment, weekNumber, createdAt }
    const commentsMap: Record<string, Record<number, Array<{
      id: string
      comment: string
      weekNumber: number | null
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

    // Determine which surahs have data
    const surahsWithData = new Set<number>()
    for (const m of masteryData) {
      surahsWithData.add(m.surahNumber)
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
      referent: referent ? { id: referent.userId, name: referent.user.name } : null
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
    const { userId, surahNumber, comment, weekNumber } = body

    if (!userId || !surahNumber || !comment) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    // Find or create a session for this week
    let sessionRecord = await prisma.groupSession.findFirst({
      where: {
        groupId,
        weekNumber: weekNumber || null
      }
    })

    if (!sessionRecord) {
      // Create a new session for this group
      sessionRecord = await prisma.groupSession.create({
        data: {
          groupId,
          date: new Date(),
          weekNumber: weekNumber || null,
          createdBy: effectiveUserId
        }
      })
    }

    // Create the recitation with comment
    const recitation = await prisma.surahRecitation.create({
      data: {
        sessionId: sessionRecord.id,
        userId,
        surahNumber,
        type: 'MEMORIZATION',
        verseStart: 1,
        verseEnd: 1,
        status: 'V',
        comment,
        createdBy: effectiveUserId
      }
    })

    return NextResponse.json({
      success: true,
      comment: {
        id: recitation.id,
        comment: recitation.comment,
        weekNumber: sessionRecord.weekNumber,
        createdAt: recitation.createdAt.toISOString()
      }
    })
  } catch (error) {
    console.error('Error adding comment:', error)
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
