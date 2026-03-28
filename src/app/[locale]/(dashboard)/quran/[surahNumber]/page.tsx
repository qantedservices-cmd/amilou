'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ChevronLeft, ChevronRight, ArrowRight, Loader2, BookOpen, Eye, Palette, List } from 'lucide-react'

interface PageVerse {
  surahNumber: number
  surahNameAr: string
  verseNumber: number
  textAr: string
  textTajweed: string | null
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

// Sanitize tajweed HTML - only allow tajweed and span tags with class attributes
// This content comes from our own database (seeded from quran.com API), not user input
function renderTajweedText(html: string): string {
  return html.replace(/<span class=end>.*?<\/span>/g, '')
}

function MushafPageView({
  page,
  positions,
  currentSurah,
  tajweedEnabled,
}: {
  page: MushafPage
  positions: SurahData['positions']
  currentSurah: number
  tajweedEnabled: boolean
}) {
  const isRightPage = page.side === 'right'

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
        h-[75vh] min-h-[500px] max-h-[900px] flex flex-col overflow-hidden
        ${isRightPage ? 'border-l-[3px] border-l-amber-400/40' : 'border-r-[3px] border-r-amber-400/40'}
      `}
    >
      {/* Page header */}
      <div className="flex items-center justify-between px-4 py-1 border-b border-amber-300/30 dark:border-amber-800/20 text-xs text-amber-700/60 dark:text-amber-400/50 shrink-0" dir="rtl">
        <span>{page.juz ? `الجزء ${toArabicNumber(page.juz)}` : ''}</span>
        <span>{page.hizb ? `الحزب ${toArabicNumber(Math.floor(page.hizb))}` : ''}</span>
      </div>

      {/* Page content */}
      <div className="flex-1 px-5 sm:px-8 py-3 overflow-y-auto" dir="rtl">
        {groups.map((group, gi) => (
          <div key={`${group.surahNumber}-${gi}`}>
            {group.showHeader && (
              <div className="text-center my-2">
                <div className="border-y-2 border-amber-400/40 dark:border-amber-600/30 py-1.5 bg-amber-50/50 dark:bg-amber-900/20">
                  <div className="text-base font-bold text-amber-900 dark:text-amber-200 font-quran">
                    سورة {group.surahNameAr}
                  </div>
                  {group.surahNumber !== 1 && group.surahNumber !== 9 && (
                    <div className="text-sm text-amber-800/60 dark:text-amber-300/60 mt-0.5 font-quran">
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                    </div>
                  )}
                </div>
              </div>
            )}

            <p className="text-justify font-quran leading-[2.6] sm:leading-[3]" style={{ textAlignLast: 'center' }}>
              {group.verses.map(verse => {
                const isRevisionPos = positions.revisionPage === page.pageNumber && positions.revisionVerse === verse.verseNumber
                const isReadingPos = positions.readingPage === page.pageNumber && positions.readingVerse === verse.verseNumber
                const isOtherSurah = verse.surahNumber !== currentSurah

                let verseClass = ''
                if (isRevisionPos) verseClass = 'bg-blue-200/60 dark:bg-blue-800/40 rounded px-1'
                else if (isReadingPos) verseClass = 'bg-purple-200/60 dark:bg-purple-800/40 rounded px-1'
                else if (verse.isMemorized) verseClass = 'bg-emerald-100/40 dark:bg-emerald-900/20'

                const useTajweed = tajweedEnabled && verse.textTajweed

                return (
                  <span key={`${verse.surahNumber}:${verse.verseNumber}`} className={`${verseClass} ${isOtherSurah ? 'opacity-35' : ''}`}>
                    {useTajweed ? (
                      <TajweedVerse html={verse.textTajweed!} />
                    ) : (
                      <span className="text-xl sm:text-[1.55rem]">
                        {verse.textAr}
                      </span>
                    )}
                    {' '}
                    <span className="inline-flex items-center justify-center w-6 h-6 text-[10px] rounded-full border border-amber-500/30 text-amber-700 dark:text-amber-400 align-middle">
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

      {/* Page footer */}
      <div className="text-center py-1 border-t border-amber-300/30 dark:border-amber-800/20 text-sm text-amber-700/50 dark:text-amber-400/40 shrink-0">
        {toArabicNumber(page.pageNumber)}
      </div>
    </div>
  )
}

// Tajweed verse component - renders pre-sanitized HTML from our database
// Content is seeded from quran.com API (trusted source), not user-generated
function TajweedVerse({ html }: { html: string }) {
  const cleaned = renderTajweedText(html)
  return <span className="text-xl sm:text-[1.55rem]" dangerouslySetInnerHTML={{ __html: cleaned }} />
}

export default function SurahPage() {
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const surahNumber = parseInt(params.surahNumber as string)

  const [data, setData] = useState<SurahData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tajweedEnabled, setTajweedEnabled] = useState(false)
  const [scrollMode, setScrollMode] = useState(false)
  const [currentSpread, setCurrentSpread] = useState(0)

  useEffect(() => {
    if (isNaN(surahNumber)) return
    setLoading(true)
    setCurrentSpread(0)
    fetch(`/api/quran/surahs/${surahNumber}`)
      .then(res => res.json())
      .then(d => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [surahNumber])

  // Build spreads
  const spreads: Array<{ right: MushafPage | null; left: MushafPage | null }> = []
  if (data?.pages) {
    let i = 0
    while (i < data.pages.length) {
      const page = data.pages[i]
      if (page.side === 'right') {
        const nextPage = data.pages[i + 1]
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
  }

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (scrollMode) return
    if (e.key === 'ArrowLeft') {
      setCurrentSpread(prev => Math.min(prev + 1, spreads.length - 1))
    } else if (e.key === 'ArrowRight') {
      setCurrentSpread(prev => Math.max(prev - 1, 0))
    }
  }, [scrollMode, spreads.length])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

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

  const { surah, positions } = data
  const goNext = () => router.push(`/${locale}/quran/${surahNumber + 1}`)
  const goPrev = () => router.push(`/${locale}/quran/${surahNumber - 1}`)

  const currentPages = scrollMode ? spreads : [spreads[currentSpread]].filter(Boolean)

  return (
    <div className="space-y-3 max-w-6xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2" dir="rtl">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/${locale}/quran`)}>
          <ArrowRight className="h-4 w-4 ml-1" />
          السور
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-bold font-quran">{surah.nameAr}</span>
          <span className="text-xs text-muted-foreground">({surah.nameFr})</span>
          {surah.mastery && (
            <Badge variant="secondary" className="text-xs">{surah.mastery}</Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={surahNumber >= 114} onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-1">{toArabicNumber(surahNumber)}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={surahNumber <= 1} onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Options bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="tajweed" checked={tajweedEnabled} onCheckedChange={setTajweedEnabled} />
            <Label htmlFor="tajweed" className="flex items-center gap-1 text-xs cursor-pointer">
              <Palette className="h-3.5 w-3.5" />
              Tajweed
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="scroll" checked={scrollMode} onCheckedChange={setScrollMode} />
            <Label htmlFor="scroll" className="flex items-center gap-1 text-xs cursor-pointer">
              <List className="h-3.5 w-3.5" />
              Défilement
            </Label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {positions.revisionVerse && (
            <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-full">
              <BookOpen className="h-3 w-3" />
              Rév p.{positions.revisionPage}
            </div>
          )}
          {positions.readingVerse && (
            <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 dark:bg-purple-950/30 px-2 py-0.5 rounded-full">
              <Eye className="h-3 w-3" />
              Lect p.{positions.readingPage}
            </div>
          )}
        </div>
      </div>

      {/* Mushaf content */}
      <div className={scrollMode ? 'space-y-4' : ''}>
        {currentPages.map((spread, si) => {
          if (!spread) return null
          return (
            <div key={si} className="grid grid-cols-1 lg:grid-cols-2" dir="rtl">
              <div>
                {spread.right ? (
                  <MushafPageView page={spread.right} positions={positions} currentSurah={surahNumber} tajweedEnabled={tajweedEnabled} />
                ) : <div className="h-[75vh] min-h-[500px]" />}
              </div>
              <div>
                {spread.left ? (
                  <MushafPageView page={spread.left} positions={positions} currentSurah={surahNumber} tajweedEnabled={tajweedEnabled} />
                ) : <div className="h-[75vh] min-h-[500px]" />}
              </div>
            </div>
          )
        })}
      </div>

      {/* Spread navigation (paginated mode) */}
      {!scrollMode && spreads.length > 1 && (
        <div className="flex items-center justify-center gap-4 py-2" dir="rtl">
          <Button variant="outline" size="sm" disabled={currentSpread >= spreads.length - 1} onClick={() => setCurrentSpread(prev => prev + 1)}>
            <ChevronRight className="h-4 w-4 ml-1" />
            التالي
          </Button>
          <span className="text-sm text-muted-foreground">
            {toArabicNumber(currentSpread + 1)} / {toArabicNumber(spreads.length)}
          </span>
          <Button variant="outline" size="sm" disabled={currentSpread <= 0} onClick={() => setCurrentSpread(prev => prev - 1)}>
            السابق
            <ChevronLeft className="h-4 w-4 mr-1" />
          </Button>
        </div>
      )}

      {/* Surah navigation */}
      <div className="flex items-center justify-between py-4 border-t" dir="rtl">
        <Button variant="outline" size="sm" disabled={surahNumber >= 114} onClick={goNext}>
          السورة التالية
          <ChevronRight className="h-4 w-4 mr-1" />
        </Button>
        <span className="text-xs text-muted-foreground">
          ص {toArabicNumber(data.pages[0]?.pageNumber || 0)} – {toArabicNumber(data.pages[data.pages.length - 1]?.pageNumber || 0)}
        </span>
        <Button variant="outline" size="sm" disabled={surahNumber <= 1} onClick={goPrev}>
          <ChevronLeft className="h-4 w-4 ml-1" />
          السورة السابقة
        </Button>
      </div>
    </div>
  )
}
