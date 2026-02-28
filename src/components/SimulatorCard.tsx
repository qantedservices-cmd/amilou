'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, Calculator } from 'lucide-react'
import { SimulatorDialog, type MemorizationPace } from './SimulatorDialog'

interface SimulatorCardProps {
  memorizationPace: MemorizationPace | null
  memorizedPercentage: number
}

export function SimulatorCard({
  memorizationPace,
  memorizedPercentage,
}: SimulatorCardProps) {
  // All hooks must be called before any early returns
  const [dialogOpen, setDialogOpen] = useState(false)

  // Case 1: 100% memorized
  if (memorizedPercentage >= 100) {
    return (
      <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="size-4 text-amber-600 dark:text-amber-400" />
            Projection memorisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
            Felicitations !
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Vous avez memorise l&apos;integralite du Coran.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Case 2: No data or versesPerDay is 0
  if (!memorizationPace || memorizationPace.versesPerDay === 0) {
    return (
      <Card className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="size-4 text-slate-600 dark:text-slate-400" />
            Projection memorisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Pas assez de donnees
          </p>
        </CardContent>
      </Card>
    )
  }

  // Case 3: Normal — compute estimated end date
  const effectiveVersesPerDay =
    memorizationPace.versesPerDay * memorizationPace.consistency
  const daysRemaining = Math.ceil(
    memorizationPace.remainingVerses / effectiveVersesPerDay
  )
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + daysRemaining)
  const endDateStr = endDate.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })
  const capitalizedEndDate =
    endDateStr.charAt(0).toUpperCase() + endDateStr.slice(1)

  return (
    <>
      <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="size-4 text-violet-600 dark:text-violet-400" />
            Projection memorisation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-violet-600 dark:text-violet-400">
                Rythme actuel
              </span>
              <span className="font-medium text-violet-700 dark:text-violet-300">
                {Math.round(memorizationPace.versesPerDay * 100) / 100}{' '}
                versets/jour
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-violet-600 dark:text-violet-400">
                Restant
              </span>
              <span className="font-medium text-violet-700 dark:text-violet-300">
                {memorizationPace.remainingVerses.toLocaleString('fr-FR')}{' '}
                versets
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-violet-600 dark:text-violet-400">
                Fin estimee
              </span>
              <span className="font-medium text-violet-700 dark:text-violet-300">
                {capitalizedEndDate}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30"
            onClick={() => setDialogOpen(true)}
          >
            <Calculator className="size-4 mr-2" />
            Simuler
          </Button>
        </CardContent>
      </Card>

      <SimulatorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        memorizationPace={memorizationPace}
      />
    </>
  )
}
