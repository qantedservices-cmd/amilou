import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const { dailyTarget, targetMonths, totalTarget, isActive } = await request.json()

    const existing = await prisma.userObjective.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Objectif non trouvé' }, { status: 404 })
    }

    const objective = await prisma.userObjective.update({
      where: { id },
      data: {
        dailyTarget,
        targetMonths,
        totalTarget,
        isActive,
      },
      include: { program: true },
    })

    return NextResponse.json(objective)
  } catch (error) {
    console.error('Error updating objective:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'objectif' },
      { status: 500 }
    )
  }
}

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

    const existing = await prisma.userObjective.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Objectif non trouvé' }, { status: 404 })
    }

    await prisma.userObjective.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting objective:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'objectif' },
      { status: 500 }
    )
  }
}
