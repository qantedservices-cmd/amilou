import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'
import { getMemorizedZone, objectiveToHizbPerDay, hizbToPosition } from '@/lib/quran-utils'

// GET — Read current positions (non-destructive: never overwrites positions)
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId } = await getEffectiveUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const zone = await getMemorizedZone(userId)

    // Get current positions from DB
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        readingCurrentHizb: true,
        revisionCurrentHizb: true,
        revisionSuspendedHizb: true,
      }
    })

    const readingHizb = user?.readingCurrentHizb ?? 0
    const revisionHizb = user?.revisionCurrentHizb ?? 0
    const isSuspended = user?.revisionSuspendedHizb !== null && user?.revisionSuspendedHizb !== undefined

    // Get programs and settings for display
    const [revisionProgram, readingProgram] = await Promise.all([
      prisma.program.findFirst({ where: { code: 'REVISION' } }),
      prisma.program.findFirst({ where: { code: 'READING' } }),
    ])

    const programSettings = await prisma.userProgramSettings.findMany({
      where: {
        userId,
        isActive: true,
        programId: { in: [revisionProgram?.id, readingProgram?.id].filter(Boolean) as string[] }
      },
      include: { program: true }
    })

    const revisionSettings = revisionProgram ? programSettings.find(s => s.programId === revisionProgram.id) : null
    const readingSettings = readingProgram ? programSettings.find(s => s.programId === readingProgram.id) : null

    // Convert to readable positions
    // Lecture +1 : afficher verset 1 du prochain hizb (où reprendre)
    // Révision : zone.startHizb + offset donne déjà le prochain hizb
    const readingPos = readingHizb > 0 ? await hizbToPosition(readingHizb + 1) : await hizbToPosition(1)
    const revisionPos = zone && revisionHizb > 0
      ? await hizbToPosition(zone.startHizb + revisionHizb)
      : zone ? await hizbToPosition(zone.startHizb) : null

    const totalHizbs = zone?.totalHizbs ?? 0

    return NextResponse.json({
      reading: readingSettings ? {
        currentHizb: readingHizb,
        totalHizbs: 60,
        surahNumber: readingPos?.surahNumber || 1,
        surahNameAr: readingPos?.surahNameAr || '',
        verseNumber: readingPos?.verseNumber || 1,
        page: readingPos?.page || 1,
        juz: readingPos?.juz || 1,
        percentage: Math.round((readingHizb / 60) * 100)
      } : null,
      revision: revisionSettings ? {
        currentHizb: revisionHizb,
        totalHizbs,
        surahNumber: revisionPos?.surahNumber || 1,
        surahNameAr: revisionPos?.surahNameAr || '',
        verseNumber: revisionPos?.verseNumber || 1,
        page: revisionPos?.page || 1,
        juz: revisionPos?.juz || 1,
        percentage: totalHizbs > 0 ? Math.round((revisionHizb / totalHizbs) * 100) : 0,
        isSuspended
      } : null,
      memorizedZone: zone,
    })
  } catch (error) {
    console.error('Error fetching progress tracker:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des positions' },
      { status: 500 }
    )
  }
}

// PUT — Manual position update
export async function PUT(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId } = await getEffectiveUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { readingHizb, revisionHizb } = body

    // Validate reading hizb
    if (readingHizb !== undefined && (readingHizb < 0 || readingHizb > 60)) {
      return NextResponse.json({ error: 'Hizb de lecture doit être entre 0 et 60' }, { status: 400 })
    }

    // Validate revision hizb against memorized zone
    if (revisionHizb !== undefined) {
      const zone = await getMemorizedZone(userId)
      if (zone && (revisionHizb < 0 || revisionHizb > zone.totalHizbs)) {
        return NextResponse.json({ error: `Hizb de révision doit être entre 0 et ${zone.totalHizbs}` }, { status: 400 })
      }
    }

    const data: Record<string, number | null> = {}
    if (readingHizb !== undefined) data.readingCurrentHizb = readingHizb
    if (revisionHizb !== undefined) data.revisionCurrentHizb = revisionHizb

    await prisma.user.update({
      where: { id: userId },
      data
    })

    // Return updated positions with readable format
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        readingCurrentHizb: true,
        revisionCurrentHizb: true,
        revisionSuspendedHizb: true,
      }
    })

    const zone = await getMemorizedZone(userId)
    const rHizb = updatedUser?.readingCurrentHizb ?? 0
    const rvHizb = updatedUser?.revisionCurrentHizb ?? 0

    const readingPos = rHizb > 0 ? await hizbToPosition(rHizb + 1) : await hizbToPosition(1)
    const revisionPos = zone && rvHizb > 0 ? await hizbToPosition(zone.startHizb + rvHizb) : null

    return NextResponse.json({
      readingCurrentHizb: rHizb,
      revisionCurrentHizb: rvHizb,
      readingPosition: readingPos,
      revisionPosition: revisionPos,
    })
  } catch (error) {
    console.error('Error updating progress tracker:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour des positions' },
      { status: 500 }
    )
  }
}
