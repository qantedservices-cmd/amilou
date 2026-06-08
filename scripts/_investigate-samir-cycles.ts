import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const SAMIR_EMAIL = 'sinlatourelle@gmail.com'

  // 1. Get Samir's user record
  const user = await prisma.user.findUnique({
    where: { email: SAMIR_EMAIL },
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

  if (!user) {
    console.log('User not found')
    return
  }

  console.log('='.repeat(80))
  console.log('1. USER POSITIONS')
  console.log('='.repeat(80))
  console.log(`  Name: ${user.name}`)
  console.log(`  Email: ${user.email}`)
  console.log(`  readingCurrentHizb: ${user.readingCurrentHizb}`)
  console.log(`  revisionCurrentHizb: ${user.revisionCurrentHizb}`)
  console.log(`  revisionSuspendedHizb: ${user.revisionSuspendedHizb}`)
  console.log(`  memorizationStartSurah: ${user.memorizationStartSurah}`)
  console.log(`  memorizationStartVerse: ${user.memorizationStartVerse}`)
  console.log(`  memorizationDirection: ${user.memorizationDirection}`)

  // 2. Get ALL CompletionCycles for Samir
  const allCycles = await prisma.completionCycle.findMany({
    where: { userId: user.id },
    orderBy: { completedAt: 'desc' },
  })

  console.log('\n' + '='.repeat(80))
  console.log('2. ALL COMPLETION CYCLES')
  console.log('='.repeat(80))

  const revisionCycles = allCycles.filter(c => c.type === 'REVISION')
  const lectureCycles = allCycles.filter(c => c.type === 'LECTURE')

  console.log(`\n  Total REVISION cycles: ${revisionCycles.length}`)
  for (const c of revisionCycles) {
    console.log(`    - id: ${c.id}`)
    console.log(`      completedAt: ${c.completedAt.toISOString()}`)
    console.log(`      createdAt:   ${c.createdAt.toISOString()}`)
    console.log(`      daysToComplete: ${c.daysToComplete}`)
    console.log(`      hizbCount: ${c.hizbCount}`)
    console.log(`      notes: ${c.notes}`)
    console.log()
  }

  console.log(`  Total LECTURE cycles: ${lectureCycles.length}`)
  for (const c of lectureCycles) {
    console.log(`    - id: ${c.id}`)
    console.log(`      completedAt: ${c.completedAt.toISOString()}`)
    console.log(`      createdAt:   ${c.createdAt.toISOString()}`)
    console.log(`      daysToComplete: ${c.daysToComplete}`)
    console.log(`      hizbCount: ${c.hizbCount}`)
    console.log(`      notes: ${c.notes}`)
    console.log()
  }

  // 3. Get Samir's REVISION and LECTURE objectives
  const programs = await prisma.program.findMany({
    where: { code: { in: ['REVISION', 'READING'] } }
  })

  const revisionProgram = programs.find(p => p.code === 'REVISION')
  const readingProgram = programs.find(p => p.code === 'READING')

  console.log('='.repeat(80))
  console.log('3. ACTIVE OBJECTIVES (UserProgramSettings)')
  console.log('='.repeat(80))

  const activeSettings = await prisma.userProgramSettings.findMany({
    where: {
      userId: user.id,
      isActive: true,
      programId: { in: programs.map(p => p.id) }
    },
    include: { program: true }
  })

  for (const s of activeSettings) {
    const hizbPerDay = objectiveToHizbPerDay(s.quantity, s.unit, s.period)
    console.log(`  ${s.program.code}:`)
    console.log(`    quantity: ${s.quantity}, unit: ${s.unit}, period: ${s.period}`)
    console.log(`    -> hizb/day: ${hizbPerDay.toFixed(4)}`)
    console.log(`    isActive: ${s.isActive}`)
    console.log(`    startDate: ${s.startDate.toISOString()}`)
    console.log(`    createdAt: ${s.createdAt.toISOString()}`)
    console.log(`    updatedAt: ${s.updatedAt.toISOString()}`)
  }

  // 4. Count DailyProgramCompletion entries since 2026-03-15
  const sinceDate = new Date('2026-03-15T00:00:00.000Z')

  console.log('\n' + '='.repeat(80))
  console.log(`4. DAILY PROGRAM COMPLETIONS SINCE ${sinceDate.toISOString().split('T')[0]}`)
  console.log('='.repeat(80))

  if (revisionProgram) {
    const revCompletions = await prisma.dailyProgramCompletion.findMany({
      where: {
        userId: user.id,
        programId: revisionProgram.id,
        date: { gte: sinceDate },
        completed: true,
      },
      orderBy: { date: 'asc' }
    })
    console.log(`\n  REVISION completions: ${revCompletions.length}`)
    for (const c of revCompletions) {
      console.log(`    - date: ${c.date.toISOString().split('T')[0]}, completed: ${c.completed}, createdAt: ${c.createdAt.toISOString()}`)
    }
  }

  if (readingProgram) {
    const readCompletions = await prisma.dailyProgramCompletion.findMany({
      where: {
        userId: user.id,
        programId: readingProgram.id,
        date: { gte: sinceDate },
        completed: true,
      },
      orderBy: { date: 'asc' }
    })
    console.log(`\n  READING (LECTURE) completions: ${readCompletions.length}`)
    for (const c of readCompletions) {
      console.log(`    - date: ${c.date.toISOString().split('T')[0]}, completed: ${c.completed}, createdAt: ${c.createdAt.toISOString()}`)
    }
  }

  // 5. Calculate expected positions
  console.log('\n' + '='.repeat(80))
  console.log('5. POSITION CALCULATION')
  console.log('='.repeat(80))

  const lastRevisionCycle = revisionCycles[0]
  const lastLectureCycle = lectureCycles[0]

  const revisionSettings = activeSettings.find(s => s.program.code === 'REVISION')
  const readingSettings = activeSettings.find(s => s.program.code === 'READING')

  if (lastRevisionCycle && revisionSettings && revisionProgram) {
    const hizbPerDay = objectiveToHizbPerDay(revisionSettings.quantity, revisionSettings.unit, revisionSettings.period)
    const completionsSinceLastCycle = await prisma.dailyProgramCompletion.count({
      where: {
        userId: user.id,
        programId: revisionProgram.id,
        date: { gt: lastRevisionCycle.completedAt },
        completed: true,
      }
    })
    const expectedRevisionHizb = completionsSinceLastCycle * hizbPerDay
    const maxRevisionHizb = lastRevisionCycle.hizbCount ?? 20

    console.log(`\n  REVISION:`)
    console.log(`    Last cycle completedAt: ${lastRevisionCycle.completedAt.toISOString()}`)
    console.log(`    Hizb/day objective: ${hizbPerDay.toFixed(4)}`)
    console.log(`    Completed days since last cycle: ${completionsSinceLastCycle}`)
    console.log(`    Expected hizb (raw): ${expectedRevisionHizb.toFixed(4)}`)
    console.log(`    Expected hizb (clamped to ${maxRevisionHizb}): ${Math.min(expectedRevisionHizb, maxRevisionHizb).toFixed(4)}`)
    console.log(`    Stored revisionCurrentHizb: ${user.revisionCurrentHizb}`)
    console.log(`    Match: ${Math.round(Math.min(expectedRevisionHizb, maxRevisionHizb)) === user.revisionCurrentHizb ? 'YES' : 'NO'}`)
  }

  if (lastLectureCycle && readingSettings && readingProgram) {
    const hizbPerDay = objectiveToHizbPerDay(readingSettings.quantity, readingSettings.unit, readingSettings.period)
    const completionsSinceLastCycle = await prisma.dailyProgramCompletion.count({
      where: {
        userId: user.id,
        programId: readingProgram.id,
        date: { gt: lastLectureCycle.completedAt },
        completed: true,
      }
    })
    const expectedReadingHizb = completionsSinceLastCycle * hizbPerDay

    console.log(`\n  LECTURE:`)
    console.log(`    Last cycle completedAt: ${lastLectureCycle.completedAt.toISOString()}`)
    console.log(`    Hizb/day objective: ${hizbPerDay.toFixed(4)}`)
    console.log(`    Completed days since last cycle: ${completionsSinceLastCycle}`)
    console.log(`    Expected hizb (raw): ${expectedReadingHizb.toFixed(4)}`)
    console.log(`    Expected hizb (clamped to 60): ${Math.min(expectedReadingHizb, 60).toFixed(4)}`)
    console.log(`    Stored readingCurrentHizb: ${user.readingCurrentHizb}`)
    console.log(`    Match: ${Math.round(Math.min(expectedReadingHizb, 60)) === user.readingCurrentHizb ? 'YES' : 'NO'}`)
  }

  // 6. Look at ALL completions in the vicinity of cycle creation
  console.log('\n' + '='.repeat(80))
  console.log('6. COMPLETIONS AROUND CYCLE CREATION DATES')
  console.log('='.repeat(80))

  for (const cycle of allCycles.slice(0, 6)) {
    const dayBefore = new Date(cycle.completedAt)
    dayBefore.setDate(dayBefore.getDate() - 2)
    const dayAfter = new Date(cycle.completedAt)
    dayAfter.setDate(dayAfter.getDate() + 2)

    const completions = await prisma.dailyProgramCompletion.findMany({
      where: {
        userId: user.id,
        date: { gte: dayBefore, lte: dayAfter },
        completed: true,
      },
      include: { program: true },
      orderBy: { date: 'asc' }
    })

    console.log(`\n  Cycle ${cycle.type} completedAt ${cycle.completedAt.toISOString().split('T')[0]} (created ${cycle.createdAt.toISOString()}):`)
    if (completions.length === 0) {
      console.log('    No completions nearby')
    }
    for (const c of completions) {
      console.log(`    - ${c.date.toISOString().split('T')[0]} ${c.program.code} (created ${c.createdAt.toISOString()})`)
    }
  }

  // 7. Analysis
  console.log('\n' + '='.repeat(80))
  console.log('7. ANALYSIS: MANUAL vs AUTOMATIC CREATION')
  console.log('='.repeat(80))

  console.log('\n  Key observations:')

  for (const cycle of allCycles) {
    const createdAtTime = cycle.createdAt.getTime()
    const completedAtTime = cycle.completedAt.getTime()
    const timeDiff = Math.abs(createdAtTime - completedAtTime)
    const hoursDiff = timeDiff / (1000 * 60 * 60)

    const isManual = hoursDiff > 1 // If created much later than completed date, likely manual
    const hasNotes = !!cycle.notes
    const noteIndicatesAuto = cycle.notes?.toLowerCase().includes('auto') ||
                               cycle.notes?.toLowerCase().includes('mode combiné') ||
                               cycle.notes?.toLowerCase().includes('recalcul')

    console.log(`\n  ${cycle.type} cycle (completedAt: ${cycle.completedAt.toISOString().split('T')[0]}):`)
    console.log(`    completedAt vs createdAt diff: ${hoursDiff.toFixed(1)} hours`)
    console.log(`    Notes: "${cycle.notes || '(none)'}"}`)
    console.log(`    Likely creation method: ${noteIndicatesAuto ? 'AUTOMATIC (note suggests auto)' : isManual ? 'MANUAL (created significantly after completedAt)' : 'MANUAL (via UI, same-day creation)'}`)
  }

  console.log('\n  ----')
  console.log('  IMPORTANT: The codebase shows:')
  console.log('  - CompletionCycles are ONLY created via POST /api/completion-cycles (manual)')
  console.log('  - The progress-tracker GET endpoint only reads positions, never writes')
  console.log('  - The progress-tracker PUT endpoint only updates user positions, never creates cycles')
  console.log('  - The attendance/programs POST endpoint auto-advances positions but does NOT create cycles')
  console.log('  - There is NO automatic cycle creation anywhere in the codebase')
  console.log('  - All cycles were created manually by the user through the UI')

  await prisma.$disconnect()
}

function objectiveToHizbPerDay(quantity: number, unit: string, period: string): number {
  let hizbsPerUnit: number
  switch (unit) {
    case 'QUART': hizbsPerUnit = 0.25; break
    case 'DEMI_HIZB': hizbsPerUnit = 0.5; break
    case 'HIZB': hizbsPerUnit = 1; break
    case 'JUZ': hizbsPerUnit = 2; break
    case 'PAGE': hizbsPerUnit = 1 / 10.07; break
    default: hizbsPerUnit = 1 / 10.07
  }
  const totalHizbs = quantity * hizbsPerUnit
  switch (period) {
    case 'DAY': return totalHizbs
    case 'WEEK': return totalHizbs / 7
    case 'MONTH': return totalHizbs / 30
    case 'YEAR': return totalHizbs / 365
    default: return totalHizbs
  }
}

main().catch(console.error)
