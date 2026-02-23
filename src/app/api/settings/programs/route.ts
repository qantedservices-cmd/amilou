import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'

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

    // Support impersonation
    const { userId: effectiveUserId } = await getEffectiveUserId()

    // Use effective user ID by default, or specified userId if admin
    let targetUserId = effectiveUserId!
    if (userId && userId !== effectiveUserId) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      })
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
// Crée un snapshot de TOUS les objectifs, avec mise en avant de ceux modifiés
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()

    // Support impersonation
    const { userId: effectiveUserId } = await getEffectiveUserId()

    // Support batch or single
    const items = Array.isArray(body.settings) ? body.settings : (body.programId ? [body] : [])

    // Use effective user ID by default
    let targetUserId = effectiveUserId!
    if (body.userId && body.userId !== effectiveUserId) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      })
      if (['ADMIN', 'MANAGER', 'REFERENT'].includes(currentUser?.role || '')) {
        targetUserId = body.userId
      }
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'Aucun objectif fourni' }, { status: 400 })
    }

    const validUnits = ['PAGE', 'QUART', 'DEMI_HIZB', 'HIZB', 'JUZ']
    const validPeriods = ['DAY', 'WEEK', 'MONTH', 'YEAR']
    const now = new Date()

    // Get all current active settings
    const currentSettings = await prisma.userProgramSettings.findMany({
      where: {
        userId: targetUserId,
        isActive: true
      }
    })

    // Build map of incoming items by programId
    const incomingMap = new Map<string, { quantity: number; unit: string; period: string }>()
    for (const item of items) {
      const { programId, quantity, unit, period } = item
      if (!programId) continue
      if (unit && !validUnits.includes(unit)) continue
      if (period && !validPeriods.includes(period)) continue

      incomingMap.set(programId, {
        quantity: quantity ?? 1,
        unit: unit ?? 'PAGE',
        period: period ?? 'DAY'
      })
    }

    // Determine which settings actually changed
    const changedProgramIds: string[] = []
    for (const [programId, incoming] of incomingMap) {
      const existing = currentSettings.find(s => s.programId === programId)
      if (!existing ||
          existing.quantity !== incoming.quantity ||
          existing.unit !== incoming.unit ||
          existing.period !== incoming.period) {
        changedProgramIds.push(programId)
      }
    }

    // If nothing changed, return current settings
    if (changedProgramIds.length === 0) {
      return NextResponse.json(currentSettings)
    }

    // Archive ALL current active settings with snapshot info
    const snapshotDate = now
    if (currentSettings.length > 0) {
      await prisma.userProgramSettings.updateMany({
        where: {
          userId: targetUserId,
          isActive: true
        },
        data: {
          isActive: false,
          endDate: now,
          snapshotDate: snapshotDate,
          wasModified: false // Will update specific ones below
        }
      })

      // Mark the ones that were actually modified and update with NEW values
      for (const setting of currentSettings) {
        if (changedProgramIds.includes(setting.programId)) {
          const newValues = incomingMap.get(setting.programId)
          if (newValues) {
            await prisma.userProgramSettings.update({
              where: { id: setting.id },
              data: {
                wasModified: true,
                quantity: newValues.quantity,
                unit: newValues.unit,
                period: newValues.period
              }
            })
          }
        }
      }
    }

    // Create new active settings for ALL programs
    const results = []
    for (const [programId, incoming] of incomingMap) {
      const newSetting = await prisma.userProgramSettings.create({
        data: {
          userId: targetUserId,
          programId,
          quantity: incoming.quantity,
          unit: incoming.unit,
          period: incoming.period,
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

    // Support impersonation
    const { userId: effectiveUserId } = await getEffectiveUserId()

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

    // Allow if it's the effective user's setting or if admin
    if (setting.userId !== effectiveUserId && currentUser?.role !== 'ADMIN') {
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
