import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const userId = session.user.id

    // Get all progress entries for the user
    const progressEntries = await prisma.progress.findMany({
      where: { userId },
      include: { surah: true },
    })

    // Calculate total verses
    const totalVerses = progressEntries.reduce(
      (sum, entry) => sum + (entry.verseEnd - entry.verseStart + 1),
      0
    )

    // Calculate total pages (approximate: ~15 verses per page)
    const totalPages = Math.round(totalVerses / 15)

    // Get unique surahs worked on
    const uniqueSurahs = new Set(progressEntries.map(e => e.surahNumber)).size

    // Get group memberships count
    const groupsCount = await prisma.groupMember.count({
      where: { userId },
    })

    // Calculate attendance rate for current month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const attendance = await prisma.dailyAttendance.findFirst({
      where: {
        userId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    })

    let attendanceRate = 0
    if (attendance) {
      const days = [
        attendance.sunday,
        attendance.monday,
        attendance.tuesday,
        attendance.wednesday,
        attendance.thursday,
        attendance.friday,
        attendance.saturday,
      ]
      const presentDays = days.filter(Boolean).length
      attendanceRate = Math.round((presentDays / 7) * 100)
    }

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

    // Get active objectives
    const objectives = await prisma.userObjective.findMany({
      where: { userId, isActive: true },
      include: { program: true },
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

    return NextResponse.json({
      totalVerses,
      totalPages,
      uniqueSurahs,
      groupsCount,
      attendanceRate,
      recentProgress,
      objectives,
      weeklyByProgram,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    )
  }
}
