import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    // Find the objective
    const objective = await prisma.weeklyObjective.findUnique({
      where: { id }
    })

    if (!objective) {
      return NextResponse.json({ error: 'Objectif non trouvé' }, { status: 404 })
    }

    // Check permissions
    if (objective.userId !== session.user.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      })
      if (!['ADMIN', 'MANAGER', 'REFERENT'].includes(currentUser?.role || '')) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
    }

    // Only allow deleting custom objectives
    if (!objective.isCustom) {
      return NextResponse.json(
        { error: 'Impossible de supprimer un objectif par défaut' },
        { status: 400 }
      )
    }

    // Delete the objective (cascade will delete completions)
    await prisma.weeklyObjective.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting weekly objective:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'objectif' },
      { status: 500 }
    )
  }
}
