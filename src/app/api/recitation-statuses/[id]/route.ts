import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// PUT /api/recitation-statuses/[id] - Update a status
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (currentUser?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Seuls les administrateurs peuvent modifier des statuts' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { code, label, tooltip, color, sortOrder } = body

    // Check if status exists
    const existing = await prisma.recitationStatus.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Statut non trouvé' }, { status: 404 })
    }

    // If changing code, check it doesn't conflict
    if (code && code !== existing.code) {
      const conflict = await prisma.recitationStatus.findUnique({
        where: { code }
      })
      if (conflict) {
        return NextResponse.json(
          { error: 'Ce code existe déjà' },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.recitationStatus.update({
      where: { id },
      data: {
        ...(code && { code }),
        ...(label && { label }),
        ...(tooltip && { tooltip }),
        ...(color && { color }),
        ...(sortOrder !== undefined && { sortOrder }),
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating recitation status:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du statut' },
      { status: 500 }
    )
  }
}

// DELETE /api/recitation-statuses/[id] - Delete a status
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (currentUser?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Seuls les administrateurs peuvent supprimer des statuts' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Check if status exists and is not a default
    const existing = await prisma.recitationStatus.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Statut non trouvé' }, { status: 404 })
    }

    if (existing.isDefault) {
      return NextResponse.json(
        { error: 'Les statuts par défaut ne peuvent pas être supprimés' },
        { status: 400 }
      )
    }

    // Check if status is used in any recitations
    const usageCount = await prisma.surahRecitation.count({
      where: { status: existing.code }
    })

    if (usageCount > 0) {
      return NextResponse.json(
        { error: `Ce statut est utilisé par ${usageCount} récitation(s)` },
        { status: 400 }
      )
    }

    await prisma.recitationStatus.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting recitation status:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du statut' },
      { status: 500 }
    )
  }
}
