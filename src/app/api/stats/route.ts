import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'
import { checkDataVisibility } from '@/lib/permissions'

// Constantes du Coran
const QURAN_TOTAL_VERSES = 6236
const QURAN_TOTAL_PAGES = 604
const QURAN_TOTAL_SURAHS = 114

// Daily programs order
const DAILY_PROGRAMS = ['MEMORIZATION', 'CONSOLIDATION', 'REVISION', 'READING']

// Helper: Get start of week (Sunday)
function getWeekStartDate(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return d
}

// Helper: Get start of day
function getDayStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Support impersonation
    const { userId: effectiveUserId } = await getEffectiveUserId()
    let userId = effectiveUserId!
    const now = new Date()

    // Support viewing another user's stats (for admin/referent)
    const requestedUserId = new URL(request.url).searchParams.get('userId')
    if (requestedUserId && requestedUserId !== userId) {
      const visibility = await checkDataVisibility(userId, requestedUserId, 'stats')
      if (!visibility.canView) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
      userId = requestedUserId
    }

    // Parse period params
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'year' // 'year' | 'month' | 'global'
    const paramYear = searchParams.get('year') ? parseInt(searchParams.get('year')!) : now.getFullYear()
    const paramMonth = searchParams.get('month') ? parseInt(searchParams.get('month')!) : now.getMonth() + 1
    const weekOffset = searchParams.get('weekOffset') ? parseInt(searchParams.get('weekOffset')!) : 0

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

    // =============================================
    // OPTIMIZED: Parallel initial queries
    // =============================================
    const todayStart = getDayStart(now)
    const tomorrowStart = new Date(todayStart)
    tomorrowStart.setDate(tomorrowStart.getDate() + 1)

    // Evolution data date range
    const evolutionStartDate = new Date(now)
    evolutionStartDate.setDate(now.getDate() - now.getDay() - (11 * 7))
    evolutionStartDate.setHours(0, 0, 0, 0)

    // Parallel fetch of all independent data
    const [
      progressEntries,
      groupsCount,
      allAttendanceEntries,
      objectives,
      programSettings,
      todayLogs,
      allPrograms,
      _unusedEvolutionLogs,
      weeklyObjectives,
      allCompletions,
      completionCycles,
      tafsirProgram,
      firstAttendance,
      firstCompletion
    ] = await Promise.all([
      prisma.progress.findMany({
        where: { userId },
        include: { surah: true, program: true },
      }),
      prisma.groupMember.count({
        where: { userId },
      }),
      prisma.dailyAttendance.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      }),
      prisma.userObjective.findMany({
        where: { userId, isActive: true },
        include: { program: true },
      }),
      prisma.userProgramSettings.findMany({
        where: { userId, isActive: true },
        include: { program: true },
      }),
      prisma.dailyLog.findMany({
        where: {
          userId,
          date: { gte: todayStart, lt: tomorrowStart },
        },
        include: { program: true },
      }),
      prisma.program.findMany({
        orderBy: { code: 'asc' },
      }),
      prisma.dailyLog.findMany({
        where: {
          userId,
          date: { gte: evolutionStartDate }
        },
        include: { program: true }
      }),
      prisma.weeklyObjective.findMany({
        where: { userId, isActive: true },
        include: {
          completions: {
            where: {
              weekStartDate: { gte: periodStart, lt: periodEnd }
            }
          }
        }
      }),
      prisma.dailyProgramCompletion.findMany({
        where: { userId, completed: true },
        orderBy: { date: 'desc' },
        select: { date: true }
      }),
      prisma.completionCycle.findMany({
        where: { userId },
        orderBy: { completedAt: 'desc' }
      }),
      prisma.program.findFirst({
        where: { code: 'TAFSIR' }
      }),
      prisma.dailyAttendance.findFirst({
        where: { userId },
        orderBy: { date: 'asc' },
        select: { date: true }
      }),
      prisma.dailyProgramCompletion.findFirst({
        where: { userId },
        orderBy: { date: 'asc' },
        select: { date: true }
      })
    ])

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

    // Query pages in parallel batches
    const batchSize = 500
    const batchPromises = []
    for (let i = 0; i < memorizedVersesArray.length; i += batchSize) {
      const batch = memorizedVersesArray.slice(i, i + batchSize)
      batchPromises.push(
        prisma.verse.findMany({
          where: { OR: batch },
          select: { page: true }
        })
      )
    }
    const batchResults = await Promise.all(batchPromises)
    const allPages = batchResults.flatMap(r => r.map(v => v.page))

    const uniquePages = new Set(allPages)
    const totalMemorizedPages = uniquePages.size || Math.round(totalMemorizedVerses / 15)

    // Get unique surahs memorized
    const memorizedSurahs = new Set(memorizationEntries.map(e => e.surahNumber))
    const totalMemorizedSurahs = memorizedSurahs.size

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

    // Calculate weekly attendance (assiduité hebdo) - based on Progress submissions
    // A week is "attended" if user has at least one MEMORIZATION progress entry for that week
    const weeklyProgressSubmissions = new Set<string>()
    for (const entry of periodProgress.filter(e => e.program.code === 'MEMORIZATION')) {
      const entryDate = new Date(entry.date)
      const weekInfo = getWeekNumber(entryDate)
      weeklyProgressSubmissions.add(`${weekInfo.year}-${weekInfo.week}`)
    }
    const weeklyAttendanceCount = weeklyProgressSubmissions.size
    const weeklyAttendanceRate = totalWeeksInPeriod > 0
      ? Math.round((weeklyAttendanceCount / totalWeeksInPeriod) * 100)
      : 0

    // Build weekly attendance data for display
    const weeklyAttendanceDetails = attendanceEntries.map(entry => {
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

    // Build objectives vs realized (using data from parallel queries)
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

    // Build evolution data for last 12 weeks (using Progress entries)
    const evolutionData = []
    for (let i = 11; i >= 0; i--) {
      const weekStartDate = new Date(now)
      weekStartDate.setDate(now.getDate() - now.getDay() - (i * 7))
      weekStartDate.setHours(0, 0, 0, 0)

      const weekEndDate = new Date(weekStartDate)
      weekEndDate.setDate(weekStartDate.getDate() + 7)

      // Filter progress entries for this week
      const weekEntries = progressEntries.filter(entry => {
        const entryDate = new Date(entry.date)
        return entryDate >= weekStartDate && entryDate < weekEndDate
      })

      const weekData: Record<string, number> = {
        MEMORIZATION: 0,
        CONSOLIDATION: 0,
        REVISION: 0,
        READING: 0,
        TAFSIR: 0
      }

      weekEntries.forEach(entry => {
        const verses = entry.verseEnd - entry.verseStart + 1
        if (weekData[entry.program.code] !== undefined) {
          weekData[entry.program.code] += verses
        }
      })

      const weekInfoData = getWeekNumber(weekStartDate)
      evolutionData.push({
        week: `S${weekInfoData.week}`,
        weekStart: weekStartDate.toISOString().split('T')[0],
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

    // =============================================
    // DailyProgramCompletion stats (using todayStart/tomorrowStart from above)
    // =============================================

    // Calculate base week based on period selection
    // For current period: use current week
    // For past period: use last week of that period
    let baseWeekStart: Date
    const currentWeekStart = getWeekStartDate(now)

    if (period === 'global') {
      // Global: always relative to current week
      baseWeekStart = currentWeekStart
    } else if (period === 'month') {
      // Check if selected month is current month
      const isCurrentMonth = paramYear === now.getFullYear() && paramMonth === (now.getMonth() + 1)
      if (isCurrentMonth) {
        baseWeekStart = currentWeekStart
      } else {
        // Use last day of selected month, then get its week start
        const lastDayOfMonth = new Date(paramYear, paramMonth, 0)
        baseWeekStart = getWeekStartDate(lastDayOfMonth)
      }
    } else {
      // Year period
      const isCurrentYear = paramYear === now.getFullYear()
      if (isCurrentYear) {
        baseWeekStart = currentWeekStart
      } else {
        // Use last day of selected year
        const lastDayOfYear = new Date(paramYear, 11, 31)
        baseWeekStart = getWeekStartDate(lastDayOfYear)
      }
    }

    // Apply week offset for navigation
    const weekStart = new Date(baseWeekStart)
    weekStart.setDate(baseWeekStart.getDate() + (weekOffset * 7))
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekInfo = getWeekNumber(weekStart)

    // Allow navigating forward (including future weeks for pre-entry)
    const canGoForward = true

    // Use allPrograms from parallel queries, filter for daily programs
    const dailyProgramsList = allPrograms.filter(p => DAILY_PROGRAMS.includes(p.code))
    const programMap = new Map(dailyProgramsList.map(p => [p.code, p]))

    // Parallel fetch of week-specific data
    const [todayCompletions, weekCompletions, currentWeekObjectives] = await Promise.all([
      prisma.dailyProgramCompletion.findMany({
        where: {
          userId,
          date: { gte: todayStart, lt: tomorrowStart },
          completed: true
        },
        include: { program: true }
      }),
      prisma.dailyProgramCompletion.findMany({
        where: {
          userId,
          date: { gte: weekStart, lt: weekEnd },
          completed: true
        },
        include: { program: true }
      }),
      prisma.weeklyObjective.findMany({
        where: { userId, isActive: true },
        include: {
          completions: {
            where: { weekStartDate: { gte: weekStart, lt: weekEnd } }
          }
        }
      })
    ])

    const todayPrograms = DAILY_PROGRAMS.map(code => ({
      code,
      name: programMap.get(code)?.nameFr || code,
      completed: todayCompletions.some(c => c.program.code === code)
    }))

    // Build week grid: 7 days x 4 programs
    const weekGrid: Record<string, boolean[]> = {}
    for (const code of DAILY_PROGRAMS) {
      weekGrid[code] = [false, false, false, false, false, false, false]
    }

    for (const completion of weekCompletions) {
      const dayIndex = Math.floor((completion.date.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000))
      if (dayIndex >= 0 && dayIndex < 7 && weekGrid[completion.program.code]) {
        weekGrid[completion.program.code][dayIndex] = true
      }
    }

    // Calculate program stats for the week
    const weekProgramStats = DAILY_PROGRAMS.map(code => {
      const daysCompleted = weekGrid[code].filter(Boolean).length
      return {
        code,
        name: programMap.get(code)?.nameFr || code,
        daysCompleted,
        totalDays: 7,
        rate: Math.round((daysCompleted / 7) * 100)
      }
    })

    // Calculate for both month and year (always compute both)
    let adoptionDate: Date | null = null
    if (firstAttendance) adoptionDate = firstAttendance.date
    if (firstCompletion && (!adoptionDate || firstCompletion.date < adoptionDate)) {
      adoptionDate = firstCompletion.date
    }

    function computeProgramStats(pStart: Date, pEnd: Date, completions: Array<{ date: Date; program: { code: string } }>) {
      const effStart = adoptionDate && adoptionDate > pStart ? adoptionDate : pStart
      const effEnd = pEnd > now ? now : pEnd
      const programDays: Record<string, Set<string>> = {}
      for (const code of DAILY_PROGRAMS) {
        programDays[code] = new Set()
      }
      for (const c of completions) {
        const dateKey = c.date.toISOString().split('T')[0]
        if (programDays[c.program.code]) {
          programDays[c.program.code].add(dateKey)
        }
      }
      const totalDays = Math.max(1, Math.ceil((effEnd.getTime() - effStart.getTime()) / (24 * 60 * 60 * 1000)))
      return DAILY_PROGRAMS.map(code => ({
        code,
        name: programMap.get(code)?.nameFr || code,
        daysCompleted: programDays[code].size,
        totalDays,
        rate: Math.round((programDays[code].size / totalDays) * 100)
      }))
    }

    // Month boundaries (selected month or current month)
    const monthStart = new Date(paramYear, paramMonth - 1, 1)
    const monthEnd = new Date(paramYear, paramMonth, 1)
    // Year boundaries
    const yearStart = new Date(paramYear, 0, 1)
    const yearEnd = new Date(paramYear + 1, 0, 1)

    // Fetch completions for the entire year (covers month too)
    const yearCompletions = await prisma.dailyProgramCompletion.findMany({
      where: {
        userId,
        date: { gte: yearStart, lt: yearEnd },
        completed: true
      },
      include: { program: true }
    })

    const monthCompletions = yearCompletions.filter(c => c.date >= monthStart && c.date < monthEnd)

    const monthProgramStats = computeProgramStats(monthStart, monthEnd, monthCompletions)
    const yearProgramStats = computeProgramStats(yearStart, yearEnd, yearCompletions)
    // Keep periodProgramStats for backward compatibility
    const periodProgramStats = period === 'month' ? monthProgramStats : yearProgramStats

    // =============================================
    // Weekly Objectives stats (using weeklyObjectives from parallel queries)
    // =============================================
    // currentWeekObjectives is already fetched in the second parallel batch above

    const weeklyObjectivesStatus = currentWeekObjectives.map(obj => {
      // Build daily grid: 7 booleans (Sun-Sat)
      const dailyGrid = [false, false, false, false, false, false, false]
      for (const completion of obj.completions) {
        if (completion.completed) {
          const dayIndex = Math.floor((completion.weekStartDate.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000))
          if (dayIndex >= 0 && dayIndex < 7) {
            dailyGrid[dayIndex] = true
          }
        }
      }
      const completedCount = dailyGrid.filter(Boolean).length
      return {
        id: obj.id,
        name: obj.name,
        isCustom: obj.isCustom,
        completed: completedCount > 0,
        dailyGrid
      }
    })

    // Calculate weekly objectives rate for the period
    const weeksInPeriod = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (7 * 24 * 60 * 60 * 1000)))

    const weeklyObjectivesStats = weeklyObjectives.map(obj => {
      // Count distinct weeks with at least 1 daily completion
      const completedWeekKeys = new Set<string>()
      for (const c of obj.completions) {
        if (c.completed) {
          const sunday = getWeekStartDate(new Date(c.weekStartDate))
          completedWeekKeys.add(sunday.toISOString().split('T')[0])
        }
      }
      const completedWeeks = completedWeekKeys.size
      return {
        id: obj.id,
        name: obj.name,
        isCustom: obj.isCustom,
        completedWeeks,
        totalWeeks: weeksInPeriod,
        rate: Math.round((completedWeeks / weeksInPeriod) * 100)
      }
    })

    // =============================================
    // Streak calculation (using allCompletions from parallel queries)
    // =============================================
    // Daily streak: consecutive days with at least 1 program completed
    // Get unique dates
    const completionDates = [...new Set(allCompletions.map(c =>
      getDayStart(c.date).getTime()
    ))].sort((a, b) => b - a)

    let dailyStreak = 0
    let checkDate = getDayStart(now).getTime()

    // Check if today has activity, if not start from yesterday
    if (!completionDates.includes(checkDate)) {
      checkDate -= 24 * 60 * 60 * 1000
    }

    for (const dateTime of completionDates) {
      if (dateTime === checkDate) {
        dailyStreak++
        checkDate -= 24 * 60 * 60 * 1000
      } else if (dateTime < checkDate) {
        break
      }
    }

    // Weekly streak: consecutive weeks with all weekly objectives completed
    const allWeeklyCompletions = await prisma.weeklyObjectiveCompletion.findMany({
      where: {
        weeklyObjective: { userId, isActive: true },
        completed: true
      },
      include: { weeklyObjective: true },
      orderBy: { weekStartDate: 'desc' }
    })

    // Group by week (find the Sunday of each completion date)
    const weeklyCompletionsByWeek: Record<string, Set<string>> = {}
    for (const c of allWeeklyCompletions) {
      const completionDate = new Date(c.weekStartDate)
      const sunday = getWeekStartDate(completionDate)
      const weekKey = sunday.toISOString().split('T')[0]
      if (!weeklyCompletionsByWeek[weekKey]) {
        weeklyCompletionsByWeek[weekKey] = new Set()
      }
      weeklyCompletionsByWeek[weekKey].add(c.weeklyObjective.id)
    }

    const activeObjectiveCount = currentWeekObjectives.length
    let weeklyStreak = 0
    let checkWeek = getWeekStartDate(now)

    // Check current week
    const currentWeekKey = checkWeek.toISOString().split('T')[0]
    const currentWeekCompleted = weeklyCompletionsByWeek[currentWeekKey]?.size === activeObjectiveCount

    if (!currentWeekCompleted) {
      checkWeek.setDate(checkWeek.getDate() - 7)
    }

    while (true) {
      const weekKey = checkWeek.toISOString().split('T')[0]
      if (weeklyCompletionsByWeek[weekKey]?.size === activeObjectiveCount) {
        weeklyStreak++
        checkWeek.setDate(checkWeek.getDate() - 7)
      } else {
        break
      }
    }

    // =============================================
    // Completion Cycles (using completionCycles from parallel queries)
    // =============================================
    const revisionCycles = completionCycles.filter(c => c.type === 'REVISION')
    const lectureCycles = completionCycles.filter(c => c.type === 'LECTURE')

    const lastRevision = revisionCycles[0]
    const lastLecture = lectureCycles[0]

    const daysSinceRevision = lastRevision
      ? Math.floor((now.getTime() - new Date(lastRevision.completedAt).getTime()) / (24 * 60 * 60 * 1000))
      : null

    const daysSinceLecture = lastLecture
      ? Math.floor((now.getTime() - new Date(lastLecture.completedAt).getTime()) / (24 * 60 * 60 * 1000))
      : null

    const avgRevisionDays = revisionCycles.length > 1
      ? Math.round(revisionCycles.slice(0, -1).reduce((sum, c) => sum + (c.daysToComplete || 0), 0) / (revisionCycles.length - 1))
      : null

    const avgLectureDays = lectureCycles.length > 1
      ? Math.round(lectureCycles.slice(0, -1).reduce((sum, c) => sum + (c.daysToComplete || 0), 0) / (lectureCycles.length - 1))
      : null

    // =============================================
    // Tafsir Coverage (using tafsirProgram from parallel queries + progressEntries)
    // =============================================
    let tafsirCoverage = { percentage: 0, coveredVerses: 0, completedSurahs: 0 }

    if (tafsirProgram) {
      // Use progressEntries we already have instead of a separate query
      const tafsirEntries = progressEntries.filter(e => e.programId === tafsirProgram.id)

      // Calculate covered verses per surah
      const surahVerses: Record<number, Set<number>> = {}
      for (const entry of tafsirEntries) {
        if (!surahVerses[entry.surahNumber]) {
          surahVerses[entry.surahNumber] = new Set()
        }
        for (let v = entry.verseStart; v <= entry.verseEnd; v++) {
          surahVerses[entry.surahNumber].add(v)
        }
      }

      // Use surah info from progressEntries to get totals
      const surahTotals = new Map(
        tafsirEntries.map(e => [e.surahNumber, e.surah.totalVerses])
      )

      let totalCovered = 0
      let completed = 0
      for (const [surahNum, verses] of Object.entries(surahVerses)) {
        totalCovered += verses.size
        const surahTotal = surahTotals.get(parseInt(surahNum)) || 0
        if (verses.size >= surahTotal) {
          completed++
        }
      }

      tafsirCoverage = {
        percentage: Math.round((totalCovered / 6236) * 100),
        coveredVerses: totalCovered,
        completedSurahs: completed
      }
    }

    // =============================================
    // NEW: Comparison with previous period
    // =============================================
    let previousPeriodStart: Date
    let previousPeriodEnd: Date

    if (period === 'month') {
      previousPeriodStart = new Date(paramYear, paramMonth - 2, 1)
      previousPeriodEnd = new Date(paramYear, paramMonth - 1, 1)
    } else if (period === 'year') {
      previousPeriodStart = new Date(paramYear - 1, 0, 1)
      previousPeriodEnd = new Date(paramYear, 0, 1)
    } else {
      previousPeriodStart = periodStart
      previousPeriodEnd = periodEnd
    }

    const previousCompletions = await prisma.dailyProgramCompletion.count({
      where: {
        userId,
        date: { gte: previousPeriodStart, lt: previousPeriodEnd },
        completed: true
      }
    })

    const currentCompletions = await prisma.dailyProgramCompletion.count({
      where: {
        userId,
        date: { gte: periodStart, lt: periodEnd },
        completed: true
      }
    })

    const trend = currentCompletions > previousCompletions ? 'up' :
                  currentCompletions < previousCompletions ? 'down' : 'stable'

    const trendPercentage = previousCompletions > 0
      ? Math.round(((currentCompletions - previousCompletions) / previousCompletions) * 100)
      : 0

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
      // Daily attendance for period (assiduité quotidienne)
      dailyAttendance: {
        rate: attendanceRate,
        activeWeeks: activeWeeksCount,
        totalWeeks: totalWeeksInPeriod,
      },
      // Weekly attendance for period (assiduité hebdo - soumission avancement)
      weeklyAttendance: {
        rate: weeklyAttendanceRate,
        weeksWithSubmission: weeklyAttendanceCount,
        totalWeeks: totalWeeksInPeriod,
      },
      // Legacy fields for backwards compatibility
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
      // Weekly attendance details data (filtered by period)
      weeklyAttendanceDetails,
      // NEW: Program completion stats
      todayPrograms,
      weekGrid,
      weekProgramStats,
      periodProgramStats,
      monthProgramStats,
      yearProgramStats,
      weekStartDate: weekStart.toISOString().split('T')[0],
      weekNumber: weekInfo.week,
      weekYear: weekInfo.year,
      weekOffset,
      canGoForward,
      // NEW: Weekly objectives stats
      weeklyObjectivesStatus,
      weeklyObjectivesStats,
      // NEW: Streaks
      dailyStreak,
      weeklyStreak,
      // NEW: Trend
      trend,
      trendPercentage,
      // NEW: Completion Cycles
      completionCycles: {
        revision: {
          totalCycles: revisionCycles.length,
          lastDate: lastRevision?.completedAt || null,
          daysSinceLast: daysSinceRevision,
          averageDays: avgRevisionDays,
          lastHizbCount: lastRevision?.hizbCount || null
        },
        lecture: {
          totalCycles: lectureCycles.length,
          lastDate: lastLecture?.completedAt || null,
          daysSinceLast: daysSinceLecture,
          averageDays: avgLectureDays
        }
      },
      // NEW: Tafsir Coverage
      tafsirCoverage,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    )
  }
}
