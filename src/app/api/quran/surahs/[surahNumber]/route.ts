import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'
import { getMemorizedZone } from '@/lib/quran-utils'

// GET — Get all verses of a surah grouped by page, with full page content
export async function GET(
  request: Request,
  { params }: { params: Promise<{ surahNumber: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId } = await getEffectiveUserId()
    const targetUserId = userId || session.user.id
    const { surahNumber: surahParam } = await params
    const surahNumber = parseInt(surahParam)

    if (isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      return NextResponse.json({ error: 'Numéro de sourate invalide' }, { status: 400 })
    }

    // Get surah info and its verses to find which pages it spans
    const [surah, surahVerses, user, zone, mastery] = await Promise.all([
      prisma.surah.findUnique({ where: { number: surahNumber } }),
      prisma.verse.findMany({
        where: { surahNumber, textAr: { not: null } },
        orderBy: { verseNumber: 'asc' },
        select: { page: true }
      }),
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          readingCurrentHizb: true,
          revisionCurrentHizb: true,
        }
      }),
      getMemorizedZone(targetUserId),
      prisma.surahMastery.findUnique({
        where: { userId_surahNumber: { userId: targetUserId, surahNumber } }
      })
    ])

    if (!surah) {
      return NextResponse.json({ error: 'Sourate non trouvée' }, { status: 404 })
    }

    // Get all pages this surah spans
    const pageNumbers = [...new Set(surahVerses.map(v => v.page))].sort((a, b) => a - b)

    // Fetch ALL verses on those pages (including other surahs on the same page)
    const allVerses = await prisma.verse.findMany({
      where: { page: { in: pageNumbers }, textAr: { not: null } },
      orderBy: [{ page: 'asc' }, { surahNumber: 'asc' }, { verseNumber: 'asc' }],
      include: { surah: { select: { nameAr: true } } },
    })

    // Build pages with surah headers
    const pages = new Map<number, Array<{
      surahNumber: number
      surahNameAr: string
      verseNumber: number
      textAr: string
      textTajweed: string | null
      wordsLines: Array<{ t: string; l: number }> | null
      juz: number | null
      hizb: number | null
      isMemorized: boolean
      isFirstOfSurah: boolean
    }>>()

    // Track first verse of each surah on each page
    const seenSurahOnPage = new Set<string>()

    for (const v of allVerses) {
      if (!pages.has(v.page)) pages.set(v.page, [])
      const pageKey = `${v.page}-${v.surahNumber}`
      const isFirst = !seenSurahOnPage.has(pageKey) && v.verseNumber === 1
      if (v.verseNumber === 1) seenSurahOnPage.add(pageKey)

      const isMemorized = zone
        ? v.hizb != null && v.hizb >= zone.startHizb && v.hizb <= zone.endHizb
        : false

      pages.get(v.page)!.push({
        surahNumber: v.surahNumber,
        surahNameAr: v.surah.nameAr,
        verseNumber: v.verseNumber,
        textAr: v.textAr!,
        textTajweed: v.textTajweed || null,
        wordsLines: (v.wordsLines as Array<{ t: string; l: number }>) || null,
        juz: v.juz,
        hizb: v.hizb,
        isMemorized,
        isFirstOfSurah: isFirst,
      })
    }

    // Find reading and revision positions
    let readingPage: number | null = null
    let readingVerse: number | null = null
    let revisionPage: number | null = null
    let revisionVerse: number | null = null

    if (user) {
      const readingHizb = user.readingCurrentHizb ?? 0
      const revisionHizb = user.revisionCurrentHizb ?? 0

      for (const v of allVerses) {
        if (readingHizb > 0 && v.hizb != null && Math.abs(v.hizb - (readingHizb + 1)) < 0.5 && !readingVerse) {
          readingPage = v.page
          readingVerse = v.verseNumber
        }
        if (revisionHizb > 0 && zone && v.hizb != null && Math.abs(v.hizb - (zone.startHizb + revisionHizb)) < 0.5 && !revisionVerse) {
          revisionPage = v.page
          revisionVerse = v.verseNumber
        }
      }
    }

    // Convert to array
    const pagesArray = pageNumbers.map(pageNum => ({
      pageNumber: pageNum,
      side: pageNum % 2 === 1 ? 'right' : 'left' as 'right' | 'left',
      juz: pages.get(pageNum)?.[0]?.juz || null,
      hizb: pages.get(pageNum)?.[0]?.hizb || null,
      verses: pages.get(pageNum) || [],
    }))

    return NextResponse.json({
      surah: {
        number: surah.number,
        nameAr: surah.nameAr,
        nameFr: surah.nameFr,
        nameEn: surah.nameEn,
        totalVerses: surah.totalVerses,
        revelationType: surah.revelationType,
        mastery: mastery?.status || null,
      },
      pages: pagesArray,
      positions: {
        readingPage,
        readingVerse,
        revisionPage,
        revisionVerse,
      },
      memorizedZone: zone,
    })
  } catch (error) {
    console.error('Error fetching surah:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la sourate' },
      { status: 500 }
    )
  }
}
