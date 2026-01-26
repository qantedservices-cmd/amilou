import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId, name, programId } = await request.json()

    // Check permissions for modifying another user
    const targetUserId = userId || session.user.id
    if (targetUserId !== session.user.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      })
      if (!['ADMIN', 'MANAGER', 'REFERENT'].includes(currentUser?.role || '')) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    }

    // Check for duplicate name
    const existing = await prisma.weeklyObjective.findFirst({
      where: {
        userId: targetUserId,
        name: name.trim(),
        isActive: true
      }
    })

    if (existing) {
      return NextResponse.json({ error: 'Un objectif avec ce nom existe déjà' }, { status: 400 })
    }

    // Validate program if provided
    if (programId) {
      const program = await prisma.program.findUnique({
        where: { id: programId }
      })
      if (!program) {
        return NextResponse.json({ error: 'Programme non trouvé' }, { status: 404 })
      }
    }

    const objective = await prisma.weeklyObjective.create({
      data: {
        userId: targetUserId,
        name: name.trim(),
        programId: programId || null,
        isCustom: true,
        isActive: true
      },
      include: { program: true }
    })

    return NextResponse.json({
      id: objective.id,
      name: objective.name,
      programId: objective.programId,
      programCode: objective.program?.code || null,
      isCustom: objective.isCustom,
      completed: false,
      completionId: null
    })
  } catch (error) {
    console.error('Error creating weekly objective:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'objectif' },
      { status: 500 }
    )
  }
}
