import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')

    // Check if user is ADMIN
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    const isAdmin = currentUser?.role === 'ADMIN'

    // Get groups where user is a member
    const memberships = await prisma.groupMember.findMany({
      where: { userId: session.user.id },
      select: { groupId: true, role: true },
    })

    const groupIds = memberships.map(m => m.groupId)

    // Admin can access any group
    if (groupId && !isAdmin && !groupIds.includes(groupId)) {
      return NextResponse.json({ error: 'Groupe non trouvé' }, { status: 404 })
    }

    // Build where clause
    const whereClause = groupId
      ? { groupId }
      : isAdmin
        ? {}
        : { groupId: { in: groupIds } }

    const sessions = await prisma.groupSession.findMany({
      where: whereClause,
      include: {
        group: true,
        attendance: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        recitations: {
          include: {
            user: { select: { id: true, name: true } },
            surah: { select: { number: true, nameFr: true, nameAr: true, totalVerses: true } }
          }
        }
      },
      orderBy: { date: 'desc' },
      take: 50,
    })

    return NextResponse.json(sessions)
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des séances' },
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

    const { groupId, date, weekNumber, notes } = await request.json()

    if (!groupId || !date) {
      return NextResponse.json({ error: 'Groupe et date requis' }, { status: 400 })
    }

    // Calculate week number if not provided
    let calculatedWeekNumber = weekNumber
    if (!calculatedWeekNumber) {
      const d = new Date(date)
      const startOfYear = new Date(d.getFullYear(), 0, 1)
      const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
      calculatedWeekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7)
    }

    // Check if user is global admin or group admin/referent
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    const isGlobalAdmin = currentUser?.role === 'ADMIN'

    if (!isGlobalAdmin) {
      const membership = await prisma.groupMember.findFirst({
        where: {
          groupId,
          userId: session.user.id,
          role: { in: ['ADMIN', 'REFERENT'] },
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: 'Vous devez être administrateur ou référent pour créer une séance' },
          { status: 403 }
        )
      }
    }

    // Get all group members
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    })

    // Create session with attendance records for all members
    const groupSession = await prisma.groupSession.create({
      data: {
        groupId,
        date: new Date(date),
        weekNumber: calculatedWeekNumber,
        notes,
        createdBy: session.user.id,
        attendance: {
          create: members.map(m => ({
            userId: m.userId,
            present: false,
            excused: false,
          })),
        },
      },
      include: {
        group: true,
        attendance: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(groupSession)
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la séance' },
      { status: 500 }
    )
  }
}
