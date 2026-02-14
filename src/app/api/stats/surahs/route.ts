import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'
import { checkDataVisibility } from '@/lib/permissions'

// Programs to track (excluding REVISION and READING which use cycles)
const TRACKED_PROGRAMS = ['MEMORIZATION', 'CONSOLIDATION', 'TAFSIR']

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Support impersonation
    const { userId: effectiveUserId } = await getEffectiveUserId()
    let userId = effectiveUserId!

    // Support viewing another user's stats (for admin/referent)
    const { searchParams } = new URL(request.url)
    const requestedUserId = searchParams.get('userId')
    if (requestedUserId && requestedUserId !== userId) {
      const visibility = await checkDataVisibility(userId, requestedUserId, 'stats')
      if (!visibility.canView) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
      userId = requestedUserId
    }

    // Get all surahs
    const surahs = await prisma.surah.findMany({
      orderBy: { number: 'asc' }
    })

    // Get programs
    const programs = await prisma.program.findMany({
      where: { code: { in: TRACKED_PROGRAMS } }
    })
    const programMap = new Map(programs.map(p => [p.id, p.code]))

    // Get all progress entries for this user
    const progressEntries = await prisma.progress.findMany({
      where: {
        userId,
        program: { code: { in: TRACKED_PROGRAMS } }
      },
      include: { program: true }
    })

    // Build coverage map: surahNumber -> programCode -> Set of verses
    const coverageMap: Record<number, Record<string, Set<number>>> = {}

    for (const surah of surahs) {
      coverageMap[surah.number] = {}
      for (const code of TRACKED_PROGRAMS) {
        coverageMap[surah.number][code] = new Set()
      }
    }

    for (const entry of progressEntries) {
      const programCode = entry.program.code
      if (!coverageMap[entry.surahNumber]) continue

      for (let v = entry.verseStart; v <= entry.verseEnd; v++) {
        coverageMap[entry.surahNumber][programCode].add(v)
      }
    }

    // Build result
    const surahProgress = surahs.map(surah => {
      const coverage = coverageMap[surah.number]
      const programProgress: Record<string, { covered: number; percentage: number }> = {}

      for (const code of TRACKED_PROGRAMS) {
        const covered = coverage[code].size
        programProgress[code] = {
          covered,
          percentage: Math.round((covered / surah.totalVerses) * 100)
        }
      }

      // Calculate overall (based on memorization as primary)
      const memCovered = coverage['MEMORIZATION'].size
      const overallPercentage = Math.round((memCovered / surah.totalVerses) * 100)

      return {
        number: surah.number,
        nameFr: surah.nameFr,
        nameAr: surah.nameAr,
        totalVerses: surah.totalVerses,
        programs: programProgress,
        overallPercentage
      }
    })

    // Calculate totals
    const totals: Record<string, { covered: number; percentage: number }> = {}
    const totalVerses = 6236

    for (const code of TRACKED_PROGRAMS) {
      let totalCovered = 0
      for (const surahNum of Object.keys(coverageMap)) {
        totalCovered += coverageMap[parseInt(surahNum)][code].size
      }
      totals[code] = {
        covered: totalCovered,
        percentage: Math.round((totalCovered / totalVerses) * 100)
      }
    }

    return NextResponse.json({
      surahs: surahProgress,
      totals,
      programs: TRACKED_PROGRAMS
    })
  } catch (error) {
    console.error('Error fetching surah stats:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    )
  }
}
