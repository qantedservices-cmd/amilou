import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'
import { getMemorizedZone, objectiveToHizbPerDay, hizbToPosition } from '@/lib/quran-utils'

// GET — Recalculate positions (idempotent: always computes from scratch since last cycle)
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
    if (!zone) {
      return NextResponse.json({ error: 'Aucune donnée de mémorisation trouvée' }, { status: 400 })
    }

    // Get programs
    const [revisionProgram, readingProgram] = await Promise.all([
      prisma.program.findFirst({ where: { code: 'REVISION' } }),
      prisma.program.findFirst({ where: { code: 'READING' } }),
    ])

    // Get user settings (objectives) for these programs
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

    // Get last cycles (before today — only count manual/real cycles, not auto ones we're about to create)
    const [lastRevisionCycle, lastLectureCycle] = await Promise.all([
      prisma.completionCycle.findFirst({
        where: { userId, type: 'REVISION' },
        orderBy: { completedAt: 'desc' }
      }),
      prisma.completionCycle.findFirst({
        where: { userId, type: 'LECTURE' },
        orderBy: { completedAt: 'desc' }
      }),
    ])

    // Count completed days since last cycle for each program
    const revisionSinceDate = lastRevisionCycle?.completedAt || new Date(2020, 0, 1)
    const lectureSinceDate = lastLectureCycle?.completedAt || new Date(2020, 0, 1)

    const [revisionDays, readingDays] = await Promise.all([
      revisionProgram ? prisma.dailyProgramCompletion.count({
        where: {
          userId,
          programId: revisionProgram.id,
          completed: true,
          date: { gt: revisionSinceDate }
        }
      }) : 0,
      readingProgram ? prisma.dailyProgramCompletion.count({
        where: {
          userId,
          programId: readingProgram.id,
          completed: true,
          date: { gt: lectureSinceDate }
        }
      }) : 0,
    ])

    const revisionHizbPerDay = revisionSettings
      ? objectiveToHizbPerDay(revisionSettings.quantity, revisionSettings.unit, revisionSettings.period)
      : 0
    const readingHizbPerDay = readingSettings
      ? objectiveToHizbPerDay(readingSettings.quantity, readingSettings.unit, readingSettings.period)
      : 0

    // IDEMPOTENT: always start from 0 since last cycle (not from current position)
    let readingHizb = readingDays * readingHizbPerDay
    let revisionHizb = revisionDays * revisionHizbPerDay

    // Cap revision to zone (no auto-cycle creation on recalcul — cycles are manual)
    if (zone.totalHizbs > 0 && revisionHizb > zone.totalHizbs) {
      revisionHizb = revisionHizb % zone.totalHizbs
    }

    // Cap reading to 60 (no auto-cycle creation on recalcul)
    if (readingHizb > 60) {
      readingHizb = readingHizb % 60
    }

    // Save positions
    await prisma.user.update({
      where: { id: userId },
      data: {
        readingCurrentHizb: readingHizb,
        revisionCurrentHizb: revisionHizb,
        revisionSuspendedHizb: null, // Reset suspension on recalcul
      }
    })

    // Convert to readable positions
    const readingPos = readingHizb > 0 ? await hizbToPosition(readingHizb) : await hizbToPosition(0.01)
    const revisionPos = revisionHizb > 0 ? await hizbToPosition(zone.startHizb + revisionHizb) : await hizbToPosition(zone.startHizb)

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
        totalHizbs: zone.totalHizbs,
        surahNumber: revisionPos?.surahNumber || 1,
        surahNameAr: revisionPos?.surahNameAr || '',
        verseNumber: revisionPos?.verseNumber || 1,
        page: revisionPos?.page || 1,
        juz: revisionPos?.juz || 1,
        percentage: zone.totalHizbs > 0 ? Math.round((revisionHizb / zone.totalHizbs) * 100) : 0,
        isSuspended: false
      } : null,
      memorizedZone: zone,
      revisionDays,
      readingDays,
      revisionAdvance: revisionDays * revisionHizbPerDay,
      readingAdvance: readingDays * readingHizbPerDay,
    })
  } catch (error) {
    console.error('Error recalculating progress tracker:', error)
    return NextResponse.json(
      { error: 'Erreur lors du recalcul des positions' },
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

    const readingPos = rHizb > 0 ? await hizbToPosition(rHizb) : await hizbToPosition(0.01)
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
