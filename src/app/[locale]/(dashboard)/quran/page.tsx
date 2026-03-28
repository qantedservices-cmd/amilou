'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Loader2, Search, X } from 'lucide-react'

interface SurahItem {
  number: number
  nameAr: string
  nameFr: string
  nameEn: string
  totalVerses: number
  revelationType: string
  mastery: string | null
}

interface SearchResult {
  surahNumber: number
  surahNameAr: string
  surahNameFr: string
  verseNumber: number | null
  textAr: string | null
  page: number | null
  isSurah?: boolean
  totalVerses?: number
}

const masteryColors: Record<string, { bg: string; text: string }> = {
  'V': { bg: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700', text: 'text-emerald-800 dark:text-emerald-200' },
  'X': { bg: 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700', text: 'text-blue-800 dark:text-blue-200' },
  '90%': { bg: 'bg-lime-100 dark:bg-lime-900/40 border-lime-300 dark:border-lime-700', text: 'text-lime-800 dark:text-lime-200' },
  '50%': { bg: 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700', text: 'text-yellow-800 dark:text-yellow-200' },
  '51%': { bg: 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700', text: 'text-yellow-800 dark:text-yellow-200' },
  'AM': { bg: 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700', text: 'text-orange-800 dark:text-orange-200' },
}

const defaultStyle = { bg: 'bg-muted/30 border-border', text: 'text-muted-foreground' }

function getMasteryStyle(mastery: string | null) {
  if (!mastery) return defaultStyle
  if (mastery.startsWith('V')) return masteryColors['V']
  if (mastery.startsWith('S')) return { bg: 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700', text: 'text-purple-800 dark:text-purple-200' }
  return masteryColors[mastery] || defaultStyle
}

export default function QuranPage() {
  const [surahs, setSurahs] = useState<SurahItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const locale = useLocale()

  useEffect(() => {
    fetch('/api/quran/surahs')
      .then(res => res.json())
      .then(data => setSurahs(data.surahs || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/quran/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        setSearchResults(data.results || [])
      } catch {
        setSearchResults([])
      }
      setSearching(false)
    }, 300)

    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [searchQuery])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const legendItems = [
    { ...masteryColors['V'], label: 'Validé' },
    { ...masteryColors['X'], label: 'Connu' },
    { ...masteryColors['90%'], label: '90%' },
    { ...masteryColors['50%'], label: '50%' },
    { ...masteryColors['AM'], label: 'À mémoriser' },
    { bg: 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700', text: 'text-purple-800 dark:text-purple-200', label: 'Récité' },
    { ...defaultStyle, label: 'Non commencé' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-quran">القرآن الكريم</h1>
          <p className="text-sm text-muted-foreground">114 sourates — recherche par sourate, page, mots clés</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Chercher : البقرة, 2:255, p.604, Fatiha..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9 pr-9"
          dir="auto"
        />
        {searchQuery && (
          <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearchQuery('')}>
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}

        {/* Search results dropdown */}
        {searchQuery && (searchResults.length > 0 || searching) && (
          <div className="absolute z-50 top-full mt-1 w-full max-h-80 overflow-y-auto bg-popover border rounded-md shadow-lg">
            {searching ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Recherche...
              </div>
            ) : (
              searchResults.map((r, i) => (
                <button
                  key={i}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-0 transition-colors"
                  onClick={() => {
                    router.push(`/${locale}/quran/${r.surahNumber}`)
                    setSearchQuery('')
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {r.surahNameAr} ({r.surahNameFr})
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {r.isSurah ? `${r.totalVerses} v.` : `${r.surahNumber}:${r.verseNumber}`}
                      {r.page ? ` — p.${r.page}` : ''}
                    </span>
                  </div>
                  {r.textAr && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1 font-quran" dir="rtl">
                      {r.textAr}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-1.5">
        {legendItems.map(item => (
          <div key={item.label} className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] ${item.bg} ${item.text}`}>
            {item.label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
        {surahs.map(surah => {
          const style = getMasteryStyle(surah.mastery)
          return (
            <Card
              key={surah.number}
              className={`cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md border ${style.bg}`}
              onClick={() => router.push(`/${locale}/quran/${surah.number}`)}
            >
              <CardContent className="p-2.5">
                <div className="flex items-start justify-between mb-0.5">
                  <span className={`text-xs font-mono ${style.text}`}>{surah.number}</span>
                  {surah.mastery && (
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${style.text} border-current`}>
                      {surah.mastery}
                    </Badge>
                  )}
                </div>
                <div className={`text-lg font-semibold text-right leading-tight font-quran ${style.text}`} dir="rtl">
                  {surah.nameAr}
                </div>
                <div className={`text-xs mt-0.5 ${style.text} opacity-70`}>
                  {surah.nameFr}
                </div>
                <div className={`text-[10px] mt-0.5 ${style.text} opacity-50`}>
                  {surah.totalVerses} v. — {surah.revelationType === 'Meccan' ? 'Mecquoise' : 'Médinoise'}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
