'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Check,
  Save,
  Target,
  User,
  Plus,
  Trash2,
  Loader2
} from 'lucide-react'
import { format, addDays } from 'date-fns'
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

interface WeeklyObjective {
  id: string
  name: string
  programId: string | null
  programCode: string | null
  isCustom: boolean
  completed: boolean
  completionId: string | null
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

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

function getWeekNumber(date: Date): { week: number; year: number } {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const week = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return { week, year: d.getFullYear() }
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay()
  d.setDate(d.getDate() - dow)
  return d
}

export default function AttendancePage() {
  const t = useTranslations()
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()))
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [manageableUsers, setManageableUsers] = useState<ManageableUser[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [completions, setCompletions] = useState<Record<string, Record<number, boolean>>>({})
  const [weeklyObjectives, setWeeklyObjectives] = useState<WeeklyObjective[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // New objective dialog state
  const [showNewObjectiveDialog, setShowNewObjectiveDialog] = useState(false)
  const [newObjectiveName, setNewObjectiveName] = useState('')
  const [creatingObjective, setCreatingObjective] = useState(false)

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekInfo = getWeekNumber(weekStart)

  const fetchData = useCallback(async () => {
    if (!selectedUserId) return

    setLoading(true)
    try {
      const weekStartStr = format(weekStart, 'yyyy-MM-dd')
      const [programsRes, objectivesRes] = await Promise.all([
        fetch(`/api/attendance/programs?weekStart=${weekStartStr}&userId=${selectedUserId}`),
        fetch(`/api/attendance/weekly-objectives?weekStart=${weekStartStr}&userId=${selectedUserId}`)
      ])

      if (programsRes.ok) {
        const data = await programsRes.json()
        setPrograms(data.programs || [])
        setCompletions(data.completions || {})
      }

      if (objectivesRes.ok) {
        const data = await objectivesRes.json()
        setWeeklyObjectives(data.objectives || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedUserId, weekStart])

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const usersRes = await fetch('/api/users/manageable')
        if (usersRes.ok) {
          const users = await usersRes.json()
          setManageableUsers(Array.isArray(users) ? users : [])
          const selfUser = users.find((u: ManageableUser) => u.isSelf)
          if (selfUser) {
            setSelectedUserId(selfUser.id)
          }
        }
      } catch (error) {
        console.error('Error fetching initial data:', error)
      }
    }
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (selectedUserId) {
      fetchData()
    }
  }, [selectedUserId, fetchData])

  function toggleCompletion(programId: string, dayIndex: number) {
    setCompletions(prev => ({
      ...prev,
      [programId]: {
        ...prev[programId],
        [dayIndex]: !prev[programId]?.[dayIndex]
      }
    }))
  }

  async function toggleObjective(objective: WeeklyObjective) {
    const newCompleted = !objective.completed

    // Optimistic update
    setWeeklyObjectives(prev =>
      prev.map(obj =>
        obj.id === objective.id ? { ...obj, completed: newCompleted } : obj
      )
    )

    try {
      const res = await fetch('/api/attendance/weekly-objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          objectiveId: objective.id,
          weekStart: format(weekStart, 'yyyy-MM-dd'),
          completed: newCompleted
        })
      })

      if (!res.ok) {
        // Revert on error
        setWeeklyObjectives(prev =>
          prev.map(obj =>
            obj.id === objective.id ? { ...obj, completed: !newCompleted } : obj
          )
        )
      }
    } catch (error) {
      console.error('Error toggling objective:', error)
      // Revert on error
      setWeeklyObjectives(prev =>
        prev.map(obj =>
          obj.id === objective.id ? { ...obj, completed: !newCompleted } : obj
        )
      )
    }
  }

  async function saveAllCompletions() {
    setSaving(true)
    try {
      // Build completions payload
      const completionsPayload: Record<string, Record<number, { date: string; completed: boolean }>> = {}

      for (const program of programs) {
        completionsPayload[program.id] = {}
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          completionsPayload[program.id][dayIndex] = {
            date: format(weekDates[dayIndex], 'yyyy-MM-dd'),
            completed: completions[program.id]?.[dayIndex] || false
          }
        }
      }

      const res = await fetch('/api/attendance/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          completions: completionsPayload
        })
      })

      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (error) {
      console.error('Error saving completions:', error)
    } finally {
      setSaving(false)
    }
  }

  async function createObjective() {
    if (!newObjectiveName.trim()) return

    setCreatingObjective(true)
    try {
      const res = await fetch('/api/attendance/weekly-objectives/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          name: newObjectiveName.trim()
        })
      })

      if (res.ok) {
        const newObjective = await res.json()
        setWeeklyObjectives(prev => [...prev, newObjective])
        setNewObjectiveName('')
        setShowNewObjectiveDialog(false)
      }
    } catch (error) {
      console.error('Error creating objective:', error)
    } finally {
      setCreatingObjective(false)
    }
  }

  async function deleteObjective(objectiveId: string) {
    try {
      const res = await fetch(`/api/attendance/weekly-objectives/${objectiveId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setWeeklyObjectives(prev => prev.filter(obj => obj.id !== objectiveId))
      }
    } catch (error) {
      console.error('Error deleting objective:', error)
    }
  }

  function prevWeek() {
    setWeekStart(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 7)
      return d
    })
  }

  function nextWeek() {
    setWeekStart(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 7)
      return d
    })
  }

  function goToCurrentWeek() {
    setWeekStart(getWeekStart(new Date()))
  }

  const isCurrentWeek = format(weekStart, 'yyyy-MM-dd') === format(getWeekStart(new Date()), 'yyyy-MM-dd')
  const selectedUserName = manageableUsers.find(u => u.id === selectedUserId)?.name || 'Utilisateur'

  // Calculate stats
  const totalPossible = programs.length * 7
  const totalCompleted = Object.values(completions).reduce((sum, days) =>
    sum + Object.values(days).filter(Boolean).length, 0
  )
  const weekPercentage = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0

  if (loading && programs.length === 0) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('attendance.title')}</h1>
        <p className="text-muted-foreground">Suivez votre assiduité par programme</p>
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

            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={prevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                className="min-w-[180px] font-semibold"
                onClick={goToCurrentWeek}
              >
                Semaine {weekInfo.week} - {weekInfo.year}
              </Button>

              <Button variant="outline" size="icon" onClick={nextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>

              {!isCurrentWeek && (
                <Button variant="ghost" size="sm" onClick={goToCurrentWeek}>
                  Aujourd'hui
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Programs Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-emerald-600" />
            Programmes Journaliers
            {manageableUsers.length > 1 && !manageableUsers.find(u => u.id === selectedUserId)?.isSelf && (
              <Badge variant="outline" className="ml-2">{selectedUserName}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Cochez les programmes accomplis chaque jour
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground w-32">Programme</th>
                  {weekDates.map((date, i) => {
                    const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                    return (
                      <th
                        key={i}
                        className={`text-center py-3 px-1 font-medium ${isToday ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}`}
                      >
                        <div className="text-xs text-muted-foreground">{DAY_LABELS[i]}</div>
                        <div className={`text-sm ${isToday ? 'text-emerald-600 font-bold' : ''}`}>
                          {format(date, 'd')}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {programs.map((program) => (
                  <tr key={program.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-2">
                      <Badge className={getProgramColor(program.code)}>
                        {program.nameFr}
                      </Badge>
                    </td>
                    {weekDates.map((date, dayIndex) => {
                      const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                      const isCompleted = completions[program.id]?.[dayIndex] || false
                      return (
                        <td
                          key={dayIndex}
                          className={`text-center py-3 px-1 ${isToday ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}`}
                        >
                          <Checkbox
                            checked={isCompleted}
                            onCheckedChange={() => toggleCompletion(program.id, dayIndex)}
                            className={`h-6 w-6 ${isCompleted ? 'data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600' : ''}`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Progression semaine : </span>
              <span className={`font-bold text-lg ${weekPercentage >= 80 ? 'text-emerald-600' : weekPercentage >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {weekPercentage}%
              </span>
              <span className="text-muted-foreground ml-2">({totalCompleted}/{totalPossible})</span>
            </div>
            <Button
              onClick={saveAllCompletions}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : saved ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Enregistré !
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

      {/* Weekly Objectives */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Objectifs Semaine
          </CardTitle>
          <CardDescription>
            Objectifs hebdomadaires à accomplir
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {weeklyObjectives.map((objective) => (
              <div
                key={objective.id}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  objective.completed
                    ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                    : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={objective.completed}
                    onCheckedChange={() => toggleObjective(objective)}
                    className={`h-5 w-5 ${objective.completed ? 'data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600' : ''}`}
                  />
                  <span className={`font-medium ${objective.completed ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>
                    {objective.name}
                  </span>
                  {objective.programCode && (
                    <Badge variant="outline" className="text-xs">
                      {objective.programCode}
                    </Badge>
                  )}
                </div>
                {objective.isCustom && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-600"
                    onClick={() => deleteObjective(objective.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            {weeklyObjectives.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Aucun objectif hebdomadaire configuré
              </p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t">
            <Dialog open={showNewObjectiveDialog} onOpenChange={setShowNewObjectiveDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Ajouter objectif
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nouvel objectif hebdomadaire</DialogTitle>
                  <DialogDescription>
                    Créez un objectif personnalisé à accomplir chaque semaine
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input
                    placeholder="Ex: Hadith, Dou'a, Méditation..."
                    value={newObjectiveName}
                    onChange={(e) => setNewObjectiveName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createObjective()}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewObjectiveDialog(false)}>
                    Annuler
                  </Button>
                  <Button
                    onClick={createObjective}
                    disabled={creatingObjective || !newObjectiveName.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {creatingObjective ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Création...
                      </>
                    ) : (
                      'Créer'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
