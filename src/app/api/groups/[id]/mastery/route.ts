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
      select: { number: true, nameAr: true, nameFr: true }
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
    const surahGroups: Array<{ type: 'surah'; number: number; nameAr: string; nameFr: string } | { type: 'collapsed'; start: number; end: number }> = []
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
          nameFr: surah.nameFr
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

    return NextResponse.json({
      group,
      members: members.map(m => ({
        id: m.userId,
        name: m.user.name
      })),
      surahGroups,
      masteryMap,
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
