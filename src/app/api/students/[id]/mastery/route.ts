import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/students/[id]/mastery - Get mastery status for all surahs
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id: studentId } = await params

    // Authorization check: user can only view their own data unless ADMIN/MANAGER/REFERENT
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    const canViewOthers = ['ADMIN', 'MANAGER', 'REFERENT'].includes(currentUser?.role || '')
    if (studentId !== session.user.id && !canViewOthers) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // Get student info
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, email: true }
    })

    if (!student) {
      return NextResponse.json({ error: 'Élève non trouvé' }, { status: 404 })
    }

    // Get all surahs with mastery status
    const surahs = await prisma.surah.findMany({
      orderBy: { number: 'asc' }
    })

    const masteries = await prisma.surahMastery.findMany({
      where: { userId: studentId }
    })

    const masteryMap = new Map(masteries.map(m => [m.surahNumber, m]))

    // Combine surahs with mastery data
    const result = surahs.map(surah => ({
      surahNumber: surah.number,
      nameAr: surah.nameAr,
      nameFr: surah.nameFr,
      totalVerses: surah.totalVerses,
      mastery: masteryMap.get(surah.number) || null
    }))

    return NextResponse.json({
      student,
      surahs: result,
      stats: {
        total: surahs.length,
        validated: masteries.filter(m => m.status === 'VALIDATED').length,
        known: masteries.filter(m => m.status === 'KNOWN').length,
        inProgress: masteries.filter(m => m.status === 'AM').length,
        partial: masteries.filter(m => m.status === 'PARTIAL').length,
      }
    })
  } catch (error) {
    console.error('Error fetching mastery:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du mastery' },
      { status: 500 }
    )
  }
}

// PUT /api/students/[id]/mastery - Update mastery for a surah
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id: studentId } = await params

    // Authorization check: user can only update their own data unless ADMIN/MANAGER/REFERENT
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    const canUpdateOthers = ['ADMIN', 'MANAGER', 'REFERENT'].includes(currentUser?.role || '')
    if (studentId !== session.user.id && !canUpdateOthers) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { surahNumber, status, validatedWeek, verseStart, verseEnd } = await request.json()

    if (!surahNumber || !status) {
      return NextResponse.json({ error: 'surahNumber et status requis' }, { status: 400 })
    }

    const mastery = await prisma.surahMastery.upsert({
      where: {
        userId_surahNumber: { userId: studentId, surahNumber }
      },
      update: {
        status,
        validatedWeek,
        validatedAt: status === 'VALIDATED' ? new Date() : undefined,
        verseStart,
        verseEnd,
        updatedAt: new Date()
      },
      create: {
        userId: studentId,
        surahNumber,
        status,
        validatedWeek,
        validatedAt: status === 'VALIDATED' ? new Date() : undefined,
        verseStart,
        verseEnd,
      }
    })

    return NextResponse.json(mastery)
  } catch (error) {
    console.error('Error updating mastery:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du mastery' },
      { status: 500 }
    )
  }
}
