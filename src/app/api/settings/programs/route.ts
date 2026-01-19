import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// GET - Récupérer les paramètres de programmes d'un utilisateur
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // Vérifier les permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    // Déterminer l'utilisateur cible
    let targetUserId = session.user.id
    if (userId && userId !== session.user.id) {
      // Vérifier si l'utilisateur a le droit de voir les paramètres d'un autre
      if (!['ADMIN', 'MANAGER', 'REFERENT'].includes(currentUser?.role || '')) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
      targetUserId = userId
    }

    const settings = await prisma.userProgramSettings.findMany({
      where: { userId: targetUserId },
      include: {
        program: {
          select: {
            id: true,
            code: true,
            nameFr: true,
            nameAr: true,
            nameEn: true
          }
        }
      },
      orderBy: { program: { code: 'asc' } }
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching program settings:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paramètres' },
      { status: 500 }
    )
  }
}

// POST - Créer ou mettre à jour les paramètres
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, programId, quantity, unit, period, isActive } = body

    if (!programId) {
      return NextResponse.json({ error: 'programId requis' }, { status: 400 })
    }

    // Vérifier les permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    // Déterminer l'utilisateur cible
    let targetUserId = session.user.id
    if (userId && userId !== session.user.id) {
      if (!['ADMIN', 'MANAGER', 'REFERENT'].includes(currentUser?.role || '')) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
      targetUserId = userId
    }

    // Valider les valeurs
    const validUnits = ['PAGE', 'QUART', 'DEMI_HIZB', 'HIZB', 'JUZ']
    const validPeriods = ['DAY', 'WEEK', 'MONTH', 'YEAR']

    if (unit && !validUnits.includes(unit)) {
      return NextResponse.json({ error: 'Unité invalide' }, { status: 400 })
    }
    if (period && !validPeriods.includes(period)) {
      return NextResponse.json({ error: 'Période invalide' }, { status: 400 })
    }

    // Upsert (créer ou mettre à jour)
    const setting = await prisma.userProgramSettings.upsert({
      where: {
        userId_programId: {
          userId: targetUserId,
          programId: programId
        }
      },
      update: {
        quantity: quantity ?? 1,
        unit: unit ?? 'PAGE',
        period: period ?? 'DAY',
        isActive: isActive ?? true
      },
      create: {
        userId: targetUserId,
        programId: programId,
        quantity: quantity ?? 1,
        unit: unit ?? 'PAGE',
        period: period ?? 'DAY',
        isActive: isActive ?? true
      },
      include: {
        program: {
          select: {
            id: true,
            code: true,
            nameFr: true
          }
        }
      }
    })

    return NextResponse.json(setting)
  } catch (error) {
    console.error('Error saving program settings:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'enregistrement des paramètres' },
      { status: 500 }
    )
  }
}

// DELETE - Supprimer un paramètre
export async function DELETE(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }

    // Vérifier que le paramètre appartient à l'utilisateur ou que c'est un admin
    const setting = await prisma.userProgramSettings.findUnique({
      where: { id }
    })

    if (!setting) {
      return NextResponse.json({ error: 'Paramètre non trouvé' }, { status: 404 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (setting.userId !== session.user.id && currentUser?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    await prisma.userProgramSettings.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting program settings:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression' },
      { status: 500 }
    )
  }
}
