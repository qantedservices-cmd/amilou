'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar, Target, Clock } from 'lucide-react'

export interface MemorizationPace {
  versesPerDay: number
  activeDays: number
  totalDays: number
  totalNewVerses: number
  consistency: number
  remainingVerses: number
  remainingPages: number
  remainingHizbs: number
  remainingJuz: number
  verseMilestones: Array<{
    verses: number
    page: number
    hizb: number
    juz: number
    surah: number
  }>
}

interface SimulatorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memorizationPace: MemorizationPace
}

type Unit = 'versets' | 'pages' | 'quart' | 'demi_hizb' | 'hizbs' | 'juz'
type Period = 'jour' | 'semaine' | 'mois'

const UNIT_LABELS: Record<Unit, string> = {
  versets: 'Versets',
  pages: 'Pages',
  quart: 'Quart de hizb',
  demi_hizb: 'Demi-hizb',
  hizbs: 'Hizb',
  juz: 'Juz',
}

const PERIOD_LABELS: Record<Period, string> = {
  jour: 'jour',
  semaine: 'semaine',
  mois: 'mois',
}

// 1 hizb = 2 demi-hizbs = 4 quarts
function unitToHizbFactor(unit: Unit): number | null {
  switch (unit) {
    case 'quart': return 0.25
    case 'demi_hizb': return 0.5
    case 'hizbs': return 1
    case 'juz': return 2
    default: return null
  }
}

function toVersesPerDay(
  quantity: number,
  unit: Unit,
  period: Period,
  pace: MemorizationPace
): number {
  let versesPerPeriod: number

  const hizbFactor = unitToHizbFactor(unit)
  if (unit === 'versets') {
    versesPerPeriod = quantity
  } else if (unit === 'pages') {
    versesPerPeriod =
      pace.remainingPages > 0
        ? quantity * (pace.remainingVerses / pace.remainingPages)
        : 0
  } else if (hizbFactor !== null) {
    // Convert to hizbs then to verses
    const quantityInHizbs = quantity * hizbFactor
    versesPerPeriod =
      pace.remainingHizbs > 0
        ? quantityInHizbs * (pace.remainingVerses / pace.remainingHizbs)
        : 0
  } else {
    versesPerPeriod = 0
  }

  switch (period) {
    case 'jour':
      return versesPerPeriod
    case 'semaine':
      return versesPerPeriod / 7
    case 'mois':
      return versesPerPeriod / 30
  }
}

function targetToVerses(
  quantity: number,
  unit: Unit,
  pace: MemorizationPace
): number {
  const hizbFactor = unitToHizbFactor(unit)
  if (unit === 'versets') return quantity
  if (unit === 'pages') {
    return pace.remainingPages > 0
      ? quantity * (pace.remainingVerses / pace.remainingPages)
      : 0
  }
  if (hizbFactor !== null) {
    const quantityInHizbs = quantity * hizbFactor
    return pace.remainingHizbs > 0
      ? quantityInHizbs * (pace.remainingVerses / pace.remainingHizbs)
      : 0
  }
  return 0
}

function findMilestone(
  versesFromNow: number,
  milestones: MemorizationPace['verseMilestones']
): MemorizationPace['verseMilestones'][number] | null {
  let best: MemorizationPace['verseMilestones'][number] | null = null
  for (const m of milestones) {
    if (m.verses <= versesFromNow) {
      if (!best || m.verses > best.verses) {
        best = m
      }
    }
  }
  return best
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}

function formatDuration(days: number): string {
  if (days < 30) {
    return `${Math.round(days)} jour${Math.round(days) > 1 ? 's' : ''}`
  }
  const months = Math.floor(days / 30)
  const remainingDays = Math.round(days % 30)
  if (months < 12) {
    const parts = [`${months} mois`]
    if (remainingDays > 0) {
      parts.push(
        `${remainingDays} jour${remainingDays > 1 ? 's' : ''}`
      )
    }
    return parts.join(' et ')
  }
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  const parts = [`${years} an${years > 1 ? 's' : ''}`]
  if (remainingMonths > 0) {
    parts.push(`${remainingMonths} mois`)
  }
  return parts.join(' et ')
}

/** Compute pages/week from versesPerDay and remaining data */
export function computePagesPerWeek(pace: MemorizationPace): number {
  if (pace.remainingPages <= 0 || pace.remainingVerses <= 0) return 0
  const vpd = pace.versesPerDay * pace.consistency
  const pagesPerDay = vpd * (pace.remainingPages / pace.remainingVerses)
  return Math.round(pagesPerDay * 7 * 10) / 10
}

export function SimulatorDialog({
  open,
  onOpenChange,
  memorizationPace,
}: SimulatorDialogProps) {
  // Default rhythm: show pages/semaine with computed value
  const defaultPagesPerWeek = useMemo(
    () => computePagesPerWeek(memorizationPace),
    [memorizationPace]
  )

  const [rhythmQuantity, setRhythmQuantity] = useState<number>(defaultPagesPerWeek)
  const [rhythmUnit, setRhythmUnit] = useState<Unit>('pages')
  const [rhythmPeriod, setRhythmPeriod] = useState<Period>('semaine')

  const [targetQuantity, setTargetQuantity] = useState<number>(1)
  const [targetUnit, setTargetUnit] = useState<Unit>('juz')

  const [targetDateStr, setTargetDateStr] = useState<string>(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().split('T')[0]
  })

  // Formatted current pace display
  const currentPaceDisplay = useMemo(() => {
    const ppw = computePagesPerWeek(memorizationPace)
    return `${formatNumber(ppw)} pages/semaine`
  }, [memorizationPace])

  const effectiveVpd = useMemo(() => {
    const rawVpd = toVersesPerDay(
      rhythmQuantity,
      rhythmUnit,
      rhythmPeriod,
      memorizationPace
    )
    return rawVpd * memorizationPace.consistency
  }, [rhythmQuantity, rhythmUnit, rhythmPeriod, memorizationPace])

  // Tab 1: Completion date
  const completionResult = useMemo(() => {
    if (effectiveVpd <= 0 || memorizationPace.remainingVerses <= 0) return null
    const daysRemaining = memorizationPace.remainingVerses / effectiveVpd
    const completionDate = new Date()
    completionDate.setDate(completionDate.getDate() + daysRemaining)
    return { date: completionDate, days: daysRemaining }
  }, [effectiveVpd, memorizationPace.remainingVerses])

  // Tab 2: Target date
  const targetResult = useMemo(() => {
    if (effectiveVpd <= 0) return null
    const tv = targetToVerses(targetQuantity, targetUnit, memorizationPace)
    if (tv <= 0) return null
    const days = tv / effectiveVpd
    const date = new Date()
    date.setDate(date.getDate() + days)
    return { date, days, targetVerses: Math.round(tv) }
  }, [effectiveVpd, targetQuantity, targetUnit, memorizationPace])

  // Tab 3: Date projection
  const dateResult = useMemo(() => {
    if (effectiveVpd <= 0) return null
    const targetDate = new Date(targetDateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    targetDate.setHours(0, 0, 0, 0)
    const diffDays = Math.max(
      0,
      (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (diffDays <= 0) return null
    const projectedVerses = diffDays * effectiveVpd
    const percentage = Math.min(
      100,
      (projectedVerses / memorizationPace.remainingVerses) * 100
    )
    const milestone = findMilestone(
      projectedVerses,
      memorizationPace.verseMilestones
    )
    return { projectedVerses: Math.round(projectedVerses), percentage, milestone, diffDays }
  }, [effectiveVpd, targetDateStr, memorizationPace])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Simulateur de mémorisation</DialogTitle>
        </DialogHeader>

        {/* Rhythm controls */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            <span>
              Rythme actuel : {currentPaceDisplay} (régularité :{' '}
              {Math.round(memorizationPace.consistency * 100)}%)
            </span>
          </div>

          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Quantité</Label>
              <Input
                type="number"
                min={0}
                step={0.25}
                value={rhythmQuantity}
                onChange={(e) =>
                  setRhythmQuantity(Math.max(0, parseFloat(e.target.value) || 0))
                }
                className="w-24"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unité</Label>
              <Select
                value={rhythmUnit}
                onValueChange={(v) => setRhythmUnit(v as Unit)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(UNIT_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Par</Label>
              <Select
                value={rhythmPeriod}
                onValueChange={(v) => setRhythmPeriod(v as Period)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {effectiveVpd > 0 && (
            <p className="text-xs text-muted-foreground">
              ≈ {formatNumber(Math.round(effectiveVpd * 100) / 100)} versets
              effectifs/jour (avec régularité)
            </p>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="fin" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="fin" className="flex-1 gap-1">
              <Calendar className="size-3.5" />
              Fin ?
            </TabsTrigger>
            <TabsTrigger value="cible" className="flex-1 gap-1">
              <Target className="size-3.5" />
              Cible ?
            </TabsTrigger>
            <TabsTrigger value="date" className="flex-1 gap-1">
              <Clock className="size-3.5" />
              Date ?
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Fin ? */}
          <TabsContent value="fin" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              À ce rythme, quand aurez-vous terminé la mémorisation du Coran ?
            </p>
            {completionResult ? (
              <div className="rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 p-4 space-y-2">
                <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">
                  {formatDate(completionResult.date)}
                </p>
                <p className="text-sm text-violet-600 dark:text-violet-400">
                  Dans {formatDuration(completionResult.days)} (
                  {formatNumber(memorizationPace.remainingVerses)} versets
                  restants)
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  {memorizationPace.remainingVerses <= 0
                    ? 'Félicitations, vous avez terminé la mémorisation !'
                    : 'Ajustez le rythme pour voir la projection.'}
                </p>
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Cible ? */}
          <TabsContent value="cible" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Combien souhaitez-vous mémoriser ? On vous dit quand ce sera fait.
            </p>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Objectif</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={targetQuantity}
                  onChange={(e) =>
                    setTargetQuantity(
                      Math.max(1, parseInt(e.target.value) || 1)
                    )
                  }
                  className="w-24"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unité</Label>
                <Select
                  value={targetUnit}
                  onValueChange={(v) => setTargetUnit(v as Unit)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {targetResult ? (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 space-y-2">
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {formatDate(targetResult.date)}
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Dans {formatDuration(targetResult.days)} (
                  {formatNumber(targetResult.targetVerses)} versets)
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  Ajustez le rythme et la cible pour voir la projection.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Tab 3: Date ? */}
          <TabsContent value="date" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Choisissez une date pour voir où vous en serez.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Date cible</Label>
              <Input
                type="date"
                value={targetDateStr}
                onChange={(e) => setTargetDateStr(e.target.value)}
                className="w-44"
              />
            </div>

            {dateResult ? (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4 space-y-2">
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {dateResult.percentage >= 100
                    ? '100%'
                    : `${Math.round(dateResult.percentage * 10) / 10}%`}
                </p>
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  +{formatNumber(dateResult.projectedVerses)} versets
                  supplémentaires en {formatDuration(dateResult.diffDays)}
                </p>
                {dateResult.milestone && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 space-y-0.5 pt-1 border-t border-emerald-200 dark:border-emerald-800">
                    <p>
                      Niveau atteint : {formatNumber(dateResult.milestone.verses)}{' '}
                      versets
                    </p>
                    <p>
                      ~{formatNumber(dateResult.milestone.page)} pages |{' '}
                      {formatNumber(Math.round(dateResult.milestone.hizb * 10) / 10)}{' '}
                      hizbs |{' '}
                      {formatNumber(Math.round(dateResult.milestone.juz * 10) / 10)}{' '}
                      juz
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  {effectiveVpd <= 0
                    ? 'Ajustez le rythme pour voir la projection.'
                    : 'Choisissez une date future.'}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
