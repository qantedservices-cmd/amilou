import prisma from '@/lib/db'

// Position in the Quran
export interface QuranPosition {
  surahNumber: number
  surahNameAr: string
  verseNumber: number
  page: number
  hizb: number
  juz: number
}

// Zone memorized by a user
export interface MemorizedZone {
  startHizb: number
  endHizb: number
  totalHizbs: number
}

// Convert a hizb number to the first verse of that traditional hizb
// In the Verse table, hizb N starts at hizb value N.0 (exact integer)
// We find the page of that marker, then return the first verse of that page
export async function hizbToPosition(hizb: number): Promise<QuranPosition | null> {
  // Special case: hizb 1 = start of Quran (S1V1, page 1)
  if (hizb <= 1) {
    const first = await prisma.verse.findFirst({
      orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }],
      include: { surah: true }
    })
    if (!first) return null
    return {
      surahNumber: first.surahNumber,
      surahNameAr: first.surah.nameAr,
      verseNumber: first.verseNumber,
      page: first.page,
      hizb: first.hizb || 1,
      juz: first.juz || 1
    }
  }

  // Find the first verse at hizb >= N (the actual hizb boundary)
  const marker = await prisma.verse.findFirst({
    where: { hizb: { gte: hizb } },
    orderBy: { hizb: 'asc' }
  })

  if (!marker) {
    // Beyond last hizb
    const lastVerse = await prisma.verse.findFirst({
      orderBy: { hizb: 'desc' },
      include: { surah: true }
    })
    if (!lastVerse) return null
    return {
      surahNumber: lastVerse.surahNumber,
      surahNameAr: lastVerse.surah.nameAr,
      verseNumber: lastVerse.verseNumber,
      page: lastVerse.page,
      hizb: lastVerse.hizb || 60,
      juz: lastVerse.juz || 30
    }
  }

  // Get the first verse of that hizb (exact boundary)
  const firstOfHizb = await prisma.verse.findFirst({
    where: { hizb: marker.hizb },
    orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }],
    include: { surah: true }
  })

  if (!firstOfHizb) return null

  return {
    surahNumber: firstOfHizb.surahNumber,
    surahNameAr: firstOfHizb.surah.nameAr,
    verseNumber: firstOfHizb.verseNumber,
    page: firstOfHizb.page,
    hizb: firstOfHizb.hizb || 0,
    juz: firstOfHizb.juz || 0
  }
}

// Calculate the memorized zone in hizbs
export async function getMemorizedZone(userId: string): Promise<MemorizedZone | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      memorizationStartSurah: true,
      memorizationStartVerse: true,
      memorizationDirection: true
    }
  })

  const memorizationProgram = await prisma.program.findFirst({
    where: { code: 'MEMORIZATION' }
  })

  if (!memorizationProgram) return null

  // Find the last memorization entry
  const lastMemorization = await prisma.progress.findFirst({
    where: {
      userId,
      programId: memorizationProgram.id
    },
    orderBy: [
      { date: 'desc' },
      { surahNumber: 'desc' },
      { verseEnd: 'desc' }
    ]
  })

  if (!lastMemorization) return null

  // Get hizb for last memorized verse
  const endVerse = await prisma.verse.findUnique({
    where: {
      surahNumber_verseNumber: {
        surahNumber: lastMemorization.surahNumber,
        verseNumber: lastMemorization.verseEnd
      }
    }
  })

  if (!endVerse?.hizb) return null

  // Get hizb for start position
  const startSurah = user?.memorizationStartSurah || 1
  const startVerseNum = user?.memorizationStartVerse || 1
  const direction = user?.memorizationDirection || 'FORWARD'

  const startVerse = await prisma.verse.findUnique({
    where: {
      surahNumber_verseNumber: {
        surahNumber: startSurah,
        verseNumber: startVerseNum
      }
    }
  })

  const startHizbRaw = startVerse?.hizb || 1

  if (direction === 'FORWARD') {
    const startHizb = Math.floor(startHizbRaw)
    const endHizb = Math.ceil(endVerse.hizb)
    // totalHizbs = nombre de hizbs à réviser (hizb entamé inclus, sans compter le +1)
    // Ex: hizb 1 à 19 = 19 hizbs à parcourir (positions 0 à 19)
    return {
      startHizb,
      endHizb,
      totalHizbs: endHizb - startHizb
    }
  } else {
    // BACKWARD: start is at higher hizb, end is at lower
    const startHizb = Math.ceil(startHizbRaw)
    const endHizb = Math.floor(endVerse.hizb)
    return {
      startHizb: endHizb,
      endHizb: startHizb,
      totalHizbs: startHizb - endHizb
    }
  }
}

// Convert objective (quantity+unit+period) to hizbs per day
export function objectiveToHizbPerDay(quantity: number, unit: string, period: string): number {
  // Convert unit to hizbs
  let hizbsPerUnit: number
  switch (unit) {
    case 'QUART':
      hizbsPerUnit = 0.25
      break
    case 'DEMI_HIZB':
      hizbsPerUnit = 0.5
      break
    case 'HIZB':
      hizbsPerUnit = 1
      break
    case 'JUZ':
      hizbsPerUnit = 2
      break
    case 'PAGE':
      hizbsPerUnit = 1 / 10.07 // ~604 pages / 60 hizbs
      break
    default:
      hizbsPerUnit = 1 / 10.07 // default to page
  }

  const totalHizbs = quantity * hizbsPerUnit

  // Convert period to per-day
  switch (period) {
    case 'DAY':
      return totalHizbs
    case 'WEEK':
      return totalHizbs / 7
    case 'MONTH':
      return totalHizbs / 30
    case 'YEAR':
      return totalHizbs / 365
    default:
      return totalHizbs
  }
}

// Recalculate reading and revision positions from the last cycle dates
// Simulates day-by-day advancement with combined phase logic
export async function recalculatePositionsFromCycles(userId: string): Promise<{
  readingHizb: number
  revisionHizb: number
  revisionSuspended: number | null
}> {
  // Fetch zone, programs, cycles all in parallel
  const [zone, revisionProgram, readingProgram, lastLectureCycle, lastRevisionCycle] = await Promise.all([
    getMemorizedZone(userId),
    prisma.program.findFirst({ where: { code: 'REVISION' } }),
    prisma.program.findFirst({ where: { code: 'READING' } }),
    prisma.completionCycle.findFirst({ where: { userId, type: 'LECTURE' }, orderBy: { completedAt: 'desc' } }),
    prisma.completionCycle.findFirst({ where: { userId, type: 'REVISION' }, orderBy: { completedAt: 'desc' } }),
  ])

  // Get settings (needs program IDs)
  const programSettings = await prisma.userProgramSettings.findMany({
    where: {
      userId,
      isActive: true,
      programId: { in: [revisionProgram?.id, readingProgram?.id].filter(Boolean) as string[] }
    }
  })

  const readingSettings = readingProgram ? programSettings.find(s => s.programId === readingProgram.id) : null
  const revisionSettings = revisionProgram ? programSettings.find(s => s.programId === revisionProgram.id) : null
  const readingHizbPerDay = readingSettings ? objectiveToHizbPerDay(readingSettings.quantity, readingSettings.unit, readingSettings.period) : 0
  const revisionHizbPerDay = revisionSettings ? objectiveToHizbPerDay(revisionSettings.quantity, revisionSettings.unit, revisionSettings.period) : 0

  const lectureCycleDate = lastLectureCycle
    ? new Date(new Date(lastLectureCycle.completedAt).toISOString().split('T')[0])
    : null
  const revisionCycleDate = lastRevisionCycle
    ? new Date(new Date(lastRevisionCycle.completedAt).toISOString().split('T')[0])
    : null

  // Fetch completions + adjustments in parallel
  const [readingDaysResult, revisionDaysResult, adjustmentsResult] = await Promise.all([
    readingProgram ? prisma.dailyProgramCompletion.findMany({
      where: {
        userId,
        programId: readingProgram.id,
        completed: true,
        ...(lectureCycleDate ? { date: { gt: lectureCycleDate } } : {})
      },
      orderBy: { date: 'asc' },
      select: { date: true }
    }) : Promise.resolve([]),
    revisionProgram ? prisma.dailyProgramCompletion.findMany({
      where: {
        userId,
        programId: revisionProgram.id,
        completed: true,
        ...(revisionCycleDate ? { date: { gt: revisionCycleDate } } : {})
      },
      orderBy: { date: 'asc' },
      select: { date: true }
    }) : Promise.resolve([]),
    prisma.positionAdjustment.findMany({
      where: {
        userId,
        date: {
          gt: new Date(Math.min(
            lectureCycleDate?.getTime() || 0,
            revisionCycleDate?.getTime() || 0
          ) || 0)
        }
      },
      orderBy: { date: 'asc' },
    }),
  ])

  const readingDays = readingDaysResult
  const revisionDays = revisionDaysResult
  const adjustments = adjustmentsResult

  // Keep only the LAST adjustment per date (multiple adjustments same day → last wins)
  const adjustmentsByDate = new Map<string, typeof adjustments[0]>()
  for (const adj of adjustments) {
    adjustmentsByDate.set(adj.date.toISOString().split('T')[0], adj)
  }

  // Simulate day by day with combined phase
  let readingHizb = 0
  let revisionHizb = 0
  let revisionSuspended: number | null = null
  const newCycles: Array<{ type: 'REVISION' | 'LECTURE'; date: string; hizbCount: number; notes: string }> = []

  const isInMemorizedZone = (hizb: number): boolean => {
    if (!zone || zone.totalHizbs <= 0) return false
    return hizb >= zone.startHizb && hizb <= zone.endHizb
  }

  // Merge into date-based timeline (include adjustment dates too)
  const readingDateSet = new Set(readingDays.map(d => d.date.toISOString().split('T')[0]))
  const revisionDateSet = new Set(revisionDays.map(d => d.date.toISOString().split('T')[0]))
  const adjustmentDateSet = new Set(adjustmentsByDate.keys())
  const allDates = [...new Set([...readingDateSet, ...revisionDateSet, ...adjustmentDateSet])].sort()

  for (const dateStr of allDates) {
    // Apply manual adjustment — overrides position AND skips advancement for that day
    const adj = adjustmentsByDate.get(dateStr)
    let readingAdjusted = false
    let revisionAdjusted = false
    if (adj) {
      if (adj.readingHizb !== null) {
        readingHizb = adj.readingHizb
        readingAdjusted = true
      }
      if (adj.revisionHizb !== null) {
        revisionHizb = adj.revisionHizb
        revisionAdjusted = true
        if (revisionSuspended !== null) {
          revisionSuspended = null
        }
      }
    }

    const hasReading = readingDateSet.has(dateStr) && !readingAdjusted
    const hasRevision = revisionDateSet.has(dateStr) && !revisionAdjusted

    // Process reading first (may suspend/resume revision)
    if (hasReading && readingHizbPerDay > 0) {
      const wasInZone = isInMemorizedZone(readingHizb)
      const speed = wasInZone ? 2 : 1
      readingHizb += speed * readingHizbPerDay

      // Handle wrap (reading exceeds 60 = full Quran)
      while (readingHizb >= 60) {
        readingHizb -= 60
        newCycles.push({ type: 'LECTURE', date: dateStr, hizbCount: 60, notes: 'Auto-cycle' })
        if (revisionSuspended !== null) {
          revisionHizb = revisionSuspended
          revisionSuspended = null
        }
        if (isInMemorizedZone(readingHizb) && revisionSuspended === null) {
          revisionSuspended = revisionHizb
        }
      }

      if (readingHizb < 60) {
        const isNowInZone = isInMemorizedZone(readingHizb)
        if (!wasInZone && isNowInZone && revisionSuspended === null) {
          revisionSuspended = revisionHizb
        }
        if (wasInZone && !isNowInZone && revisionSuspended !== null) {
          revisionHizb = revisionSuspended
          revisionSuspended = null
        }
      }
    }

    // Process revision (only if not suspended)
    if (hasRevision && revisionHizbPerDay > 0 && revisionSuspended === null && zone && zone.totalHizbs > 0) {
      revisionHizb += revisionHizbPerDay
      while (revisionHizb >= zone.totalHizbs) {
        revisionHizb -= zone.totalHizbs
        newCycles.push({ type: 'REVISION', date: dateStr, hizbCount: zone.totalHizbs, notes: 'Auto-cycle' })
      }
    }
  }

  // Create any missing cycles in DB
  for (const cycle of newCycles) {
    const cycleDate = new Date(cycle.date + 'T12:00:00.000Z')
    // Check if cycle already exists for this date/type
    const existing = await prisma.completionCycle.findFirst({
      where: {
        userId,
        type: cycle.type,
        completedAt: {
          gte: new Date(cycle.date + 'T00:00:00.000Z'),
          lt: new Date(cycle.date + 'T23:59:59.999Z'),
        }
      }
    })
    if (!existing) {
      await prisma.completionCycle.create({
        data: {
          userId,
          type: cycle.type,
          completedAt: cycleDate,
          hizbCount: cycle.hizbCount,
          notes: cycle.notes,
        }
      })
    }
  }

  return {
    readingHizb: Math.round(readingHizb),
    revisionHizb: Math.round(revisionHizb),
    revisionSuspended: revisionSuspended !== null ? Math.round(revisionSuspended) : null
  }
}

// Format hizb per day as readable objective label
export function formatObjectiveLabel(quantity: number, unit: string, period: string): string {
  const unitLabels: Record<string, string> = {
    'PAGE': 'page(s)',
    'QUART': 'quart(s)',
    'DEMI_HIZB': 'demi-hizb(s)',
    'HIZB': 'hizb(s)',
    'JUZ': 'juz'
  }
  const periodLabels: Record<string, string> = {
    'DAY': '/jour',
    'WEEK': '/semaine',
    'MONTH': '/mois',
    'YEAR': '/an'
  }
  return `${quantity} ${unitLabels[unit] || unit}${periodLabels[period] || ''}`
}
