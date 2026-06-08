import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const SAMIR_EMAIL = 'sinlatourelle@gmail.com'
  const user = await prisma.user.findUnique({
    where: { email: SAMIR_EMAIL },
    select: { id: true }
  })

  if (!user) { console.log('User not found'); return }

  const programs = await prisma.program.findMany({
    where: { code: { in: ['REVISION', 'READING'] } }
  })
  const revisionProgram = programs.find(p => p.code === 'REVISION')!
  const readingProgram = programs.find(p => p.code === 'READING')!

  console.log('='.repeat(80))
  console.log('DETAILED TIMELINE: March 15 and after')
  console.log('='.repeat(80))

  // On March 15, what happened in what order?
  // Cycle completedAt = 2026-03-15T00:00:00.000Z (midnight)
  // Revision cycle createdAt = 2026-03-15T05:50:13.119Z
  // Lecture cycle createdAt = 2026-03-15T05:51:16.336Z

  // Revision completion on 2026-03-15 createdAt = 2026-03-15T05:47:58.612Z
  // Reading completion on 2026-03-15 createdAt = 2026-03-15T05:52:54.143Z

  console.log('\nMarch 15 timeline:')
  console.log('  05:47:58 - REVISION daily completion toggled (ON)')
  console.log('  05:48:00 - CONSOLIDATION daily completion toggled (ON)')
  console.log('  05:50:13 - REVISION cycle created (completedAt: midnight)')
  console.log('  05:51:16 - LECTURE cycle created (completedAt: midnight)')
  console.log('  05:52:54 - READING daily completion toggled (ON)')

  // So when the REVISION cycle was created, the REVISION completion for Mar 15 already existed
  // The position was already advanced by that completion

  // Let's check: after toggling REVISION on Mar 15, the attendance/programs endpoint
  // would have advanced revisionCurrentHizb by +2 (hizbPerDay)
  // Then after toggling READING on Mar 15, readingCurrentHizb by +2

  // But stored values are 20 and 60 (max), meaning they wrapped around or were manually set

  // Let's count ALL completions for REVISION and READING
  const allRevisionCompletions = await prisma.dailyProgramCompletion.findMany({
    where: { userId: user.id, programId: revisionProgram.id, completed: true },
    orderBy: { date: 'asc' }
  })

  const allReadingCompletions = await prisma.dailyProgramCompletion.findMany({
    where: { userId: user.id, programId: readingProgram.id, completed: true },
    orderBy: { date: 'asc' }
  })

  console.log(`\nTotal REVISION completions ever: ${allRevisionCompletions.length}`)
  console.log(`Total READING completions ever: ${allReadingCompletions.length}`)

  // Since position is incremented by 2 per completed day (hizb/day = 2),
  // and REVISION wraps at 20 hizbs, READING wraps at 60:
  // revisionCurrentHizb = (total_completions * 2) mod 20? No, it doesn't wrap.
  // Actually, the attendance/programs route clamps values, it doesn't wrap.

  // Let's trace what the position SHOULD be based on all completions
  // since the system was set up (since the objective was set on 2026-02-17)
  const objectiveStartDate = new Date('2026-02-17T18:34:10.188Z')

  const revisionSinceObjective = allRevisionCompletions.filter(
    c => c.date >= objectiveStartDate
  )
  const readingSinceObjective = allReadingCompletions.filter(
    c => c.date >= objectiveStartDate
  )

  console.log(`\nREVISION completions since objective (${objectiveStartDate.toISOString().split('T')[0]}): ${revisionSinceObjective.length}`)
  console.log(`READING completions since objective (${objectiveStartDate.toISOString().split('T')[0]}): ${readingSinceObjective.length}`)

  // The key question: were the positions reset to 0 when cycles were created?
  // Looking at the code: cycles are created via POST /api/completion-cycles
  // That endpoint ONLY creates the cycle record. It does NOT reset positions.
  // The positions are ONLY modified by:
  // 1. PUT /api/progress-tracker (manual)
  // 2. POST /api/attendance/programs (incremental, when toggling completions)

  console.log('\n' + '='.repeat(80))
  console.log('POSITION HISTORY ANALYSIS')
  console.log('='.repeat(80))

  // Since positions are never reset by cycle creation,
  // and they're incremented by 2 per completed day:
  // Let's compute the cumulative increment since a given reference

  // From the last cycle (March 15) — 5 completed days after (Mar 16-20) should give +10
  // But also Mar 15 REVISION was checked BEFORE the cycle was created
  // So position at time of cycle creation already included Mar 15

  // The real question: was the position manually set after creating the cycle?

  // Let's check: after the last REVISION cycle (Mar 15), there are 5 completions (Mar 16-20)
  // That's 5 * 2 = 10 hizbs advancement
  // But ALSO Mar 15 had a completion before the cycle was logged
  // So total since the cycle point = 6 * 2 = 12 (if we count from Mar 15 onwards)
  // But wait, the REVISION completion on Mar 15 was created at 05:47, BEFORE the cycle at 05:50
  // The cycle completedAt is midnight Mar 15, but the daily completion date is also Mar 15

  // The attendance/programs query uses date > lastCycleCompletedAt, not >=
  // But completedAt is midnight 2026-03-15, and the completion date is also midnight 2026-03-15
  // date > midnight = only dates strictly after Mar 15

  // Actually, let me re-count:
  // The query I used was: date: { gt: lastRevisionCycle.completedAt }
  // lastRevisionCycle.completedAt = 2026-03-15T00:00:00.000Z
  // Completions with date > 2026-03-15T00:00:00.000Z:
  // Mar 16, 17, 18, 19, 20 = 5 completions
  // Mar 15 is NOT included (date = midnight Mar 15 = completedAt exactly, not >)
  // So 5 * 2 = 10, but stored is 20. That means 10 extra hizbs somewhere.

  // Possible explanations:
  // 1. Position was NOT reset after creating the cycle (it was already at some value)
  // 2. Position was manually set via PUT /api/progress-tracker

  // Since position is 20 (max for revision) and 60 (max for reading),
  // it looks like positions hit the ceiling

  // Let's check: before the last cycle on Mar 15, what was the sequence?
  // Previous cycle: REVISION on Mar 5, then 10 days of completions (Mar 5-14)
  // That's potentially 10 * 2 = 20 hizbs from Mar 6-15

  // Actually let's count between Mar 5 cycle and Mar 15 cycle:
  const revBetweenCycles = await prisma.dailyProgramCompletion.count({
    where: {
      userId: user.id,
      programId: revisionProgram.id,
      completed: true,
      date: {
        gt: new Date('2026-03-05T00:00:00.000Z'),
        lte: new Date('2026-03-15T00:00:00.000Z'),
      }
    }
  })

  const readBetweenCycles = await prisma.dailyProgramCompletion.count({
    where: {
      userId: user.id,
      programId: readingProgram.id,
      completed: true,
      date: {
        gt: new Date('2026-03-05T00:00:00.000Z'),
        lte: new Date('2026-03-15T00:00:00.000Z'),
      }
    }
  })

  console.log(`\nREVISION completions between Mar 5 and Mar 15 cycles (exclusive/inclusive): ${revBetweenCycles}`)
  console.log(`  -> advancement: ${revBetweenCycles * 2} hizbs (max 20)`)
  console.log(`READING completions between Mar 5 and Mar 15 cycles (READING has no cycle on Mar 5): ${readBetweenCycles}`)

  // Between the LECTURE cycle Feb 17 and LECTURE cycle Mar 15:
  const readBetweenLectureCycles = await prisma.dailyProgramCompletion.count({
    where: {
      userId: user.id,
      programId: readingProgram.id,
      completed: true,
      date: {
        gt: new Date('2026-02-17T00:00:00.000Z'),
        lte: new Date('2026-03-15T00:00:00.000Z'),
      }
    }
  })
  console.log(`READING completions between Feb 17 and Mar 15 LECTURE cycles: ${readBetweenLectureCycles}`)
  console.log(`  -> advancement: ${readBetweenLectureCycles * 2} hizbs (max 60)`)

  // The current position is at MAX for both:
  // revisionCurrentHizb = 20 (max = hizbCount = 20)
  // readingCurrentHizb = 60 (max = 60)
  // This means the positions have been accumulating beyond what they should be
  // since cycles don't reset positions

  console.log('\n' + '='.repeat(80))
  console.log('ROOT CAUSE ANALYSIS')
  console.log('='.repeat(80))
  console.log(`
  CRITICAL FINDING: Cycles do NOT reset positions.

  The attendance/programs endpoint increments positions each time a REVISION
  or READING completion is toggled ON, and decrements when toggled OFF.
  But creating a CompletionCycle does NOT reset the positions to 0.

  This means:
  - revisionCurrentHizb keeps accumulating across cycles
  - It hits the ceiling (20 for revision, 60 for reading) and stays clamped

  Between the Mar 5 REVISION cycle and Mar 15 REVISION cycle:
    ${revBetweenCycles} completions * 2 hizb/day = ${revBetweenCycles * 2} hizbs
    Starting from whatever position was at Mar 5, this added ${revBetweenCycles * 2} hizbs
    Clamped at 20 (zone totalHizbs) -> revisionCurrentHizb = 20

  Between Feb 17 LECTURE cycle and Mar 15 LECTURE cycle:
    ${readBetweenLectureCycles} completions * 2 hizb/day = ${readBetweenLectureCycles * 2} hizbs
    Clamped at 60 -> readingCurrentHizb = 60

  After Mar 15 cycles (Mar 16-20): 5 more completions per program
    -> +10 more hizbs each, but positions were already at ceiling
    -> No change visible (still 20 and 60)

  CONCLUSION:
  - All 14 CompletionCycle records were created MANUALLY by Samir via the UI
    (POST /api/completion-cycles)
  - There is NO automatic cycle creation in the codebase
  - The positions are at maximum because the app never resets them when a cycle completes
  - This is a BUG: after logging a cycle, positions should be reset to 0
    (or to the excess beyond the cycle boundary)
  `)

  await prisma.$disconnect()
}

main().catch(console.error)
