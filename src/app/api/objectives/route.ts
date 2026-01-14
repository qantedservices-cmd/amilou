import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const objectives = await prisma.userObjective.findMany({
      where: { userId: session.user.id },
      include: { program: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(objectives)
  } catch (error) {
    console.error('Error fetching objectives:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des objectifs' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { programId, dailyTarget, targetMonths, totalTarget } = await request.json()

    if (!programId || !dailyTarget) {
      return NextResponse.json(
        { error: 'Programme et objectif quotidien requis' },
        { status: 400 }
      )
    }

    // Deactivate existing objective for this program
    await prisma.userObjective.updateMany({
      where: {
        userId: session.user.id,
        programId,
        isActive: true,
      },
      data: { isActive: false },
    })

    const objective = await prisma.userObjective.create({
      data: {
        userId: session.user.id,
        programId,
        dailyTarget,
        targetMonths,
        totalTarget,
      },
      include: { program: true },
    })

    return NextResponse.json(objective)
  } catch (error) {
    console.error('Error creating objective:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'objectif' },
      { status: 500 }
    )
  }
}
