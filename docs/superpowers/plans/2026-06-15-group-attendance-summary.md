# Bilan présences par groupe — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une page `/groups/[id]/attendance` avec un tableau résumé par élève (présent/absent/excusé/taux) et une matrice détaillée par séance, éditable par référent et admin.

**Architecture:** Une nouvelle API `GET /api/groups/[id]/attendance-summary` agrège en 2 requêtes Prisma toutes les séances + tous les membres actifs + leurs `SessionAttendance` existants. Une nouvelle page client affiche le tableau résumé puis (en repliable) la matrice. L'édition réutilise `PUT /api/sessions/[sessionId]` déjà en place (upsert depuis la spec Présences).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma, shadcn/ui, Tailwind, lucide-react. Pas de framework de test ; vérif via `npm run build` + test manuel `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-06-14-group-attendance-summary-design.md`

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `src/app/api/groups/[id]/attendance-summary/route.ts` | GET : récupère séances + membres + attendance, agrège, retourne JSON |
| `src/app/[locale]/(dashboard)/groups/[id]/attendance/page.tsx` | Page client : header, tableau résumé (avec tri), matrice repliable, édition optimiste |
| `src/app/[locale]/(dashboard)/groups/[id]/mastery/page.tsx` | Ajouter le bouton "Bilan présences" dans la barre d'actions |
| `src/app/[locale]/(dashboard)/groups/[id]/sessions/[num]/page.tsx` | Ajouter le bouton "Bilan présences" dans le header |

Volume total estimé : ~400 lignes neuves (API ~120, page ~280), 2 boutons ajoutés dans les pages existantes.

---

## Task 1 : API GET /api/groups/[id]/attendance-summary

**Files:**
- Create: `src/app/api/groups/[id]/attendance-summary/route.ts`

Objectif : exposer le résumé + détail par séance dans une seule réponse.

- [ ] **Step 1 : Créer le fichier route**

Créer `src/app/api/groups/[id]/attendance-summary/route.ts` avec ce contenu :

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId: effectiveUserId } = await getEffectiveUserId()
    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id: groupId } = await params

    // Permission check: must be group member or global ADMIN
    const [membership, user] = await Promise.all([
      prisma.groupMember.findFirst({
        where: { groupId, userId: effectiveUserId },
      }),
      prisma.user.findUnique({
        where: { id: effectiveUserId },
        select: { role: true },
      }),
    ])

    const isGlobalAdmin = user?.role === 'ADMIN'
    if (!membership && !isGlobalAdmin) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const isReferent = membership?.role === 'REFERENT' || isGlobalAdmin

    // 1. Fetch group + all sessions ordered chronologically + all attendance records
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        name: true,
        sessions: {
          orderBy: { date: 'asc' },
          select: {
            id: true,
            date: true,
            attendance: {
              select: { userId: true, present: true, excused: true },
            },
          },
        },
      },
    })

    if (!group) {
      return NextResponse.json({ error: 'Groupe non trouvé' }, { status: 404 })
    }

    // 2. Fetch active students (MEMBER OR REFERENT with isStudent=true)
    const members = await prisma.groupMember.findMany({
      where: {
        groupId,
        isActive: true,
        OR: [
          { role: 'MEMBER' },
          { role: 'REFERENT', isStudent: true },
        ],
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    })

    // Build session list with sequential numbers
    const sessions = group.sessions.map((s, idx) => ({
      id: s.id,
      number: idx + 1,
      date: s.date.toISOString(),
    }))

    // Build attendance lookup: sessionId -> userId -> { present, excused }
    const attendanceBySession = new Map<string, Map<string, { present: boolean; excused: boolean }>>()
    for (const s of group.sessions) {
      const byUser = new Map<string, { present: boolean; excused: boolean }>()
      for (const a of s.attendance) {
        byUser.set(a.userId, { present: a.present, excused: a.excused })
      }
      attendanceBySession.set(s.id, byUser)
    }

    // Build per-member summary + per-session breakdown
    const totalSessions = sessions.length
    const membersOut = members.map((m) => {
      const perSession = sessions.map((s) => {
        const rec = attendanceBySession.get(s.id)?.get(m.userId)
        if (!rec) {
          return { sessionId: s.id, present: false, excused: false, hasRecord: false }
        }
        return { sessionId: s.id, present: rec.present, excused: rec.excused, hasRecord: true }
      })

      const presentCount = perSession.filter((p) => p.present).length
      const excusedCount = perSession.filter((p) => !p.present && p.excused).length
      const absentCount = totalSessions - presentCount - excusedCount
      const rate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0

      return {
        userId: m.userId,
        name: m.user.name || '',
        presentCount,
        absentCount,
        excusedCount,
        rate,
        perSession,
      }
    })

    return NextResponse.json({
      groupName: group.name,
      totalSessions,
      firstSessionDate: sessions[0]?.date ?? null,
      isReferent,
      sessions,
      members: membersOut,
    })
  } catch (error) {
    console.error('Error fetching attendance summary:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du bilan' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2 : Vérifier le build**

Run: `npm run build`
Expected: build OK, aucune erreur TS sur la nouvelle route.

- [ ] **Step 3 : Test manuel rapide**

Run: `npm run dev`. Dans un terminal séparé, tester en tant qu'utilisateur authentifié (via le navigateur, ouvrir `/api/groups/<groupId>/attendance-summary` après login). Vérifier que la réponse contient bien `groupName`, `totalSessions`, `sessions[]`, `members[].perSession[]`.

- [ ] **Step 4 : Commit**

```bash
git add "src/app/api/groups/[id]/attendance-summary/route.ts"
git commit -m "feat: API GET /api/groups/[id]/attendance-summary (résumé + détail par séance)"
```

---

## Task 2 : Page client — header + tableau résumé

**Files:**
- Create: `src/app/[locale]/(dashboard)/groups/[id]/attendance/page.tsx`

- [ ] **Step 1 : Créer la page avec en-tête + tableau résumé (sans matrice ni édition)**

Créer `src/app/[locale]/(dashboard)/groups/[id]/attendance/page.tsx` :

```tsx
'use client'

import { useState, useEffect, use, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Users, ArrowUpDown, Calendar } from 'lucide-react'

interface PerSession {
  sessionId: string
  present: boolean
  excused: boolean
  hasRecord: boolean
}

interface MemberSummary {
  userId: string
  name: string
  presentCount: number
  absentCount: number
  excusedCount: number
  rate: number
  perSession: PerSession[]
}

interface SessionInfo {
  id: string
  number: number
  date: string
}

interface AttendanceSummaryData {
  groupName: string
  totalSessions: number
  firstSessionDate: string | null
  isReferent: boolean
  sessions: SessionInfo[]
  members: MemberSummary[]
}

type SortKey = 'name' | 'present' | 'absent' | 'excused' | 'rate'
type SortDir = 'asc' | 'desc'

export default function GroupAttendancePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id: groupId } = use(params)
  const router = useRouter()
  const locale = useLocale()

  const [data, setData] = useState<AttendanceSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('rate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/groups/${groupId}/attendance-summary`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j.error || 'Erreur')
        }
        return r.json()
      })
      .then((d: AttendanceSummaryData) => {
        if (!cancelled) setData(d)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [groupId])

  const sortedMembers = useMemo(() => {
    if (!data) return []
    const arr = [...data.members]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name, 'fr'); break
        case 'present': cmp = a.presentCount - b.presentCount; break
        case 'absent': cmp = a.absentCount - b.absentCount; break
        case 'excused': cmp = a.excusedCount - b.excusedCount; break
        case 'rate': cmp = a.rate - b.rate; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [data, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  function rateColor(rate: number): string {
    if (rate >= 80) return 'bg-emerald-500'
    if (rate >= 60) return 'bg-amber-500'
    return 'bg-red-500'
  }

  function rateTextColor(rate: number): string {
    if (rate >= 80) return 'text-emerald-700 dark:text-emerald-400'
    if (rate >= 60) return 'text-amber-700 dark:text-amber-400'
    return 'text-red-700 dark:text-red-400'
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-12 rounded bg-muted/40 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
      </div>
    )
  }

  if (!data) return null

  const firstDateLabel = data.firstSessionDate
    ? new Date(data.firstSessionDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/groups/${groupId}/mastery`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{data.groupName} — Bilan des présences</h1>
          <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
            <Users className="h-4 w-4" />
            <span>Total séances : {data.totalSessions}</span>
            <span>·</span>
            <Calendar className="h-4 w-4" />
            <span>Période : depuis le {firstDateLabel}</span>
          </div>
        </div>
      </div>

      {/* Summary table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Résumé par élève</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sortedMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {data.totalSessions === 0 ? 'Aucune séance enregistrée dans ce groupe.' : 'Aucun élève dans ce groupe.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th
                      className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleSort('name')}
                    >
                      <span className="inline-flex items-center gap-1">Élève <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th
                      className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 w-32"
                      onClick={() => toggleSort('present')}
                    >
                      <span className="inline-flex items-center gap-1">Présent <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th
                      className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 w-24"
                      onClick={() => toggleSort('absent')}
                    >
                      <span className="inline-flex items-center gap-1">Absent <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th
                      className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 w-24"
                      onClick={() => toggleSort('excused')}
                    >
                      <span className="inline-flex items-center gap-1">Excusé <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th
                      className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 w-48"
                      onClick={() => toggleSort('rate')}
                    >
                      <span className="inline-flex items-center gap-1">Taux <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((m, i) => (
                    <tr key={m.userId} className={`border-b last:border-0 hover:bg-muted/20 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                      <td className="px-4 py-2.5 text-sm font-medium">{m.name}</td>
                      <td className="px-4 py-2.5 text-center text-sm">{m.presentCount} / {data.totalSessions}</td>
                      <td className="px-4 py-2.5 text-center text-sm">{m.absentCount}</td>
                      <td className="px-4 py-2.5 text-center text-sm">{m.excusedCount}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${rateColor(m.rate)} transition-all`}
                              style={{ width: `${m.rate}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold ${rateTextColor(m.rate)} w-10 text-right`}>
                            {m.rate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2 : Build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3 : Test manuel**

`npm run dev`, ouvrir `/fr/groups/<id>/attendance` en tant qu'admin. Vérifier :
- Header avec nom du groupe + "Total séances : N · Période : depuis le DD/MM/YYYY"
- Tableau résumé avec les colonnes Élève / Présent / Absent / Excusé / Taux
- Tri par taux décroissant par défaut
- Clic sur en-tête de colonne → tri change
- Couleurs des barres : vert ≥80, jaune 60-79, rouge <60

- [ ] **Step 4 : Commit**

```bash
git add "src/app/[locale]/(dashboard)/groups/[id]/attendance/page.tsx"
git commit -m "feat: page bilan présences — header + tableau résumé triable"
```

---

## Task 3 : Matrice détaillée (lecture seule, repliable)

**Files:**
- Modify: `src/app/[locale]/(dashboard)/groups/[id]/attendance/page.tsx`

- [ ] **Step 1 : Importer Collapsible + Badge + ChevronDown**

Modifier la ligne d'imports lucide-react pour ajouter `ChevronDown` et `CheckCircle2`, `Circle`, `X`, et ajouter les imports Collapsible + Badge. Remplacer la ligne actuelle :

```tsx
import { ArrowLeft, Users, ArrowUpDown, Calendar } from 'lucide-react'
```

par :

```tsx
import { ArrowLeft, Users, ArrowUpDown, Calendar, ChevronDown, CheckCircle2, Circle, X } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
```

- [ ] **Step 2 : Ajouter le state `matrixOpen`**

Juste après le state `sortDir` (ligne ~75), ajouter :

```tsx
  const [matrixOpen, setMatrixOpen] = useState(false)
```

- [ ] **Step 3 : Ajouter la matrice sous la carte résumé**

Juste avant la fermeture du `<div className="space-y-6 max-w-6xl mx-auto">` (avant le `</div>` final qui ferme le wrapper principal), ajouter :

```tsx
      {/* Detailed matrix */}
      {data.totalSessions > 0 && sortedMembers.length > 0 && (
        <Collapsible open={matrixOpen} onOpenChange={setMatrixOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Détail par séance</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${matrixOpen ? 'rotate-180' : ''}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[70vh]">
                  <table className="border-collapse">
                    <thead className="sticky top-0 z-20 bg-background">
                      <tr>
                        <th className="sticky left-0 z-30 bg-background border-b border-r px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase w-48">
                          Élève
                        </th>
                        {data.sessions.map(s => {
                          const d = new Date(s.date)
                          const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                          return (
                            <th
                              key={s.id}
                              className="border-b px-2 py-2 text-center text-xs font-semibold text-muted-foreground min-w-[58px]"
                              title={d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            >
                              <div>S{s.number}</div>
                              <div className="font-normal text-[10px]">{label}</div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMembers.map((m, mi) => (
                        <tr key={m.userId} className={mi % 2 === 0 ? '' : 'bg-muted/10'}>
                          <td className="sticky left-0 z-10 bg-background border-r px-3 py-2 text-sm font-medium whitespace-nowrap">
                            {m.name}
                          </td>
                          {m.perSession.map((cell, ci) => {
                            const session = data.sessions[ci]
                            const d = new Date(session.date)
                            const dateLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                            let icon = <span className="text-muted-foreground/40">–</span>
                            let stateLabel = 'Aucun enregistrement'
                            let bg = ''
                            if (cell.hasRecord) {
                              if (cell.present) {
                                icon = <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                                stateLabel = 'Présent'
                                bg = 'bg-emerald-50 dark:bg-emerald-950/30'
                              } else if (cell.excused) {
                                icon = <Circle className="h-4 w-4 text-orange-500 mx-auto" />
                                stateLabel = 'Excusé'
                                bg = 'bg-orange-50 dark:bg-orange-950/30'
                              } else {
                                icon = <X className="h-4 w-4 text-red-500 mx-auto" />
                                stateLabel = 'Absent'
                                bg = 'bg-red-50 dark:bg-red-950/30'
                              }
                            }
                            return (
                              <td
                                key={cell.sessionId}
                                className={`border-l px-2 py-2 text-center ${bg}`}
                                title={`${stateLabel} — ${dateLabel}`}
                              >
                                {icon}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
```

- [ ] **Step 4 : Build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 5 : Test manuel**

`npm run dev`, recharger `/fr/groups/<id>/attendance`. Vérifier :
- Section "Détail par séance" apparaît sous le résumé, fermée par défaut
- Clic sur l'en-tête → déplie
- Tableau avec lignes = élèves, colonnes = séances (S1, S2, …) + date courte
- Cellules colorées : vert (présent), rouge (absent), orange (excusé), gris (aucun)
- Hover sur cellule = tooltip avec date complète + état
- Scroll horizontal si nombreuses séances
- Nom de l'élève reste collé à gauche au scroll

- [ ] **Step 6 : Commit**

```bash
git add "src/app/[locale]/(dashboard)/groups/[id]/attendance/page.tsx"
git commit -m "feat: matrice détaillée par séance dans le bilan présences (lecture seule)"
```

---

## Task 4 : Édition matrice (référent + admin)

**Files:**
- Modify: `src/app/[locale]/(dashboard)/groups/[id]/attendance/page.tsx`

Objectif : permettre au référent/admin de cliquer sur une cellule de la matrice pour cycler son état (3 états) avec sauvegarde optimiste.

- [ ] **Step 1 : Ajouter le handler `cyclePresence`**

Juste avant le `if (loading) return` (vers ligne ~110-120), ajouter :

```tsx
  const [savingCell, setSavingCell] = useState<string | null>(null)

  async function cyclePresence(userId: string, sessionId: string) {
    if (!data || !data.isReferent) return

    const memberIdx = data.members.findIndex(m => m.userId === userId)
    if (memberIdx < 0) return
    const cellIdx = data.members[memberIdx].perSession.findIndex(p => p.sessionId === sessionId)
    if (cellIdx < 0) return
    const current = data.members[memberIdx].perSession[cellIdx]

    // Cycle: Present → Absent → Excused → Present
    let next: { present: boolean; excused: boolean }
    if (current.present) {
      next = { present: false, excused: false }
    } else if (!current.excused) {
      next = { present: false, excused: true }
    } else {
      next = { present: true, excused: false }
    }

    // Optimistic local update + recompute counts/rate for this member
    const previous = data
    const newPerSession = [...data.members[memberIdx].perSession]
    newPerSession[cellIdx] = {
      sessionId,
      present: next.present,
      excused: next.excused,
      hasRecord: true,
    }
    const presentCount = newPerSession.filter(p => p.present).length
    const excusedCount = newPerSession.filter(p => !p.present && p.excused).length
    const absentCount = data.totalSessions - presentCount - excusedCount
    const rate = data.totalSessions > 0 ? Math.round((presentCount / data.totalSessions) * 100) : 0

    const newMembers = [...data.members]
    newMembers[memberIdx] = {
      ...data.members[memberIdx],
      perSession: newPerSession,
      presentCount,
      excusedCount,
      absentCount,
      rate,
    }
    setData({ ...data, members: newMembers })
    setSavingCell(`${userId}:${sessionId}`)

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendance: [{ userId, present: next.present, excused: next.excused }],
        }),
      })
      if (!res.ok) throw new Error('PUT failed')
    } catch (err) {
      console.error('Error saving attendance:', err)
      setData(previous) // rollback
      alert('Erreur lors de la sauvegarde')
    } finally {
      setTimeout(() => {
        setSavingCell(prev => prev === `${userId}:${sessionId}` ? null : prev)
      }, 600)
    }
  }
```

- [ ] **Step 2 : Rendre les cellules cliquables si isReferent**

Dans le tableau matrice ajouté au Task 3, remplacer le bloc `<td key={cell.sessionId} ...>{icon}</td>` par :

```tsx
                            const cellKey = `${m.userId}:${cell.sessionId}`
                            const isSaving = savingCell === cellKey
                            return (
                              <td
                                key={cell.sessionId}
                                className={`border-l px-2 py-2 text-center ${bg} ${data.isReferent ? 'cursor-pointer hover:opacity-70' : ''} ${isSaving ? 'opacity-50' : ''}`}
                                title={data.isReferent ? `${stateLabel} — ${dateLabel} — cliquer pour changer` : `${stateLabel} — ${dateLabel}`}
                                onClick={data.isReferent ? () => cyclePresence(m.userId, cell.sessionId) : undefined}
                              >
                                {icon}
                              </td>
                            )
```

Note : l'ancien `return (<td ...>{icon}</td>)` devient cette version étendue. Garder l'arrow function du `.map(...)`.

- [ ] **Step 3 : Ajouter un hint dans le titre de la matrice**

Modifier le `<CardTitle>` de la section matrice pour ajouter le hint quand l'utilisateur est référent. Remplacer :

```tsx
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Détail par séance</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${matrixOpen ? 'rotate-180' : ''}`} />
                </CardTitle>
```

par :

```tsx
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Détail par séance
                    {data.isReferent && (
                      <span className="text-xs font-normal text-muted-foreground">
                        Clic = Présent → Absent → Excusé
                      </span>
                    )}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${matrixOpen ? 'rotate-180' : ''}`} />
                </CardTitle>
```

- [ ] **Step 4 : Build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 5 : Test manuel — édition admin**

`npm run dev`, connecté en admin sur `/fr/groups/<id>/attendance`. Déplier la matrice. Cliquer sur une cellule présente :
- Visuellement bascule en rouge (absent)
- Le résumé en haut met à jour le `Présent X / N` et le taux
- Recharger la page → l'état persiste
- Cliquer encore : devient orange (excusé)
- Cliquer encore : redevient vert (présent)

Test rollback : couper le réseau (DevTools → Network → Offline), cliquer une cellule → doit revenir à l'état précédent + toast/alert d'erreur.

- [ ] **Step 6 : Test manuel — non-référent**

Se connecter en élève simple membre du groupe. Cellules pas cliquables (cursor default, pas de hover).

- [ ] **Step 7 : Commit**

```bash
git add "src/app/[locale]/(dashboard)/groups/[id]/attendance/page.tsx"
git commit -m "feat: édition matrice présences pour référent/admin (cycle 3 états + autosave)"
```

---

## Task 5 : Liens vers le bilan depuis mastery et page séance

**Files:**
- Modify: `src/app/[locale]/(dashboard)/groups/[id]/mastery/page.tsx`
- Modify: `src/app/[locale]/(dashboard)/groups/[id]/sessions/[num]/page.tsx`

- [ ] **Step 1 : Ajouter bouton "Bilan présences" sur la page mastery**

Dans `src/app/[locale]/(dashboard)/groups/[id]/mastery/page.tsx`, trouver le bouton "Voir séance" (autour de la ligne 1909-1914). Juste après son `</Link>` de fermeture, ajouter :

```tsx
            <Link href={`/${locale}/groups/${groupId}/attendance`}>
              <Button variant="outline" size="sm" className="h-8 text-sm">
                <Users className="h-4 w-4 mr-1" />
                Bilan présences
              </Button>
            </Link>
```

Note : `Users` est déjà importé dans ce fichier (vérifier ligne 34).

- [ ] **Step 2 : Ajouter bouton "Bilan présences" sur la page séance**

Dans `src/app/[locale]/(dashboard)/groups/[id]/sessions/[num]/page.tsx`, trouver la zone des boutons d'action dans le header (autour de la ligne 880-900, après le bouton "Rapport PDF"). Juste avant ou après le `Link` de "Rapport PDF", ajouter :

```tsx
          <Link href={`/${locale}/groups/${groupId}/attendance`}>
            <Button variant="outline" size="sm">
              <Users className="h-4 w-4 mr-1" />
              Bilan présences
            </Button>
          </Link>
```

Note : `Users` et `Link` sont déjà importés (vérifier les lignes 25-46).

- [ ] **Step 3 : Build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 4 : Test manuel**

`npm run dev`. Sur `/fr/groups/<id>/mastery` → cliquer "Bilan présences" → arrive sur la page bilan. Idem depuis `/fr/groups/<id>/sessions/14`.

- [ ] **Step 5 : Commit**

```bash
git add "src/app/[locale]/(dashboard)/groups/[id]/mastery/page.tsx" "src/app/[locale]/(dashboard)/groups/[id]/sessions/[num]/page.tsx"
git commit -m "feat: liens 'Bilan présences' depuis mastery et page séance"
```

---

## Task 6 : Vérification finale + déploiement

- [ ] **Step 1 : Lint sur les fichiers modifiés**

Run: `npm run lint 2>&1 | grep -E "attendance-summary|groups.\[id\].attendance"`
Expected: aucune erreur nouvellement introduite (les avertissements pré-existants sont normaux).

- [ ] **Step 2 : Build complet**

Run: `npm run build`
Expected: build OK, pas d'erreur TS.

- [ ] **Step 3 : Smoke test multi-rôle**

`npm run dev`. Connecté en admin :
- Ouvrir `/fr/groups/<groupeAvecSéances>/attendance`
- Vérifier résumé + matrice
- Cliquer 2-3 cellules différentes, vérifier que les taux du résumé suivent
- F5, vérifier la persistance

- [ ] **Step 4 : Vérifier git status propre**

Run: `git status -s src/app/api/groups/\[id\]/attendance-summary src/app/[locale]/\(dashboard\)/groups/\[id\]/attendance src/app/[locale]/\(dashboard\)/groups/\[id\]/mastery/page.tsx src/app/[locale]/\(dashboard\)/groups/\[id\]/sessions/\[num\]/page.tsx`
Expected: aucune sortie (tout commité).

- [ ] **Step 5 : Merge feature branch + push + déploiement VPS**

```bash
git checkout master
git merge --no-ff feature/group-attendance-summary -m "Merge feature/group-attendance-summary: page bilan + matrice éditable"
git push origin master
ssh root@72.61.105.112 "cd /opt/amilou && git pull && docker-compose down && docker-compose up -d --build"
```

Note : aucune migration Prisma (zéro changement de schéma).
