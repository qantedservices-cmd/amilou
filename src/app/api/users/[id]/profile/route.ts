import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// Helper to get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Helper to get start of week (Monday)
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const currentUserId = session.user.id

    // Get current user's role
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true }
    })

    // Check access: user can see their own profile, or admin/manager can see all
    const isOwnProfile = currentUserId === id
    const isAdminOrManager = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER'

    if (!isOwnProfile && !isAdminOrManager) {
      // Check if current user is REFERENT of a group containing the target user
      const referentGroups = await prisma.groupMember.findMany({
        where: { userId: currentUserId, role: 'REFERENT' },
        select: { groupId: true }
      })

      if (referentGroups.length > 0) {
        const targetInReferentGroup = await prisma.groupMember.findFirst({
          where: {
            userId: id,
            groupId: { in: referentGroups.map(g => g.groupId) }
          }
        })

        if (!targetInReferentGroup) {
          return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
    }

    // Get user with groups
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        groupMembers: {
          include: {
            group: { select: { id: true, name: true } }
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentWeekStart = getWeekStart(now)
    const currentMonth = now.getMonth()

    // ========================================
    // SURAH MASTERY STATS (from SurahMastery table)
    // ========================================
    const surahMasteries = await prisma.surahMastery.findMany({
      where: { userId: id },
      include: {
        surah: { select: { number: true, nameAr: true, nameFr: true, totalVerses: true } }
      },
      orderBy: { surahNumber: 'asc' }
    })

    const validatedStatuses = ['V', 'S']
    const inProgressStatuses = ['AM', '50%', '51%', '90%']

    const surahsValidatedFromMastery = surahMasteries.filter(m =>
      validatedStatuses.some(s => m.status.startsWith(s))
    )
    const surahsInProgressFromMastery = surahMasteries.filter(m =>
      inProgressStatuses.includes(m.status)
    )

    // ========================================
    // PROGRESS TABLE STATS (from Google Forms webhook)
    // ========================================
    const allSurahs = await prisma.surah.findMany({
      orderBy: { number: 'asc' }
    })
    const surahMap = new Map(allSurahs.map(s => [s.number, s]))

    // Get MEMORIZATION program
    const memoProgram = await prisma.program.findFirst({ where: { code: 'MEMORIZATION' } })

    const progressEntries = await prisma.progress.findMany({
      where: {
        userId: id,
        programId: memoProgram?.id
      },
      include: {
        surah: { select: { number: true, nameAr: true, nameFr: true, totalVerses: true } }
      },
      orderBy: { date: 'desc' }
    })

    // Calculate verses covered per surah from Progress entries
    const surahCoverage: Record<number, {
      surahNumber: number
      surahName: string
      surahNameAr: string
      totalVerses: number
      coveredVerses: Set<number>
      entries: { date: string; verseStart: number; verseEnd: number }[]
    }> = {}

    for (const entry of progressEntries) {
      if (!entry.surah) continue
      const sn = entry.surahNumber
      if (!surahCoverage[sn]) {
        surahCoverage[sn] = {
          surahNumber: sn,
          surahName: entry.surah.nameFr,
          surahNameAr: entry.surah.nameAr,
          totalVerses: entry.surah.totalVerses,
          coveredVerses: new Set(),
          entries: []
        }
      }
      // Add covered verses
      for (let v = entry.verseStart; v <= entry.verseEnd; v++) {
        surahCoverage[sn].coveredVerses.add(v)
      }
      surahCoverage[sn].entries.push({
        date: entry.date.toISOString().split('T')[0],
        verseStart: entry.verseStart,
        verseEnd: entry.verseEnd
      })
    }

    // Build surah progress from Progress entries
    // Any surah with at least one entry is considered VALIDATED
    const surahProgressFromEntries = Object.values(surahCoverage).map(sc => {
      const coverage = (sc.coveredVerses.size / sc.totalVerses) * 100
      return {
        surahNumber: sc.surahNumber,
        surahName: sc.surahName,
        surahNameAr: sc.surahNameAr,
        totalVerses: sc.totalVerses,
        coveredVerses: sc.coveredVerses.size,
        coverage: Math.round(coverage),
        isComplete: true, // Any recorded surah is considered validated
        entries: sc.entries
      }
    })

    // Count surahs from Progress data - all are validated
    const surahsCompleteFromProgress = surahProgressFromEntries
    const surahsInProgressFromProgress: typeof surahProgressFromEntries = [] // None in progress, all validated

    // Calculate total verses memorized
    // Use the higher count between SurahMastery and Progress
    let totalVersesFromMastery = 0
    for (const mastery of surahsValidatedFromMastery) {
      totalVersesFromMastery += mastery.surah.totalVerses
    }

    let totalVersesFromProgress = 0
    for (const sp of surahProgressFromEntries) {
      totalVersesFromProgress += sp.coveredVerses
    }

    // Use the best data source
    const hasMasteryData = surahMasteries.length > 0
    const hasProgressData = progressEntries.length > 0

    let totalVersesMemorized: number
    let surahsValidatedCount: number
    let surahsInProgressCount: number

    if (hasMasteryData && totalVersesFromMastery >= totalVersesFromProgress) {
      // Use SurahMastery data
      totalVersesMemorized = totalVersesFromMastery
      surahsValidatedCount = surahsValidatedFromMastery.length
      surahsInProgressCount = surahsInProgressFromMastery.length
    } else if (hasProgressData) {
      // Use Progress data
      totalVersesMemorized = totalVersesFromProgress
      surahsValidatedCount = surahsCompleteFromProgress.length
      surahsInProgressCount = surahsInProgressFromProgress.length
    } else {
      totalVersesMemorized = 0
      surahsValidatedCount = 0
      surahsInProgressCount = 0
    }

    // Approximate pages (about 15 verses per page)
    const pagesMemorized = Math.round(totalVersesMemorized / 15)

    // Total Quran: 6236 verses, 604 pages
    const progressPercent = Math.round((totalVersesMemorized / 6236) * 100)

    // ========================================
    // ATTENDANCE STATS (from SessionAttendance or DailyProgramCompletion)
    // ========================================

    // Get session attendance for this user
    const sessionAttendances = await prisma.sessionAttendance.findMany({
      where: { userId: id },
      include: {
        session: {
          select: { id: true, date: true, groupId: true, weekNumber: true }
        }
      },
      orderBy: { session: { date: 'desc' } }
    })

    // Get daily program completions for fallback
    const allDailyCompletions = await prisma.dailyProgramCompletion.findMany({
      where: { userId: id, completed: true },
      orderBy: { date: 'desc' }
    })

    // Get unique dates with at least one completion
    const completionDates = [...new Set(allDailyCompletions.map(c => c.date.toISOString().split('T')[0]))]
    const completionDatesSet = new Set(completionDates)

    let totalSessions: number
    let presentSessions: number
    let thisYearSessions: number
    let thisYearPresent: number
    let thisMonthSessions: number
    let thisMonthPresent: number
    let streak: number

    if (sessionAttendances.length > 0) {
      // Use SessionAttendance data
      totalSessions = sessionAttendances.length
      presentSessions = sessionAttendances.filter(a => a.present).length

      const thisYearAttendances = sessionAttendances.filter(a =>
        a.session.date.getFullYear() === currentYear
      )
      thisYearSessions = thisYearAttendances.length
      thisYearPresent = thisYearAttendances.filter(a => a.present).length

      const thisMonthAttendances = sessionAttendances.filter(a =>
        a.session.date.getFullYear() === currentYear &&
        a.session.date.getMonth() === currentMonth
      )
      thisMonthSessions = thisMonthAttendances.length
      thisMonthPresent = thisMonthAttendances.filter(a => a.present).length

      // Current streak (consecutive present sessions)
      streak = 0
      const sortedAttendances = [...sessionAttendances].sort((a, b) =>
        b.session.date.getTime() - a.session.date.getTime()
      )
      for (const att of sortedAttendances) {
        if (att.present) streak++
        else break
      }
    } else {
      // Fallback to DailyProgramCompletion data
      // Count unique days with completions
      totalSessions = completionDates.length
      presentSessions = completionDates.length // All are "present" days

      // This year
      const thisYearDates = completionDates.filter(d => d.startsWith(currentYear.toString()))
      thisYearSessions = thisYearDates.length
      thisYearPresent = thisYearDates.length

      // This month
      const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
      const thisMonthDates = completionDates.filter(d => d.startsWith(monthStr))
      thisMonthSessions = thisMonthDates.length
      thisMonthPresent = thisMonthDates.length

      // Calculate streak from daily completions (consecutive days)
      streak = 0
      const sortedDates = [...completionDates].sort().reverse() // Most recent first
      if (sortedDates.length > 0) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        let checkDate = new Date(today)

        // Start from today or yesterday
        let checkDateStr = checkDate.toISOString().split('T')[0]
        if (!completionDatesSet.has(checkDateStr)) {
          checkDate.setDate(checkDate.getDate() - 1)
          checkDateStr = checkDate.toISOString().split('T')[0]
        }

        // Count consecutive days
        while (completionDatesSet.has(checkDateStr)) {
          streak++
          checkDate.setDate(checkDate.getDate() - 1)
          checkDateStr = checkDate.toISOString().split('T')[0]
        }
      }
    }

    // ========================================
    // DAILY ATTENDANCE (PROGRAM COMPLETIONS) - for current week display
    // ========================================
    const dailyCompletions = await prisma.dailyProgramCompletion.findMany({
      where: { userId: id },
      include: {
        program: { select: { code: true, nameFr: true } }
      },
      orderBy: { date: 'desc' }
    })

    // Get completions for current week
    const currentWeekEnd = new Date(currentWeekStart)
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6)
    currentWeekEnd.setHours(23, 59, 59, 999)

    const thisWeekCompletions = dailyCompletions.filter(c =>
      c.date >= currentWeekStart && c.date <= currentWeekEnd && c.completed
    )

    // Group by program for the week
    const programsThisWeek: Record<string, { name: string; daysCompleted: number }> = {}
    for (const c of thisWeekCompletions) {
      if (!programsThisWeek[c.programId]) {
        programsThisWeek[c.programId] = { name: c.program.nameFr, daysCompleted: 0 }
      }
      programsThisWeek[c.programId].daysCompleted++
    }

    // ========================================
    // WEEKLY OBJECTIVES
    // ========================================
    const weeklyObjectives = await prisma.weeklyObjective.findMany({
      where: { userId: id, isActive: true },
      include: {
        completions: {
          where: { weekStartDate: currentWeekStart },
          take: 1
        }
      }
    })

    const objectivesData = weeklyObjectives.map(obj => ({
      id: obj.id,
      name: obj.name,
      isCustom: obj.isCustom,
      completed: obj.completions[0]?.completed || false
    }))

    // ========================================
    // RECITATION HISTORY (from SurahRecitation or Progress)
    // ========================================
    const recitations = await prisma.surahRecitation.findMany({
      where: { userId: id },
      include: {
        surah: { select: { number: true, nameAr: true, nameFr: true } },
        session: { select: { date: true, weekNumber: true, group: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    let recentRecitations: {
      id: string
      date: string
      weekNumber: number | null
      groupName: string
      surahNumber: number
      surahName: string
      surahNameAr: string
      type: string
      verseStart: number
      verseEnd: number
      status: string
      comment: string | null
    }[]

    if (recitations.length > 0) {
      // Use SurahRecitation data
      recentRecitations = recitations.map(r => ({
        id: r.id,
        date: r.session.date.toISOString().split('T')[0],
        weekNumber: r.session.weekNumber,
        groupName: r.session.group.name,
        surahNumber: r.surahNumber,
        surahName: r.surah.nameFr,
        surahNameAr: r.surah.nameAr,
        type: r.type,
        verseStart: r.verseStart,
        verseEnd: r.verseEnd,
        status: r.status,
        comment: r.comment
      }))
    } else {
      // Fall back to Progress entries
      recentRecitations = progressEntries.slice(0, 20).map(p => ({
        id: p.id,
        date: p.date.toISOString().split('T')[0],
        weekNumber: getWeekNumber(p.date),
        groupName: 'Personnel',
        surahNumber: p.surahNumber,
        surahName: p.surah?.nameFr || `Sourate ${p.surahNumber}`,
        surahNameAr: p.surah?.nameAr || '',
        type: 'MEMORIZATION',
        verseStart: p.verseStart,
        verseEnd: p.verseEnd,
        status: 'Enregistré',
        comment: p.comment
      }))
    }

    // ========================================
    // MONTHLY PROGRESSION (last 6 months)
    // ========================================
    const sixMonthsAgo = new Date(currentYear, currentMonth - 5, 1)

    const monthlyRecitations = await prisma.surahRecitation.groupBy({
      by: ['status'],
      where: {
        userId: id,
        createdAt: { gte: sixMonthsAgo }
      },
      _count: true
    })

    // Get validated masteries by month (or completed surahs from Progress)
    let recentValidations: { surahNumber: number; surahName: string; validatedAt: string | undefined; validatedWeek: number | null }[]

    const masteryValidations = surahMasteries
      .filter(m => m.validatedAt && m.validatedAt >= sixMonthsAgo)
      .map(m => ({
        surahNumber: m.surahNumber,
        surahName: m.surah.nameFr,
        validatedAt: m.validatedAt?.toISOString().split('T')[0],
        validatedWeek: m.validatedWeek
      }))

    if (masteryValidations.length > 0) {
      recentValidations = masteryValidations
    } else {
      // Use completed surahs from Progress
      recentValidations = surahsCompleteFromProgress.map(sp => ({
        surahNumber: sp.surahNumber,
        surahName: sp.surahName,
        validatedAt: sp.entries[0]?.date,
        validatedWeek: null
      }))
    }

    // ========================================
    // BUILD RESPONSE
    // ========================================
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        groups: user.groupMembers.map(m => ({
          id: m.group.id,
          name: m.group.name,
          role: m.role
        }))
      },
      memorization: {
        surahsValidated: surahsValidatedCount,
        surahsInProgress: surahsInProgressCount,
        totalVerses: totalVersesMemorized,
        totalPages: pagesMemorized,
        progressPercent
      },
      attendance: {
        totalSessions,
        presentSessions,
        globalRate: totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 0,
        thisYear: {
          sessions: thisYearSessions,
          present: thisYearPresent,
          rate: thisYearSessions > 0 ? Math.round((thisYearPresent / thisYearSessions) * 100) : 0
        },
        thisMonth: {
          sessions: thisMonthSessions,
          present: thisMonthPresent,
          rate: thisMonthSessions > 0 ? Math.round((thisMonthPresent / thisMonthSessions) * 100) : 0
        },
        currentStreak: streak
      },
      dailyPrograms: {
        currentWeek: Object.values(programsThisWeek),
        weekNumber: getWeekNumber(now)
      },
      weeklyObjectives: objectivesData,
      recentRecitations,
      surahMasteries: surahMasteries.length > 0
        ? surahMasteries.map(m => ({
            surahNumber: m.surahNumber,
            surahName: m.surah.nameFr,
            surahNameAr: m.surah.nameAr,
            totalVerses: m.surah.totalVerses,
            status: m.status,
            validatedWeek: m.validatedWeek,
            validatedAt: m.validatedAt?.toISOString().split('T')[0] || null
          }))
        : surahProgressFromEntries.map(sp => ({
            surahNumber: sp.surahNumber,
            surahName: sp.surahName,
            surahNameAr: sp.surahNameAr,
            totalVerses: sp.totalVerses,
            status: sp.isComplete ? 'V' : `${sp.coverage}%`,
            validatedWeek: null,
            validatedAt: null
          })),
      recentValidations,
      stats: {
        monthlyRecitations
      }
    })
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du profil' },
      { status: 500 }
    )
  }
}
