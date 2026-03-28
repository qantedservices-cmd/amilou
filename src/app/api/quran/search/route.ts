import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// GET — Search verses by keyword, surah number, page number, or surah:verse
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()

    if (!q || q.length < 1) {
      return NextResponse.json({ results: [] })
    }

    // Parse search query
    // Format "2:255" → surah 2, verse 255
    const surahVerseMatch = q.match(/^(\d+):(\d+)$/)
    if (surahVerseMatch) {
      const surahNum = parseInt(surahVerseMatch[1])
      const verseNum = parseInt(surahVerseMatch[2])
      const verse = await prisma.verse.findFirst({
        where: { surahNumber: surahNum, verseNumber: verseNum, textAr: { not: null } },
        include: { surah: { select: { nameAr: true, nameFr: true } } }
      })
      if (verse) {
        return NextResponse.json({
          results: [{
            surahNumber: verse.surahNumber,
            surahNameAr: verse.surah.nameAr,
            surahNameFr: verse.surah.nameFr,
            verseNumber: verse.verseNumber,
            textAr: verse.textAr,
            page: verse.page,
          }]
        })
      }
      return NextResponse.json({ results: [] })
    }

    // Format "p123" or "p.123" → page 123
    const pageMatch = q.match(/^p\.?(\d+)$/)
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1])
      const verses = await prisma.verse.findMany({
        where: { page: pageNum, textAr: { not: null } },
        orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }],
        include: { surah: { select: { nameAr: true, nameFr: true } } },
        take: 30,
      })
      return NextResponse.json({
        results: verses.map(v => ({
          surahNumber: v.surahNumber,
          surahNameAr: v.surah.nameAr,
          surahNameFr: v.surah.nameFr,
          verseNumber: v.verseNumber,
          textAr: v.textAr,
          page: v.page,
        }))
      })
    }

    // Pure number → surah number
    const pureNum = q.match(/^(\d+)$/)
    if (pureNum) {
      const surahNum = parseInt(pureNum[1])
      if (surahNum >= 1 && surahNum <= 114) {
        const surah = await prisma.surah.findUnique({ where: { number: surahNum } })
        if (surah) {
          return NextResponse.json({
            results: [{
              surahNumber: surah.number,
              surahNameAr: surah.nameAr,
              surahNameFr: surah.nameFr,
              verseNumber: null,
              textAr: null,
              page: null,
              isSurah: true,
              totalVerses: surah.totalVerses,
            }]
          })
        }
      }
    }

    // Search surah names (Arabic or French)
    const surahResults = await prisma.surah.findMany({
      where: {
        OR: [
          { nameAr: { contains: q } },
          { nameFr: { contains: q, mode: 'insensitive' } },
          { nameEn: { contains: q, mode: 'insensitive' } },
        ]
      },
      take: 10,
    })

    if (surahResults.length > 0) {
      const results: Array<Record<string, unknown>> = surahResults.map(s => ({
        surahNumber: s.number,
        surahNameAr: s.nameAr,
        surahNameFr: s.nameFr,
        verseNumber: null as number | null,
        textAr: null as string | null,
        page: null as number | null,
        isSurah: true,
        totalVerses: s.totalVerses,
      }))

      // Also search verse text if Arabic
      if (/[\u0600-\u06FF]/.test(q)) {
        const verseResults = await prisma.verse.findMany({
          where: { textAr: { contains: q } },
          include: { surah: { select: { nameAr: true, nameFr: true } } },
          take: 20,
        })
        for (const v of verseResults) {
          results.push({
            surahNumber: v.surahNumber,
            surahNameAr: v.surah.nameAr,
            surahNameFr: v.surah.nameFr,
            verseNumber: v.verseNumber,
            textAr: v.textAr,
            page: v.page,
            isSurah: false,
            totalVerses: 0,
          })
        }
      }

      return NextResponse.json({ results })
    }

    // Arabic text search
    if (/[\u0600-\u06FF]/.test(q)) {
      const verses = await prisma.verse.findMany({
        where: { textAr: { contains: q } },
        include: { surah: { select: { nameAr: true, nameFr: true } } },
        take: 30,
      })
      return NextResponse.json({
        results: verses.map(v => ({
          surahNumber: v.surahNumber,
          surahNameAr: v.surah.nameAr,
          surahNameFr: v.surah.nameFr,
          verseNumber: v.verseNumber,
          textAr: v.textAr,
          page: v.page,
        }))
      })
    }

    return NextResponse.json({ results: [] })
  } catch (error) {
    console.error('Error searching quran:', error)
    return NextResponse.json({ error: 'Erreur de recherche' }, { status: 500 })
  }
}
