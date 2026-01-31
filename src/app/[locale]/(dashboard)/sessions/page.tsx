'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Calendar, ChevronLeft, ChevronRight, Users, Check, X, BookOpen } from 'lucide-react'

interface Group {
  id: string
  name: string
}

interface SessionEntry {
  surahNumber: number
  surahName: string
  verseStart: number
  verseEnd: number
  program: string
}

interface SessionParticipant {
  userId: string
  userName: string
  entries: SessionEntry[]
}

interface SessionData {
  date: string
  participants: SessionParticipant[]
  presentCount: number
  totalMembers: number
  absentMembers: string[]
}

interface CalendarData {
  year: number
  month: number | null
  sessions: SessionData[]
  sessionDates: string[]
  totalSessions: number
  members: { id: string; name: string }[]
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export default function SessionsPage() {
  const t = useTranslations()
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  useEffect(() => {
    fetchGroups()
  }, [])

  useEffect(() => {
    fetchCalendarData()
  }, [currentYear, currentMonth, selectedGroup])

  async function fetchGroups() {
    try {
      const res = await fetch('/api/groups')
      if (res.ok) {
        const data = await res.json()
        setGroups(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }

  async function fetchCalendarData() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        year: currentYear.toString(),
        month: currentMonth.toString()
      })
      if (selectedGroup !== 'all') {
        params.set('groupId', selectedGroup)
      }

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

  function isSessionDate(day: number): boolean {
    if (!calendarData) return false
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return calendarData.sessionDates.includes(dateStr)
  }

  function getSessionForDate(day: number): SessionData | undefined {
    if (!calendarData) return undefined
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return calendarData.sessions.find(s => s.date === dateStr)
  }

  function openSessionDetail(day: number) {
    const session = getSessionForDate(day)
    if (session) {
      setSelectedSession(session)
      setDetailDialogOpen(true)
    }
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

  if (loading && !calendarData) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('sessions.title')}</h1>
          <p className="text-muted-foreground">Calendrier des séances et avancement hebdomadaire</p>
        </div>

        {groups.length > 0 && (
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tous les groupes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les groupes</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Stats Card */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Séances ce mois</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {calendarData?.sessions.filter(s => {
                const d = new Date(s.date)
                return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear
              }).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Membres du groupe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {calendarData?.members.length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total séances (année)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {calendarData?.totalSessions || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-600" />
              Calendrier des séances
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[150px] text-center font-medium">
                {MONTHS[currentMonth - 1]} {currentYear}
              </span>
              <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription>
            Cliquez sur un jour vert pour voir les détails de la séance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {DAYS.map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="p-2" />
              }

              const hasSession = isSessionDate(day)
              const isToday = isCurrentMonth && day === today.getDate()
              const session = hasSession ? getSessionForDate(day) : null

              return (
                <div
                  key={day}
                  onClick={() => hasSession && openSessionDetail(day)}
                  className={`
                    relative p-2 min-h-[60px] rounded-lg border text-center transition-all
                    ${hasSession
                      ? 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-300 dark:border-emerald-700 cursor-pointer hover:bg-emerald-200 dark:hover:bg-emerald-800'
                      : 'bg-background border-transparent hover:bg-muted/50'
                    }
                    ${isToday ? 'ring-2 ring-blue-500' : ''}
                  `}
                >
                  <span className={`text-sm ${hasSession ? 'font-bold text-emerald-800 dark:text-emerald-200' : ''}`}>
                    {day}
                  </span>
                  {hasSession && session && (
                    <div className="mt-1">
                      <Badge variant="secondary" className="text-xs px-1 py-0 bg-emerald-200 dark:bg-emerald-800">
                        {session.presentCount} <Users className="inline h-3 w-3 ml-0.5" />
                      </Badge>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300" />
              <span>Séance avec avancement</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded ring-2 ring-blue-500" />
              <span>Aujourd'hui</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle>Dernières séances</CardTitle>
          <CardDescription>Historique des soumissions d'avancement</CardDescription>
        </CardHeader>
        <CardContent>
          {calendarData?.sessions && calendarData.sessions.length > 0 ? (
            <div className="space-y-3">
              {calendarData.sessions.slice(0, 10).map((session) => (
                <div
                  key={session.date}
                  onClick={() => {
                    setSelectedSession(session)
                    setDetailDialogOpen(true)
                  }}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
                      <Calendar className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium">{formatDate(session.date)}</p>
                      <p className="text-sm text-muted-foreground">
                        {session.participants.map(p => p.userName).join(', ')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                    {session.presentCount}/{session.totalMembers}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mb-4 opacity-50" />
              <p>Aucune séance enregistrée</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-auto">
          {selectedSession && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-emerald-600" />
                  {formatDate(selectedSession.date)}
                </DialogTitle>
                <DialogDescription>
                  {selectedSession.presentCount} participant(s) sur {selectedSession.totalMembers} membres
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Participants with their progress */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Présents ({selectedSession.participants.length})
                  </h4>
                  <div className="space-y-3">
                    {selectedSession.participants.map((participant) => (
                      <div key={participant.userId} className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                        <p className="font-medium text-emerald-800 dark:text-emerald-200 mb-2">
                          {participant.userName}
                        </p>
                        <div className="space-y-1">
                          {participant.entries.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <BookOpen className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{entry.surahName}</span>
                              <span className="text-muted-foreground">
                                v.{entry.verseStart}-{entry.verseEnd}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {entry.program}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Absent members */}
                {selectedSession.absentMembers.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <X className="h-4 w-4 text-red-600" />
                      Absents ({selectedSession.absentMembers.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedSession.absentMembers.map((name) => (
                        <Badge key={name} variant="outline" className="text-red-600 border-red-200">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
