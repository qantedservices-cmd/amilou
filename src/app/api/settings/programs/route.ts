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
    const includeHistory = searchParams.get('history') === 'true'

    // Vérifier les permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    let targetUserId = session.user.id
    if (userId && userId !== session.user.id) {
      if (!['ADMIN', 'MANAGER', 'REFERENT'].includes(currentUser?.role || '')) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
      targetUserId = userId
    }

    const where = includeHistory
      ? { userId: targetUserId }
      : { userId: targetUserId, isActive: true }

    const settings = await prisma.userProgramSettings.findMany({
      where,
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
      orderBy: [
        { isActive: 'desc' },
        { startDate: 'desc' }
      ]
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

// POST - Enregistrer tous les objectifs (batch)
// Accepte soit un objet unique {programId, quantity, unit, period}
// soit un tableau [{programId, quantity, unit, period}, ...]
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()

    // Vérifier les permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    // Support batch or single
    const items = Array.isArray(body.settings) ? body.settings : (body.programId ? [body] : [])
    const targetUserId = body.userId && body.userId !== session.user.id
      ? ((['ADMIN', 'MANAGER', 'REFERENT'].includes(currentUser?.role || ''))
        ? body.userId : session.user.id)
      : session.user.id

    if (items.length === 0) {
      return NextResponse.json({ error: 'Aucun objectif fourni' }, { status: 400 })
    }

    const validUnits = ['PAGE', 'QUART', 'DEMI_HIZB', 'HIZB', 'JUZ']
    const validPeriods = ['DAY', 'WEEK', 'MONTH', 'YEAR']
    const now = new Date()
    const results = []

    for (const item of items) {
      const { programId, quantity, unit, period } = item

      if (!programId) continue
      if (unit && !validUnits.includes(unit)) continue
      if (period && !validPeriods.includes(period)) continue

      const qty = quantity ?? 1
      const u = unit ?? 'PAGE'
      const p = period ?? 'DAY'

      // Find current active setting for this program
      const existing = await prisma.userProgramSettings.findFirst({
        where: {
          userId: targetUserId,
          programId,
          isActive: true
        }
      })

      // If same values, skip
      if (existing && existing.quantity === qty && existing.unit === u && existing.period === p) {
        results.push(existing)
        continue
      }

      // Archive old setting if exists
      if (existing) {
        await prisma.userProgramSettings.update({
          where: { id: existing.id },
          data: {
            isActive: false,
            endDate: now
          }
        })
      }

      // Create new active setting
      const newSetting = await prisma.userProgramSettings.create({
        data: {
          userId: targetUserId,
          programId,
          quantity: qty,
          unit: u,
          period: p,
          isActive: true,
          startDate: now
        },
        include: {
          program: {
            select: { id: true, code: true, nameFr: true }
          }
        }
      })

      results.push(newSetting)
    }

    return NextResponse.json(results)
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
