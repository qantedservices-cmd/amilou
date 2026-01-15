'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CalendarCheck, ChevronLeft, ChevronRight, Check, Save } from 'lucide-react'

interface AttendanceRecord {
  id: string
  date: string
  sunday: boolean
  monday: boolean
  tuesday: boolean
  wednesday: boolean
  thursday: boolean
  friday: boolean
  saturday: boolean
  comment: string | null
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
type DayKey = typeof DAYS[number]

export default function AttendancePage() {
  const t = useTranslations()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentWeekDays, setCurrentWeekDays] = useState<Record<DayKey, boolean>>({
    sunday: false,
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
  })
  const [saved, setSaved] = useState(false)

  const currentMonth = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  useEffect(() => {
    fetchAttendance()
  }, [currentDate])

  async function fetchAttendance() {
    setLoading(true)
    try {
      const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
      const res = await fetch(`/api/attendance?month=${month}`)
      if (res.ok) {
        const data = await res.json()
        setAttendance(Array.isArray(data) ? data : [])
        // Load current week's attendance
        loadCurrentWeek(data)
      }
    } catch (error) {
      console.error('Error fetching attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  function loadCurrentWeek(records: AttendanceRecord[]) {
    const weekStart = getWeekStart(new Date())
    const record = records.find(r => {
      const recordDate = new Date(r.date)
      return recordDate.getTime() === weekStart.getTime()
    })

    if (record) {
      setCurrentWeekDays({
        sunday: record.sunday,
        monday: record.monday,
        tuesday: record.tuesday,
        wednesday: record.wednesday,
        thursday: record.thursday,
        friday: record.friday,
        saturday: record.saturday,
      })
    } else {
      setCurrentWeekDays({
        sunday: false,
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
      })
    }
  }

  function getWeekStart(date: Date): Date {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    const day = d.getDay()
    d.setDate(d.getDate() - day)
    return d
  }

  function prevMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  async function saveCurrentWeek() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString(),
          days: currentWeekDays,
        }),
      })

      if (res.ok) {
        await fetchAttendance()
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (error) {
      console.error('Error saving attendance:', error)
    } finally {
      setSaving(false)
    }
  }

  function toggleDay(day: DayKey) {
    setCurrentWeekDays(prev => ({ ...prev, [day]: !prev[day] }))
  }

  // Calculate stats
  function calculateMonthStats() {
    let totalDays = 0
    let presentDays = 0

    attendance.forEach(record => {
      DAYS.forEach(day => {
        totalDays++
        if (record[day]) presentDays++
      })
    })

    return {
      totalDays,
      presentDays,
      rate: totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0,
    }
  }

  const stats = calculateMonthStats()

  // Generate calendar grid
  function generateCalendarDays() {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()
    const totalDays = lastDay.getDate()

    const days: { date: Date | null; isPresent: boolean }[] = []

    // Add padding for days before month starts
    for (let i = 0; i < startPadding; i++) {
      days.push({ date: null, isPresent: false })
    }

    // Add each day of the month
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d)
      const weekStart = getWeekStart(date)
      const dayOfWeek = date.getDay()
      const dayKey = DAYS[dayOfWeek]

      const record = attendance.find(r => {
        const recordDate = new Date(r.date)
        return recordDate.getTime() === weekStart.getTime()
      })

      days.push({
        date,
        isPresent: record ? record[dayKey] : false,
      })
    }

    return days
  }

  const calendarDays = generateCalendarDays()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('attendance.title')}</h1>
        <p className="text-muted-foreground">Suivez votre assiduité quotidienne</p>
      </div>

      {/* Current Week Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-emerald-600" />
            Cette semaine
          </CardTitle>
          <CardDescription>Cochez les jours où vous avez travaillé</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 mb-4">
            {DAYS.map((day) => {
              const dayDate = new Date()
              const diff = DAYS.indexOf(day) - dayDate.getDay()
              const thisDay = new Date(dayDate)
              thisDay.setDate(dayDate.getDate() + diff)

              return (
                <div key={day} className="flex flex-col items-center gap-2">
                  <Label className="text-xs text-muted-foreground">
                    {t(`attendance.days.${day}`).slice(0, 3)}
                  </Label>
                  <span className="text-xs">{thisDay.getDate()}</span>
                  <button
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${
                      currentWeekDays[day]
                        ? 'bg-emerald-600 text-white'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {currentWeekDays[day] && <Check className="h-5 w-5" />}
                  </button>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {Object.values(currentWeekDays).filter(Boolean).length} / 7 jours
            </p>
            <Button
              onClick={saveCurrentWeek}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? (
                t('common.loading')
              ) : saved ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Enregistré
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Stats Cards */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('attendance.rate')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{stats.rate}%</div>
            <p className="text-xs text-muted-foreground">ce mois</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Jours présent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.presentDays}</div>
            <p className="text-xs text-muted-foreground">sur {stats.totalDays} jours enregistrés</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Semaines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{attendance.length}</div>
            <p className="text-xs text-muted-foreground">semaines enregistrées</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="capitalize">{currentMonth}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {t(`attendance.days.${day}`).slice(0, 3)}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (!day.date) {
                return <div key={index} className="aspect-square" />
              }

              const isToday = day.date.getTime() === today.getTime()
              const isPast = day.date < today

              return (
                <div
                  key={index}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors ${
                    day.isPresent
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100'
                      : isPast
                      ? 'bg-muted/50 text-muted-foreground'
                      : 'bg-muted/30'
                  } ${isToday ? 'ring-2 ring-emerald-600' : ''}`}
                >
                  <span className={isToday ? 'font-bold' : ''}>{day.date.getDate()}</span>
                  {day.isPresent && <Check className="h-3 w-3 mt-0.5" />}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-emerald-100 dark:bg-emerald-900" />
              <span className="text-muted-foreground">Présent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-muted/50" />
              <span className="text-muted-foreground">Absent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded ring-2 ring-emerald-600" />
              <span className="text-muted-foreground">Aujourd'hui</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
