import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// GET - Récupérer les logs quotidiens
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const date = searchParams.get('date')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const programId = searchParams.get('programId')

    // Vérifier les permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    const isPrivileged = ['ADMIN', 'MANAGER', 'REFERENT'].includes(currentUser?.role || '')

    // Déterminer l'utilisateur cible
    let targetUserId = session.user.id
    if (userId && userId !== session.user.id) {
      if (!isPrivileged) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
      targetUserId = userId
    }

    // Construire le where
    const where: Record<string, unknown> = {}

    // Si pas admin et pas de userId spécifié, limiter à l'utilisateur courant
    if (!isPrivileged || (userId && userId !== 'all')) {
      where.userId = targetUserId
    }

    // Filtrer par date
    if (date) {
      const d = new Date(date)
      d.setHours(0, 0, 0, 0)
      const nextDay = new Date(d)
      nextDay.setDate(nextDay.getDate() + 1)
      where.date = {
        gte: d,
        lt: nextDay
      }
    } else if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    if (programId && programId !== 'all') {
      where.programId = programId
    }

    const logs = await prisma.dailyLog.findMany({
      where,
      include: {
        program: {
          select: {
            id: true,
            code: true,
            nameFr: true,
            nameAr: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { date: 'desc' },
        { program: { code: 'asc' } }
      ],
      take: 500
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('Error fetching daily logs:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des logs' },
      { status: 500 }
    )
  }
}

// POST - Créer ou mettre à jour un log quotidien
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, programId, date, quantity, unit, comment } = body

    if (!programId || quantity === undefined) {
      return NextResponse.json(
        { error: 'programId et quantity requis' },
        { status: 400 }
      )
    }

    // Vérifier les permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    const isPrivileged = ['ADMIN', 'MANAGER', 'REFERENT'].includes(currentUser?.role || '')

    // Déterminer l'utilisateur cible
    let targetUserId = session.user.id
    if (userId && userId !== session.user.id) {
      if (!isPrivileged) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
      targetUserId = userId
    }

    // Valider l'unité
    const validUnits = ['PAGE', 'QUART', 'DEMI_HIZB', 'HIZB', 'JUZ']
    const logUnit = unit || 'PAGE'
    if (!validUnits.includes(logUnit)) {
      return NextResponse.json({ error: 'Unité invalide' }, { status: 400 })
    }

    // Parser la date
    const logDate = date ? new Date(date) : new Date()
    logDate.setHours(0, 0, 0, 0)

    // Upsert (créer ou mettre à jour)
    const log = await prisma.dailyLog.upsert({
      where: {
        userId_programId_date: {
          userId: targetUserId,
          programId: programId,
          date: logDate
        }
      },
      update: {
        quantity: parseFloat(quantity),
        unit: logUnit,
        comment: comment || null,
        createdBy: session.user.id
      },
      create: {
        userId: targetUserId,
        programId: programId,
        date: logDate,
        quantity: parseFloat(quantity),
        unit: logUnit,
        comment: comment || null,
        createdBy: session.user.id
      },
      include: {
        program: {
          select: {
            id: true,
            code: true,
            nameFr: true
          }
        },
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json(log)
  } catch (error) {
    console.error('Error saving daily log:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'enregistrement' },
      { status: 500 }
    )
  }
}

// DELETE - Supprimer un log
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

    // Vérifier que le log existe et les permissions
    const log = await prisma.dailyLog.findUnique({
      where: { id }
    })

    if (!log) {
      return NextResponse.json({ error: 'Log non trouvé' }, { status: 404 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    const isPrivileged = ['ADMIN', 'MANAGER', 'REFERENT'].includes(currentUser?.role || '')

    if (log.userId !== session.user.id && !isPrivileged) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    await prisma.dailyLog.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting daily log:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression' },
      { status: 500 }
    )
  }
}
