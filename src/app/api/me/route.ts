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

    // Support impersonation - return impersonated user's data if active
    const { userId, isImpersonating } = await getEffectiveUserId()

    const user = await prisma.user.findUnique({
      where: { id: userId! },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ ...user, isImpersonating })
  } catch (error) {
    console.error('Error fetching current user:', error)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'utilisateur" },
      { status: 500 }
    )
  }
}
