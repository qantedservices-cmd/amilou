'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2, BookOpen, Eye } from 'lucide-react'

interface Verse {
  number: number
  textAr: string
  page: number
  juz: number | null
  hizb: number | null
  isMemorized: boolean
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
  verses: Verse[]
  positions: {
    readingVerse: number | null
    revisionVerse: number | null
  }
  memorizedZone: {
    startHizb: number
    endHizb: number
    totalHizbs: number
  } | null
}

// Convert verse number to Arabic-Indic numerals
function toArabicNumber(n: number): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
  return n.toString().split('').map(d => arabicDigits[parseInt(d)]).join('')
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

  const { surah, verses, positions } = data

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Navigation bar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/${locale}/quran`)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Sourates
        </Button>
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
          <span className="text-sm text-muted-foreground px-2">{surahNumber}/114</span>
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

      {/* Surah header */}
      <div className="text-center space-y-2 py-4 border-b">
        <h1 className="text-4xl font-bold leading-tight" dir="rtl">
          سورة {surah.nameAr}
        </h1>
        <p className="text-muted-foreground">
          {surah.nameFr} — {surah.totalVerses} versets — {surah.revelationType === 'Meccan' ? 'Mecquoise' : 'Médinoise'}
        </p>
        {surah.mastery && (
          <Badge variant="outline" className="text-sm">
            Statut : {surah.mastery}
          </Badge>
        )}
      </div>

      {/* Position indicators */}
      {(positions.revisionVerse || positions.readingVerse) && (
        <div className="flex flex-wrap gap-3 justify-center">
          {positions.revisionVerse && (
            <div className="flex items-center gap-1.5 text-sm text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-3 py-1 rounded-full">
              <BookOpen className="h-3.5 w-3.5" />
              Révision : verset {positions.revisionVerse}
            </div>
          )}
          {positions.readingVerse && (
            <div className="flex items-center gap-1.5 text-sm text-purple-600 bg-purple-50 dark:bg-purple-950/30 px-3 py-1 rounded-full">
              <Eye className="h-3.5 w-3.5" />
              Lecture : verset {positions.readingVerse}
            </div>
          )}
        </div>
      )}

      {/* Bismillah (except for Surah 1 and 9) */}
      {surahNumber !== 1 && surahNumber !== 9 && (
        <div className="text-center text-2xl py-4 text-muted-foreground" dir="rtl">
          بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
        </div>
      )}

      {/* Verses */}
      <div className="leading-[2.8] text-right px-2 sm:px-6" dir="rtl">
        {verses.map(verse => {
          const isRevisionPos = positions.revisionVerse === verse.number
          const isReadingPos = positions.readingVerse === verse.number

          let bgClass = ''
          if (isRevisionPos) bgClass = 'bg-blue-100 dark:bg-blue-900/30 rounded-lg px-2 -mx-2'
          else if (isReadingPos) bgClass = 'bg-purple-100 dark:bg-purple-900/30 rounded-lg px-2 -mx-2'
          else if (verse.isMemorized) bgClass = 'bg-emerald-50 dark:bg-emerald-950/20'

          return (
            <span key={verse.number} className={`inline ${bgClass}`}>
              <span className="text-2xl sm:text-3xl font-amiri">
                {verse.textAr}
              </span>
              <span className="inline-flex items-center justify-center w-8 h-8 mx-1 text-xs rounded-full bg-muted text-muted-foreground align-middle font-mono">
                {toArabicNumber(verse.number)}
              </span>
            </span>
          )
        })}
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
