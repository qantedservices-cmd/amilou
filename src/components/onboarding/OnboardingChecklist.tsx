'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, X } from 'lucide-react'
import { JoinOrCreateGroupDialog } from './JoinOrCreateGroupDialog'

interface MeState {
  hasSeenOnboarding: boolean
  hasGroup: boolean
  hasMemorizationZone: boolean
}

function ChecklistItem({ done, label, hint, action }: { done: boolean; label: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        {done ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground/50 shrink-0" />}
        <div className="min-w-0">
          <span className={`text-sm ${done ? 'text-muted-foreground line-through' : 'font-medium'}`}>{label}</span>
          {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
        </div>
      </div>
      {!done && action}
    </div>
  )
}

export function OnboardingChecklist({ locale }: { locale: string }) {
  const [me, setMe] = useState<MeState | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/me')
        const d = await res.json()
        if (cancelled) return
        setMe({
          hasSeenOnboarding: d.hasSeenOnboarding === true,
          hasGroup: d.hasGroup === true,
          hasMemorizationZone: d.hasMemorizationZone === true,
        })
      } catch { /* silencieux */ }
    }
    load()
    return () => { cancelled = true }
  }, [refreshKey])

  function refresh() {
    setRefreshKey((k) => k + 1)
  }

  async function hide() {
    setDismissed(true)
    try {
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasSeenOnboarding: true }),
      })
    } catch { /* silencieux */ }
  }

  if (!me || me.hasSeenOnboarding || dismissed) return null

  const doneCount = (me.hasGroup ? 1 : 0) + (me.hasMemorizationZone ? 1 : 0)
  const allDone = me.hasGroup && me.hasMemorizationZone

  return (
    <Card className="border-2 border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📖</span>
            <div>
              <h3 className="font-semibold">{allDone ? 'Tout est configuré !' : 'Bienvenue sur Aamilou'}</h3>
              <p className="text-xs text-muted-foreground">{doneCount}/2 étapes optionnelles complétées</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={hide} title="Masquer">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="divide-y">
          <ChecklistItem
            done={true}
            label="Suivre mon avancement"
            hint="C'est déjà possible — commence quand tu veux, un groupe n'est pas requis."
          />
          <ChecklistItem
            done={me.hasGroup}
            label="Rejoindre ou créer un groupe"
            action={
              <Button size="sm" variant="outline" onClick={() => setGroupDialogOpen(true)}>
                Rejoindre / Créer
              </Button>
            }
          />
          <ChecklistItem
            done={me.hasMemorizationZone}
            label="Configurer ma zone de mémorisation"
            action={
              <Button size="sm" variant="outline" onClick={() => { window.location.href = `/${locale}/settings#zone-memorisation` }}>
                Configurer
              </Button>
            }
          />
        </div>

        {allDone && (
          <div className="mt-3">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={hide}>Masquer</Button>
          </div>
        )}
      </CardContent>

      <JoinOrCreateGroupDialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen} onDone={refresh} />
    </Card>
  )
}
