import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Support impersonation - show impersonated user's profile
    const { userId: effectiveUserId, isImpersonating } = await getEffectiveUserId()

    const user = await prisma.user.findUnique({
      where: { id: effectiveUserId! },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        privateAttendance: true,
        privateProgress: true,
        privateStats: true,
        privateEvaluations: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ ...user, isImpersonating })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du profil' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Support impersonation
    const { userId: effectiveUserId } = await getEffectiveUserId()

    const body = await request.json()
    const { name, privateAttendance, privateProgress, privateStats, privateEvaluations } = body

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
      }
      updateData.name = name.trim()
    }

    // Privacy settings
    if (privateAttendance !== undefined) updateData.privateAttendance = privateAttendance
    if (privateProgress !== undefined) updateData.privateProgress = privateProgress
    if (privateStats !== undefined) updateData.privateStats = privateStats
    if (privateEvaluations !== undefined) updateData.privateEvaluations = privateEvaluations

    const user = await prisma.user.update({
      where: { id: effectiveUserId! },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        privateAttendance: true,
        privateProgress: true,
        privateStats: true,
        privateEvaluations: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du profil' },
      { status: 500 }
    )
  }
}
