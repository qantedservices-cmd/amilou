import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

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
