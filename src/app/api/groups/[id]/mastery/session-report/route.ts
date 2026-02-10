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
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// Helper: find or create session for the current week (Sunday-Saturday)
async function findOrCreateWeekSession(groupId: string, createdBy: string) {
  const today = new Date()
  const weekStart = getWeekStart(today)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

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

// GET /api/groups/[id]/mastery/session-report?sessionNumber=N
// Returns session report data (checklist, homework, next surah) for a given session number
// If no sessionNumber, returns data for the last session + group defaults
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

    const { searchParams } = new URL(request.url)
    const sessionNumberParam = searchParams.get('sessionNumber')

    // Get group with defaultHomework
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, defaultHomework: true }
    })

    if (!group) {
      return NextResponse.json({ error: 'Groupe non trouvé' }, { status: 404 })
    }

    // Get all sessions ordered chronologically
    const allSessions = await prisma.groupSession.findMany({
      where: { groupId },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        date: true,
        weekNumber: true,
        nextSurahNumber: true,
        homework: true,
        sessionTopics: true
      }
    })

    let targetSession = null
    let targetSessionNumber = 0

    if (sessionNumberParam) {
      const num = parseInt(sessionNumberParam)
      if (num > 0 && num <= allSessions.length) {
        targetSession = allSessions[num - 1]
        targetSessionNumber = num
      }
    } else {
      // Default to last session
      if (allSessions.length > 0) {
        targetSession = allSessions[allSessions.length - 1]
        targetSessionNumber = allSessions.length
      }
    }

    // Get all surahs for the selector
    const surahs = await prisma.surah.findMany({
      orderBy: { number: 'asc' },
      select: { number: true, nameAr: true, nameFr: true, totalVerses: true }
    })

    // Default homework text
    const defaultHomework = group.defaultHomework ||
      '- Lire de tête les sourates mémorisées\n- Écouter 10 min du dernier Juzz (Sourates 78 à 114)\n- Répéter 15 fois la partie à mémoriser\n- Écouter 15 fois la partie à mémoriser'

    // Default checklist items
    const defaultTopics = [
      { label: 'Suivi individuel de la mémorisation', checked: true },
      { label: 'Préparation de la prochaine sourate en groupe', checked: true, children: [
        { label: 'Récitation', checked: false },
        { label: 'Lecture sens des versets', checked: false },
        { label: 'Tafsir', checked: false },
      ]},
      { label: 'Étude leçon du livre Arc en Ciel', checked: false },
      { label: 'Sujets de recherches', checked: false },
      { label: 'Échanges ouverts', checked: false },
    ]

    return NextResponse.json({
      sessionNumber: targetSessionNumber,
      sessionId: targetSession?.id || null,
      sessionDate: targetSession?.date?.toISOString() || null,
      weekNumber: targetSession?.weekNumber || null,
      nextSurahNumber: targetSession?.nextSurahNumber || null,
      homework: targetSession?.homework || defaultHomework,
      sessionTopics: (targetSession?.sessionTopics as any[]) || defaultTopics,
      defaultHomework,
      surahs,
      totalSessions: allSessions.length
    })
  } catch (error) {
    console.error('Error fetching session report:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/groups/[id]/mastery/session-report
// Save session report data (checklist, homework, next surah) and optionally update group default homework
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

    // Check permissions
    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId: effectiveUserId, role: 'REFERENT' }
    })
    const user = await prisma.user.findUnique({
      where: { id: effectiveUserId },
      select: { role: true }
    })

    if (!membership && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul le référent peut modifier' }, { status: 403 })
    }

    const body = await request.json()
    const { sessionNumber, nextSurahNumber, homework, sessionTopics, saveAsDefault } = body

    if (!sessionNumber) {
      return NextResponse.json({ error: 'Numéro de séance manquant' }, { status: 400 })
    }

    // Resolve session by number
    const allSessions = await prisma.groupSession.findMany({
      where: { groupId },
      orderBy: { date: 'asc' },
      select: { id: true }
    })

    let sessionId: string

    if (sessionNumber <= allSessions.length) {
      sessionId = allSessions[sessionNumber - 1].id
    } else {
      // Find or create session for current week (one per week rule)
      const weekSession = await findOrCreateWeekSession(groupId, effectiveUserId)
      sessionId = weekSession.id
    }

    // Update session with report data
    await prisma.groupSession.update({
      where: { id: sessionId },
      data: {
        nextSurahNumber: nextSurahNumber || null,
        homework: homework || null,
        sessionTopics: sessionTopics || null
      }
    })

    // Optionally save homework as group default
    if (saveAsDefault && homework) {
      await prisma.group.update({
        where: { id: groupId },
        data: { defaultHomework: homework }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving session report:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
