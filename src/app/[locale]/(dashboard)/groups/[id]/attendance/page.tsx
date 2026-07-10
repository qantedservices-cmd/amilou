'use client'

import { useState, useEffect, use, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Users, ArrowUpDown, Calendar, ChevronDown, CheckCircle2, Circle, X } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'

interface PerSession {
  sessionId: string
  present: boolean
  excused: boolean
  hasRecord: boolean
}

interface MemberSummary {
  userId: string
  name: string
  presentCount: number
  absentCount: number
  excusedCount: number
  rate: number
  applicableCount: number
  perSession: PerSession[]
}

interface SessionInfo {
  id: string
  number: number
  date: string
}

interface AttendanceSummaryData {
  groupName: string
  totalSessions: number
  firstSessionDate: string | null
  isReferent: boolean
  sessions: SessionInfo[]
  members: MemberSummary[]
}

type SortKey = 'name' | 'present' | 'absent' | 'excused' | 'rate'
type SortDir = 'asc' | 'desc'

export default function GroupAttendancePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id: groupId } = use(params)
  const router = useRouter()
  const locale = useLocale()

  const [data, setData] = useState<AttendanceSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('rate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [matrixOpen, setMatrixOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/groups/${groupId}/attendance-summary`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j.error || 'Erreur')
        }
        return r.json()
      })
      .then((d: AttendanceSummaryData) => {
        if (!cancelled) setData(d)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [groupId])

  const sortedMembers = useMemo(() => {
    if (!data) return []
    const arr = [...data.members]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name, 'fr'); break
        case 'present': cmp = a.presentCount - b.presentCount; break
        case 'absent': cmp = a.absentCount - b.absentCount; break
        case 'excused': cmp = a.excusedCount - b.excusedCount; break
        case 'rate': cmp = a.rate - b.rate; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [data, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  function rateColor(rate: number): string {
    if (rate >= 80) return 'bg-emerald-500'
    if (rate >= 60) return 'bg-amber-500'
    return 'bg-red-500'
  }

  function rateTextColor(rate: number): string {
    if (rate >= 80) return 'text-emerald-700 dark:text-emerald-400'
    if (rate >= 60) return 'text-amber-700 dark:text-amber-400'
    return 'text-red-700 dark:text-red-400'
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-12 rounded bg-muted/40 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
      </div>
    )
  }

  if (!data) return null

  const firstDateLabel = data.firstSessionDate
    ? new Date(data.firstSessionDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/groups/${groupId}/mastery`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{data.groupName} — Bilan des présences</h1>
          <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
            <Users className="h-4 w-4" />
            <span>Total séances : {data.totalSessions}</span>
            <span>·</span>
            <Calendar className="h-4 w-4" />
            <span>Période : depuis le {firstDateLabel}</span>
          </div>
        </div>
      </div>

      {/* Summary table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Résumé par élève</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sortedMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {data.totalSessions === 0 ? 'Aucune séance enregistrée dans ce groupe.' : 'Aucun élève dans ce groupe.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th
                      className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleSort('name')}
                    >
                      <span className="inline-flex items-center gap-1">Élève <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th
                      className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 w-32"
                      onClick={() => toggleSort('present')}
                    >
                      <span className="inline-flex items-center gap-1">Présent <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th
                      className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 w-24"
                      onClick={() => toggleSort('absent')}
                    >
                      <span className="inline-flex items-center gap-1">Absent <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th
                      className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 w-24"
                      onClick={() => toggleSort('excused')}
                    >
                      <span className="inline-flex items-center gap-1">Excusé <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th
                      className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 w-48"
                      onClick={() => toggleSort('rate')}
                    >
                      <span className="inline-flex items-center gap-1">Taux <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((m, i) => (
                    <tr key={m.userId} className={`border-b last:border-0 hover:bg-muted/20 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                      <td className="px-4 py-2.5 text-sm font-medium">{m.name}</td>
                      <td className="px-4 py-2.5 text-center text-sm">{m.presentCount} / {m.applicableCount}</td>
                      <td className="px-4 py-2.5 text-center text-sm">{m.absentCount}</td>
                      <td className="px-4 py-2.5 text-center text-sm">{m.excusedCount}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${rateColor(m.rate)} transition-all`}
                              style={{ width: `${m.rate}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold ${rateTextColor(m.rate)} w-10 text-right`}>
                            {m.rate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed matrix */}
      {data.totalSessions > 0 && sortedMembers.length > 0 && (
        <Collapsible open={matrixOpen} onOpenChange={setMatrixOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Détail par séance</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${matrixOpen ? 'rotate-180' : ''}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[70vh]">
                  <table className="border-collapse">
                    <thead className="sticky top-0 z-20 bg-background">
                      <tr>
                        <th className="sticky left-0 z-30 bg-background border-b border-r px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase w-48">
                          Élève
                        </th>
                        {data.sessions.map(s => {
                          const d = new Date(s.date)
                          const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                          return (
                            <th
                              key={s.id}
                              className="border-b px-2 py-2 text-center text-xs font-semibold text-muted-foreground min-w-[58px]"
                              title={d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            >
                              <div>S{s.number}</div>
                              <div className="font-normal text-[10px]">{label}</div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMembers.map((m, mi) => (
                        <tr key={m.userId} className={mi % 2 === 0 ? '' : 'bg-muted/10'}>
                          <td className="sticky left-0 z-10 bg-background border-r px-3 py-2 text-sm font-medium whitespace-nowrap">
                            {m.name}
                          </td>
                          {m.perSession.map((cell, ci) => {
                            const session = data.sessions[ci]
                            const d = new Date(session.date)
                            const dateLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                            let icon = <span className="text-muted-foreground/40">–</span>
                            let stateLabel = 'Aucun enregistrement'
                            let bg = ''
                            if (cell.hasRecord) {
                              if (cell.present) {
                                icon = <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                                stateLabel = 'Présent'
                                bg = 'bg-emerald-50 dark:bg-emerald-950/30'
                              } else if (cell.excused) {
                                icon = <Circle className="h-4 w-4 text-orange-500 mx-auto" />
                                stateLabel = 'Excusé'
                                bg = 'bg-orange-50 dark:bg-orange-950/30'
                              } else {
                                icon = <X className="h-4 w-4 text-red-500 mx-auto" />
                                stateLabel = 'Absent'
                                bg = 'bg-red-50 dark:bg-red-950/30'
                              }
                            }
                            return (
                              <td
                                key={cell.sessionId}
                                className={`border-l px-2 py-2 text-center ${bg}`}
                                title={`${stateLabel} — ${dateLabel}`}
                              >
                                {icon}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  )
}
