'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2, BookOpen, Eye } from 'lucide-react'

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
        relative bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-800/30
        rounded-sm min-h-[500px] sm:min-h-[600px] flex flex-col
        ${isRightPage ? 'rounded-r-lg' : 'rounded-l-lg'}
      `}
    >
      {/* Page header */}
      <div className={`flex items-center justify-between px-4 py-2 border-b border-amber-200/30 dark:border-amber-800/20 text-xs text-muted-foreground`}>
        <span>{page.juz ? `جزء ${toArabicNumber(page.juz)}` : ''}</span>
        <span className="font-medium">{toArabicNumber(page.pageNumber)}</span>
        <span>{page.hizb ? `حزب ${toArabicNumber(Math.floor(page.hizb))}` : ''}</span>
      </div>

      {/* Page side indicator */}
      <div className={`absolute top-2 ${isRightPage ? 'left-2' : 'right-2'}`}>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isRightPage ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'}`}>
          {isRightPage ? 'يمين' : 'يسار'}
        </span>
      </div>

      {/* Page content */}
      <div className="flex-1 px-4 sm:px-6 py-4" dir="rtl">
        {groups.map((group, gi) => (
          <div key={`${group.surahNumber}-${gi}`}>
            {/* Surah header (Bismillah banner) */}
            {group.showHeader && (
              <div className="text-center my-3">
                <div className="inline-block bg-amber-100/80 dark:bg-amber-900/30 border border-amber-300/50 dark:border-amber-700/30 rounded-lg px-6 py-2">
                  <div className="text-lg font-bold text-amber-900 dark:text-amber-200">
                    سورة {group.surahNameAr}
                  </div>
                  {group.surahNumber !== 1 && group.surahNumber !== 9 && (
                    <div className="text-base text-amber-800/70 dark:text-amber-300/70 mt-1">
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Verses */}
            <span className="leading-[2.6] sm:leading-[3]">
              {group.verses.map(verse => {
                const isRevisionPos = positions.revisionPage === page.pageNumber && positions.revisionVerse === verse.verseNumber
                const isReadingPos = positions.readingPage === page.pageNumber && positions.readingVerse === verse.verseNumber
                const isOtherSurah = verse.surahNumber !== currentSurah

                let verseClass = ''
                if (isRevisionPos) verseClass = 'bg-blue-200/60 dark:bg-blue-800/40 rounded px-1'
                else if (isReadingPos) verseClass = 'bg-purple-200/60 dark:bg-purple-800/40 rounded px-1'
                else if (verse.isMemorized) verseClass = 'bg-emerald-100/50 dark:bg-emerald-900/20'

                return (
                  <span key={`${verse.surahNumber}:${verse.verseNumber}`} className={`${verseClass} ${isOtherSurah ? 'opacity-40' : ''}`}>
                    <span className="text-xl sm:text-2xl">
                      {verse.textAr}
                    </span>
                    <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 mx-0.5 text-[10px] sm:text-xs rounded-full border border-amber-400/40 dark:border-amber-600/30 text-amber-700 dark:text-amber-400 align-middle">
                      {toArabicNumber(verse.verseNumber)}
                    </span>
                  </span>
                )
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SurahPage() {
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const surahNumber = parseInt(params.surahNumber as string)
  const contentRef = useRef<HTMLDivElement>(null)

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

  // Pair pages for spread view (right + left)
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

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Navigation bar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/${locale}/quran`)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Sourates
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{surah.nameFr}</span>
          <Badge variant="outline" className="text-xs">
            {surah.totalVerses} v.
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
            disabled={surahNumber <= 1}
            onClick={() => router.push(`/${locale}/quran/${surahNumber - 1}`)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-1">{surahNumber}/114</span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={surahNumber >= 114}
            onClick={() => router.push(`/${locale}/quran/${surahNumber + 1}`)}
          >
            <ChevronRight className="h-4 w-4" />
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

      {/* Mushaf pages */}
      <div ref={contentRef} className="space-y-6">
        {spreads.map((spread, si) => (
          <div key={si} className="grid grid-cols-1 lg:grid-cols-2 gap-1">
            {/* Right page (odd, first in RTL reading order) */}
            <div className="lg:order-2">
              {spread.right ? (
                <MushafPageView page={spread.right} positions={positions} currentSurah={surahNumber} />
              ) : (
                <div className="min-h-[500px]" />
              )}
            </div>
            {/* Left page (even) */}
            <div className="lg:order-1">
              {spread.left ? (
                <MushafPageView page={spread.left} positions={positions} currentSurah={surahNumber} />
              ) : (
                <div className="min-h-[500px]" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between py-6 border-t">
        <Button
          variant="outline"
          disabled={surahNumber <= 1}
          onClick={() => router.push(`/${locale}/quran/${surahNumber - 1}`)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {surahNumber > 1 ? `Sourate ${surahNumber - 1}` : ''}
        </Button>
        <span className="text-sm text-muted-foreground">
          Pages {pages[0]?.pageNumber}–{pages[pages.length - 1]?.pageNumber}
        </span>
        <Button
          variant="outline"
          disabled={surahNumber >= 114}
          onClick={() => router.push(`/${locale}/quran/${surahNumber + 1}`)}
        >
          {surahNumber < 114 ? `Sourate ${surahNumber + 1}` : ''}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}
