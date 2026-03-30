import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const programId = searchParams.get('programId')
    const userId = searchParams.get('userId')
    const limitParam = parseInt(searchParams.get('limit') || '100')
    const limit = Math.min(Math.max(limitParam, 1), 1000) // Bounds: 1-1000

    // Support impersonation
    const { userId: effectiveUserId, isImpersonating } = await getEffectiveUserId()

    // Get current user to check if admin
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    const isAdmin = currentUser?.role === 'ADMIN'

    // Build where clause
    const where: Record<string, unknown> = {}

    if (isImpersonating) {
      // When impersonating, show the impersonated user's data
      where.userId = effectiveUserId
    } else if (isAdmin) {
      // Admin can see all or filter by user
      if (userId && userId !== 'all') {
        where.userId = userId
      }
    } else {
      // Regular users only see their own data
      where.userId = session.user.id
    }

    if (programId && programId !== 'all') {
      where.programId = programId
    }

    const progress = await prisma.progress.findMany({
      where,
      include: {
        program: true,
        surah: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
      orderBy: { date: 'desc' },
      take: limit,
    })

    return NextResponse.json(progress)
  } catch (error) {
    console.error('Error fetching progress:', error)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'avancement" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { programId, date, surahNumber, verseStart, verseEnd, repetitions, comment, userId } = await request.json()

    if (!programId || !surahNumber || !verseStart || !verseEnd) {
      return NextResponse.json(
        { error: 'Données incomplètes' },
        { status: 400 }
      )
    }

    // Check if admin and userId provided
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    const isAdmin = currentUser?.role === 'ADMIN'
    const targetUserId = (isAdmin && userId) ? userId : session.user.id

    // Verify surah exists and verse range is valid
    const surah = await prisma.surah.findUnique({
      where: { number: surahNumber },
    })

    if (!surah) {
      return NextResponse.json({ error: 'Sourate non trouvée' }, { status: 400 })
    }

    if (verseStart < 1 || verseEnd > surah.totalVerses || verseStart > verseEnd) {
      return NextResponse.json(
        { error: `Versets invalides. La sourate ${surah.nameFr} a ${surah.totalVerses} versets.` },
        { status: 400 }
      )
    }

    const progressDate = date ? new Date(date) : new Date()

    const progress = await prisma.progress.create({
      data: {
        userId: targetUserId,
        programId,
        date: progressDate,
        surahNumber,
        verseStart,
        verseEnd,
        repetitions,
        comment,
        createdBy: session.user.id,
      },
      include: {
        program: true,
        surah: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
    })

    // For MEMORIZATION entries, auto-create SurahRecitation in the week's session
    if (progress.program.code === 'MEMORIZATION') {
      try {
        // Find the user's group where isStudent=true
        const membership = await prisma.groupMember.findFirst({
          where: { userId: targetUserId, isStudent: true, isActive: true }
        })

        if (membership) {
          const groupId = membership.groupId
          const entryDate = new Date(progressDate)

          // Week start = Sunday
          const weekStart = new Date(entryDate)
          weekStart.setUTCHours(0, 0, 0, 0)
          weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay())

          const weekEnd = new Date(weekStart)
          weekEnd.setUTCDate(weekStart.getUTCDate() + 7)

          // Calculate week number (ISO-like, starting from week 1 of the year)
          const startOfYear = new Date(Date.UTC(entryDate.getUTCFullYear(), 0, 1))
          const weekNumber = Math.ceil(((entryDate.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7)

          // Find existing session this week
          let groupSession = await prisma.groupSession.findFirst({
            where: {
              groupId,
              date: { gte: weekStart, lt: weekEnd }
            }
          })

          // Create session if not found
          if (!groupSession) {
            groupSession = await prisma.groupSession.create({
              data: {
                groupId,
                date: weekStart,
                weekNumber,
                createdBy: session.user.id,
              }
            })
          }

          // Determine status: "V" if full surah covered, "50%" otherwise
          const isFullSurah = verseStart === 1 && verseEnd === surah.totalVerses
          const status = isFullSurah ? 'V' : '50%'

          // Create SurahRecitation
          await prisma.surahRecitation.create({
            data: {
              sessionId: groupSession.id,
              userId: targetUserId,
              surahNumber,
              type: 'MEMORIZATION',
              verseStart,
              verseEnd,
              status,
              comment: comment || `v.${verseStart}-${verseEnd}`,
              createdBy: session.user.id,
            }
          })

          // Mark user as present in this session
          await prisma.sessionAttendance.upsert({
            where: {
              sessionId_userId: {
                sessionId: groupSession.id,
                userId: targetUserId,
              }
            },
            update: { present: true },
            create: {
              sessionId: groupSession.id,
              userId: targetUserId,
              present: true,
              excused: false,
            }
          })
        }
      } catch (err) {
        // Don't fail the Progress creation if SurahRecitation fails
        console.error('Error auto-creating SurahRecitation:', err)
      }
    }

    return NextResponse.json(progress)
  } catch (error) {
    console.error('Error creating progress:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement de l'avancement" },
      { status: 500 }
    )
  }
}
