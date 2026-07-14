# Amélioration de l'onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guider le nouvel arrivant avec une checklist sur le dashboard, lui permettre de rejoindre (par code) ou créer un groupe (référent participant ou superviseur), configurer sa zone de mémorisation, et garantir un usage sans groupe non bloquant.

**Architecture:** Un composant `OnboardingChecklist` autonome (fetch `/api/me` étendu) remplace la bannière actuelle du dashboard. Il ouvre une modale `JoinOrCreateGroupDialog` (onglets Rejoindre/Créer) branchée sur les API existantes `/api/join` et `POST /api/groups`. Extensions serveur minimales : `/api/me` expose `hasGroup`/`hasMemorizationZone`, `POST /api/groups` honore `isStudent`.

**Tech Stack:** Next.js 16 App Router (route handlers + composants client React 19), Prisma, shadcn/ui (`Dialog`, `Tabs`, `Input`, `Label`, `Button`, `Card`), `sonner` (`toast`), next-intl.

## Global Constraints

- Aucun framework de test dans le repo (`package.json` n'a pas de script `test`). Vérification par tâche = `npx tsc --noEmit` + `npm run lint` (ne considérer que les **nouvelles** alertes sur les fichiers touchés ; le repo a des alertes préexistantes) + vérification manuelle décrite.
- Aucune nouvelle dépendance npm. `Dialog`, `Tabs`, `Input`, `Label`, `Button`, `Card` (shadcn) et `toast` (`sonner`) sont déjà présents.
- Aucun changement de schéma Prisma.
- Textes UI et messages d'erreur API en **français**.
- Thème visuel existant : boutons primaires `bg-emerald-600 hover:bg-emerald-700`, cartes shadcn. Suivre ce style.
- Impersonation : les API utilisent `getEffectiveUserId()` ; ne pas casser ce comportement.
- Le `inviteCode` de groupe fait 6 caractères hex **majuscules** (ex: `A3F9C1`).
- Rétrocompatibilité : `POST /api/groups` sans `isStudent` doit continuer de créer un référent **participant** (`isStudent=true`).

---

### Task 1: Étendre `GET /api/me` (hasGroup, hasMemorizationZone)

**Files:**
- Modify: `src/app/api/me/route.ts`

**Interfaces:**
- Produces: `GET /api/me` renvoie, en plus des champs actuels, `hasGroup: boolean` et `hasMemorizationZone: boolean`. Consommé par la checklist (Task 5).

- [ ] **Step 1: Ajouter `memorizationStartSurah` au select et calculer les deux booléens**

Dans `src/app/api/me/route.ts`, remplacer le bloc `findUnique` + `return` par :

```ts
    const user = await prisma.user.findUnique({
      where: { id: userId! },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        hasSeenOnboarding: true,
        memorizationStartDate: true,
        memorizationStartSurah: true,
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    const groupCount = await prisma.groupMember.count({ where: { userId: userId! } })

    return NextResponse.json({
      ...user,
      isImpersonating,
      hasGroup: groupCount > 0,
      hasMemorizationZone: user.memorizationStartSurah !== null,
    })
```

- [ ] **Step 2: Vérifier compilation et lint**

```bash
npx tsc --noEmit
npx eslint src/app/api/me/route.ts
```
Attendu : aucune nouvelle erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/me/route.ts
git commit -m "feat(api): /api/me expose hasGroup et hasMemorizationZone pour l'onboarding"
```

---

### Task 2: `POST /api/groups` — honorer `isStudent`

**Files:**
- Modify: `src/app/api/groups/route.ts` (handler `POST`, ~lignes 115-131)

**Interfaces:**
- Produces: `POST /api/groups { name, description?, sessionFrequency?, isStudent? }` crée le référent créateur avec `isStudent` (défaut `true` si absent). Consommé par la modale (Task 4).

- [ ] **Step 1: Lire `isStudent` du body et le passer à la création du membre**

Dans `POST`, remplacer :

```ts
    const { name, description, sessionFrequency } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Nom du groupe requis' }, { status: 400 })
    }

    // Create group and add creator as referent
    const group = await prisma.group.create({
      data: {
        name,
        description,
        sessionFrequency: sessionFrequency || 'WEEKLY',
        members: {
          create: {
            userId: session.user.id,
            role: 'REFERENT',
          },
        },
      },
```

par :

```ts
    const { name, description, sessionFrequency, isStudent } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Nom du groupe requis' }, { status: 400 })
    }

    // Create group and add creator as referent (participant élève par défaut)
    const group = await prisma.group.create({
      data: {
        name,
        description,
        sessionFrequency: sessionFrequency || 'WEEKLY',
        members: {
          create: {
            userId: session.user.id,
            role: 'REFERENT',
            isStudent: isStudent !== false,
          },
        },
      },
```

- [ ] **Step 2: Vérifier compilation et lint**

```bash
npx tsc --noEmit
npx eslint src/app/api/groups/route.ts
```
Attendu : aucune nouvelle erreur.

- [ ] **Step 3: Vérification manuelle (curl, admin ou user connecté)**

```bash
curl -X POST http://localhost:3100/api/groups -H 'Content-Type: application/json' -b '<cookie>' \
  -d '{"name":"Test Superviseur","isStudent":false}'
```
Attendu : `200`, groupe créé. Vérifier en base que le `GroupMember` du créateur a `role=REFERENT` et `isStudent=false`. Rejouer sans `isStudent` → `isStudent=true`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/groups/route.ts
git commit -m "feat(api): POST /api/groups honore isStudent (referent participant vs superviseur)"
```

---

### Task 3: Ancre `#zone-memorisation` dans Paramètres

**Files:**
- Modify: `src/app/[locale]/(dashboard)/settings/page.tsx` (section « Zone de mémorisation », ~ligne 909 ; + effet de défilement)

**Interfaces:**
- Produces: naviguer vers `/settings#zone-memorisation` fait défiler jusqu'à la section zone. Utilisé par la checklist (Task 5).

- [ ] **Step 1: Ajouter l'`id` sur la carte « Zone de mémorisation »**

Dans `settings/page.tsx`, la section est la carte commentée `{/* Memorization Start Settings Card */}` (~ligne 904-905). Remplacer :

```tsx
      {/* Memorization Start Settings Card */}
      <Card>
```

par :

```tsx
      {/* Memorization Start Settings Card */}
      <Card id="zone-memorisation" className="scroll-mt-24">
```

- [ ] **Step 2: Défiler vers l'ancre au chargement si le hash est présent**

Dans le composant de la page Paramètres, ajouter un `useEffect` (après les autres hooks, avant tout `return` conditionnel — respecter l'ordre des hooks) :

```tsx
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#zone-memorisation') {
      const el = document.getElementById('zone-memorisation')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])
```

Note : ce `useEffect` doit être placé au même niveau que les autres hooks du composant (jamais après un `if (loading) return`).

- [ ] **Step 3: Vérifier compilation et lint**

```bash
npx tsc --noEmit
npx eslint "src/app/[locale]/(dashboard)/settings/page.tsx"
```
Attendu : aucune nouvelle erreur.

- [ ] **Step 4: Vérification manuelle**

`npm run dev`, ouvrir `http://localhost:3100/fr/settings#zone-memorisation` → la page défile jusqu'à la section « Zone de mémorisation ».

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/(dashboard)/settings/page.tsx"
git commit -m "feat(settings): ancre #zone-memorisation avec defilement"
```

---

### Task 4: Composant `JoinOrCreateGroupDialog`

**Files:**
- Create: `src/components/onboarding/JoinOrCreateGroupDialog.tsx`

**Interfaces:**
- Consumes: `GET /api/join?code=` + `POST /api/join` (Task existante), `POST /api/groups` (Task 2).
- Produces: composant
  `JoinOrCreateGroupDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void })`.
  `onDone` est appelé après une adhésion/création réussie (pour rafraîchir la checklist — Task 5).

- [ ] **Step 1: Créer le composant**

Créer `src/components/onboarding/JoinOrCreateGroupDialog.tsx` :

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}

export function JoinOrCreateGroupDialog({ open, onOpenChange, onDone }: Props) {
  // --- Rejoindre ---
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [foundGroup, setFoundGroup] = useState<{ id: string; name: string; description: string | null } | null>(null)
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(false)

  async function verifyCode() {
    const c = code.trim().toUpperCase()
    if (!c) return
    setChecking(true)
    setJoinError('')
    setFoundGroup(null)
    try {
      const res = await fetch(`/api/join?code=${encodeURIComponent(c)}`)
      const data = await res.json()
      if (res.ok) setFoundGroup(data)
      else setJoinError(data.error || 'Code invalide')
    } catch {
      setJoinError('Erreur réseau')
    } finally {
      setChecking(false)
    }
  }

  async function joinGroup() {
    const c = code.trim().toUpperCase()
    setJoining(true)
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Vous avez rejoint le groupe')
        onOpenChange(false)
        onDone()
      } else {
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setJoining(false)
    }
  }

  // --- Créer ---
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [role, setRole] = useState<'student' | 'supervisor'>('student')
  const [creating, setCreating] = useState(false)

  async function createGroup() {
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          isStudent: role === 'student',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Groupe créé')
        onOpenChange(false)
        onDone()
      } else {
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rejoindre ou créer un groupe</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="join" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="join">Rejoindre</TabsTrigger>
            <TabsTrigger value="create">Créer</TabsTrigger>
          </TabsList>

          <TabsContent value="join" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="join-code">Code d&apos;invitation</Label>
              <div className="flex gap-2">
                <Input
                  id="join-code"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setFoundGroup(null); setJoinError('') }}
                  placeholder="A3F9C1"
                  maxLength={6}
                  className="uppercase tracking-widest"
                />
                <Button variant="outline" onClick={verifyCode} disabled={checking || !code.trim()}>
                  {checking ? '...' : 'Vérifier'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Demandez le code à 6 caractères à votre référent.</p>
            </div>
            {joinError && <p className="text-sm text-red-600">{joinError}</p>}
            {foundGroup && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="font-medium">{foundGroup.name}</p>
                {foundGroup.description && <p className="text-sm text-muted-foreground">{foundGroup.description}</p>}
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={joinGroup} disabled={joining}>
                  {joining ? 'Inscription...' : 'Rejoindre ce groupe'}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="create" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="create-name">Nom du groupe</Label>
              <Input id="create-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mon groupe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-desc">Description (optionnel)</Label>
              <Input id="create-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Votre rôle dans ce groupe</Label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="role" checked={role === 'student'} onChange={() => setRole('student')} />
                Je participe aussi comme élève
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="role" checked={role === 'supervisor'} onChange={() => setRole('supervisor')} />
                Je supervise seulement
              </label>
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={createGroup} disabled={creating || !name.trim()}>
              {creating ? 'Création...' : 'Créer le groupe'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Vérifier compilation et lint**

```bash
npx tsc --noEmit
npx eslint src/components/onboarding/JoinOrCreateGroupDialog.tsx
```
Attendu : aucune erreur. Si `Tabs`/`TabsContent` n'ont pas exactement ces exports, vérifier `src/components/ui/tabs.tsx` et ajuster les noms importés.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/JoinOrCreateGroupDialog.tsx
git commit -m "feat(onboarding): modale rejoindre (code) ou creer un groupe (role au choix)"
```

---

### Task 5: Composant `OnboardingChecklist` + intégration au dashboard

**Files:**
- Create: `src/components/onboarding/OnboardingChecklist.tsx`
- Modify: `src/app/[locale]/(dashboard)/dashboard/page.tsx` (remplacer la bannière ~lignes 3231-3252 ; nettoyer l'état `showOnboardingBanner` ~lignes 894-901)

**Interfaces:**
- Consumes: `GET /api/me` (Task 1 : `hasSeenOnboarding`, `hasGroup`, `hasMemorizationZone`), `PUT /api/user/profile { hasSeenOnboarding }` (existant), `JoinOrCreateGroupDialog` (Task 4).
- Produces: composant `OnboardingChecklist({ locale }: { locale: string })`, autonome (gère son propre fetch et sa visibilité).

- [ ] **Step 1: Créer le composant**

Créer `src/components/onboarding/OnboardingChecklist.tsx` :

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, X } from 'lucide-react'
import { JoinOrCreateGroupDialog } from './JoinOrCreateGroupDialog'

interface MeState {
  hasSeenOnboarding: boolean
  hasGroup: boolean
  hasMemorizationZone: boolean
}

export function OnboardingChecklist({ locale }: { locale: string }) {
  const [me, setMe] = useState<MeState | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)

  async function refresh() {
    try {
      const res = await fetch('/api/me')
      const d = await res.json()
      setMe({
        hasSeenOnboarding: d.hasSeenOnboarding === true,
        hasGroup: d.hasGroup === true,
        hasMemorizationZone: d.hasMemorizationZone === true,
      })
    } catch { /* silencieux */ }
  }

  useEffect(() => { refresh() }, [])

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

  const Item = ({ done, label, hint, action }: { done: boolean; label: string; hint?: string; action?: React.ReactNode }) => (
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
          <Item
            done={true}
            label="Suivre mon avancement"
            hint="C'est déjà possible — commence quand tu veux, un groupe n'est pas requis."
          />
          <Item
            done={me.hasGroup}
            label="Rejoindre ou créer un groupe"
            action={
              <Button size="sm" variant="outline" onClick={() => setGroupDialogOpen(true)}>
                Rejoindre / Créer
              </Button>
            }
          />
          <Item
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
```

- [ ] **Step 2: Retirer l'ancien état de bannière du dashboard**

Dans `src/app/[locale]/(dashboard)/dashboard/page.tsx`, supprimer le `useEffect` et l'état de la bannière (~lignes 894-901) :

```tsx
  // Check onboarding status — show welcome banner for new users
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false)
  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (d.hasSeenOnboarding === false) setShowOnboardingBanner(true)
      setOnboardingChecked(true)
    }).catch(() => setOnboardingChecked(true))
  }, [])
```

Remplacer par (on conserve `setOnboardingChecked` s'il est utilisé ailleurs) :

```tsx
  // Onboarding : la checklist gère elle-même son état (composant OnboardingChecklist)
  useEffect(() => { setOnboardingChecked(true) }, [])
```

Note : vérifier les usages de `showOnboardingBanner` et `onboardingChecked`. Si `onboardingChecked` n'est plus utilisé nulle part, retirer aussi son `useState`. Ne pas laisser de variable référencée mais non déclarée.

- [ ] **Step 3: Importer et rendre `OnboardingChecklist` à la place de la bannière**

En tête de `dashboard/page.tsx`, ajouter l'import :

```tsx
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist'
```

Remplacer tout le bloc de la bannière (~lignes 3231-3252, de `{/* Onboarding banner for new users */}` jusqu'à la fermeture `)}` du bloc `showOnboardingBanner && (...)`) par :

```tsx
      {/* Onboarding checklist for new users */}
      <OnboardingChecklist locale={locale} />
```

(`locale` est déjà disponible dans le composant dashboard via `useLocale()` — vérifier qu'il est bien en portée à cet endroit ; sinon le récupérer via `const locale = useLocale()` en tête du composant.)

- [ ] **Step 4: Vérifier compilation, lint et build**

```bash
npx tsc --noEmit
npx eslint src/components/onboarding/OnboardingChecklist.tsx "src/app/[locale]/(dashboard)/dashboard/page.tsx"
npm run build
```
Attendu : compile ; pas de nouvelle erreur ; build OK (115 pages).

- [ ] **Step 5: Vérification manuelle**

`npm run dev`, connecté en **nouvel utilisateur** (sans groupe, sans zone) :
- La checklist s'affiche, 1er item coché, deux autres décochés, compteur « 0/2 ».
- « Rejoindre / Créer » ouvre la modale (Task 4). Rejoindre par code valide → item « groupe » coché, compteur « 1/2 » (sans recharger la page, via `onDone`→`refresh`).
- « Configurer » → arrive sur `/settings#zone-memorisation` ; après réglage et retour au dashboard, item « zone » coché.
- « Masquer » (X) → la carte disparaît et ne réapparaît pas au rechargement (`hasSeenOnboarding=true`).

- [ ] **Step 6: Commit**

```bash
git add src/components/onboarding/OnboardingChecklist.tsx "src/app/[locale]/(dashboard)/dashboard/page.tsx"
git commit -m "feat(onboarding): checklist dashboard (avancement/groupe/zone) remplace la banniere"
```

---

### Task 6: Usage sans groupe — vérification de non-blocage + masquage

**Files:**
- Modify (si nécessaire) : `src/app/[locale]/(dashboard)/dashboard/page.tsx` et/ou pages listées, **uniquement** si un blocage réel est constaté.

**Interfaces:**
- Consumes: rien de nouveau.
- Produces: garantie qu'un utilisateur sans groupe n'a aucun écran bloquant ; les sections strictement liées au groupe ne s'affichent pas vides.

- [ ] **Step 1: Parcourir l'app en utilisateur sans groupe**

`npm run dev`, connecté en utilisateur **sans aucun `GroupMember`**. Ouvrir successivement : `/fr/dashboard`, `/fr/progress`, `/fr/attendance`, `/fr/sessions`, `/fr/evaluations`, `/fr/groups`. Pour chacune, noter s'il y a un **écran d'erreur / plantage** (overlay Runtime Error de Next, page blanche, exception console bloquante).

Attendu de référence : le dashboard se charge (avec la checklist) ; la section « Classement Groupe - Mémorisation » **ne s'affiche pas** (elle retourne déjà `null` si `!groupRanking?.groups?.length`) ; `/progress` permet d'ajouter une entrée solo.

- [ ] **Step 2: Confirmer l'ajout d'avancement solo**

En utilisateur sans groupe, sur `/fr/progress`, ajouter une entrée MEMORIZATION. Attendu : l'entrée apparaît dans le tableau (le `Progress` est créé ; la récitation de séance est simplement sautée faute de groupe). Aucune erreur.

- [ ] **Step 3: Corriger uniquement les blocages réels constatés**

Pour chaque page qui **plante** ou affiche un écran d'erreur (et non un simple état vide, qui est acceptable) : appliquer un garde minimal. Pattern à suivre (déjà utilisé pour `group-ranking`) : une section dépendante du groupe retourne `null` quand ses données sont vides, p. ex.

```tsx
if (!groupData?.length) return null
```

Ne PAS masquer les sections non liées au groupe (Tafsir, Livres, Hadiths, etc.) — hors périmètre (chantier dashboard séparé). Ne corriger que les **plantages**.

- [ ] **Step 4: Vérifier compilation, lint et build (si code modifié)**

```bash
npx tsc --noEmit
npm run build
```
Attendu : OK. Si aucun code n'a dû être modifié (aucun blocage constaté), l'indiquer dans le rapport et passer au commit de documentation éventuel (ou aucun commit).

- [ ] **Step 5: Commit (si des corrections ont été faites)**

```bash
git add -A
git commit -m "fix(dashboard): pas de blocage ni de section groupe vide pour un utilisateur sans groupe"
```

Si aucune correction n'a été nécessaire, ne pas créer de commit vide ; noter dans le rapport que la vérification est passée sans changement.

---

## Couverture de la spec

| Exigence spec | Tâche |
|---|---|
| §1 `/api/me` expose `hasGroup`, `hasMemorizationZone` | Task 1 |
| §4 `POST /api/groups` honore `isStudent` | Task 2 |
| §5 Ancre `#zone-memorisation` dans Paramètres | Task 3 |
| §3 Modale Rejoindre (code) / Créer (rôle) | Task 4 |
| §2 Carte checklist remplaçant la bannière | Task 5 |
| §6 Non-blocage sans groupe + masquage section groupe | Task 6 |

Hors périmètre (conforme à la spec) : refonte globale du dashboard, doublons (« Mes Livres », « Programmes Journaliers »), vérification email, auto-login — traités ailleurs.

## Vérification finale (après toutes les tâches)

Reprendre le scénario de la section « Vérification » de la spec sur une base jetable (Docker Postgres + `.env.local`, cf. pratique établie), en Playwright si possible : nouvel utilisateur → checklist → rejoindre par code / créer (participant et superviseur) → zone → masquer → parcours sans groupe non bloquant.
