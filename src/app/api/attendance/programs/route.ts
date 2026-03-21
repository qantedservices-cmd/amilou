import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { objectiveToHizbPerDay, getMemorizedZone } from '@/lib/quran-utils'

// Daily programs in order
const DAILY_PROGRAMS = ['MEMORIZATION', 'CONSOLIDATION', 'REVISION', 'READING']

// Get Sunday (week start) from a date in UTC
function getWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dow = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - dow)
  return d
}

// Get all dates for a week starting from Sunday in UTC
function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setUTCDate(weekStart.getUTCDate() + i)
    dates.push(d)
  }
  return dates
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart') // Format: YYYY-MM-DD
    const userId = searchParams.get('userId')

    // Check permissions for viewing another user
    const targetUserId = userId || session.user.id
    if (targetUserId !== session.user.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      })
      if (!['ADMIN', 'MANAGER', 'REFERENT'].includes(currentUser?.role || '')) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
    }

    // Determine week start date (in UTC)
    let weekStart: Date
    if (weekStartParam) {
      // Parse as UTC
      weekStart = new Date(weekStartParam + 'T00:00:00.000Z')
      // Ensure it's a Sunday
      const dow = weekStart.getUTCDay()
      if (dow !== 0) {
        weekStart.setUTCDate(weekStart.getUTCDate() - dow)
      }
    } else {
      weekStart = getWeekStart(new Date())
    }

    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7)

    // Get all programs
    const programs = await prisma.program.findMany({
      where: { code: { in: DAILY_PROGRAMS } },
      orderBy: { code: 'asc' }
    })

    // Get completions for the week
    const completions = await prisma.dailyProgramCompletion.findMany({
      where: {
        userId: targetUserId,
        date: {
          gte: weekStart,
          lt: weekEnd
        }
      },
      include: { program: true }
    })

    // Build a matrix: { programId: { dayIndex: completed } }
    const weekDates = getWeekDates(weekStart)
    const completionMatrix: Record<string, Record<number, boolean>> = {}

    for (const program of programs) {
      completionMatrix[program.id] = {}
      for (let i = 0; i < 7; i++) {
        completionMatrix[program.id][i] = false
      }
    }

    for (const completion of completions) {
      const date = new Date(completion.date)
      // Calculate day index based on UTC dates
      const dayIndex = Math.round((date.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000))
      if (dayIndex >= 0 && dayIndex < 7 && completionMatrix[completion.programId]) {
        completionMatrix[completion.programId][dayIndex] = completion.completed
      }
    }

    // Sort programs in the correct order
    const sortedPrograms = DAILY_PROGRAMS
      .map(code => programs.find(p => p.code === code))
      .filter(Boolean)

    // Get user's program settings (objectives)
    const programSettings = await prisma.userProgramSettings.findMany({
      where: {
        userId: targetUserId,
        isActive: true,
        programId: { in: programs.map(p => p.id) }
      }
    })

    // Build objectives map: { programId: { quantity, unit, period } }
    const objectives: Record<string, { quantity: number; unit: string; period: string } | null> = {}
    for (const program of programs) {
      const setting = programSettings.find(s => s.programId === program.id)
      objectives[program.id] = setting
        ? { quantity: setting.quantity, unit: setting.unit, period: setting.period }
        : null
    }

    return NextResponse.json({
      weekStart: weekStart.toISOString(),
      weekDates: weekDates.map(d => d.toISOString()),
      programs: sortedPrograms,
      completions: completionMatrix,
      objectives
    })
  } catch (error) {
    console.error('Error fetching program completions:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des programmes' },
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

    const { userId, completions } = await request.json()
    // completions: { programId: { dayIndex: { date: string, completed: boolean } } }

    // Check permissions for modifying another user
    const targetUserId = userId || session.user.id
    if (targetUserId !== session.user.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      })
      if (!['ADMIN', 'MANAGER', 'REFERENT'].includes(currentUser?.role || '')) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
    }

    // Validate programs
    const programIds = Object.keys(completions)
    const programs = await prisma.program.findMany({
      where: { id: { in: programIds } }
    })
    const validProgramIds = new Set(programs.map(p => p.id))

    // Process each completion
    const operations = []
    for (const programId of programIds) {
      if (!validProgramIds.has(programId)) continue

      const programCompletions = completions[programId]
      for (const dayIndex of Object.keys(programCompletions)) {
        const { date, completed } = programCompletions[dayIndex]
        // Parse date as YYYY-MM-DD in UTC to avoid timezone issues
        const dateObj = new Date(date + 'T00:00:00.000Z')

        if (completed) {
          operations.push(
            prisma.dailyProgramCompletion.upsert({
              where: {
                userId_programId_date: {
                  userId: targetUserId,
                  programId,
                  date: dateObj
                }
              },
              update: { completed: true },
              create: {
                userId: targetUserId,
                programId,
                date: dateObj,
                completed: true,
                createdBy: session.user.id
              }
            })
          )
        } else {
          // Delete the record if unchecked
          operations.push(
            prisma.dailyProgramCompletion.deleteMany({
              where: {
                userId: targetUserId,
                programId,
                date: dateObj
              }
            })
          )
        }
      }
    }

    await Promise.all(operations)

    // Incremental position advancement for REVISION and READING programs
    const revisionProgram = programs.find(p => p.code === 'REVISION')
    const readingProgram = programs.find(p => p.code === 'READING')

    const trackedProgramIds = new Set(
      [revisionProgram?.id, readingProgram?.id].filter(Boolean) as string[]
    )

    // Count net changes per tracked program: +1 for checked, -1 for unchecked
    const netChanges: Record<string, number> = {}
    for (const programId of programIds) {
      if (!trackedProgramIds.has(programId)) continue
      const programCompletions = completions[programId]
      for (const dayIndex of Object.keys(programCompletions)) {
        const { completed } = programCompletions[dayIndex]
        if (!netChanges[programId]) netChanges[programId] = 0
        netChanges[programId] += completed ? 1 : -1
      }
    }

    // Apply position changes if any tracked program was toggled
    if (Object.keys(netChanges).length > 0) {
      // Get user's objectives for tracked programs
      const userSettings = await prisma.userProgramSettings.findMany({
        where: {
          userId: targetUserId,
          isActive: true,
          programId: { in: Object.keys(netChanges) }
        }
      })

      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          readingCurrentHizb: true,
          revisionCurrentHizb: true,
          revisionSuspendedHizb: true,
        }
      })

      let readingHizb = user?.readingCurrentHizb ?? 0
      let revisionHizb = user?.revisionCurrentHizb ?? 0
      let revisionSuspended: number | null = user?.revisionSuspendedHizb ?? null

      const zone = await getMemorizedZone(targetUserId)
      const maxRevisionHizbs = zone?.totalHizbs ?? 0
      const autoCreatedCycles: string[] = []

      // Per-program settings
      const readingSettings = readingProgram ? userSettings.find(s => s.programId === readingProgram.id) : null
      const revisionSettings = revisionProgram ? userSettings.find(s => s.programId === revisionProgram.id) : null
      const readingHizbPerDay = readingSettings ? objectiveToHizbPerDay(readingSettings.quantity, readingSettings.unit, readingSettings.period) : 0
      const revisionHizbPerDay = revisionSettings ? objectiveToHizbPerDay(revisionSettings.quantity, revisionSettings.unit, revisionSettings.period) : 0

      const readingChange = readingProgram ? (netChanges[readingProgram.id] || 0) : 0
      const revisionChange = revisionProgram ? (netChanges[revisionProgram.id] || 0) : 0

      // Helper: check if reading position is within memorized zone
      function isInMemorizedZone(hizb: number): boolean {
        if (!zone || zone.totalHizbs <= 0) return false
        return hizb >= zone.startHizb && hizb <= zone.endHizb
      }

      // === Process READING advancement day by day (handles combined phase) ===
      if (readingChange > 0 && readingHizbPerDay > 0) {
        for (let day = 0; day < readingChange; day++) {
          const wasInZone = isInMemorizedZone(readingHizb)
          const speed = wasInZone ? 2 : 1
          readingHizb += speed * readingHizbPerDay

          // Handle reading cycle completion (wrap around 60 hizbs)
          if (readingHizb >= 60) {
            readingHizb -= 60
            await prisma.completionCycle.create({
              data: { userId: targetUserId, type: 'LECTURE', completedAt: new Date(), daysToComplete: null, hizbCount: 60, notes: 'Cycle automatique' }
            })
            autoCreatedCycles.push('LECTURE')

            // Wrap-around: if revision was suspended, the reading passed through the zone exit
            if (revisionSuspended !== null) {
              await prisma.completionCycle.create({
                data: { userId: targetUserId, type: 'REVISION', completedAt: new Date(), daysToComplete: null, hizbCount: maxRevisionHizbs, notes: 'Mode combiné' }
              })
              autoCreatedCycles.push('REVISION')
              revisionHizb = revisionSuspended
              revisionSuspended = null
            }

            // After wrap, check if new position lands in zone
            if (isInMemorizedZone(readingHizb) && revisionSuspended === null) {
              revisionSuspended = revisionHizb
            }
          } else {
            // No wrap — check zone transitions
            const isNowInZone = isInMemorizedZone(readingHizb)

            if (!wasInZone && isNowInZone && revisionSuspended === null) {
              // Entering zone: suspend revision
              revisionSuspended = revisionHizb
            }

            if (wasInZone && !isNowInZone && revisionSuspended !== null) {
              // Exiting zone: create combined revision cycle, resume revision
              await prisma.completionCycle.create({
                data: { userId: targetUserId, type: 'REVISION', completedAt: new Date(), daysToComplete: null, hizbCount: maxRevisionHizbs, notes: 'Mode combiné' }
              })
              autoCreatedCycles.push('REVISION')
              revisionHizb = revisionSuspended
              revisionSuspended = null
            }
          }
        }
      } else if (readingChange < 0 && readingHizbPerDay > 0) {
        // Negative change: simple decrease, no combined phase reversal
        readingHizb += readingChange * readingHizbPerDay
        if (readingHizb < 0) readingHizb = 0
      }

      // === Process REVISION advancement (only if not suspended) ===
      if (revisionChange > 0 && revisionHizbPerDay > 0 && maxRevisionHizbs > 0) {
        if (revisionSuspended === null) {
          // Revision is active — advance day by day
          for (let day = 0; day < revisionChange; day++) {
            revisionHizb += revisionHizbPerDay
            while (revisionHizb >= maxRevisionHizbs) {
              revisionHizb -= maxRevisionHizbs
              await prisma.completionCycle.create({
                data: { userId: targetUserId, type: 'REVISION', completedAt: new Date(), daysToComplete: null, hizbCount: maxRevisionHizbs, notes: 'Cycle automatique' }
              })
              autoCreatedCycles.push('REVISION')
            }
          }
        }
        // If suspended, revision days don't advance (reading covers the zone)
      } else if (revisionChange < 0 && revisionHizbPerDay > 0) {
        revisionHizb += revisionChange * revisionHizbPerDay
        if (revisionHizb < 0) revisionHizb = 0
      }

      // Recalculate daysToComplete for any auto-created cycles
      for (const cycleType of [...new Set(autoCreatedCycles)]) {
        const allCycles = await prisma.completionCycle.findMany({
          where: { userId: targetUserId, type: cycleType },
          orderBy: { completedAt: 'asc' }
        })
        for (let i = 0; i < allCycles.length; i++) {
          let dtc: number | null = null
          if (i > 0) {
            dtc = Math.floor((new Date(allCycles[i].completedAt).getTime() - new Date(allCycles[i - 1].completedAt).getTime()) / (24 * 60 * 60 * 1000))
          }
          if (allCycles[i].daysToComplete !== dtc) {
            await prisma.completionCycle.update({ where: { id: allCycles[i].id }, data: { daysToComplete: dtc } })
          }
        }
      }

      // Save all positions
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          readingCurrentHizb: Math.round(readingHizb),
          revisionCurrentHizb: Math.round(revisionHizb),
          revisionSuspendedHizb: revisionSuspended !== null ? Math.round(revisionSuspended) : null,
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving program completions:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'enregistrement' },
      { status: 500 }
    )
  }
}
