import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// Constantes du Coran
const QURAN_TOTAL_VERSES = 6236
const QURAN_TOTAL_PAGES = 604
const QURAN_TOTAL_SURAHS = 114

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const userId = session.user.id
    const now = new Date()

    // Parse period params
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'year' // 'year' | 'month' | 'global'
    const paramYear = searchParams.get('year') ? parseInt(searchParams.get('year')!) : now.getFullYear()
    const paramMonth = searchParams.get('month') ? parseInt(searchParams.get('month')!) : now.getMonth() + 1

    // Helper: Calculate week number based on Sundays (matching Excel)
    function getWeekNumber(date: Date): { week: number; year: number } {
      const d = new Date(date)
      d.setHours(0, 0, 0, 0)

      const year = d.getFullYear()
      const jan1 = new Date(year, 0, 1)
      const jan1Day = jan1.getDay() // 0 = Sunday

      const firstSunday = new Date(year, 0, 1 - jan1Day)
      const diffDays = Math.floor((d.getTime() - firstSunday.getTime()) / (24 * 60 * 60 * 1000))
      const week = Math.floor(diffDays / 7) + 1

      return { week, year }
    }

    // Calculate period boundaries
    let periodStart: Date
    let periodEnd: Date
    let totalWeeksInPeriod: number

    if (period === 'global') {
      // All time - use a very old start date
      periodStart = new Date(2020, 0, 1)
      periodEnd = new Date(now.getFullYear() + 1, 0, 1)
      // For global, we'll calculate total weeks from first attendance entry
      totalWeeksInPeriod = 0 // Will be calculated later
    } else if (period === 'month') {
      periodStart = new Date(paramYear, paramMonth - 1, 1)
      periodEnd = new Date(paramYear, paramMonth, 1)
      // Weeks in a month (approximately 4-5)
      const daysInMonth = new Date(paramYear, paramMonth, 0).getDate()
      totalWeeksInPeriod = Math.ceil(daysInMonth / 7)
    } else {
      // year (default)
      periodStart = new Date(paramYear, 0, 1)
      periodEnd = new Date(paramYear + 1, 0, 1)
      // Calculate weeks in year up to now (or end of year if past)
      const effectiveEnd = periodEnd < now ? periodEnd : now
      totalWeeksInPeriod = Math.ceil((effectiveEnd.getTime() - periodStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
    }

    // Get all progress entries for the user
    const progressEntries = await prisma.progress.findMany({
      where: { userId },
      include: { surah: true, program: true },
    })

    // Filter progress by period
    const periodProgress = period === 'global'
      ? progressEntries
      : progressEntries.filter(e => {
          const d = new Date(e.date)
          return d >= periodStart && d < periodEnd
        })

    // Calculate unique memorized verses (only MEMORIZATION program) - always global for main progress
    const memorizationEntries = progressEntries.filter(e => e.program.code === 'MEMORIZATION')
    const memorizedVerses = new Set<string>()
    for (const entry of memorizationEntries) {
      for (let v = entry.verseStart; v <= entry.verseEnd; v++) {
        memorizedVerses.add(`${entry.surahNumber}:${v}`)
      }
    }

    const totalMemorizedVerses = memorizedVerses.size
    const memorizedPercentage = Math.round((totalMemorizedVerses / QURAN_TOTAL_VERSES) * 1000) / 10

    // Calculate pages from verses - query in batches to avoid OR clause limits
    const memorizedVersesArray = Array.from(memorizedVerses).map(v => {
      const [surah, verse] = v.split(':').map(Number)
      return { surahNumber: surah, verseNumber: verse }
    })

    // Query pages in batches of 500
    const allPages: number[] = []
    const batchSize = 500
    for (let i = 0; i < memorizedVersesArray.length; i += batchSize) {
      const batch = memorizedVersesArray.slice(i, i + batchSize)
      const batchPages = await prisma.verse.findMany({
        where: { OR: batch },
        select: { page: true }
      })
      allPages.push(...batchPages.map(v => v.page))
    }

    const uniquePages = new Set(allPages)
    const totalMemorizedPages = uniquePages.size || Math.round(totalMemorizedVerses / 15)

    // Get unique surahs memorized
    const memorizedSurahs = new Set(memorizationEntries.map(e => e.surahNumber))
    const totalMemorizedSurahs = memorizedSurahs.size

    // Get group memberships count
    const groupsCount = await prisma.groupMember.count({
      where: { userId },
    })

    // Get attendance entries filtered by period
    const allAttendanceEntries = await prisma.dailyAttendance.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    })

    const attendanceEntries = period === 'global'
      ? allAttendanceEntries
      : allAttendanceEntries.filter(entry => {
          const d = new Date(entry.date)
          return d >= periodStart && d < periodEnd
        })

    // Calculate active weeks for the period
    const activeWeeksCount = attendanceEntries.filter(entry =>
      entry.sunday > 0 || entry.monday > 0 || entry.tuesday > 0 || entry.wednesday > 0 ||
      entry.thursday > 0 || entry.friday > 0 || entry.saturday > 0
    ).length

    // For global period, calculate total weeks from first entry
    if (period === 'global' && allAttendanceEntries.length > 0) {
      const firstEntry = allAttendanceEntries[allAttendanceEntries.length - 1]
      const firstDate = new Date(firstEntry.date)
      totalWeeksInPeriod = Math.ceil((now.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
    }

    const attendanceRate = totalWeeksInPeriod > 0
      ? Math.round((activeWeeksCount / totalWeeksInPeriod) * 100)
      : 0

    // Build weekly attendance data for display
    const weeklyAttendance = attendanceEntries.map(entry => {
      const date = new Date(entry.date)
      const weekInfo = getWeekNumber(date)

      const scores = [
        entry.sunday, entry.monday, entry.tuesday, entry.wednesday,
        entry.thursday, entry.friday, entry.saturday
      ]
      const daysActive = scores.filter(s => s > 0).length
      const totalScore = scores.reduce((a, b) => a + b, 0)
      const maxPossible = 7 * 5

      return {
        id: entry.id,
        date: entry.date,
        weekNumber: weekInfo.week,
        year: date.getFullYear(),
        sunday: entry.sunday,
        monday: entry.monday,
        tuesday: entry.tuesday,
        wednesday: entry.wednesday,
        thursday: entry.thursday,
        friday: entry.friday,
        saturday: entry.saturday,
        comment: entry.comment,
        daysActive,
        totalScore,
        score: Math.round((totalScore / maxPossible) * 100),
      }
    })

    // Get recent progress entries (for the period)
    const recentProgress = periodProgress
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(entry => ({
        id: entry.id,
        date: entry.date,
        verseStart: entry.verseStart,
        verseEnd: entry.verseEnd,
        program: entry.program,
        surah: entry.surah,
      }))

    // Get active objectives
    const objectives = await prisma.userObjective.findMany({
      where: { userId, isActive: true },
      include: { program: true },
    })

    // Get program settings
    const programSettings = await prisma.userProgramSettings.findMany({
      where: { userId, isActive: true },
      include: { program: true },
    })

    // Get daily logs for today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayLogs = await prisma.dailyLog.findMany({
      where: {
        userId,
        date: { gte: today, lt: tomorrow },
      },
      include: { program: true },
    })

    // Get all programs
    const allPrograms = await prisma.program.findMany({
      orderBy: { code: 'asc' },
    })

    // Build objectives vs realized
    const objectivesVsRealized = allPrograms.map(program => {
      const setting = programSettings.find(s => s.programId === program.id)
      const todayLog = todayLogs.find(l => l.programId === program.id)

      return {
        programId: program.id,
        programCode: program.code,
        programName: program.nameFr,
        objective: setting ? {
          quantity: setting.quantity,
          unit: setting.unit,
          period: setting.period,
        } : null,
        realized: todayLog ? {
          quantity: todayLog.quantity,
          unit: todayLog.unit,
        } : null,
      }
    })

    // Aggregate progress by program for the period
    function aggregateByProgram(entries: typeof progressEntries) {
      return entries.reduce((acc, entry) => {
        const code = entry.program.code
        const verses = entry.verseEnd - entry.verseStart + 1
        acc[code] = (acc[code] || 0) + verses
        return acc
      }, {} as Record<string, number>)
    }

    const progressByProgram = aggregateByProgram(periodProgress)

    // Get evolution data for last 12 weeks
    const evolutionData = []
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay() - (i * 7))
      weekStart.setHours(0, 0, 0, 0)

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 7)

      const weekLogs = await prisma.dailyLog.findMany({
        where: {
          userId,
          date: { gte: weekStart, lt: weekEnd }
        },
        include: { program: true }
      })

      const weekData: Record<string, number> = {
        MEMORIZATION: 0,
        CONSOLIDATION: 0,
        REVISION: 0,
        READING: 0,
        TAFSIR: 0
      }

      weekLogs.forEach(log => {
        let pages = log.quantity
        if (log.unit === 'HIZB') pages = log.quantity * 10
        else if (log.unit === 'DEMI_HIZB') pages = log.quantity * 5
        else if (log.unit === 'QUART') pages = log.quantity * 2.5
        else if (log.unit === 'JUZ') pages = log.quantity * 20

        if (weekData[log.program.code] !== undefined) {
          weekData[log.program.code] += pages
        }
      })

      const weekInfo = getWeekNumber(weekStart)
      evolutionData.push({
        week: `S${weekInfo.week}`,
        weekStart: weekStart.toISOString().split('T')[0],
        ...weekData,
        total: Object.values(weekData).reduce((a, b) => a + b, 0)
      })
    }

    // Get available years from attendance data
    const yearsSet = new Set(allAttendanceEntries.map(e => new Date(e.date).getFullYear()))
    const availableYears = Array.from(yearsSet).sort((a, b) => b - a)
    if (!availableYears.includes(now.getFullYear())) {
      availableYears.unshift(now.getFullYear())
    }

    return NextResponse.json({
      // Period info
      period,
      selectedYear: paramYear,
      selectedMonth: paramMonth,
      availableYears,
      // Global progress (memorization) - always global
      globalProgress: {
        memorizedVerses: totalMemorizedVerses,
        memorizedPages: totalMemorizedPages,
        memorizedSurahs: totalMemorizedSurahs,
        percentage: memorizedPercentage,
        totalVerses: QURAN_TOTAL_VERSES,
        totalPages: QURAN_TOTAL_PAGES,
        totalSurahs: QURAN_TOTAL_SURAHS
      },
      // Activity stats for period
      totalVerses: periodProgress.reduce((sum, e) => sum + (e.verseEnd - e.verseStart + 1), 0),
      totalPages: Math.round(periodProgress.reduce((sum, e) => sum + (e.verseEnd - e.verseStart + 1), 0) / 15),
      uniqueSurahs: new Set(periodProgress.map(e => e.surahNumber)).size,
      groupsCount,
      // Attendance for period
      attendanceRate,
      activeWeeksCount,
      totalWeeksInPeriod,
      // Progress data
      recentProgress,
      objectives,
      progressByProgram,
      objectivesVsRealized,
      // Evolution chart data
      evolutionData,
      // Weekly attendance data (filtered by period)
      weeklyAttendance,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    )
  }
}
