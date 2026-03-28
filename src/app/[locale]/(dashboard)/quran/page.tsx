'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

interface SurahItem {
  number: number
  nameAr: string
  nameFr: string
  nameEn: string
  totalVerses: number
  revelationType: string
  mastery: string | null
}

const masteryColors: Record<string, { bg: string; text: string; label: string }> = {
  'V': { bg: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700', text: 'text-emerald-800 dark:text-emerald-200', label: 'Validé' },
  'X': { bg: 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700', text: 'text-blue-800 dark:text-blue-200', label: 'Connu' },
  '90%': { bg: 'bg-lime-100 dark:bg-lime-900/40 border-lime-300 dark:border-lime-700', text: 'text-lime-800 dark:text-lime-200', label: '90%' },
  '50%': { bg: 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700', text: 'text-yellow-800 dark:text-yellow-200', label: '50%' },
  '51%': { bg: 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700', text: 'text-yellow-800 dark:text-yellow-200', label: '51%' },
  'AM': { bg: 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700', text: 'text-orange-800 dark:text-orange-200', label: 'À mémoriser' },
}

const defaultStyle = { bg: 'bg-muted/30 border-border', text: 'text-muted-foreground', label: '' }

function getMasteryStyle(mastery: string | null) {
  if (!mastery) return defaultStyle
  // Handle V with week number (e.g., V12)
  if (mastery.startsWith('V')) return masteryColors['V']
  // Handle S with week number (e.g., S7)
  if (mastery.startsWith('S')) return { bg: 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700', text: 'text-purple-800 dark:text-purple-200', label: 'Récité' }
  return masteryColors[mastery] || defaultStyle
}

export default function QuranPage() {
  const [surahs, setSurahs] = useState<SurahItem[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const locale = useLocale()

  useEffect(() => {
    fetch('/api/quran/surahs')
      .then(res => res.json())
      .then(data => setSurahs(data.surahs || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const legendItems = [
    { ...masteryColors['V'], label: 'Validé' },
    { ...masteryColors['X'], label: 'Connu (à valider)' },
    { ...masteryColors['90%'], label: '90%' },
    { ...masteryColors['50%'], label: '50%' },
    { ...masteryColors['AM'], label: 'À mémoriser' },
    { bg: 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700', text: 'text-purple-800 dark:text-purple-200', label: 'Récité' },
    { ...defaultStyle, label: 'Non commencé' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">القرآن الكريم</h1>
        <p className="text-muted-foreground">114 sourates — cliquer pour voir les versets</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {legendItems.map(item => (
          <div key={item.label} className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs ${item.bg} ${item.text}`}>
            <div className={`w-2.5 h-2.5 rounded-sm ${item.bg}`} />
            {item.label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {surahs.map(surah => {
          const style = getMasteryStyle(surah.mastery)
          return (
            <Card
              key={surah.number}
              className={`cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md border ${style.bg}`}
              onClick={() => router.push(`/${locale}/quran/${surah.number}`)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-1">
                  <span className={`text-xs font-mono ${style.text}`}>{surah.number}</span>
                  {surah.mastery && (
                    <Badge variant="outline" className={`text-[10px] px-1 py-0 ${style.text} border-current`}>
                      {surah.mastery}
                    </Badge>
                  )}
                </div>
                <div className={`text-lg font-semibold text-right leading-tight ${style.text}`} dir="rtl">
                  {surah.nameAr}
                </div>
                <div className={`text-xs mt-1 ${style.text} opacity-70`}>
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
