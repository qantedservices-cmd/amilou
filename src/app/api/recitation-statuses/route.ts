import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/recitation-statuses - List all statuses
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const statuses = await prisma.recitationStatus.findMany({
      orderBy: { sortOrder: 'asc' }
    })

    return NextResponse.json(statuses)
  } catch (error) {
    console.error('Error fetching recitation statuses:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statuts' },
      { status: 500 }
    )
  }
}

// POST /api/recitation-statuses - Create a new status
export async function POST(request: Request) {
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
        { error: 'Seuls les administrateurs peuvent créer des statuts' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { code, label, tooltip, color } = body

    if (!code || !label || !tooltip) {
      return NextResponse.json(
        { error: 'Code, label et tooltip sont requis' },
        { status: 400 }
      )
    }

    // Check if code already exists
    const existing = await prisma.recitationStatus.findUnique({
      where: { code }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Ce code existe déjà' },
        { status: 400 }
      )
    }

    // Get max sortOrder
    const maxSort = await prisma.recitationStatus.aggregate({
      _max: { sortOrder: true }
    })

    const status = await prisma.recitationStatus.create({
      data: {
        code,
        label,
        tooltip,
        color: color || '#6B7280',
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
        isDefault: false,
      }
    })

    return NextResponse.json(status)
  } catch (error) {
    console.error('Error creating recitation status:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du statut' },
      { status: 500 }
    )
  }
}
