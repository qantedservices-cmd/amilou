'use client'

import React, { useState, useEffect, use } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ArrowLeft, BookOpen, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SurahGrid {
  surahNumber: number
  nameAr: string
  nameFr: string
  totalVerses: number
  tafsirCovered: number
  tafsirComplete: boolean
  tafsirRange: string | null
  sensCovered: number
  sensComplete: boolean
  sensRange: string | null
}

export default function GroupTafsirGridPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params)
  const router = useRouter()
  const [grid, setGrid] = useState<SurahGrid[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedEmpty, setExpandedEmpty] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch(`/api/groups/${groupId}/tafsir-grid`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.grid) setGrid(data.grid) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [groupId])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
    </div>
  )

  // Calculate global stats
  const totalTafsirVerses = grid.reduce((s, g) => s + g.tafsirCovered, 0)
  const totalSensVerses = grid.reduce((s, g) => s + g.sensCovered, 0)
  const tafsirPct = Math.round((totalTafsirVerses / 6236) * 100)
  const sensPct = Math.round((totalSensVerses / 6236) * 100)

  // Group into ranges: surahs with data vs empty ranges
  const groups: Array<{ type: 'surah'; surah: SurahGrid } | { type: 'empty'; start: number; end: number; key: string }> = []
  let emptyStart: number | null = null
  let emptyEnd: number | null = null

  for (const s of grid) {
    const hasData = s.tafsirCovered > 0 || s.sensCovered > 0
    if (hasData) {
      if (emptyStart !== null && emptyEnd !== null) {
        groups.push({ type: 'empty', start: emptyStart, end: emptyEnd, key: `e-${emptyStart}-${emptyEnd}` })
        emptyStart = null; emptyEnd = null
      }
      groups.push({ type: 'surah', surah: s })
    } else {
      if (emptyStart === null) emptyStart = s.surahNumber
      emptyEnd = s.surahNumber
    }
  }
  if (emptyStart !== null && emptyEnd !== null) {
    groups.push({ type: 'empty', start: emptyStart, end: emptyEnd, key: `e-${emptyStart}-${emptyEnd}` })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />Retour
        </Button>
        <h1 className="text-2xl font-bold">Grille Tafsir & Traduction</h1>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-rose-50 dark:bg-rose-950/30 border-rose-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><BookOpen className="h-4 w-4 text-rose-600" />Tafsir</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Progress value={tafsirPct} className="h-2 flex-1" />
              <span className="text-sm font-bold text-rose-600">{tafsirPct}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{totalTafsirVerses}/6236 versets · {grid.filter(s => s.tafsirComplete).length} sourates compl\u00e8tes</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><BookOpen className="h-4 w-4 text-purple-600" />Traduction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Progress value={sensPct} className="h-2 flex-1" />
              <span className="text-sm font-bold text-purple-600">{sensPct}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{totalSensVerses}/6236 versets · {grid.filter(s => s.sensComplete).length} sourates compl\u00e8tes</p>
          </CardContent>
        </Card>
      </div>

      {/* Grid */}
      <Card>
        <CardHeader>
          <CardTitle>D\u00e9tail par sourate</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 px-2 w-10">#</th>
                <th className="text-left py-2 px-2">Sourate</th>
                <th className="text-center py-2 px-2">Tafsir</th>
                <th className="text-center py-2 px-2">Traduction</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(group => {
                if (group.type === 'empty') {
                  const isExp = expandedEmpty.has(group.key)
                  const count = group.end - group.start + 1
                  return (
                    <React.Fragment key={group.key}>
                      <tr className="cursor-pointer hover:bg-muted/50" onClick={() => {
                        setExpandedEmpty(prev => {
                          const next = new Set(prev)
                          if (next.has(group.key)) next.delete(group.key)
                          else next.add(group.key)
                          return next
                        })
                      }}>
                        <td colSpan={4} className="text-center py-2 text-xs text-muted-foreground">
                          {isExp ? <ChevronUp className="inline h-3 w-3 mr-1" /> : <ChevronDown className="inline h-3 w-3 mr-1" />}
                          Sourates {group.start}\u2013{group.end} ({count}, aucune donn\u00e9e)
                        </td>
                      </tr>
                      {isExp && grid.filter(s => s.surahNumber >= group.start && s.surahNumber <= group.end).map(s => (
                        <tr key={s.surahNumber} className="border-b text-muted-foreground/60">
                          <td className="py-1 px-2 text-xs">{s.surahNumber}</td>
                          <td className="py-1 px-2 text-xs">{s.nameFr} <span className="font-arabic">{s.nameAr}</span></td>
                          <td className="text-center py-1 px-2 text-xs">\u2014</td>
                          <td className="text-center py-1 px-2 text-xs">\u2014</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                }

                const s = group.surah
                return (
                  <tr key={s.surahNumber} className={`border-b ${s.tafsirComplete && s.sensComplete ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}`}>
                    <td className="py-2 px-2 font-medium">{s.surahNumber}</td>
                    <td className="py-2 px-2">
                      <span className="font-medium">{s.nameFr}</span>
                      <span className="text-muted-foreground text-xs ml-2 font-arabic">{s.nameAr}</span>
                    </td>
                    <td className="text-center py-2 px-2">
                      {s.tafsirComplete ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600 mx-auto" />
                      ) : s.tafsirCovered > 0 ? (
                        <Badge variant="outline" className="text-xs text-rose-600 border-rose-200">{s.tafsirRange}</Badge>
                      ) : (
                        <span className="text-muted-foreground/40">\u2014</span>
                      )}
                    </td>
                    <td className="text-center py-2 px-2">
                      {s.sensComplete ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600 mx-auto" />
                      ) : s.sensCovered > 0 ? (
                        <Badge variant="outline" className="text-xs text-purple-600 border-purple-200">{s.sensRange}</Badge>
                      ) : (
                        <span className="text-muted-foreground/40">\u2014</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
