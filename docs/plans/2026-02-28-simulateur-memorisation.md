# Simulateur de Projection Mémorisation - Plan d'implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ajouter une carte de projection + un simulateur interactif pour visualiser quand l'utilisateur terminera sa mémorisation du Coran.

**Architecture:** Hybride - calcul du rythme (3 derniers mois) côté API dans `/api/stats`, projections et simulations côté client. Conversions basées sur la table `Verse` (données exactes Supabase).

**Tech Stack:** Next.js API Routes, Prisma, React (useState/useMemo), shadcn/ui (Card, Dialog, Tabs, Input, Select, Button)

---

### Task 1: Calcul `memorizationPace` dans l'API stats

**Files:**
- Modify: `src/app/api/stats/route.ts:716` (après le bloc completionCycles, avant Tafsir Coverage)

**Step 1: Ajouter le calcul du rythme de mémorisation**

Après la ligne 716 (après `avgLectureDays`), avant le commentaire Tafsir Coverage (ligne 717), insérer :

```typescript
    // =============================================
    // Memorization Pace (rythme sur 90 derniers jours)
    // =============================================
    let memorizationPace = null

    const ninetyDaysAgo = new Date(now)
    ninetyDaysAgo.setDate(now.getDate() - 90)

    // Filter memorization entries from last 90 days
    const recentMemorization = memorizationEntries.filter(e => {
      const d = new Date(e.date)
      return d >= ninetyDaysAgo
    })

    if (recentMemorization.length > 0) {
      // Count unique verses per day
      const versesByDay = new Map<string, Set<string>>()
      for (const entry of recentMemorization) {
        const dayKey = new Date(entry.date).toISOString().split('T')[0]
        if (!versesByDay.has(dayKey)) versesByDay.set(dayKey, new Set())
        const daySet = versesByDay.get(dayKey)!
        for (let v = entry.verseStart; v <= entry.verseEnd; v++) {
          daySet.add(`${entry.surahNumber}:${v}`)
        }
      }

      const activeDays = versesByDay.size
      const totalNewVerses = Array.from(versesByDay.values()).reduce((sum, s) => sum + s.size, 0)
      const totalDays = 90
      const versesPerDay = activeDays > 0 ? Math.round((totalNewVerses / activeDays) * 10) / 10 : 0
      const consistency = Math.round((activeDays / totalDays) * 100) / 100

      // Calculate remaining using already-computed memorizedVerses set and Verse table
      const remainingVersesCount = QURAN_TOTAL_VERSES - totalMemorizedVerses

      // Query remaining pages/hizbs/juz from Verse table
      // Get all non-memorized verses' page/hizb/juz info
      // We already have memorizedVersesArray - get the non-memorized verse stats
      const allVerseStats = await prisma.verse.findMany({
        select: { surahNumber: true, verseNumber: true, page: true, hizb: true, juz: true }
      })

      const memorizedSet = memorizedVerses // already a Set<string> of "surah:verse"
      const nonMemorizedPages = new Set<number>()
      const nonMemorizedHizbs = new Set<number>()
      const nonMemorizedJuz = new Set<number>()
      const allPages = new Set<number>()
      const allHizbs = new Set<number>()
      const allJuz = new Set<number>()

      for (const v of allVerseStats) {
        const key = `${v.surahNumber}:${v.verseNumber}`
        if (v.page) allPages.add(v.page)
        if (v.hizb) allHizbs.add(Math.ceil(v.hizb))
        if (v.juz) allJuz.add(v.juz)

        if (!memorizedSet.has(key)) {
          if (v.page) nonMemorizedPages.add(v.page)
          if (v.hizb) nonMemorizedHizbs.add(Math.ceil(v.hizb))
          if (v.juz) nonMemorizedJuz.add(v.juz)
        }
      }

      // Build milestones: every ~100 verses from current position
      // Order non-memorized verses by surah/verse, sample every 100
      const nonMemorizedVerses = allVerseStats
        .filter(v => !memorizedSet.has(`${v.surahNumber}:${v.verseNumber}`))
        .sort((a, b) => a.surahNumber - b.surahNumber || a.verseNumber - b.verseNumber)

      const verseMilestones: Array<{ verses: number; page: number; hizb: number; juz: number; surah: number }> = []
      const step = Math.max(1, Math.floor(nonMemorizedVerses.length / 50)) // ~50 milestones
      for (let i = 0; i < nonMemorizedVerses.length; i += step) {
        const v = nonMemorizedVerses[i]
        verseMilestones.push({
          verses: i + 1,
          page: v.page,
          hizb: v.hizb ? Math.ceil(v.hizb) : 0,
          juz: v.juz || 0,
          surah: v.surahNumber
        })
      }
      // Always add last verse
      if (nonMemorizedVerses.length > 0) {
        const last = nonMemorizedVerses[nonMemorizedVerses.length - 1]
        verseMilestones.push({
          verses: nonMemorizedVerses.length,
          page: last.page,
          hizb: last.hizb ? Math.ceil(last.hizb) : 0,
          juz: last.juz || 0,
          surah: last.surahNumber
        })
      }

      memorizationPace = {
        versesPerDay,
        activeDays,
        totalDays,
        totalNewVerses,
        consistency,
        remainingVerses: remainingVersesCount,
        remainingPages: nonMemorizedPages.size,
        remainingHizbs: nonMemorizedHizbs.size,
        remainingJuz: nonMemorizedJuz.size,
        verseMilestones
      }
    }
```

**Step 2: Ajouter `memorizationPace` à la réponse JSON**

Dans le return `NextResponse.json({...})` (ligne 799+), après `tafsirCoverage` (ligne 883), ajouter :

```typescript
      // NEW: Memorization Pace & Simulator
      memorizationPace,
```

**Step 3: Commit**

```bash
git add src/app/api/stats/route.ts
git commit -m "feat: calcul du rythme de mémorisation dans l'API stats"
```

---

### Task 2: Créer le composant SimulatorCard

**Files:**
- Create: `src/components/SimulatorCard.tsx`

**Step 1: Créer le composant carte de projection**

```tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, Calculator } from 'lucide-react'
import { useState } from 'react'
import { SimulatorDialog } from './SimulatorDialog'

interface MemorizationPace {
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

interface SimulatorCardProps {
  memorizationPace: MemorizationPace | null
  memorizedPercentage: number
}

export function SimulatorCard({ memorizationPace, memorizedPercentage }: SimulatorCardProps) {
  const [showSimulator, setShowSimulator] = useState(false)

  // Case: 100% memorized
  if (memorizedPercentage >= 100) {
    return (
      <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800">
        <CardContent className="pt-6">
          <p className="text-center text-amber-800 dark:text-amber-200 font-medium">
            Mémorisation complète du Coran terminée !
          </p>
        </CardContent>
      </Card>
    )
  }

  // Case: no data
  if (!memorizationPace || memorizationPace.versesPerDay === 0) {
    return (
      <Card className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-slate-500" />
            Projection Mémorisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Pas assez de données sur les 3 derniers mois pour projeter.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Calculate estimated end date
  const effectiveVersesPerDay = memorizationPace.versesPerDay * memorizationPace.consistency
  const daysRemaining = Math.ceil(memorizationPace.remainingVerses / effectiveVersesPerDay)
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + daysRemaining)

  const endDateStr = endDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <>
      <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-violet-600" />
            Projection Mémorisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rythme actuel</span>
              <span className="font-medium">{memorizationPace.versesPerDay} versets/jour</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Restant</span>
              <span className="font-medium">{memorizationPace.remainingVerses.toLocaleString('fr-FR')} versets</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fin estimée</span>
              <span className="font-bold text-violet-600 dark:text-violet-400 capitalize">{endDateStr}</span>
            </div>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-violet-600 border-violet-300 hover:bg-violet-100 dark:text-violet-400 dark:border-violet-700 dark:hover:bg-violet-950"
                onClick={() => setShowSimulator(true)}
              >
                <Calculator className="h-4 w-4 mr-2" />
                Simuler
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <SimulatorDialog
        open={showSimulator}
        onOpenChange={setShowSimulator}
        memorizationPace={memorizationPace}
      />
    </>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/SimulatorCard.tsx
git commit -m "feat: composant SimulatorCard pour la projection mémorisation"
```

---

### Task 3: Créer le composant SimulatorDialog

**Files:**
- Create: `src/components/SimulatorDialog.tsx`

**Step 1: Créer le dialog simulateur interactif**

```tsx
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

interface MemorizationPace {
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

// Convert user input (quantity + unit + period) to verses per day
function toVersesPerDay(
  quantity: number,
  unit: string,
  period: string,
  pace: MemorizationPace
): number {
  // Convert quantity to verses based on unit
  let verses = quantity
  if (unit === 'pages') {
    // Average verses per remaining page
    verses = quantity * (pace.remainingVerses / Math.max(1, pace.remainingPages))
  } else if (unit === 'hizbs') {
    verses = quantity * (pace.remainingVerses / Math.max(1, pace.remainingHizbs))
  } else if (unit === 'juz') {
    verses = quantity * (pace.remainingVerses / Math.max(1, pace.remainingJuz))
  }

  // Convert to per-day based on period
  if (period === 'week') return verses / 7
  if (period === 'month') return verses / 30
  return verses // already per day
}

// Find milestone closest to a verse count
function findMilestone(
  versesFromNow: number,
  milestones: MemorizationPace['verseMilestones']
) {
  if (milestones.length === 0) return null
  let closest = milestones[0]
  for (const m of milestones) {
    if (m.verses <= versesFromNow) closest = m
    else break
  }
  return closest
}

export function SimulatorDialog({ open, onOpenChange, memorizationPace }: SimulatorDialogProps) {
  // Rhythm controls
  const [quantity, setQuantity] = useState(memorizationPace.versesPerDay)
  const [unit, setUnit] = useState('versets')
  const [period, setPeriod] = useState('day')

  // Tab 2: target
  const [targetQuantity, setTargetQuantity] = useState(1)
  const [targetUnit, setTargetUnit] = useState('juz')

  // Tab 3: date
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().split('T')[0]
  })

  // Effective verses per day (with consistency)
  const effectiveVpd = useMemo(() => {
    const vpd = toVersesPerDay(quantity, unit, period, memorizationPace)
    return vpd * memorizationPace.consistency
  }, [quantity, unit, period, memorizationPace])

  // Tab 1: When do I finish?
  const finishDate = useMemo(() => {
    if (effectiveVpd <= 0) return null
    const days = Math.ceil(memorizationPace.remainingVerses / effectiveVpd)
    const date = new Date()
    date.setDate(date.getDate() + days)
    return {
      date,
      dateStr: date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      days,
      years: Math.round((days / 365) * 10) / 10,
    }
  }, [effectiveVpd, memorizationPace.remainingVerses])

  // Tab 2: When do I reach target?
  const targetDate2 = useMemo(() => {
    if (effectiveVpd <= 0) return null

    let targetVerses = targetQuantity
    if (targetUnit === 'pages') {
      targetVerses = targetQuantity * (memorizationPace.remainingVerses / Math.max(1, memorizationPace.remainingPages))
    } else if (targetUnit === 'hizbs') {
      targetVerses = targetQuantity * (memorizationPace.remainingVerses / Math.max(1, memorizationPace.remainingHizbs))
    } else if (targetUnit === 'juz') {
      targetVerses = targetQuantity * (memorizationPace.remainingVerses / Math.max(1, memorizationPace.remainingJuz))
    }

    const days = Math.ceil(targetVerses / effectiveVpd)
    const date = new Date()
    date.setDate(date.getDate() + days)
    return {
      dateStr: date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      days,
    }
  }, [effectiveVpd, targetQuantity, targetUnit, memorizationPace])

  // Tab 3: Where will I be on date X?
  const projection = useMemo(() => {
    if (effectiveVpd <= 0) return null
    const target = new Date(targetDate)
    const today = new Date()
    const diffDays = Math.max(0, Math.floor((target.getTime() - today.getTime()) / (86400000)))
    const projectedVerses = Math.min(
      Math.round(diffDays * effectiveVpd),
      memorizationPace.remainingVerses
    )

    const milestone = findMilestone(projectedVerses, memorizationPace.verseMilestones)
    const totalVerses = (6236 - memorizationPace.remainingVerses) + projectedVerses
    const percentage = Math.round((totalVerses / 6236) * 1000) / 10

    return {
      projectedVerses,
      totalVerses,
      percentage,
      milestone,
    }
  }, [effectiveVpd, targetDate, memorizationPace])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Simulateur de mémorisation</DialogTitle>
        </DialogHeader>

        {/* Rhythm controls */}
        <div className="space-y-2 pb-4 border-b">
          <Label className="text-xs text-muted-foreground">
            Rythme actuel : {memorizationPace.versesPerDay} versets/jour
            (régularité : {Math.round(memorizationPace.consistency * 100)}%)
          </Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0.1}
              step={0.1}
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              className="w-24"
            />
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="versets">versets</SelectItem>
                <SelectItem value="pages">pages</SelectItem>
                <SelectItem value="hizbs">hizbs</SelectItem>
                <SelectItem value="juz">juz</SelectItem>
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">/ jour</SelectItem>
                <SelectItem value="week">/ semaine</SelectItem>
                <SelectItem value="month">/ mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="finish" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="finish" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Fin ?
            </TabsTrigger>
            <TabsTrigger value="target" className="text-xs">
              <Target className="h-3 w-3 mr-1" />
              Cible ?
            </TabsTrigger>
            <TabsTrigger value="date" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              Date ?
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: When do I finish? */}
          <TabsContent value="finish" className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Quand est-ce que je termine la mémorisation complète ?
            </p>
            {finishDate ? (
              <div className="space-y-2">
                <div className="text-center p-4 rounded-lg bg-violet-50 dark:bg-violet-950/30">
                  <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 capitalize">
                    {finishDate.dateStr}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    dans {finishDate.days.toLocaleString('fr-FR')} jours ({finishDate.years} ans)
                  </p>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {memorizationPace.remainingVerses.toLocaleString('fr-FR')} versets restants
                </p>
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground">Rythme invalide</p>
            )}
          </TabsContent>

          {/* Tab 2: When do I reach target? */}
          <TabsContent value="target" className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Quand est-ce que j'atteins cette cible ?
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                step={1}
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(parseInt(e.target.value) || 1)}
                className="w-24"
              />
              <Select value={targetUnit} onValueChange={setTargetUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="versets">versets de plus</SelectItem>
                  <SelectItem value="pages">pages de plus</SelectItem>
                  <SelectItem value="hizbs">hizbs de plus</SelectItem>
                  <SelectItem value="juz">juz de plus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {targetDate2 ? (
              <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 capitalize">
                  {targetDate2.dateStr}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  dans {targetDate2.days.toLocaleString('fr-FR')} jours
                </p>
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground">Rythme invalide</p>
            )}
          </TabsContent>

          {/* Tab 3: Where will I be on date X? */}
          <TabsContent value="date" className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Où j'en serai à cette date ?
            </p>
            <Input
              type="date"
              value={targetDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setTargetDate(e.target.value)}
            />
            {projection ? (
              <div className="text-center p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 space-y-2">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {projection.percentage}%
                </p>
                <p className="text-sm text-muted-foreground">
                  {projection.totalVerses.toLocaleString('fr-FR')} versets mémorisés
                  (+{projection.projectedVerses.toLocaleString('fr-FR')})
                </p>
                {projection.milestone && (
                  <p className="text-xs text-muted-foreground">
                    ~ Juz {projection.milestone.juz}, Hizb {projection.milestone.hizb}, Page {projection.milestone.page}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground">Rythme invalide</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/SimulatorDialog.tsx
git commit -m "feat: composant SimulatorDialog pour simulation interactive"
```

---

### Task 4: Intégrer dans le dashboard

**Files:**
- Modify: `src/app/[locale]/(dashboard)/dashboard/page.tsx`

**Step 1: Ajouter l'import**

En haut du fichier, avec les autres imports de composants :

```typescript
import { SimulatorCard } from '@/components/SimulatorCard'
```

**Step 2: Ajouter la carte après "Mon Avancement Global - Mémorisation"**

Après la ligne 1573 (fermeture `</Card>` de la carte avancement global), avant le commentaire `{/* Stats Cards */}` (ligne 1575), insérer :

```tsx
      {/* Projection Mémorisation */}
      <SimulatorCard
        memorizationPace={stats?.memorizationPace || null}
        memorizedPercentage={stats?.globalProgress?.percentage || 0}
      />
```

**Step 3: Commit**

```bash
git add src/app/[locale]/(dashboard)/dashboard/page.tsx
git commit -m "feat: intégration carte projection dans le dashboard"
```

---

### Task 5: Tester et valider

**Step 1: Lancer l'app en dev**

```bash
npm run dev
```

**Step 2: Vérifier la carte dans le dashboard**

- Naviguer vers `/fr/dashboard`
- Vérifier que la carte "Projection Mémorisation" apparaît après "Mon Avancement Global"
- Vérifier les 3 infos : rythme, restant, date

**Step 3: Tester le simulateur**

- Cliquer "Simuler"
- Onglet "Fin ?" : vérifier la date change quand on modifie le rythme
- Onglet "Cible ?" : entrer 5 juz → vérifier la date
- Onglet "Date ?" : choisir une date → vérifier le % affiché

**Step 4: Tester les cas limites**

- Impersonner un utilisateur sans données de mémorisation → message "Pas assez de données"
- Vérifier le dark mode

**Step 5: Commit final**

```bash
git add -A
git commit -m "feat: simulateur de projection mémorisation complet"
```
