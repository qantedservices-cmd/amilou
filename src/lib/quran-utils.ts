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

// Convert a hizb (Float) to a readable position
export async function hizbToPosition(hizb: number): Promise<QuranPosition | null> {
  // Find the verse closest to this hizb value
  const verse = await prisma.verse.findFirst({
    where: {
      hizb: { gte: hizb }
    },
    orderBy: { hizb: 'asc' },
    include: { surah: true }
  })

  if (!verse) {
    // If hizb is beyond max, return last verse
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

  return {
    surahNumber: verse.surahNumber,
    surahNameAr: verse.surah.nameAr,
    verseNumber: verse.verseNumber,
    page: verse.page,
    hizb: verse.hizb || 0,
    juz: verse.juz || 0
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
