import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'
import { getMemorizedZone, objectiveToHizbPerDay, hizbToPosition } from '@/lib/quran-utils'

// GET — Recalculate positions from completed days since last cycle
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

    // Get last cycles
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

    // Get current positions
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        readingCurrentHizb: true,
        revisionCurrentHizb: true,
        revisionSuspendedHizb: true,
      }
    })

    let readingHizb = user?.readingCurrentHizb ?? 0
    let revisionHizb = user?.revisionCurrentHizb ?? 0
    let revisionSuspended = user?.revisionSuspendedHizb ?? null

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

    // Calculate reading advancement
    const readingAdvance = readingDays * readingHizbPerDay
    const cyclesCreated: Array<{ type: string; notes: string }> = []

    // Simulate reading advancement hizb by hizb for combined phase detection
    let remainingReadingAdvance = readingAdvance
    while (remainingReadingAdvance > 0) {
      const step = Math.min(remainingReadingAdvance, 1)
      const newReadingHizb = readingHizb + step

      // Check if reading enters memorized zone
      if (newReadingHizb >= zone.startHizb && newReadingHizb <= zone.endHizb) {
        if (revisionSuspended === null) {
          revisionSuspended = revisionHizb // save revision position
        }
        // Double speed: advance by 2 steps instead of 1
        readingHizb += step * 2
        remainingReadingAdvance -= step
      } else {
        // Check if we just exited the memorized zone
        if (revisionSuspended !== null && readingHizb >= zone.startHizb && readingHizb <= zone.endHizb) {
          // Exiting memorized zone -> cycle revision completed via combined mode
          cyclesCreated.push({ type: 'REVISION', notes: 'Mode combiné' })
          revisionHizb = revisionSuspended // resume where we left off
          revisionSuspended = null
        }
        readingHizb += step
        remainingReadingAdvance -= step
      }

      // Check if reading completed a full cycle
      if (readingHizb >= 60) {
        cyclesCreated.push({ type: 'LECTURE', notes: 'Auto-calculé' })
        readingHizb = readingHizb - 60 // wrap around
      }
    }

    // Calculate revision advancement (only if not suspended)
    if (revisionSuspended === null) {
      const revisionAdvance = revisionDays * revisionHizbPerDay
      revisionHizb += revisionAdvance

      // Check if revision completed its zone
      if (revisionHizb >= zone.totalHizbs) {
        cyclesCreated.push({ type: 'REVISION', notes: 'Auto-calculé' })
        revisionHizb = revisionHizb - zone.totalHizbs // wrap around
      }
    }

    // Create auto cycles
    for (const cycle of cyclesCreated) {
      await prisma.completionCycle.create({
        data: {
          userId,
          type: cycle.type,
          completedAt: new Date(),
          notes: cycle.notes,
        }
      })
    }

    // Save positions
    await prisma.user.update({
      where: { id: userId },
      data: {
        readingCurrentHizb: readingHizb,
        revisionCurrentHizb: revisionHizb,
        revisionSuspendedHizb: revisionSuspended,
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
        isSuspended: revisionSuspended !== null
      } : null,
      memorizedZone: zone,
      cyclesCreated: cyclesCreated.length,
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
