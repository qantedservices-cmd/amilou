'use client'

import { useState, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Calendar, ChevronLeft, ChevronRight, Users, Check, X, BookOpen, Plus, Pencil, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SessionEntry {
  surahNumber: number
  surahName: string
  surahNameAr?: string
  verseStart: number
  verseEnd: number
  status?: string | null
  comment?: string | null
  program?: string
}

interface SessionParticipant {
  userId: string
  userName: string
  entries: SessionEntry[]
}

interface SessionData {
  id: string
  type: 'group' | 'progress'
  color: string
  date: string
  weekNumber: number | null
  groupId: string | null
  groupName: string
  notes: string | null
  participants: SessionParticipant[]
  presentCount: number
  totalMembers: number
  absentMembers: string[]
  recitationCount: number
  sessionNumber: number | null
  sessionNumberYear: number | null
  totalSessionsGroup: number | null
  totalSessionsGroupYear: number | null
}

interface SessionDateInfo {
  date: string
  weekNumber: number
  sessions: { type: string; color: string; groupName: string }[]
}

interface CalendarData {
  year: number
  month: number | null
  sessions: SessionData[]
  sessionDates: SessionDateInfo[]
  totalSessions: number
  totalSessionsAllTime: number
  totalSessionsThisYear: number
  members: { id: string; name: string }[]
}

// Couleurs par défaut pour les groupes
const DEFAULT_GROUP_COLORS: Record<string, string> = {
  'Cours Montmagny': '#3B82F6',
  'Famille': '#8B5CF6',
  'Groupe Amilou': '#10B981',
}

// Couleurs de fallback pour les groupes non définis
const FALLBACK_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6366F1']

function getGroupColor(groupName: string, index: number): string {
  return DEFAULT_GROUP_COLORS[groupName] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export default function SessionsPage() {
  const locale = useLocale()
  const router = useRouter()
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [selectedDateSessions, setSelectedDateSessions] = useState<SessionData[]>([])
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [expandedParticipants, setExpandedParticipants] = useState<Set<string>>(new Set())

  // Filtre par groupe (null = tous)
  const [filterGroup, setFilterGroup] = useState<string | null>(null)

  useEffect(() => {
    fetchCalendarData()
  }, [currentYear, currentMonth])

  async function fetchCalendarData() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        year: currentYear.toString(),
        month: currentMonth.toString()
      })

      const res = await fetch(`/api/sessions/calendar?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCalendarData(data)
      }
    } catch (error) {
      console.error('Error fetching calendar:', error)
    } finally {
      setLoading(false)
    }
  }

  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate()
  }

  function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month - 1, 1).getDay()
  }

  function navigateMonth(direction: 'prev' | 'next') {
    if (direction === 'prev') {
      if (currentMonth === 1) {
        setCurrentMonth(12)
        setCurrentYear(currentYear - 1)
      } else {
        setCurrentMonth(currentMonth - 1)
      }
    } else {
      if (currentMonth === 12) {
        setCurrentMonth(1)
        setCurrentYear(currentYear + 1)
      } else {
        setCurrentMonth(currentMonth + 1)
      }
    }
  }

  function getSessionsForDay(day: number): { colors: string[]; count: number; weekNumber: number | null } {
    if (!calendarData) return { colors: [], count: 0, weekNumber: null }
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dateInfo = calendarData.sessionDates.find(s => s.date === dateStr)
    if (!dateInfo) return { colors: [], count: 0, weekNumber: null }

    // Filtrer par groupe si un filtre est actif
    let sessions = dateInfo.sessions
    if (filterGroup) {
      sessions = sessions.filter(s => s.groupName === filterGroup)
    }

    return {
      colors: sessions.map(s => s.color),
      count: sessions.length,
      weekNumber: dateInfo.weekNumber
    }
  }

  // Get week number for any day (Sun-Sat week system)
  function getWeekNumberForDay(day: number): number {
    const date = new Date(currentYear, currentMonth - 1, day)
    date.setHours(0, 0, 0, 0)

    // Get the Sunday that starts this week
    const dayOfWeek = date.getDay() // 0 = Sunday
    const sunday = new Date(date)
    sunday.setDate(date.getDate() - dayOfWeek)

    // Get January 1st of the year
    const jan1 = new Date(sunday.getFullYear(), 0, 1)
    const jan1DayOfWeek = jan1.getDay()
    const jan1Sunday = new Date(jan1)
    jan1Sunday.setDate(jan1.getDate() - jan1DayOfWeek)

    // Calculate weeks between
    const diffTime = sunday.getTime() - jan1Sunday.getTime()
    const diffWeeks = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000))

    return diffWeeks + 1
  }

  function openDayDetail(day: number) {
    if (!calendarData) return
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    let sessions = calendarData.sessions.filter(s => s.date === dateStr)

    // Filtrer par groupe si actif
    if (filterGroup) {
      sessions = sessions.filter(s => s.groupName === filterGroup)
    }

    if (sessions.length > 0) {
      setSelectedDateSessions(sessions)
      setExpandedParticipants(new Set())
      setDetailDialogOpen(true)
    }
  }

  function toggleParticipant(odId: string) {
    setExpandedParticipants(prev => {
      const next = new Set(prev)
      if (next.has(odId)) {
        next.delete(odId)
      } else {
        next.add(odId)
      }
      return next
    })
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  function toggleFilter(groupName: string) {
    setFilterGroup(prev => prev === groupName ? null : groupName)
  }

  // Filtrer les séances pour la liste
  const filteredSessions = calendarData?.sessions.filter(s =>
    !filterGroup || s.groupName === filterGroup
  ) || []

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() + 1 === currentMonth

  // Build calendar grid
  const calendarDays: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Séances</h1>
          <p className="text-muted-foreground">Calendrier et suivi des séances</p>
        </div>
        <div className="flex items-center gap-4">
          {calendarData && (
            <div className="text-right text-sm">
              <p className="font-medium">{calendarData.totalSessionsThisYear} séances en {currentYear}</p>
              <p className="text-muted-foreground">{calendarData.totalSessionsAllTime} au total</p>
            </div>
          )}
          <Button onClick={() => router.push(`/${locale}/sessions/new`)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle séance
          </Button>
        </div>
      </div>

      {/* Calendar Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Calendrier
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium min-w-[150px] text-center">
                {MONTHS[currentMonth - 1]} {currentYear}
              </span>
              <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground">Chargement...</p>
            </div>
          ) : (
            <>
              {/* Calendar Grid */}
              <div className="grid grid-cols-8 gap-1 mb-4">
                {/* Week number header */}
                <div className="text-center text-xs font-medium text-muted-foreground py-2">
                  Sem.
                </div>
                {DAYS.map(day => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}

                {/* Calendar rows with week numbers */}
                {(() => {
                  const rows: React.ReactNode[] = []
                  let currentRow: (number | null)[] = []
                  let weekNum: number | null = null

                  calendarDays.forEach((day, index) => {
                    currentRow.push(day)

                    // Get week number from first non-null day in row
                    if (day !== null && weekNum === null) {
                      weekNum = getWeekNumberForDay(day)
                    }

                    // End of row (7 days)
                    if (currentRow.length === 7) {
                      const rowIndex = Math.floor(index / 7)

                      // Add week number cell
                      rows.push(
                        <div
                          key={`week-${rowIndex}`}
                          className="flex items-center justify-center text-xs font-medium text-muted-foreground bg-muted/30 rounded"
                        >
                          {weekNum !== null ? `S${weekNum}` : ''}
                        </div>
                      )

                      // Add day cells
                      currentRow.forEach((d, i) => {
                        if (d === null) {
                          rows.push(<div key={`empty-${rowIndex}-${i}`} className="p-2" />)
                        } else {
                          const { colors, count } = getSessionsForDay(d)
                          const hasSession = count > 0
                          const isToday = isCurrentMonth && d === today.getDate()

                          rows.push(
                            <div
                              key={`day-${d}`}
                              onClick={() => hasSession && openDayDetail(d)}
                              className={`
                                relative p-2 min-h-[60px] rounded-lg border text-center transition-all
                                ${hasSession ? 'cursor-pointer hover:opacity-80 bg-muted/30' : 'bg-background border-transparent hover:bg-muted/50'}
                                ${isToday ? 'ring-2 ring-offset-1 ring-blue-500' : ''}
                              `}
                            >
                              <span className={`text-sm ${hasSession ? 'font-bold' : ''}`}>
                                {d}
                              </span>
                              {hasSession && (
                                <div className="mt-1 flex justify-center gap-1 flex-wrap">
                                  {colors.map((color, ci) => (
                                    <div
                                      key={ci}
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: color }}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        }
                      })

                      currentRow = []
                      weekNum = null
                    }
                  })

                  // Handle last incomplete row
                  if (currentRow.length > 0) {
                    const rowIndex = Math.ceil(calendarDays.length / 7)
                    rows.push(
                      <div
                        key={`week-${rowIndex}`}
                        className="flex items-center justify-center text-xs font-medium text-muted-foreground bg-muted/30 rounded"
                      >
                        {weekNum !== null ? `S${weekNum}` : ''}
                      </div>
                    )

                    currentRow.forEach((d, i) => {
                      if (d === null) {
                        rows.push(<div key={`empty-last-${i}`} className="p-2" />)
                      } else {
                        const { colors, count } = getSessionsForDay(d)
                        const hasSession = count > 0
                        const isToday = isCurrentMonth && d === today.getDate()

                        rows.push(
                          <div
                            key={`day-${d}`}
                            onClick={() => hasSession && openDayDetail(d)}
                            className={`
                              relative p-2 min-h-[60px] rounded-lg border text-center transition-all
                              ${hasSession ? 'cursor-pointer hover:opacity-80 bg-muted/30' : 'bg-background border-transparent hover:bg-muted/50'}
                              ${isToday ? 'ring-2 ring-offset-1 ring-blue-500' : ''}
                            `}
                          >
                            <span className={`text-sm ${hasSession ? 'font-bold' : ''}`}>
                              {d}
                            </span>
                            {hasSession && (
                              <div className="mt-1 flex justify-center gap-1 flex-wrap">
                                {colors.map((color, ci) => (
                                  <div
                                    key={ci}
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      }
                    })

                    // Fill remaining cells
                    for (let i = currentRow.length; i < 7; i++) {
                      rows.push(<div key={`fill-${i}`} className="p-2" />)
                    }
                  }

                  return rows
                })()}
              </div>

              {/* Legend - Clickable filters (dynamic based on user's groups) */}
              {(() => {
                // Extract unique groups from the actual data
                const userGroups = calendarData?.sessions
                  ? [...new Set(calendarData.sessions.map(s => s.groupName))]
                  : []

                if (userGroups.length === 0) return null

                return (
                  <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-muted-foreground">Filtrer :</span>
                    {userGroups.map((name, index) => {
                      const color = getGroupColor(name, index)
                      return (
                        <button
                          key={name}
                          onClick={() => toggleFilter(name)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all hover:bg-muted`}
                          style={{
                            backgroundColor: filterGroup === name ? `${color}20` : undefined,
                            boxShadow: filterGroup === name ? `0 0 0 2px white, 0 0 0 4px ${color}` : undefined
                          }}
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className={filterGroup === name ? 'font-medium' : ''}>
                            {name.replace('Cours ', '').replace('Groupe ', '')}
                          </span>
                        </button>
                      )
                    })}
                    {filterGroup && (
                      <button
                        onClick={() => setFilterGroup(null)}
                        className="text-muted-foreground hover:text-foreground ml-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )
              })()}
            </>
          )}
        </CardContent>
      </Card>

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Séances {filterGroup && `- ${filterGroup}`}
            <Badge variant="secondary" className="ml-2">
              {filteredSessions.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune séance pour cette période
            </p>
          ) : (
            <div className="space-y-3">
              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => {
                    setSelectedDateSessions([session])
                    setExpandedParticipants(new Set())
                    setDetailDialogOpen(true)
                  }}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div
                    className="w-1 h-12 rounded-full"
                    style={{ backgroundColor: session.color }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatDate(session.date)}</span>
                      {session.weekNumber && (
                        <Badge variant="outline">S{session.weekNumber}</Badge>
                      )}
                      {session.sessionNumber && session.totalSessionsGroup && (
                        <Badge variant="secondary">
                          Séance {session.sessionNumber}/{session.totalSessionsGroup}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-3">
                      <span
                        className="px-2 py-0.5 rounded text-white text-xs"
                        style={{ backgroundColor: session.color }}
                      >
                        {session.groupName.replace('Cours ', '').replace('Groupe ', '')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {session.presentCount}/{session.totalMembers}
                      </span>
                      {session.recitationCount > 0 && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {session.recitationCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedDateSessions.length > 0 && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {formatDate(selectedDateSessions[0].date)}
                </DialogTitle>
                <DialogDescription>
                  {selectedDateSessions.length} séance(s) ce jour
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {selectedDateSessions.map((session) => (
                  <div key={session.id} className="space-y-4">
                    {/* Session header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="px-3 py-1 rounded-full text-white text-sm font-medium"
                          style={{ backgroundColor: session.color }}
                        >
                          {session.groupName}
                        </span>
                        {session.weekNumber && (
                          <Badge variant="outline">Semaine {session.weekNumber}</Badge>
                        )}
                        {session.sessionNumber && session.totalSessionsGroup && (
                          <Badge variant="secondary">
                            Séance {session.sessionNumber}/{session.totalSessionsGroup}
                          </Badge>
                        )}
                      </div>
                      {session.type === 'group' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/${locale}/sessions/${session.id}`)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Modifier
                        </Button>
                      )}
                    </div>

                    {/* Présents - Cliquables */}
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-600" />
                        Présents ({session.participants.length})
                      </h4>
                      <div className="space-y-2">
                        {session.participants.map((participant) => {
                          const odId = `${session.id}-${participant.userId}`
                          const isExpanded = expandedParticipants.has(odId)

                          return (
                            <Collapsible
                              key={odId}
                              open={isExpanded}
                              onOpenChange={() => toggleParticipant(odId)}
                            >
                              <CollapsibleTrigger className="w-full">
                                <div
                                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                    isExpanded
                                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                                      : 'hover:bg-muted/50'
                                  }`}
                                >
                                  <span className="font-medium">{participant.userName}</span>
                                  <div className="flex items-center gap-2">
                                    {participant.entries.length > 0 && (
                                      <Badge variant="secondary">
                                        {participant.entries.length} récitation(s)
                                      </Badge>
                                    )}
                                    <ChevronDown
                                      className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                    />
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="pl-4 pt-2 space-y-2">
                                  {participant.entries.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-2">
                                      Aucune récitation enregistrée
                                    </p>
                                  ) : (
                                    participant.entries.map((entry, idx) => (
                                      <div
                                        key={idx}
                                        className="p-3 rounded-lg bg-muted/30 border"
                                      >
                                        <div className="flex items-start justify-between">
                                          <div>
                                            <p className="font-medium">
                                              {entry.surahName}
                                              {entry.surahNameAr && (
                                                <span className="text-muted-foreground mr-2"> ({entry.surahNameAr})</span>
                                              )}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                              Versets {entry.verseStart} - {entry.verseEnd}
                                            </p>
                                          </div>
                                          {entry.status && (
                                            <Badge variant="outline">{entry.status}</Badge>
                                          )}
                                        </div>
                                        {entry.comment && (
                                          <p className="text-sm mt-2 text-muted-foreground italic">
                                            "{entry.comment}"
                                          </p>
                                        )}
                                        {entry.program && (
                                          <p className="text-xs mt-1 text-muted-foreground">
                                            Programme: {entry.program}
                                          </p>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )
                        })}
                      </div>
                    </div>

                    {/* Absents */}
                    {session.absentMembers.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2 text-muted-foreground">
                          <X className="h-4 w-4" />
                          Absents ({session.absentMembers.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {session.absentMembers.map((name, idx) => (
                            <Badge key={idx} variant="outline" className="text-muted-foreground">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {session.notes && (
                      <div className="p-3 rounded-lg bg-muted/30 border">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Notes : </span>
                          {session.notes}
                        </p>
                      </div>
                    )}

                    {selectedDateSessions.length > 1 && (
                      <hr className="my-4" />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
