/**
 * Analyze correspondence between DailyProgramCompletion and CompletionCycle
 *
 * For each user who has CompletionCycle records:
 * - Count total DailyProgramCompletion entries for REVISION and LECTURE programs
 * - List all CompletionCycle records with dates, type, daysToComplete, hizbCount, notes
 * - Between each cycle pair, count how many days were marked completed in DailyProgramCompletion
 * - Check if daysToComplete matches the actual count
 * - Check User fields: readingCurrentHizb, revisionCurrentHizb, revisionSuspendedHizb
 * - Check UserProgramSettings for REVISION and LECTURE
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface CycleWithGap {
  id: string
  type: string
  completedAt: Date
  daysToComplete: number | null
  hizbCount: number | null
  notes: string | null
  createdAt: Date
  // computed
  actualCompletedDays: number | null
  calendarDays: number | null
  periodStart: Date | null
  periodEnd: Date
  mismatch: boolean
}

async function main() {
  console.log('='.repeat(100))
  console.log('ANALYSIS: DailyProgramCompletion vs CompletionCycle Correspondence')
  console.log('='.repeat(100))
  console.log()

  // Get all programs
  const programs = await prisma.program.findMany()
  const revisionProgram = programs.find(p => p.code === 'REVISION')
  const lectureProgram = programs.find(p => p.code === 'READING') // Note: READING is the program code for Lecture

  console.log('Programs found:')
  programs.forEach(p => console.log(`  - ${p.code} (${p.nameFr}) [id: ${p.id}]`))
  console.log()

  if (!revisionProgram) console.log('WARNING: REVISION program not found!')
  if (!lectureProgram) console.log('WARNING: READING program not found!')

  // Get all users who have CompletionCycle records
  const usersWithCycles = await prisma.user.findMany({
    where: {
      completionCycles: { some: {} }
    },
    select: {
      id: true,
      name: true,
      email: true,
      readingCurrentHizb: true,
      revisionCurrentHizb: true,
      revisionSuspendedHizb: true,
      memorizationStartSurah: true,
      memorizationStartVerse: true,
      memorizationDirection: true,
    }
  })

  console.log(`Found ${usersWithCycles.length} user(s) with CompletionCycle records.\n`)

  for (const user of usersWithCycles) {
    console.log('='.repeat(100))
    console.log(`USER: ${user.name || 'N/A'} (${user.email})`)
    console.log(`  ID: ${user.id}`)
    console.log('='.repeat(100))

    // ─── User Progress Tracker Fields ───
    console.log('\n--- User Progress Tracker Fields ---')
    console.log(`  readingCurrentHizb:    ${user.readingCurrentHizb ?? 'null (not started)'}`)
    console.log(`  revisionCurrentHizb:   ${user.revisionCurrentHizb ?? 'null (not started)'}`)
    console.log(`  revisionSuspendedHizb: ${user.revisionSuspendedHizb ?? 'null (not suspended)'}`)
    console.log(`  memorizationStartSurah:  ${user.memorizationStartSurah ?? 'null'}`)
    console.log(`  memorizationStartVerse:  ${user.memorizationStartVerse ?? 'null'}`)
    console.log(`  memorizationDirection:   ${user.memorizationDirection ?? 'null'}`)

    // ─── UserProgramSettings ───
    console.log('\n--- UserProgramSettings (active, for REVISION & READING) ---')
    const settings = await prisma.userProgramSettings.findMany({
      where: {
        userId: user.id,
        isActive: true,
        programId: {
          in: [revisionProgram?.id, lectureProgram?.id].filter(Boolean) as string[]
        }
      },
      include: { program: true },
      orderBy: { createdAt: 'desc' }
    })

    if (settings.length === 0) {
      console.log('  No active settings found for REVISION or READING.')
    } else {
      for (const s of settings) {
        console.log(`  ${s.program.code}: ${s.quantity} ${s.unit} per ${s.period} (active: ${s.isActive}, start: ${s.startDate.toISOString().slice(0, 10)})`)
      }
    }

    // Also get historical settings
    const allSettings = await prisma.userProgramSettings.findMany({
      where: {
        userId: user.id,
        programId: {
          in: [revisionProgram?.id, lectureProgram?.id].filter(Boolean) as string[]
        }
      },
      include: { program: true },
      orderBy: { createdAt: 'asc' }
    })

    if (allSettings.length > settings.length) {
      console.log(`  (${allSettings.length} total settings including inactive/snapshots)`)
    }

    // ─── DailyProgramCompletion counts ───
    console.log('\n--- DailyProgramCompletion Totals ---')

    for (const prog of [revisionProgram, lectureProgram]) {
      if (!prog) continue

      const totalEntries = await prisma.dailyProgramCompletion.count({
        where: { userId: user.id, programId: prog.id }
      })

      const completedEntries = await prisma.dailyProgramCompletion.count({
        where: { userId: user.id, programId: prog.id, completed: true }
      })

      const notCompletedEntries = await prisma.dailyProgramCompletion.count({
        where: { userId: user.id, programId: prog.id, completed: false }
      })

      // Get date range
      const firstEntry = await prisma.dailyProgramCompletion.findFirst({
        where: { userId: user.id, programId: prog.id, completed: true },
        orderBy: { date: 'asc' }
      })
      const lastEntry = await prisma.dailyProgramCompletion.findFirst({
        where: { userId: user.id, programId: prog.id, completed: true },
        orderBy: { date: 'desc' }
      })

      console.log(`  ${prog.code}:`)
      console.log(`    Total entries: ${totalEntries} (completed: ${completedEntries}, not completed: ${notCompletedEntries})`)
      if (firstEntry && lastEntry) {
        console.log(`    Date range: ${firstEntry.date.toISOString().slice(0, 10)} → ${lastEntry.date.toISOString().slice(0, 10)}`)
      } else {
        console.log(`    No completed entries found.`)
      }
    }

    // ─── CompletionCycles ───
    for (const cycleType of ['REVISION', 'LECTURE'] as const) {
      const programCode = cycleType === 'REVISION' ? 'REVISION' : 'READING'
      const prog = programs.find(p => p.code === programCode)

      console.log(`\n${'─'.repeat(80)}`)
      console.log(`  CompletionCycle records (type=${cycleType}):`)
      console.log(`${'─'.repeat(80)}`)

      const cycles = await prisma.completionCycle.findMany({
        where: { userId: user.id, type: cycleType },
        orderBy: { completedAt: 'asc' }
      })

      if (cycles.length === 0) {
        console.log('    No cycles found.')
        continue
      }

      console.log(`    Total cycles: ${cycles.length}\n`)

      // For each cycle, calculate actual completed days between cycles
      const enrichedCycles: CycleWithGap[] = []

      for (let i = 0; i < cycles.length; i++) {
        const cycle = cycles[i]
        const prevCycle = i > 0 ? cycles[i - 1] : null

        const periodStart = prevCycle ? new Date(prevCycle.completedAt) : null
        const periodEnd = new Date(cycle.completedAt)

        let actualCompletedDays: number | null = null
        let calendarDays: number | null = null

        if (periodStart && prog) {
          // Calendar days between cycles
          calendarDays = Math.floor((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000))

          // Count DailyProgramCompletion where completed=true between the two dates
          actualCompletedDays = await prisma.dailyProgramCompletion.count({
            where: {
              userId: user.id,
              programId: prog.id,
              completed: true,
              date: {
                gt: periodStart, // exclusive start (day after previous cycle completion)
                lte: periodEnd   // inclusive end (day of this cycle completion)
              }
            }
          })
        }

        const mismatch = calendarDays !== null && cycle.daysToComplete !== null && cycle.daysToComplete !== calendarDays

        enrichedCycles.push({
          ...cycle,
          actualCompletedDays,
          calendarDays,
          periodStart,
          periodEnd,
          mismatch,
        })
      }

      // Print table
      console.log('    #  | Completed At | daysToComplete | Calendar Days | Completed Days | Match? | hizbCount | Notes')
      console.log('    ' + '-'.repeat(110))

      for (let i = 0; i < enrichedCycles.length; i++) {
        const c = enrichedCycles[i]
        const dateStr = c.completedAt.toISOString().slice(0, 10)
        const dtc = c.daysToComplete !== null ? String(c.daysToComplete).padStart(5) : ' null'
        const calDays = c.calendarDays !== null ? String(c.calendarDays).padStart(5) : '  N/A'
        const actDays = c.actualCompletedDays !== null ? String(c.actualCompletedDays).padStart(5) : '  N/A'
        const matchDtcVsCal = c.mismatch ? '  MISMATCH (dtc vs cal)' : (c.calendarDays !== null ? '  OK (dtc==cal)' : '  N/A (1st)')
        const matchDtcVsAct = c.actualCompletedDays !== null && c.daysToComplete !== null
          ? (c.daysToComplete === c.actualCompletedDays ? '' : ` | DIFF: dtc(${c.daysToComplete}) vs completed(${c.actualCompletedDays})`)
          : ''
        const hizb = c.hizbCount !== null ? String(c.hizbCount).padStart(5) : ' null'
        const notes = c.notes ? c.notes.slice(0, 40) : ''

        console.log(`    ${String(i + 1).padStart(2)} | ${dateStr}   | ${dtc}          | ${calDays}         | ${actDays}          | ${matchDtcVsCal}${matchDtcVsAct} | ${hizb}     | ${notes}`)
      }

      // Summary
      const mismatches = enrichedCycles.filter(c => c.mismatch)
      const completionGaps = enrichedCycles.filter(c =>
        c.actualCompletedDays !== null && c.calendarDays !== null && c.actualCompletedDays < c.calendarDays
      )

      console.log()
      if (mismatches.length > 0) {
        console.log(`    WARNING: ${mismatches.length} cycle(s) where daysToComplete != calendar days between cycles`)
        for (const m of mismatches) {
          console.log(`      - Cycle #${enrichedCycles.indexOf(m) + 1} (${m.completedAt.toISOString().slice(0, 10)}): daysToComplete=${m.daysToComplete}, calendarDays=${m.calendarDays}`)
        }
      } else {
        console.log(`    OK: All daysToComplete values match calendar days between cycles.`)
      }

      if (completionGaps.length > 0) {
        console.log(`\n    INFO: ${completionGaps.length} cycle(s) where actual completed days < calendar days (missed days):`)
        for (const g of completionGaps) {
          const missedDays = (g.calendarDays || 0) - (g.actualCompletedDays || 0)
          const completionRate = g.calendarDays ? Math.round(((g.actualCompletedDays || 0) / g.calendarDays) * 100) : 0
          console.log(`      - Cycle #${enrichedCycles.indexOf(g) + 1} (${g.completedAt.toISOString().slice(0, 10)}): ${g.actualCompletedDays}/${g.calendarDays} days completed (${completionRate}%, missed ${missedDays} days)`)
        }
      }

      // Also check: are there completed days AFTER the last cycle?
      if (prog) {
        const lastCycle = cycles[cycles.length - 1]
        const daysAfterLastCycle = await prisma.dailyProgramCompletion.count({
          where: {
            userId: user.id,
            programId: prog.id,
            completed: true,
            date: { gt: lastCycle.completedAt }
          }
        })

        if (daysAfterLastCycle > 0) {
          const firstAfter = await prisma.dailyProgramCompletion.findFirst({
            where: {
              userId: user.id,
              programId: prog.id,
              completed: true,
              date: { gt: lastCycle.completedAt }
            },
            orderBy: { date: 'asc' }
          })
          const lastAfter = await prisma.dailyProgramCompletion.findFirst({
            where: {
              userId: user.id,
              programId: prog.id,
              completed: true,
              date: { gt: lastCycle.completedAt }
            },
            orderBy: { date: 'desc' }
          })

          console.log(`\n    CURRENT PROGRESS (after last cycle ${lastCycle.completedAt.toISOString().slice(0, 10)}):`)
          console.log(`      ${daysAfterLastCycle} completed days since last cycle`)
          if (firstAfter && lastAfter) {
            console.log(`      Range: ${firstAfter.date.toISOString().slice(0, 10)} → ${lastAfter.date.toISOString().slice(0, 10)}`)
          }
          const daysSinceLast = Math.floor((Date.now() - lastCycle.completedAt.getTime()) / (24 * 60 * 60 * 1000))
          console.log(`      Days since last cycle: ${daysSinceLast}`)
        }
      }

      // Check for completed days BEFORE the first cycle
      if (prog) {
        const firstCycle = cycles[0]
        const daysBeforeFirstCycle = await prisma.dailyProgramCompletion.count({
          where: {
            userId: user.id,
            programId: prog.id,
            completed: true,
            date: { lt: firstCycle.completedAt }
          }
        })

        if (daysBeforeFirstCycle > 0) {
          const firstBefore = await prisma.dailyProgramCompletion.findFirst({
            where: {
              userId: user.id,
              programId: prog.id,
              completed: true,
              date: { lt: firstCycle.completedAt }
            },
            orderBy: { date: 'asc' }
          })

          console.log(`\n    BEFORE FIRST CYCLE (${firstCycle.completedAt.toISOString().slice(0, 10)}):`)
          console.log(`      ${daysBeforeFirstCycle} completed days before first cycle`)
          if (firstBefore) {
            console.log(`      From: ${firstBefore.date.toISOString().slice(0, 10)}`)
          }
        }
      }
    }

    // ─── Cross-check: completion days with no matching cycle ───
    console.log(`\n${'─'.repeat(80)}`)
    console.log(`  Cross-check: Consistency Summary`)
    console.log(`${'─'.repeat(80)}`)

    for (const prog of [revisionProgram, lectureProgram]) {
      if (!prog) continue
      const cycleType = prog.code === 'REVISION' ? 'REVISION' : 'LECTURE'

      const totalCompletedDays = await prisma.dailyProgramCompletion.count({
        where: { userId: user.id, programId: prog.id, completed: true }
      })

      const cycles = await prisma.completionCycle.findMany({
        where: { userId: user.id, type: cycleType },
        orderBy: { completedAt: 'asc' }
      })

      const totalDaysToComplete = cycles.reduce((sum, c) => sum + (c.daysToComplete || 0), 0)

      // Get last cycle date for "days since"
      const lastCycleDate = cycles.length > 0 ? cycles[cycles.length - 1].completedAt : null

      const daysAfterLast = lastCycleDate ? await prisma.dailyProgramCompletion.count({
        where: {
          userId: user.id,
          programId: prog.id,
          completed: true,
          date: { gt: lastCycleDate }
        }
      }) : 0

      const daysBeforeFirst = cycles.length > 0 ? await prisma.dailyProgramCompletion.count({
        where: {
          userId: user.id,
          programId: prog.id,
          completed: true,
          date: { lte: cycles[0].completedAt }
        }
      }) : 0

      // Sum of completed days across all cycle intervals
      let daysDuringCycles = 0
      for (let i = 1; i < cycles.length; i++) {
        const prev = cycles[i - 1]
        const curr = cycles[i]
        const count = await prisma.dailyProgramCompletion.count({
          where: {
            userId: user.id,
            programId: prog.id,
            completed: true,
            date: { gt: prev.completedAt, lte: curr.completedAt }
          }
        })
        daysDuringCycles += count
      }

      console.log(`\n  ${prog.code} (cycle type: ${cycleType}):`)
      console.log(`    Total DailyProgramCompletion (completed): ${totalCompletedDays}`)
      console.log(`    Total cycles: ${cycles.length}`)
      console.log(`    Sum of daysToComplete across cycles: ${totalDaysToComplete}`)
      console.log(`    Breakdown:`)
      console.log(`      - Days before/on first cycle: ${daysBeforeFirst}`)
      console.log(`      - Days during cycle intervals: ${daysDuringCycles}`)
      console.log(`      - Days after last cycle: ${daysAfterLast}`)
      console.log(`      - Total accounted: ${daysBeforeFirst + daysDuringCycles + daysAfterLast}`)
      if (totalCompletedDays !== daysBeforeFirst + daysDuringCycles + daysAfterLast) {
        console.log(`      WARNING: Total (${totalCompletedDays}) != sum of parts (${daysBeforeFirst + daysDuringCycles + daysAfterLast})`)
      }
    }

    console.log('\n')
  }

  // ─── Users with DailyProgramCompletion but NO CompletionCycles ───
  console.log('='.repeat(100))
  console.log('USERS WITH REVISION/READING COMPLETIONS BUT NO CYCLES')
  console.log('='.repeat(100))

  const allUsersWithCompletions = await prisma.dailyProgramCompletion.findMany({
    where: {
      completed: true,
      programId: { in: [revisionProgram?.id, lectureProgram?.id].filter(Boolean) as string[] }
    },
    select: { userId: true },
    distinct: ['userId']
  })

  const usersWithCycleIds = new Set(usersWithCycles.map(u => u.id))
  const usersWithoutCycles = allUsersWithCompletions.filter(u => !usersWithCycleIds.has(u.userId))

  if (usersWithoutCycles.length === 0) {
    console.log('  None - all users with REVISION/READING completions have cycle records.\n')
  } else {
    for (const uc of usersWithoutCycles) {
      const user = await prisma.user.findUnique({
        where: { id: uc.userId },
        select: { name: true, email: true }
      })

      const revCount = revisionProgram ? await prisma.dailyProgramCompletion.count({
        where: { userId: uc.userId, programId: revisionProgram.id, completed: true }
      }) : 0

      const readCount = lectureProgram ? await prisma.dailyProgramCompletion.count({
        where: { userId: uc.userId, programId: lectureProgram.id, completed: true }
      }) : 0

      console.log(`  ${user?.name || 'N/A'} (${user?.email}): REVISION=${revCount} completed days, READING=${readCount} completed days, but 0 CompletionCycles`)
    }
  }

  console.log('\n' + '='.repeat(100))
  console.log('END OF REPORT')
  console.log('='.repeat(100))

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
