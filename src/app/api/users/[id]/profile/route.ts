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
    // SURAH MASTERY STATS
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

    const surahsValidated = surahMasteries.filter(m =>
      validatedStatuses.some(s => m.status.startsWith(s))
    )
    const surahsInProgress = surahMasteries.filter(m =>
      inProgressStatuses.includes(m.status)
    )

    // Calculate total verses memorized (from validated surahs)
    let totalVersesMemorized = 0
    for (const mastery of surahsValidated) {
      totalVersesMemorized += mastery.surah.totalVerses
    }

    // Approximate pages (about 15 verses per page)
    const pagesMemorized = Math.round(totalVersesMemorized / 15)

    // Total Quran: 6236 verses, 604 pages
    const progressPercent = Math.round((totalVersesMemorized / 6236) * 100)

    // ========================================
    // ATTENDANCE STATS
    // ========================================
    const userGroupIds = user.groupMembers.map(m => m.groupId)

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

    // Calculate attendance rates
    const totalSessions = sessionAttendances.length
    const presentSessions = sessionAttendances.filter(a => a.present).length

    // This year's sessions
    const thisYearAttendances = sessionAttendances.filter(a =>
      a.session.date.getFullYear() === currentYear
    )
    const thisYearPresent = thisYearAttendances.filter(a => a.present).length

    // This month's sessions
    const thisMonthAttendances = sessionAttendances.filter(a =>
      a.session.date.getFullYear() === currentYear &&
      a.session.date.getMonth() === currentMonth
    )
    const thisMonthPresent = thisMonthAttendances.filter(a => a.present).length

    // Current streak (consecutive present sessions)
    let streak = 0
    const sortedAttendances = [...sessionAttendances].sort((a, b) =>
      b.session.date.getTime() - a.session.date.getTime()
    )
    for (const att of sortedAttendances) {
      if (att.present) streak++
      else break
    }

    // ========================================
    // DAILY ATTENDANCE (PROGRAM COMPLETIONS)
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
    // RECITATION HISTORY
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

    const recentRecitations = recitations.map(r => ({
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

    // Get validated masteries by month
    const recentValidations = surahMasteries
      .filter(m => m.validatedAt && m.validatedAt >= sixMonthsAgo)
      .map(m => ({
        surahNumber: m.surahNumber,
        surahName: m.surah.nameFr,
        validatedAt: m.validatedAt?.toISOString().split('T')[0],
        validatedWeek: m.validatedWeek
      }))

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
        surahsValidated: surahsValidated.length,
        surahsInProgress: surahsInProgress.length,
        totalVerses: totalVersesMemorized,
        totalPages: pagesMemorized,
        progressPercent
      },
      attendance: {
        totalSessions,
        presentSessions,
        globalRate: totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 0,
        thisYear: {
          sessions: thisYearAttendances.length,
          present: thisYearPresent,
          rate: thisYearAttendances.length > 0 ? Math.round((thisYearPresent / thisYearAttendances.length) * 100) : 0
        },
        thisMonth: {
          sessions: thisMonthAttendances.length,
          present: thisMonthPresent,
          rate: thisMonthAttendances.length > 0 ? Math.round((thisMonthPresent / thisMonthAttendances.length) * 100) : 0
        },
        currentStreak: streak
      },
      dailyPrograms: {
        currentWeek: Object.values(programsThisWeek),
        weekNumber: getWeekNumber(now)
      },
      weeklyObjectives: objectivesData,
      recentRecitations,
      surahMasteries: surahMasteries.map(m => ({
        surahNumber: m.surahNumber,
        surahName: m.surah.nameFr,
        surahNameAr: m.surah.nameAr,
        totalVerses: m.surah.totalVerses,
        status: m.status,
        validatedWeek: m.validatedWeek,
        validatedAt: m.validatedAt?.toISOString().split('T')[0] || null
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
