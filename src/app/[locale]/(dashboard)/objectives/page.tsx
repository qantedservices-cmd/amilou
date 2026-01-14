'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Badge } from '@/components/ui/badge'
import { Target, Plus, Pencil, Trash2, Calculator } from 'lucide-react'

interface Program {
  id: string
  code: string
  nameAr: string
  nameFr: string
  nameEn: string
}

interface Objective {
  id: string
  programId: string
  dailyTarget: number
  targetMonths: number | null
  totalTarget: number | null
  isActive: boolean
  startDate: string
  program: Program
}

const TOTAL_QURAN_VERSES = 6236

export default function ObjectivesPage() {
  const t = useTranslations()
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [selectedProgram, setSelectedProgram] = useState('')
  const [dailyTarget, setDailyTarget] = useState('')
  const [targetMonths, setTargetMonths] = useState('')
  const [totalTarget, setTotalTarget] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [objRes, progRes] = await Promise.all([
        fetch('/api/objectives'),
        fetch('/api/programs'),
      ])
      const objData = await objRes.json()
      const progData = await progRes.json()
      setObjectives(Array.isArray(objData) ? objData : [])
      setPrograms(Array.isArray(progData) ? progData : [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setSelectedProgram('')
    setDailyTarget('')
    setTargetMonths('')
    setTotalTarget('')
    setEditingId(null)
  }

  function openEditDialog(obj: Objective) {
    setEditingId(obj.id)
    setSelectedProgram(obj.programId)
    setDailyTarget(obj.dailyTarget.toString())
    setTargetMonths(obj.targetMonths?.toString() || '')
    setTotalTarget(obj.totalTarget?.toString() || '')
    setDialogOpen(true)
  }

  function calculateDailyFromTotal() {
    if (totalTarget && targetMonths) {
      const days = parseInt(targetMonths) * 30
      const daily = Math.ceil(parseInt(totalTarget) / days)
      setDailyTarget(daily.toString())
    }
  }

  function calculateTotalFromDaily() {
    if (dailyTarget && targetMonths) {
      const days = parseInt(targetMonths) * 30
      const total = parseInt(dailyTarget) * days
      setTotalTarget(total.toString())
    }
  }

  async function handleSubmit() {
    if (!selectedProgram || !dailyTarget) return

    const payload = {
      programId: selectedProgram,
      dailyTarget: parseInt(dailyTarget),
      targetMonths: targetMonths ? parseInt(targetMonths) : null,
      totalTarget: totalTarget ? parseInt(totalTarget) : null,
    }

    try {
      const url = editingId ? `/api/objectives/${editingId}` : '/api/objectives'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        await fetchData()
        setDialogOpen(false)
        resetForm()
      }
    } catch (error) {
      console.error('Error saving objective:', error)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet objectif ?')) return

    try {
      const res = await fetch(`/api/objectives/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error deleting objective:', error)
    }
  }

  function getProgramName(program: Program) {
    return program.nameFr
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

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('objectives.title')}</h1>
          <p className="text-muted-foreground">
            Définissez vos objectifs de mémorisation et révision
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" />
              {t('common.add')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingId ? t('common.edit') : t('common.add')} {t('objectives.title').toLowerCase()}
              </DialogTitle>
              <DialogDescription>
                Définissez votre objectif quotidien pour un programme
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Programme</Label>
                <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un programme" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((prog) => (
                      <SelectItem key={prog.id} value={prog.id}>
                        {getProgramName(prog)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('objectives.dailyTarget')}</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={dailyTarget}
                    onChange={(e) => setDailyTarget(e.target.value)}
                    placeholder="Ex: 5"
                  />
                  <span className="flex items-center text-sm text-muted-foreground whitespace-nowrap">
                    {t('objectives.versesPerDay')}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('objectives.targetPeriod')}</Label>
                <Select value={targetMonths} onValueChange={setTargetMonths}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optionnel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">{t('objectives.months3')}</SelectItem>
                    <SelectItem value="6">{t('objectives.months6')}</SelectItem>
                    <SelectItem value="12">{t('objectives.year1')}</SelectItem>
                    <SelectItem value="24">2 ans</SelectItem>
                    <SelectItem value="36">3 ans</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('objectives.totalTarget')}</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    max={TOTAL_QURAN_VERSES}
                    value={totalTarget}
                    onChange={(e) => setTotalTarget(e.target.value)}
                    placeholder={`Max: ${TOTAL_QURAN_VERSES}`}
                  />
                  <span className="flex items-center text-sm text-muted-foreground">versets</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={calculateDailyFromTotal}
                  disabled={!totalTarget || !targetMonths}
                >
                  <Calculator className="mr-1 h-3 w-3" />
                  {t('objectives.calculateDaily')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={calculateTotalFromDaily}
                  disabled={!dailyTarget || !targetMonths}
                >
                  <Calculator className="mr-1 h-3 w-3" />
                  {t('objectives.calculateTotal')}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedProgram || !dailyTarget}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {objectives.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Vous n'avez pas encore défini d'objectifs.<br />
              Cliquez sur "Ajouter" pour commencer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {objectives.map((obj) => (
            <Card key={obj.id} className={!obj.isActive ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Badge className={getProgramColor(obj.program.code)}>
                      {getProgramName(obj.program)}
                    </Badge>
                    {!obj.isActive && (
                      <Badge variant="outline" className="ml-2">Inactif</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(obj)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(obj.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('objectives.dailyTarget')}</span>
                    <span className="font-semibold text-emerald-600">
                      {obj.dailyTarget} {t('objectives.versesPerDay')}
                    </span>
                  </div>
                  {obj.targetMonths && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t('objectives.targetPeriod')}</span>
                      <span className="font-medium">{obj.targetMonths} mois</span>
                    </div>
                  )}
                  {obj.totalTarget && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t('objectives.totalTarget')}</span>
                      <span className="font-medium">{obj.totalTarget} versets</span>
                    </div>
                  )}
                  <div className="pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      Depuis le {new Date(obj.startDate).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
