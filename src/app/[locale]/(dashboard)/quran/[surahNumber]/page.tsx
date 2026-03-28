'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, ArrowRight, Loader2, BookOpen, Eye } from 'lucide-react'

interface PageVerse {
  surahNumber: number
  surahNameAr: string
  verseNumber: number
  textAr: string
  juz: number | null
  hizb: number | null
  isMemorized: boolean
  isFirstOfSurah: boolean
}

interface MushafPage {
  pageNumber: number
  side: 'left' | 'right'
  juz: number | null
  hizb: number | null
  verses: PageVerse[]
}

interface SurahData {
  surah: {
    number: number
    nameAr: string
    nameFr: string
    nameEn: string
    totalVerses: number
    revelationType: string
    mastery: string | null
  }
  pages: MushafPage[]
  positions: {
    readingPage: number | null
    readingVerse: number | null
    revisionPage: number | null
    revisionVerse: number | null
  }
}

function toArabicNumber(n: number): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
  return n.toString().split('').map(d => arabicDigits[parseInt(d)]).join('')
}

function MushafPageView({
  page,
  positions,
  currentSurah,
}: {
  page: MushafPage
  positions: SurahData['positions']
  currentSurah: number
}) {
  const isRightPage = page.side === 'right'

  // Group verses by surah for header insertion
  const groups: Array<{ surahNumber: number; surahNameAr: string; showHeader: boolean; verses: PageVerse[] }> = []
  let currentGroup: typeof groups[0] | null = null

  for (const v of page.verses) {
    if (!currentGroup || currentGroup.surahNumber !== v.surahNumber) {
      currentGroup = {
        surahNumber: v.surahNumber,
        surahNameAr: v.surahNameAr,
        showHeader: v.isFirstOfSurah,
        verses: [],
      }
      groups.push(currentGroup)
    }
    currentGroup.verses.push(v)
  }

  return (
    <div
      className={`
        relative bg-[#fdf8ef] dark:bg-amber-950/10
        border border-amber-300/60 dark:border-amber-800/30
        min-h-[550px] sm:min-h-[650px] flex flex-col
        ${isRightPage ? 'border-l-2 border-l-amber-400/50' : 'border-r-2 border-r-amber-400/50'}
      `}
    >
      {/* Page header - juz / surah name / page number */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-amber-300/30 dark:border-amber-800/20 text-xs text-amber-700/70 dark:text-amber-400/60" dir="rtl">
        <span>{page.juz ? `الجزء ${toArabicNumber(page.juz)}` : ''}</span>
        <span>{page.hizb ? `الحزب ${toArabicNumber(Math.floor(page.hizb))}` : ''}</span>
      </div>

      {/* Page content - justified text */}
      <div className="flex-1 px-5 sm:px-8 py-4" dir="rtl">
        {groups.map((group, gi) => (
          <div key={`${group.surahNumber}-${gi}`}>
            {/* Surah header */}
            {group.showHeader && (
              <div className="text-center my-3">
                <div className="border-y-2 border-amber-400/40 dark:border-amber-600/30 py-2 bg-amber-50/50 dark:bg-amber-900/20">
                  <div className="text-lg font-bold text-amber-900 dark:text-amber-200">
                    سورة {group.surahNameAr}
                  </div>
                  {group.surahNumber !== 1 && group.surahNumber !== 9 && (
                    <div className="text-base text-amber-800/60 dark:text-amber-300/60 mt-1">
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Verses - justified like Mushaf */}
            <p className="text-justify leading-[2.8] sm:leading-[3.2]" style={{ textAlignLast: 'center' }}>
              {group.verses.map(verse => {
                const isRevisionPos = positions.revisionPage === page.pageNumber && positions.revisionVerse === verse.verseNumber
                const isReadingPos = positions.readingPage === page.pageNumber && positions.readingVerse === verse.verseNumber
                const isOtherSurah = verse.surahNumber !== currentSurah

                let verseClass = ''
                if (isRevisionPos) verseClass = 'bg-blue-200/60 dark:bg-blue-800/40 rounded px-1'
                else if (isReadingPos) verseClass = 'bg-purple-200/60 dark:bg-purple-800/40 rounded px-1'
                else if (verse.isMemorized) verseClass = 'bg-emerald-100/40 dark:bg-emerald-900/20'

                return (
                  <span key={`${verse.surahNumber}:${verse.verseNumber}`} className={`${verseClass} ${isOtherSurah ? 'opacity-35' : ''}`}>
                    <span className="text-xl sm:text-[1.65rem]">
                      {verse.textAr}
                    </span>
                    {' '}
                    <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-[10px] sm:text-xs rounded-full border border-amber-500/30 text-amber-700 dark:text-amber-400 align-middle">
                      {toArabicNumber(verse.verseNumber)}
                    </span>
                    {' '}
                  </span>
                )
              })}
            </p>
          </div>
        ))}
      </div>

      {/* Page footer - page number */}
      <div className="text-center py-1.5 border-t border-amber-300/30 dark:border-amber-800/20 text-sm font-medium text-amber-700/60 dark:text-amber-400/50">
        {toArabicNumber(page.pageNumber)}
      </div>
    </div>
  )
}

export default function SurahPage() {
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const surahNumber = parseInt(params.surahNumber as string)

  const [data, setData] = useState<SurahData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isNaN(surahNumber)) return
    setLoading(true)
    fetch(`/api/quran/surahs/${surahNumber}`)
      .then(res => res.json())
      .then(d => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [surahNumber])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data || !data.surah) {
    return <div className="text-center py-20 text-muted-foreground">Sourate non trouvée</div>
  }

  const { surah, pages, positions } = data

  // Pair pages for spread view (right page + left page)
  // In Mushaf: right = odd (read first), left = even
  const spreads: Array<{ right: MushafPage | null; left: MushafPage | null }> = []
  let i = 0
  while (i < pages.length) {
    const page = pages[i]
    if (page.side === 'right') {
      const nextPage = pages[i + 1]
      if (nextPage && nextPage.side === 'left') {
        spreads.push({ right: page, left: nextPage })
        i += 2
      } else {
        spreads.push({ right: page, left: null })
        i++
      }
    } else {
      spreads.push({ right: null, left: page })
      i++
    }
  }

  // Navigation: in RTL, "next surah" = higher number = chevron LEFT, "prev" = chevron RIGHT
  const goNext = () => router.push(`/${locale}/quran/${surahNumber + 1}`)
  const goPrev = () => router.push(`/${locale}/quran/${surahNumber - 1}`)

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Navigation bar - RTL aware */}
      <div className="flex items-center justify-between" dir="rtl">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/${locale}/quran`)}>
          <ArrowRight className="h-4 w-4 ml-1" />
          السور
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{surah.nameAr}</span>
          <span className="text-xs text-muted-foreground">({surah.nameFr})</span>
          <Badge variant="outline" className="text-xs">
            {toArabicNumber(surah.totalVerses)} آية
          </Badge>
          {surah.mastery && (
            <Badge variant="secondary" className="text-xs">
              {surah.mastery}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={surahNumber >= 114}
            onClick={goNext}
            title="السورة التالية"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-1">{toArabicNumber(surahNumber)}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={surahNumber <= 1}
            onClick={goPrev}
            title="السورة السابقة"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Position indicators */}
      {(positions.revisionVerse || positions.readingVerse) && (
        <div className="flex flex-wrap gap-3 justify-center">
          {positions.revisionVerse && (
            <div className="flex items-center gap-1.5 text-sm text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-3 py-1 rounded-full">
              <BookOpen className="h-3.5 w-3.5" />
              Révision : p.{positions.revisionPage} v.{positions.revisionVerse}
            </div>
          )}
          {positions.readingVerse && (
            <div className="flex items-center gap-1.5 text-sm text-purple-600 bg-purple-50 dark:bg-purple-950/30 px-3 py-1 rounded-full">
              <Eye className="h-3.5 w-3.5" />
              Lecture : p.{positions.readingPage} v.{positions.readingVerse}
            </div>
          )}
        </div>
      )}

      {/* Mushaf spreads - RTL layout */}
      <div className="space-y-6">
        {spreads.map((spread, si) => (
          <div key={si} className="grid grid-cols-1 lg:grid-cols-2" dir="rtl">
            {/* Right page (odd, read first in RTL) - appears on the right */}
            <div>
              {spread.right ? (
                <MushafPageView page={spread.right} positions={positions} currentSurah={surahNumber} />
              ) : (
                <div className="min-h-[550px]" />
              )}
            </div>
            {/* Left page (even) - appears on the left */}
            <div>
              {spread.left ? (
                <MushafPageView page={spread.left} positions={positions} currentSurah={surahNumber} />
              ) : (
                <div className="min-h-[550px]" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom navigation - RTL */}
      <div className="flex items-center justify-between py-6 border-t" dir="rtl">
        <Button
          variant="outline"
          disabled={surahNumber >= 114}
          onClick={goNext}
        >
          السورة التالية
          <ChevronRight className="h-4 w-4 mr-1" />
        </Button>
        <span className="text-sm text-muted-foreground">
          {toArabicNumber(pages[0]?.pageNumber)} – {toArabicNumber(pages[pages.length - 1]?.pageNumber)}
        </span>
        <Button
          variant="outline"
          disabled={surahNumber <= 1}
          onClick={goPrev}
        >
          <ChevronLeft className="h-4 w-4 ml-1" />
          السورة السابقة
        </Button>
      </div>
    </div>
  )
}
