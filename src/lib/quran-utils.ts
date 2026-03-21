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
// In the Verse table, traditional hizb N starts at hizb value N.1 (not N.0)
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

  // Find the first verse at hizb >= N.1 (traditional boundary marker)
  const marker = await prisma.verse.findFirst({
    where: { hizb: { gte: hizb + 0.05 } },
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

  // Get the first verse of that page (verset 1 de la page)
  const firstOfPage = await prisma.verse.findFirst({
    where: { page: marker.page },
    orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }],
    include: { surah: true }
  })

  if (!firstOfPage) return null

  return {
    surahNumber: firstOfPage.surahNumber,
    surahNameAr: firstOfPage.surah.nameAr,
    verseNumber: firstOfPage.verseNumber,
    page: firstOfPage.page,
    hizb: firstOfPage.hizb || 0,
    juz: firstOfPage.juz || 0
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
    return {
      startHizb,
      endHizb,
      totalHizbs: endHizb - startHizb + 1
    }
  } else {
    // BACKWARD: start is at higher hizb, end is at lower
    const startHizb = Math.ceil(startHizbRaw)
    const endHizb = Math.floor(endVerse.hizb)
    return {
      startHizb: endHizb,
      endHizb: startHizb,
      totalHizbs: startHizb - endHizb + 1
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
  const zone = await getMemorizedZone(userId)

  // Get programs
  const [revisionProgram, readingProgram] = await Promise.all([
    prisma.program.findFirst({ where: { code: 'REVISION' } }),
    prisma.program.findFirst({ where: { code: 'READING' } }),
  ])

  // Get active objectives
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

  // Get last cycle dates
  const lastLectureCycle = await prisma.completionCycle.findFirst({
    where: { userId, type: 'LECTURE' },
    orderBy: { completedAt: 'desc' }
  })
  const lastRevisionCycle = await prisma.completionCycle.findFirst({
    where: { userId, type: 'REVISION' },
    orderBy: { completedAt: 'desc' }
  })

  // Get completed days after last cycles
  const readingDays = readingProgram ? await prisma.dailyProgramCompletion.findMany({
    where: {
      userId,
      programId: readingProgram.id,
      completed: true,
      ...(lastLectureCycle ? { date: { gt: lastLectureCycle.completedAt } } : {})
    },
    orderBy: { date: 'asc' },
    select: { date: true }
  }) : []

  const revisionDays = revisionProgram ? await prisma.dailyProgramCompletion.findMany({
    where: {
      userId,
      programId: revisionProgram.id,
      completed: true,
      ...(lastRevisionCycle ? { date: { gt: lastRevisionCycle.completedAt } } : {})
    },
    orderBy: { date: 'asc' },
    select: { date: true }
  }) : []

  // Simulate day by day with combined phase
  let readingHizb = 0
  let revisionHizb = 0
  let revisionSuspended: number | null = null

  const isInMemorizedZone = (hizb: number): boolean => {
    if (!zone || zone.totalHizbs <= 0) return false
    return hizb >= zone.startHizb && hizb <= zone.endHizb
  }

  // Merge into date-based timeline
  const readingDateSet = new Set(readingDays.map(d => d.date.toISOString().split('T')[0]))
  const revisionDateSet = new Set(revisionDays.map(d => d.date.toISOString().split('T')[0]))
  const allDates = [...new Set([...readingDateSet, ...revisionDateSet])].sort()

  for (const dateStr of allDates) {
    const hasReading = readingDateSet.has(dateStr)
    const hasRevision = revisionDateSet.has(dateStr)

    // Process reading first (may suspend/resume revision)
    if (hasReading && readingHizbPerDay > 0) {
      const wasInZone = isInMemorizedZone(readingHizb)
      const speed = wasInZone ? 2 : 1
      readingHizb += speed * readingHizbPerDay

      // Handle wrap (reading exceeds 60 = full Quran)
      while (readingHizb >= 60) {
        readingHizb -= 60
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
      }
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
