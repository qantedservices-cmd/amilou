import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// Constantes du Coran
const QURAN_TOTAL_VERSES = 6236
const QURAN_TOTAL_PAGES = 604
const QURAN_TOTAL_SURAHS = 114

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const userId = session.user.id
    const now = new Date()

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

    // Calculate active weeks (weeks where at least one day is true)
    const activeWeeksCount = attendanceEntries.filter(entry =>
      entry.sunday || entry.monday || entry.tuesday || entry.wednesday ||
      entry.thursday || entry.friday || entry.saturday
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

      const daysActive = [
        entry.sunday, entry.monday, entry.tuesday, entry.wednesday,
        entry.thursday, entry.friday, entry.saturday
      ].filter(Boolean).length

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
        score: Math.round((daysActive / 7) * 100),
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

    // Calculate progress per program for this week
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const weeklyProgress = await prisma.progress.findMany({
      where: {
        userId,
        date: { gte: startOfWeek },
      },
      include: { program: true },
    })

    const weeklyByProgram = weeklyProgress.reduce((acc, entry) => {
      const code = entry.program.code
      const verses = entry.verseEnd - entry.verseStart + 1
      acc[code] = (acc[code] || 0) + verses
      return acc
    }, {} as Record<string, number>)

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
      // Progress data
      recentProgress,
      objectives,
      weeklyByProgram,
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
