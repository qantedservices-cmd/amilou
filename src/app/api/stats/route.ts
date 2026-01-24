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
    const paramWeek = searchParams.get('week') ? parseInt(searchParams.get('week')!) : null
    const paramYear = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null

    // Get all progress entries for the user
    const progressEntries = await prisma.progress.findMany({
      where: { userId },
      include: { surah: true, program: true },
    })

    // Get memorization program
    const memorizationProgram = await prisma.program.findFirst({
      where: { code: 'MEMORIZATION' }
    })

    // Calculate total verses worked (all programs)
    const totalVerses = progressEntries.reduce(
      (sum, entry) => sum + (entry.verseEnd - entry.verseStart + 1),
      0
    )

    // Calculate unique memorized verses (only MEMORIZATION program)
    const memorizationEntries = progressEntries.filter(
      e => e.program.code === 'MEMORIZATION'
    )

    // Create a set of unique verse identifiers for memorization
    const memorizedVerses = new Set<string>()
    for (const entry of memorizationEntries) {
      for (let v = entry.verseStart; v <= entry.verseEnd; v++) {
        memorizedVerses.add(`${entry.surahNumber}:${v}`)
      }
    }

    const totalMemorizedVerses = memorizedVerses.size
    const memorizedPercentage = Math.round((totalMemorizedVerses / QURAN_TOTAL_VERSES) * 1000) / 10

    // Calculate pages from verses (using actual verse data if available)
    const versePages = await prisma.verse.findMany({
      where: {
        OR: Array.from(memorizedVerses).map(v => {
          const [surah, verse] = v.split(':').map(Number)
          return { surahNumber: surah, verseNumber: verse }
        }).slice(0, 1000) // Limit for performance
      },
      select: { page: true }
    })
    const uniquePages = new Set(versePages.map(v => v.page))
    const totalMemorizedPages = uniquePages.size || Math.round(totalMemorizedVerses / 15)

    // Get unique surahs memorized
    const memorizedSurahs = new Set(memorizationEntries.map(e => e.surahNumber))
    const totalMemorizedSurahs = memorizedSurahs.size

    // Get group memberships count
    const groupsCount = await prisma.groupMember.count({
      where: { userId },
    })

    // Calculate attendance rate from DailyAttendance
    const attendanceEntries = await prisma.dailyAttendance.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    })

    // Calculate active weeks (weeks where at least one day has score > 0)
    const activeWeeksCount = attendanceEntries.filter(entry =>
      entry.sunday > 0 || entry.monday > 0 || entry.tuesday > 0 || entry.wednesday > 0 ||
      entry.thursday > 0 || entry.friday > 0 || entry.saturday > 0
    ).length

    // Calculate total weeks since first entry or start of year
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const totalWeeksSinceYearStart = Math.ceil(
      (now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000)
    )

    const attendanceRate = totalWeeksSinceYearStart > 0
      ? Math.round((activeWeeksCount / totalWeeksSinceYearStart) * 100)
      : 0

    // Build weekly attendance data for dashboard display
    const weeklyAttendance = attendanceEntries.map(entry => {
      const date = new Date(entry.date)
      // Calculate ISO week number
      const tempDate = new Date(date.getTime())
      tempDate.setHours(0, 0, 0, 0)
      tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7))
      const week1 = new Date(tempDate.getFullYear(), 0, 4)
      const weekNumber = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)

      const scores = [
        entry.sunday, entry.monday, entry.tuesday, entry.wednesday,
        entry.thursday, entry.friday, entry.saturday
      ]
      const daysActive = scores.filter(s => s > 0).length
      const totalScore = scores.reduce((a, b) => a + b, 0)
      const maxPossible = 7 * 5 // 7 days * 5 programs

      return {
        id: entry.id,
        date: entry.date,
        weekNumber,
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

    // Get recent progress entries
    const recentProgress = await prisma.progress.findMany({
      where: { userId },
      include: {
        program: true,
        surah: true,
      },
      orderBy: { date: 'desc' },
      take: 5,
    })

    // Get active objectives (old system)
    const objectives = await prisma.userObjective.findMany({
      where: { userId, isActive: true },
      include: { program: true },
    })

    // Get program settings (new assiduity system)
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
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: { program: true },
    })

    // Get all programs for objectives vs realized
    const allPrograms = await prisma.program.findMany({
      orderBy: { code: 'asc' },
    })

    // Build objectives vs realized data
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

    // Calculate period dates based on params
    function getMondayOfISOWeek(year: number, week: number): Date {
      const simple = new Date(year, 0, 1 + (week - 1) * 7)
      const dow = simple.getDay()
      const isoWeekStart = new Date(simple)
      if (dow <= 4) {
        isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1)
      } else {
        isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay())
      }
      isoWeekStart.setHours(0, 0, 0, 0)
      return isoWeekStart
    }

    // Determine the selected week
    const selectedYear = paramYear || now.getFullYear()
    let selectedWeek = paramWeek
    if (!selectedWeek) {
      // Calculate current ISO week
      const tempDate = new Date(now.getTime())
      tempDate.setHours(0, 0, 0, 0)
      tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7))
      const week1 = new Date(tempDate.getFullYear(), 0, 4)
      selectedWeek = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
    }

    const selectedWeekStart = getMondayOfISOWeek(selectedYear, selectedWeek)
    const selectedWeekEnd = new Date(selectedWeekStart)
    selectedWeekEnd.setDate(selectedWeekStart.getDate() + 7)

    // Month range (month containing the selected week)
    const monthStart = new Date(selectedWeekStart.getFullYear(), selectedWeekStart.getMonth(), 1)
    const monthEnd = new Date(selectedWeekStart.getFullYear(), selectedWeekStart.getMonth() + 1, 1)

    // Year range
    const yearStart = new Date(selectedYear, 0, 1)
    const yearEnd = new Date(selectedYear + 1, 0, 1)

    // Progress by program for each period
    const allProgressForYear = progressEntries.filter(e => {
      const d = new Date(e.date)
      return d >= yearStart && d < yearEnd
    })

    const weekProgress = allProgressForYear.filter(e => {
      const d = new Date(e.date)
      return d >= selectedWeekStart && d < selectedWeekEnd
    })

    const monthProgress = allProgressForYear.filter(e => {
      const d = new Date(e.date)
      return d >= monthStart && d < monthEnd
    })

    function aggregateByProgram(entries: typeof progressEntries) {
      return entries.reduce((acc, entry) => {
        const code = entry.program.code
        const verses = entry.verseEnd - entry.verseStart + 1
        acc[code] = (acc[code] || 0) + verses
        return acc
      }, {} as Record<string, number>)
    }

    const weeklyByProgram = aggregateByProgram(weekProgress)
    const monthlyByProgram = aggregateByProgram(monthProgress)
    const yearlyByProgram = aggregateByProgram(allProgressForYear)

    // Get evolution data for last 12 weeks (for chart)
    const evolutionData = []
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay() - (i * 7))
      weekStart.setHours(0, 0, 0, 0)

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 7)

      // Get daily logs for this week
      const weekLogs = await prisma.dailyLog.findMany({
        where: {
          userId,
          date: {
            gte: weekStart,
            lt: weekEnd
          }
        },
        include: { program: true }
      })

      // Calculate totals per program for this week (convert to pages)
      const weekData: Record<string, number> = {
        MEMORIZATION: 0,
        CONSOLIDATION: 0,
        REVISION: 0,
        READING: 0,
        TAFSIR: 0
      }

      weekLogs.forEach(log => {
        // Convert to pages for uniformity
        let pages = log.quantity
        if (log.unit === 'HIZB') pages = log.quantity * 10 // 1 hizb ≈ 10 pages
        else if (log.unit === 'DEMI_HIZB') pages = log.quantity * 5
        else if (log.unit === 'QUART') pages = log.quantity * 2.5
        else if (log.unit === 'JUZ') pages = log.quantity * 20 // 1 juz ≈ 20 pages

        if (weekData[log.program.code] !== undefined) {
          weekData[log.program.code] += pages
        }
      })

      evolutionData.push({
        week: `S${12 - i}`,
        weekStart: weekStart.toISOString().split('T')[0],
        ...weekData,
        total: Object.values(weekData).reduce((a, b) => a + b, 0)
      })
    }

    return NextResponse.json({
      // Global progress (memorization)
      globalProgress: {
        memorizedVerses: totalMemorizedVerses,
        memorizedPages: totalMemorizedPages,
        memorizedSurahs: totalMemorizedSurahs,
        percentage: memorizedPercentage,
        totalVerses: QURAN_TOTAL_VERSES,
        totalPages: QURAN_TOTAL_PAGES,
        totalSurahs: QURAN_TOTAL_SURAHS
      },
      // Activity stats
      totalVerses,
      totalPages: Math.round(totalVerses / 15),
      uniqueSurahs: new Set(progressEntries.map(e => e.surahNumber)).size,
      groupsCount,
      // Attendance/Activity rate
      attendanceRate,
      activeWeeksCount,
      totalWeeksSinceYearStart,
      // Period info
      selectedWeek,
      selectedYear,
      // Progress data
      recentProgress,
      objectives,
      weeklyByProgram,
      monthlyByProgram,
      yearlyByProgram,
      objectivesVsRealized,
      // Evolution chart data
      evolutionData,
      // Weekly attendance data
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
