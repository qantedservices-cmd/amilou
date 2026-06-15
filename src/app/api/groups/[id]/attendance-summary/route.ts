import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId: effectiveUserId } = await getEffectiveUserId()
    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id: groupId } = await params

    // Permission check: must be group member or global ADMIN
    const [membership, user] = await Promise.all([
      prisma.groupMember.findFirst({
        where: { groupId, userId: effectiveUserId },
      }),
      prisma.user.findUnique({
        where: { id: effectiveUserId },
        select: { role: true },
      }),
    ])

    const isGlobalAdmin = user?.role === 'ADMIN'
    if (!membership && !isGlobalAdmin) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const isReferent = membership?.role === 'REFERENT' || isGlobalAdmin

    // 1. Fetch group + all sessions ordered chronologically + all attendance records
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        name: true,
        sessions: {
          orderBy: { date: 'asc' },
          select: {
            id: true,
            date: true,
            attendance: {
              select: { userId: true, present: true, excused: true },
            },
          },
        },
      },
    })

    if (!group) {
      return NextResponse.json({ error: 'Groupe non trouvé' }, { status: 404 })
    }

    // 2. Fetch active students (MEMBER OR REFERENT with isStudent=true)
    const members = await prisma.groupMember.findMany({
      where: {
        groupId,
        isActive: true,
        OR: [
          { role: 'MEMBER' },
          { role: 'REFERENT', isStudent: true },
        ],
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    })

    // Build session list with sequential numbers
    const sessions = group.sessions.map((s, idx) => ({
      id: s.id,
      number: idx + 1,
      date: s.date.toISOString(),
    }))

    // Build attendance lookup: sessionId -> userId -> { present, excused }
    const attendanceBySession = new Map<string, Map<string, { present: boolean; excused: boolean }>>()
    for (const s of group.sessions) {
      const byUser = new Map<string, { present: boolean; excused: boolean }>()
      for (const a of s.attendance) {
        byUser.set(a.userId, { present: a.present, excused: a.excused })
      }
      attendanceBySession.set(s.id, byUser)
    }

    // Build per-member summary + per-session breakdown
    const totalSessions = sessions.length
    const membersOut = members.map((m) => {
      const perSession = sessions.map((s) => {
        const rec = attendanceBySession.get(s.id)?.get(m.userId)
        if (!rec) {
          return { sessionId: s.id, present: false, excused: false, hasRecord: false }
        }
        return { sessionId: s.id, present: rec.present, excused: rec.excused, hasRecord: true }
      })

      const presentCount = perSession.filter((p) => p.present).length
      const excusedCount = perSession.filter((p) => !p.present && p.excused).length
      const absentCount = totalSessions - presentCount - excusedCount
      const rate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0

      return {
        userId: m.userId,
        name: m.user.name || '',
        presentCount,
        absentCount,
        excusedCount,
        rate,
        perSession,
      }
    })

    return NextResponse.json({
      groupName: group.name,
      totalSessions,
      firstSessionDate: sessions[0]?.date ?? null,
      isReferent,
      sessions,
      members: membersOut,
    })
  } catch (error) {
    console.error('Error fetching attendance summary:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du bilan' },
      { status: 500 }
    )
  }
}
