import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// PUT /api/sessions/[id]/recitations/[recitationId] - Update a recitation
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; recitationId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id: sessionId, recitationId } = await params
    const body = await request.json()
    const { surahNumber, type, verseStart, verseEnd, status, comment } = body

    // Check if recitation exists and belongs to this session
    const recitation = await prisma.surahRecitation.findUnique({
      where: { id: recitationId },
      include: {
        session: {
          select: { groupId: true }
        }
      }
    })

    if (!recitation || recitation.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Récitation non trouvée' }, { status: 404 })
    }

    // Check if user is global admin or group admin/referent
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    const isGlobalAdmin = currentUser?.role === 'ADMIN'

    if (!isGlobalAdmin) {
      const membership = await prisma.groupMember.findFirst({
        where: {
          groupId: recitation.session.groupId,
          userId: session.user.id,
          role: { in: ['ADMIN', 'REFERENT'] },
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: 'Vous devez être administrateur ou référent pour modifier une récitation' },
          { status: 403 }
        )
      }
    }

    // Get surah info for validation
    const surah = await prisma.surah.findUnique({
      where: { number: surahNumber }
    })

    if (!surah) {
      return NextResponse.json({ error: 'Sourate non trouvée' }, { status: 400 })
    }

    // Update the recitation
    const updated = await prisma.surahRecitation.update({
      where: { id: recitationId },
      data: {
        surahNumber,
        type: type || 'MEMORIZATION',
        verseStart,
        verseEnd: Math.min(verseEnd, surah.totalVerses),
        status,
        comment,
      },
      include: {
        user: { select: { id: true, name: true } },
        surah: { select: { number: true, nameFr: true, nameAr: true, totalVerses: true } }
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating recitation:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la récitation' },
      { status: 500 }
    )
  }
}

// DELETE /api/sessions/[id]/recitations/[recitationId] - Delete a recitation
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; recitationId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id: sessionId, recitationId } = await params

    // Check if recitation exists and belongs to this session
    const recitation = await prisma.surahRecitation.findUnique({
      where: { id: recitationId },
      include: {
        session: {
          select: { groupId: true }
        }
      }
    })

    if (!recitation || recitation.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Récitation non trouvée' }, { status: 404 })
    }

    // Check if user is global admin or group admin/referent
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    const isGlobalAdmin = currentUser?.role === 'ADMIN'

    if (!isGlobalAdmin) {
      const membership = await prisma.groupMember.findFirst({
        where: {
          groupId: recitation.session.groupId,
          userId: session.user.id,
          role: { in: ['ADMIN', 'REFERENT'] },
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: 'Vous devez être administrateur ou référent pour supprimer une récitation' },
          { status: 403 }
        )
      }
    }

    // Delete the recitation
    await prisma.surahRecitation.delete({
      where: { id: recitationId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting recitation:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la récitation' },
      { status: 500 }
    )
  }
}
