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

    // Get TAFSIR program
    const tafsirProgram = await prisma.program.findFirst({
      where: { code: 'TAFSIR' }
    })

    if (!tafsirProgram) {
      return NextResponse.json({ error: 'Programme TAFSIR non trouvé' }, { status: 500 })
    }

    // Get all Tafsir progress entries for the user
    const tafsirEntries = await prisma.progress.findMany({
      where: {
        userId,
        programId: tafsirProgram.id
      },
      include: {
        surah: true
      },
      orderBy: [
        { surahNumber: 'asc' },
        { date: 'desc' }
      ]
    })

    // Get all surahs
    const allSurahs = await prisma.surah.findMany({
      orderBy: { number: 'asc' }
    })

    // Calculate coverage per surah
    const surahCoverage: Record<number, {
      surahNumber: number
      surahName: string
      surahNameAr: string
      totalVerses: number
      coveredVerses: Set<number>
      entries: { date: string; verseStart: number; verseEnd: number }[]
    }> = {}

    // Initialize all surahs
    for (const surah of allSurahs) {
      surahCoverage[surah.number] = {
        surahNumber: surah.number,
        surahName: surah.nameFr,
        surahNameAr: surah.nameAr,
        totalVerses: surah.totalVerses,
        coveredVerses: new Set(),
        entries: []
      }
    }

    // Add covered verses from entries
    for (const entry of tafsirEntries) {
      const surah = surahCoverage[entry.surahNumber]
      if (surah) {
        for (let v = entry.verseStart; v <= entry.verseEnd; v++) {
          surah.coveredVerses.add(v)
        }
        surah.entries.push({
          date: entry.date.toISOString().split('T')[0],
          verseStart: entry.verseStart,
          verseEnd: entry.verseEnd
        })
      }
    }

    // Build response
    const surahStats = allSurahs.map(surah => {
      const coverage = surahCoverage[surah.number]
      const coveredCount = coverage.coveredVerses.size
      const percentage = Math.round((coveredCount / surah.totalVerses) * 100)

      return {
        surahNumber: surah.number,
        surahName: surah.nameFr,
        surahNameAr: surah.nameAr,
        totalVerses: surah.totalVerses,
        coveredVerses: coveredCount,
        percentage,
        isComplete: coveredCount >= surah.totalVerses,
        entries: coverage.entries
      }
    })

    // Calculate global stats
    const totalQuranVerses = 6236
    const totalCoveredVerses = surahStats.reduce((sum, s) => sum + s.coveredVerses, 0)
    const globalPercentage = Math.round((totalCoveredVerses / totalQuranVerses) * 100)
    const completedSurahs = surahStats.filter(s => s.isComplete).length
    const inProgressSurahs = surahStats.filter(s => s.coveredVerses > 0 && !s.isComplete).length

    return NextResponse.json({
      global: {
        totalVerses: totalQuranVerses,
        coveredVerses: totalCoveredVerses,
        percentage: globalPercentage,
        completedSurahs,
        inProgressSurahs,
        totalSurahs: 114
      },
      surahs: surahStats.filter(s => s.coveredVerses > 0 || s.entries.length > 0),
      allSurahs: surahStats
    })
  } catch (error) {
    console.error('Error fetching tafsir coverage:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la couverture Tafsir' },
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

    const userId = session.user.id
    const body = await request.json()
    const { surahNumber, verseStart, verseEnd, date, comment } = body

    if (!surahNumber || !verseStart || !verseEnd) {
      return NextResponse.json({ error: 'Sourate et versets requis' }, { status: 400 })
    }

    // Validate surah exists
    const surah = await prisma.surah.findUnique({
      where: { number: surahNumber }
    })

    if (!surah) {
      return NextResponse.json({ error: 'Sourate non trouvée' }, { status: 404 })
    }

    if (verseStart < 1 || verseEnd > surah.totalVerses || verseStart > verseEnd) {
      return NextResponse.json({ error: 'Versets invalides' }, { status: 400 })
    }

    // Get TAFSIR program
    const tafsirProgram = await prisma.program.findFirst({
      where: { code: 'TAFSIR' }
    })

    if (!tafsirProgram) {
      return NextResponse.json({ error: 'Programme TAFSIR non trouvé' }, { status: 500 })
    }

    // Create progress entry
    const entry = await prisma.progress.create({
      data: {
        userId,
        programId: tafsirProgram.id,
        date: date ? new Date(date) : new Date(),
        surahNumber,
        verseStart,
        verseEnd,
        comment: comment || null,
        createdBy: userId
      },
      include: {
        surah: true,
        program: true
      }
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Error creating tafsir entry:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'entrée Tafsir' },
      { status: 500 }
    )
  }
}
