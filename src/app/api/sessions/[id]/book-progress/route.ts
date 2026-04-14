import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

async function checkReferentOrAdmin(userId: string, sessionId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role === 'ADMIN') return true

  const session = await prisma.groupSession.findUnique({
    where: { id: sessionId },
    select: { groupId: true }
  })
  if (!session) return false

  const membership = await prisma.groupMember.findFirst({
    where: { groupId: session.groupId, userId, role: 'REFERENT' }
  })
  return !!membership
}

const includeRelations = {
  book: { select: { id: true, title: true, titleAr: true } },
  chapter: {
    select: {
      id: true, title: true, titleAr: true, chapterNumber: true, depth: true,
      parent: { select: { id: true, title: true, titleAr: true, chapterNumber: true } }
    }
  },
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id: sessionId } = await params

    const entries = await prisma.sessionBookProgress.findMany({
      where: { sessionId },
      include: includeRelations,
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(entries)
  } catch (error) {
    console.error('Error fetching book progress:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id: sessionId } = await params
    const canEdit = await checkReferentOrAdmin(session.user.id, sessionId)
    if (!canEdit) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { bookId, chapterId, pageStart, pageEnd, isRead, isQaDone, comment } = await request.json()
    if (!bookId) return NextResponse.json({ error: 'Livre requis' }, { status: 400 })

    const entry = await prisma.sessionBookProgress.create({
      data: {
        sessionId,
        bookId,
        chapterId: chapterId || null,
        pageStart: pageStart || null,
        pageEnd: pageEnd || null,
        isRead: isRead || false,
        isQaDone: isQaDone || false,
        comment: comment || null,
        createdBy: session.user.id,
      },
      include: includeRelations,
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error('Error creating book progress:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id: sessionId } = await params
    const canEdit = await checkReferentOrAdmin(session.user.id, sessionId)
    if (!canEdit) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { entryId, chapterId, pageStart, pageEnd, isRead, isQaDone, comment } = await request.json()
    if (!entryId) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

    const entry = await prisma.sessionBookProgress.update({
      where: { id: entryId },
      data: {
        chapterId: chapterId !== undefined ? (chapterId || null) : undefined,
        pageStart: pageStart !== undefined ? pageStart : undefined,
        pageEnd: pageEnd !== undefined ? pageEnd : undefined,
        isRead: isRead !== undefined ? isRead : undefined,
        isQaDone: isQaDone !== undefined ? isQaDone : undefined,
        comment: comment !== undefined ? (comment || null) : undefined,
      },
      include: includeRelations,
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Error updating book progress:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id: sessionId } = await params
    const canEdit = await checkReferentOrAdmin(session.user.id, sessionId)
    if (!canEdit) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const entryId = searchParams.get('entryId')
    if (!entryId) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

    await prisma.sessionBookProgress.delete({ where: { id: entryId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting book progress:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
