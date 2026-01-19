'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Check,
  Save,
  Calendar as CalendarIcon,
  Target,
  User
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface ManageableUser {
  id: string
  name: string | null
  email: string
  isSelf: boolean
}

interface Program {
  id: string
  code: string
  nameFr: string
  nameAr: string
}

interface ProgramSetting {
  id: string
  programId: string
  quantity: number
  unit: string
  period: string
  program: Program
}

interface DailyLog {
  id: string
  programId: string
  quantity: number
  unit: string
  program: Program
}

const UNITS = [
  { value: 'PAGE', label: 'Page(s)' },
  { value: 'QUART', label: 'Quart(s)' },
  { value: 'DEMI_HIZB', label: 'Demi-hizb' },
  { value: 'HIZB', label: 'Hizb' },
  { value: 'JUZ', label: 'Juz' },
]

const QUANTITIES = ['0', '0.25', '0.33', '0.5', '0.75', '1', '1.5', '2', '3', '4', '5']

export default function AttendancePage() {
  const t = useTranslations()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [manageableUsers, setManageableUsers] = useState<ManageableUser[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [userSettings, setUserSettings] = useState<ProgramSetting[]>([])
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Form state for each program
  const [formData, setFormData] = useState<Record<string, { quantity: string; unit: string }>>({})

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (selectedUserId) {
      fetchUserSettings()
      fetchDailyLogs()
    }
  }, [selectedUserId, selectedDate])

  async function fetchInitialData() {
    try {
      const [usersRes, programsRes] = await Promise.all([
        fetch('/api/users/manageable'),
        fetch('/api/programs'),
      ])

      if (usersRes.ok) {
        const users = await usersRes.json()
        setManageableUsers(Array.isArray(users) ? users : [])
        // Select self by default
        const selfUser = users.find((u: ManageableUser) => u.isSelf)
        if (selfUser) {
          setSelectedUserId(selfUser.id)
        }
      }

      if (programsRes.ok) {
        const progs = await programsRes.json()
        setPrograms(Array.isArray(progs) ? progs : [])
      }
    } catch (error) {
      console.error('Error fetching initial data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchUserSettings() {
    try {
      const res = await fetch(`/api/settings/programs?userId=${selectedUserId}`)
      if (res.ok) {
        const data = await res.json()
        setUserSettings(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching user settings:', error)
    }
  }

  async function fetchDailyLogs() {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const res = await fetch(`/api/daily-log?userId=${selectedUserId}&date=${dateStr}`)
      if (res.ok) {
        const data = await res.json()
        setDailyLogs(Array.isArray(data) ? data : [])

        // Initialize form data from existing logs
        const newFormData: Record<string, { quantity: string; unit: string }> = {}
        programs.forEach(prog => {
          const log = data.find((l: DailyLog) => l.programId === prog.id)
          if (log) {
            newFormData[prog.id] = {
              quantity: log.quantity.toString(),
              unit: log.unit
            }
          } else {
            // Use user's preferred unit from settings
            const setting = userSettings.find(s => s.programId === prog.id)
            newFormData[prog.id] = {
              quantity: '',
              unit: setting?.unit || 'PAGE'
            }
          }
        })
        setFormData(newFormData)
      }
    } catch (error) {
      console.error('Error fetching daily logs:', error)
    }
  }

  function getSettingForProgram(programId: string) {
    return userSettings.find(s => s.programId === programId)
  }

  function updateFormData(programId: string, field: 'quantity' | 'unit', value: string) {
    setFormData(prev => ({
      ...prev,
      [programId]: {
        ...prev[programId],
        [field]: value
      }
    }))
  }

  async function saveLog(programId: string) {
    const data = formData[programId]
    if (!data || !data.quantity) return

    setSaving(programId)
    try {
      const res = await fetch('/api/daily-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          programId,
          date: format(selectedDate, 'yyyy-MM-dd'),
          quantity: parseFloat(data.quantity),
          unit: data.unit
        }),
      })

      if (res.ok) {
        await fetchDailyLogs()
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (error) {
      console.error('Error saving log:', error)
    } finally {
      setSaving(null)
    }
  }

  async function saveAllLogs() {
    setSaving('all')
    try {
      for (const prog of programs) {
        const data = formData[prog.id]
        if (data && data.quantity && parseFloat(data.quantity) > 0) {
          await fetch('/api/daily-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: selectedUserId,
              programId: prog.id,
              date: format(selectedDate, 'yyyy-MM-dd'),
              quantity: parseFloat(data.quantity),
              unit: data.unit
            }),
          })
        }
      }
      await fetchDailyLogs()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Error saving logs:', error)
    } finally {
      setSaving(null)
    }
  }

  function prevDay() {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
  }

  function nextDay() {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDate(newDate)
  }

  function goToToday() {
    setSelectedDate(new Date())
  }

  function getProgramColor(code: string) {
    const colors: Record<string, string> = {
      MEMORIZATION: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
      CONSOLIDATION: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      REVISION: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
      READING: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
      TAFSIR: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100',
    }
    return colors[code] || 'bg-gray-100 text-gray-800'
  }

  function formatObjective(setting: ProgramSetting | undefined) {
    if (!setting) return 'Non défini'
    const unitLabel = UNITS.find(u => u.value === setting.unit)?.label || setting.unit
    const periodLabels: Record<string, string> = {
      DAY: '/jour',
      WEEK: '/semaine',
      MONTH: '/mois',
      YEAR: '/an'
    }
    return `${setting.quantity} ${unitLabel}${periodLabels[setting.period] || ''}`
  }

  function getUnitLabel(unit: string) {
    return UNITS.find(u => u.value === unit)?.label || unit
  }

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  const selectedUserName = manageableUsers.find(u => u.id === selectedUserId)?.name || 'Utilisateur'

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
        <p className="text-muted-foreground">Suivez votre assiduité quotidienne par programme</p>
      </div>

      {/* Controls Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* User Selector */}
            {manageableUsers.length > 1 && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {manageableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.isSelf ? `Moi-même (${user.name || user.email})` : (user.name || user.email)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date Selector */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={prevDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="min-w-[200px]">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Button variant="outline" size="icon" onClick={nextDay}>
                <ChevronRight className="h-4 w-4" />
              </Button>

              {!isToday && (
                <Button variant="ghost" size="sm" onClick={goToToday}>
                  Aujourd'hui
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Entry Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-emerald-600" />
            Assiduité du {format(selectedDate, 'd MMMM yyyy', { locale: fr })}
            {manageableUsers.length > 1 && !manageableUsers.find(u => u.id === selectedUserId)?.isSelf && (
              <Badge variant="outline" className="ml-2">{selectedUserName}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Saisissez ce qui a été réalisé pour chaque programme
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {programs.map((program) => {
              const setting = getSettingForProgram(program.id)
              const log = dailyLogs.find(l => l.programId === program.id)
              const data = formData[program.id] || { quantity: '', unit: 'PAGE' }
              const hasValue = data.quantity && parseFloat(data.quantity) > 0

              return (
                <div
                  key={program.id}
                  className={`flex flex-wrap items-center gap-4 rounded-lg border p-4 ${
                    log ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : ''
                  }`}
                >
                  <div className="min-w-[140px]">
                    <Badge className={getProgramColor(program.code)}>
                      {program.nameFr}
                    </Badge>
                    {setting && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Objectif: {formatObjective(setting)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-1">
                    <Select
                      value={data.quantity || '0'}
                      onValueChange={(v) => updateFormData(program.id, 'quantity', v)}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUANTITIES.map((q) => (
                          <SelectItem key={q} value={q}>
                            {q === '0.25' ? '1/4' : q === '0.33' ? '1/3' : q === '0.5' ? '1/2' : q === '0.75' ? '3/4' : q}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={data.unit}
                      onValueChange={(v) => updateFormData(program.id, 'unit', v)}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {log && (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                        <Check className="h-3 w-3 mr-1" />
                        Enregistré
                      </Badge>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant={hasValue ? "default" : "outline"}
                    className={hasValue ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                    disabled={saving === program.id || !hasValue}
                    onClick={() => saveLog(program.id)}
                  >
                    {saving === program.id ? '...' : <Save className="h-4 w-4" />}
                  </Button>
                </div>
              )
            })}
          </div>

          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {dailyLogs.length} / {programs.length} programmes enregistrés
            </p>
            <Button
              onClick={saveAllLogs}
              disabled={saving === 'all'}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving === 'all' ? (
                t('common.loading')
              ) : saved ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Tout enregistré
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Tout enregistrer
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé du jour</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Aucune activité enregistrée pour cette journée
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dailyLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                >
                  <Badge className={getProgramColor(log.program.code)}>
                    {log.program.nameFr}
                  </Badge>
                  <span className="font-semibold text-emerald-600">
                    {log.quantity} {getUnitLabel(log.unit)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
