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

    // Build per-member summary + per-session breakdown.
    // A roll-call ("appel") is done at each session, so a member present in the
    // group produces a record (present / excused / absent) for that session. A
    // session with NO record for a member means they were not part of that
    // session's roll-call (not yet enrolled, or outside their period) — it does
    // NOT count as an absence. The rate is therefore computed only over the
    // sessions where the member has a record.
    const totalSessions = sessions.length
    const membersOut = members.map((m) => {
      let presentCount = 0
      let excusedCount = 0
      let absentCount = 0

      const perSession = sessions.map((s) => {
        const rec = attendanceBySession.get(s.id)?.get(m.userId)
        if (rec) {
          if (rec.present) presentCount++
          else if (rec.excused) excusedCount++
          else absentCount++
          return { sessionId: s.id, present: rec.present, excused: rec.excused, hasRecord: true }
        }
        return { sessionId: s.id, present: false, excused: false, hasRecord: false }
      })

      const applicableCount = presentCount + excusedCount + absentCount
      const rate = applicableCount > 0 ? Math.round((presentCount / applicableCount) * 100) : 0

      return {
        userId: m.userId,
        name: m.user.name || '',
        presentCount,
        absentCount,
        excusedCount,
        rate,
        applicableCount,
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
