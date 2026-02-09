import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'

// Helper: resolve sessionId from sessionNumber (chronological order)
async function resolveSessionId(groupId: string, sessionNumber: number, effectiveUserId: string): Promise<string | null> {
  const allSessions = await prisma.groupSession.findMany({
    where: { groupId },
    orderBy: { date: 'asc' },
    select: { id: true }
  })

  if (sessionNumber > 0 && sessionNumber <= allSessions.length) {
    return allSessions[sessionNumber - 1].id
  }

  // Session number beyond existing: create new session for current week
  const today = new Date()
  const d = new Date(today)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  const weekStart = d
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const existing = await prisma.groupSession.findFirst({
    where: { groupId, date: { gte: weekStart, lt: weekEnd } },
    orderBy: { date: 'asc' }
  })

  if (existing) return existing.id

  // ISO week number
  const utcDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  const dayNum = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)

  const newSession = await prisma.groupSession.create({
    data: { groupId, date: today, weekNumber, createdBy: effectiveUserId }
  })

  return newSession.id
}

// GET /api/groups/[id]/research-topics
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

    // Check membership or admin
    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId: effectiveUserId }
    })
    const user = await prisma.user.findUnique({
      where: { id: effectiveUserId },
      select: { role: true }
    })

    if (!membership && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Get all sessions for session number mapping
    const allSessions = await prisma.groupSession.findMany({
      where: { groupId },
      orderBy: { date: 'asc' },
      select: { id: true, date: true }
    })
    const sessionNumberMap = new Map<string, number>()
    allSessions.forEach((s, idx) => {
      sessionNumberMap.set(s.id, idx + 1)
    })

    // Get all research topics for this group
    const topics = await prisma.researchTopic.findMany({
      where: { groupId },
      orderBy: { createdAt: 'asc' }
    })

    const enrichedTopics = topics.map(t => ({
      id: t.id,
      sessionNumber: t.sessionId ? sessionNumberMap.get(t.sessionId) || null : null,
      assignedTo: t.assignedTo,
      question: t.question,
      answer: t.answer,
      isValidated: t.isValidated,
      createdAt: t.createdAt.toISOString()
    }))

    // Check if user is referent or admin
    const isReferent = membership?.role === 'REFERENT' || user?.role === 'ADMIN'

    return NextResponse.json({
      topics: enrichedTopics,
      isReferent,
      nextSessionNumber: allSessions.length + 1,
      totalSessions: allSessions.length
    })
  } catch (error) {
    console.error('Error fetching research topics:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/groups/[id]/research-topics - Create a new research topic
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

    // Check referent or admin
    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId: effectiveUserId }
    })
    const user = await prisma.user.findUnique({
      where: { id: effectiveUserId },
      select: { role: true }
    })

    if ((!membership || membership.role !== 'REFERENT') && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul le référent peut ajouter des sujets' }, { status: 403 })
    }

    const body = await request.json()
    const { sessionNumber, assignedTo, question, answer, isValidated } = body

    if (!assignedTo || !question) {
      return NextResponse.json({ error: 'Élève et question requis' }, { status: 400 })
    }

    // Resolve sessionId from sessionNumber
    let sessionId: string | null = null
    if (sessionNumber) {
      sessionId = await resolveSessionId(groupId, sessionNumber, effectiveUserId)
    }

    const topic = await prisma.researchTopic.create({
      data: {
        groupId,
        sessionId,
        assignedTo,
        question,
        answer: answer || null,
        isValidated: isValidated || false
      }
    })

    // Return with sessionNumber
    return NextResponse.json({
      success: true,
      topic: {
        id: topic.id,
        sessionNumber: sessionNumber || null,
        assignedTo: topic.assignedTo,
        question: topic.question,
        answer: topic.answer,
        isValidated: topic.isValidated,
        createdAt: topic.createdAt.toISOString()
      }
    })
  } catch (error) {
    console.error('Error creating research topic:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH /api/groups/[id]/research-topics - Update a research topic
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

    // Check referent or admin
    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId: effectiveUserId }
    })
    const user = await prisma.user.findUnique({
      where: { id: effectiveUserId },
      select: { role: true }
    })

    if ((!membership || membership.role !== 'REFERENT') && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul le référent peut modifier les sujets' }, { status: 403 })
    }

    const body = await request.json()
    const { id, question, answer, assignedTo, sessionNumber, isValidated } = body

    if (!id) {
      return NextResponse.json({ error: 'ID du sujet manquant' }, { status: 400 })
    }

    // Verify topic belongs to this group
    const existing = await prisma.researchTopic.findUnique({
      where: { id }
    })
    if (!existing || existing.groupId !== groupId) {
      return NextResponse.json({ error: 'Sujet non trouvé' }, { status: 404 })
    }

    const updateData: any = {}
    if (question !== undefined) updateData.question = question
    if (answer !== undefined) updateData.answer = answer
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo
    if (isValidated !== undefined) updateData.isValidated = isValidated

    // Update session if sessionNumber provided
    if (sessionNumber !== undefined) {
      if (sessionNumber) {
        updateData.sessionId = await resolveSessionId(groupId, sessionNumber, effectiveUserId)
      } else {
        updateData.sessionId = null
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 })
    }

    const updated = await prisma.researchTopic.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ success: true, topic: updated })
  } catch (error) {
    console.error('Error updating research topic:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/groups/[id]/research-topics - Delete a research topic
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

    // Check referent or admin
    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId: effectiveUserId }
    })
    const user = await prisma.user.findUnique({
      where: { id: effectiveUserId },
      select: { role: true }
    })

    if ((!membership || membership.role !== 'REFERENT') && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul le référent peut supprimer les sujets' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID du sujet manquant' }, { status: 400 })
    }

    // Verify topic belongs to this group
    const existing = await prisma.researchTopic.findUnique({
      where: { id }
    })
    if (!existing || existing.groupId !== groupId) {
      return NextResponse.json({ error: 'Sujet non trouvé' }, { status: 404 })
    }

    await prisma.researchTopic.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting research topic:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
