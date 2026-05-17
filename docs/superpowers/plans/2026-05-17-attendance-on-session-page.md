# Section Présences sur la page séance — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une section Présences éditable (Présent / Absent / Excusé) sur la page `/groups/[id]/sessions/[num]`, avec autosave optimiste alignée sur la règle d'inclusion membres déjà appliquée à la création de séance.

**Architecture:** Un fetch supplémentaire vers `GET /api/sessions/[id]` après obtention du `currentSessionId` charge les enregistrements `SessionAttendance`. Une nouvelle carte React au-dessus de "Points abordés" affiche la grille et gère le cycle 3 états. Le `PUT /api/sessions/[id]` existant est corrigé pour faire un **upsert** au lieu d'un `updateMany`, afin que les membres ajoutés après la création de la séance soient pris en compte.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma, shadcn/ui, Tailwind. Pas de framework de test dans le projet — vérification via `npm run build` (typecheck) + `npm run lint` + test manuel sur `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-05-17-attendance-on-session-page-design.md`

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `src/app/api/sessions/[id]/route.ts` | Corriger PUT pour upsert SessionAttendance |
| `src/app/[locale]/(dashboard)/groups/[id]/sessions/[num]/page.tsx` | State attendance + fetch + carte Présences + entrée table des matières |

Tout le travail UI tient dans un seul fichier (la page séance, déjà à 1772 lignes — pas de refactor unilatéral, on respecte le pattern). Le seul changement API est local au PUT de la route session.

---

## Task 1 : Corriger PUT /api/sessions/[id] pour upsert l'attendance

**Files:**
- Modify: `src/app/api/sessions/[id]/route.ts:187-201`

**Problème :** L'implémentation actuelle utilise `prisma.sessionAttendance.updateMany` (ligne 189). Si un membre a été ajouté au groupe **après** la création de la séance, il n'a pas d'enregistrement `SessionAttendance`, et `updateMany` n'en crée pas — l'appel réussit silencieusement sans rien faire.

**Solution :** Utiliser `upsert` avec la clé composée `(sessionId, userId)`. Cette clé doit exister comme contrainte unique dans le schéma Prisma.

- [ ] **Step 1 : Vérifier la contrainte unique sur SessionAttendance**

Run:
```bash
grep -nE "model SessionAttendance|@@unique" prisma/schema.prisma | head -20
```

Expected: il doit y avoir un `@@unique([sessionId, userId])` dans le modèle `SessionAttendance`. Si absent, l'ajouter et faire `npx prisma db push` avant de continuer.

- [ ] **Step 2 : Remplacer `updateMany` par `upsert`**

Dans `src/app/api/sessions/[id]/route.ts`, remplacer le bloc lignes 187-201 :

```ts
    // Update attendance records
    if (attendance && Array.isArray(attendance)) {
      for (const att of attendance) {
        await prisma.sessionAttendance.updateMany({
          where: {
            sessionId: id,
            userId: att.userId,
          },
          data: {
            present: att.present ?? false,
            excused: att.excused ?? false,
            note: att.note,
          },
        })
      }
    }
```

par :

```ts
    // Upsert attendance records (create if missing - handles members added after session creation)
    if (attendance && Array.isArray(attendance)) {
      for (const att of attendance) {
        await prisma.sessionAttendance.upsert({
          where: {
            sessionId_userId: {
              sessionId: id,
              userId: att.userId,
            },
          },
          create: {
            sessionId: id,
            userId: att.userId,
            present: att.present ?? false,
            excused: att.excused ?? false,
            note: att.note ?? null,
          },
          update: {
            present: att.present ?? false,
            excused: att.excused ?? false,
            note: att.note,
          },
        })
      }
    }
```

Note : `sessionId_userId` est le nom auto-généré par Prisma pour `@@unique([sessionId, userId])`. Si la contrainte unique utilise un autre nom, ajuster.

- [ ] **Step 3 : Vérifier que le build passe**

Run: `npm run build`
Expected: build réussit sans erreur TypeScript. En particulier pas d'erreur du type `Property 'sessionId_userId' does not exist on type ...`.

- [ ] **Step 4 : Commit**

```bash
git add src/app/api/sessions/[id]/route.ts
git commit -m "Fix: upsert SessionAttendance dans PUT /api/sessions/[id] (membres ajoutés après création)"
```

---

## Task 2 : Charger l'attendance de la séance dans la page

**Files:**
- Modify: `src/app/[locale]/(dashboard)/groups/[id]/sessions/[num]/page.tsx`

**Objectif :** Ajouter un state local `sessionAttendance` et un effet qui le remplit quand `currentSessionId` devient disponible.

- [ ] **Step 1 : Ajouter le type AttendanceEntry**

Dans la zone des interfaces (vers ligne 47-130), ajouter :

```ts
interface AttendanceEntry {
  userId: string
  userName: string
  present: boolean
  excused: boolean
}
```

- [ ] **Step 2 : Ajouter le state `sessionAttendance`**

Juste après la déclaration de `currentSessionId` (ligne 179), ajouter :

```ts
  // Session attendance
  const [sessionAttendance, setSessionAttendance] = useState<AttendanceEntry[]>([])
  const [savingAttendanceFor, setSavingAttendanceFor] = useState<string | null>(null)
```

- [ ] **Step 3 : Ajouter un `useEffect` pour charger l'attendance**

Juste après le `useEffect` principal (vers ligne 240-241), ajouter :

```ts
  useEffect(() => {
    if (!currentSessionId) return
    let cancelled = false
    fetch(`/api/sessions/${currentSessionId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data?.attendance) return
        setSessionAttendance(
          data.attendance.map((a: { userId: string; present: boolean; excused: boolean; user: { name: string } }) => ({
            userId: a.userId,
            userName: a.user?.name ?? '',
            present: a.present,
            excused: a.excused,
          }))
        )
      })
      .catch(err => console.error('Error fetching attendance:', err))
    return () => { cancelled = true }
  }, [currentSessionId])
```

- [ ] **Step 4 : Vérifier que le build passe**

Run: `npm run build`
Expected: build OK, pas d'erreur TS.

- [ ] **Step 5 : Test manuel rapide**

Run: `npm run dev` puis ouvrir une page séance (ex. `/fr/groups/<id>/sessions/14`). Ouvrir la console navigateur. Vérifier qu'aucune erreur n'apparaît.

- [ ] **Step 6 : Commit (WIP — pas encore d'UI)**

```bash
git add src/app/[locale]/\(dashboard\)/groups/\[id\]/sessions/\[num\]/page.tsx
git commit -m "WIP: charger SessionAttendance dans la page séance"
```

---

## Task 3 : Calculer la liste fusionnée membres + attendance

**Files:**
- Modify: `src/app/[locale]/(dashboard)/groups/[id]/sessions/[num]/page.tsx`

**Objectif :** Produire une vue normalisée combinant `members` (élèves actifs du groupe) et `sessionAttendance` (enregistrements existants), de sorte qu'un membre actif sans enregistrement apparaisse comme `{present: false, excused: false}`.

- [ ] **Step 1 : Ajouter `useMemo` pour la liste fusionnée**

Juste avant le bloc `if (loading) return ...` (vers ligne 691), ajouter :

```ts
  // Merge active members with their attendance record (or default to absent if missing)
  const attendanceByUser = React.useMemo(() => {
    const map = new Map<string, AttendanceEntry>()
    sessionAttendance.forEach(a => map.set(a.userId, a))
    return map
  }, [sessionAttendance])

  const presenceList = React.useMemo(() => {
    return members.map(m => {
      const existing = attendanceByUser.get(m.id)
      return {
        userId: m.id,
        userName: m.name,
        present: existing?.present ?? false,
        excused: existing?.excused ?? false,
      }
    })
  }, [members, attendanceByUser])

  const presentCount = presenceList.filter(p => p.present).length
  const absentUnexcused = presenceList.filter(p => !p.present && !p.excused)
```

**Important :** Ce `useMemo` doit être placé AVANT tout `if (loading) return`. Voir la mémoire projet « React hooks before early returns ».

- [ ] **Step 2 : Vérifier que le build passe**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3 : Commit**

```bash
git add src/app/[locale]/\(dashboard\)/groups/\[id\]/sessions/\[num\]/page.tsx
git commit -m "WIP: calcul liste fusionnée membres+attendance pour la séance"
```

---

## Task 4 : Ajouter le handler de cycle 3 états + autosave optimiste

**Files:**
- Modify: `src/app/[locale]/(dashboard)/groups/[id]/sessions/[num]/page.tsx`

**Objectif :** Une fonction `cyclePresence(userId)` qui :
1. Lit l'état courant (depuis `presenceList`)
2. Calcule l'état suivant dans le cycle Présent → Absent → Excusé → Présent
3. Met à jour `sessionAttendance` localement (optimiste)
4. POST vers PUT /api/sessions/[id] avec uniquement cet utilisateur
5. En cas d'échec, rollback et alert

- [ ] **Step 1 : Ajouter la fonction `cyclePresence`**

Juste après les `useMemo` ajoutés au Task 3, ajouter :

```ts
  async function cyclePresence(userId: string) {
    if (!isReferent || !currentSessionId) return

    const current = presenceList.find(p => p.userId === userId)
    if (!current) return

    // Cycle: Présent(P) → Absent(A) → Excusé(E) → Présent
    let next: { present: boolean; excused: boolean }
    if (current.present) {
      next = { present: false, excused: false } // P → A
    } else if (!current.excused) {
      next = { present: false, excused: true } // A → E
    } else {
      next = { present: true, excused: false } // E → P
    }

    // Optimistic update: build the new attendance list with this user updated
    const previousAttendance = sessionAttendance
    const updatedList: AttendanceEntry[] = [
      ...sessionAttendance.filter(a => a.userId !== userId),
      { userId, userName: current.userName, present: next.present, excused: next.excused },
    ]
    setSessionAttendance(updatedList)
    setSavingAttendanceFor(userId)

    try {
      const res = await fetch(`/api/sessions/${currentSessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendance: [{ userId, present: next.present, excused: next.excused }],
        }),
      })
      if (!res.ok) throw new Error('PUT failed')
    } catch (err) {
      console.error('Error saving attendance:', err)
      setSessionAttendance(previousAttendance) // rollback
      alert('Erreur lors de la sauvegarde de la présence')
    } finally {
      // Keep the "saving" flag for 800ms so the user sees feedback
      setTimeout(() => {
        setSavingAttendanceFor(prev => (prev === userId ? null : prev))
      }, 800)
    }
  }
```

- [ ] **Step 2 : Vérifier que le build passe**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3 : Commit**

```bash
git add src/app/[locale]/\(dashboard\)/groups/\[id\]/sessions/\[num\]/page.tsx
git commit -m "WIP: handler cyclePresence avec autosave optimiste"
```

---

## Task 5 : Afficher la carte Présences

**Files:**
- Modify: `src/app/[locale]/(dashboard)/groups/[id]/sessions/[num]/page.tsx`

**Objectif :** Insérer la nouvelle carte React **juste avant** `<div id="sec-points" ...>` (ligne 841).

- [ ] **Step 1 : Insérer la carte Présences**

Juste avant la ligne `{/* Points abordés + Devoirs */}` (ligne 840), ajouter :

```tsx
        {/* Présences */}
        <Card id="sec-presences" className="scroll-mt-16">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              Présences ({presentCount}/{presenceList.length})
              {isReferent && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  Clic = Présent → Absent → Excusé
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Progress bar */}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{
                  width: presenceList.length > 0
                    ? `${(presentCount / presenceList.length) * 100}%`
                    : '0%',
                }}
              />
            </div>

            {/* Grid of student chips */}
            <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {presenceList.map(p => {
                const isSaving = savingAttendanceFor === p.userId
                let bgClass = 'bg-muted/30 border-muted'
                let iconEl = <Circle className="h-4 w-4 text-muted-foreground" />
                let label = 'Non marqué'
                if (p.present) {
                  bgClass = 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                  iconEl = <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  label = 'Présent'
                } else if (p.excused) {
                  bgClass = 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800'
                  iconEl = <Circle className="h-4 w-4 text-orange-500" />
                  label = 'Excusé'
                } else {
                  bgClass = 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
                  iconEl = <X className="h-4 w-4 text-red-500" />
                  label = 'Absent'
                }
                return (
                  <button
                    key={p.userId}
                    type="button"
                    disabled={!isReferent || isSaving}
                    onClick={() => cyclePresence(p.userId)}
                    title={isReferent ? `${label} — cliquer pour changer` : label}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-colors ${bgClass} ${
                      isReferent ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
                    } ${isSaving ? 'opacity-50' : ''}`}
                  >
                    {iconEl}
                    <span className="font-medium truncate">{p.userName}</span>
                  </button>
                )
              })}
            </div>

            {/* Absents list */}
            {absentUnexcused.length > 0 && (
              <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Absents non excusés :</span>
                {absentUnexcused.map(p => (
                  <Badge key={p.userId} variant="outline" className="text-muted-foreground">
                    {p.userName}
                  </Badge>
                ))}
              </div>
            )}

            {presenceList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun élève dans ce groupe.
              </p>
            )}
          </CardContent>
        </Card>
```

Note : `Circle`, `CheckCircle2`, `X`, `Users` sont déjà importés dans le fichier (vérifié dans le header lignes 25-44). `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Badge` aussi.

- [ ] **Step 2 : Vérifier que le build passe**

Run: `npm run build`
Expected: build OK, pas d'erreur TS / lint.

- [ ] **Step 3 : Test manuel — affichage**

Run: `npm run dev`. Ouvrir une page séance existante en tant qu'admin. Vérifier :
- La carte "Présences (N/M)" apparaît bien **au-dessus** de "Points abordés"
- Chaque élève apparaît avec son nom et une icône
- Les couleurs sont cohérentes (vert/rouge/orange)
- La barre de progression reflète le ratio

- [ ] **Step 4 : Test manuel — édition**

Toujours en tant qu'admin :
- Cliquer sur un élève "Présent" → il devient "Absent" (rouge) + apparaît dans la liste des absents
- Cliquer encore → "Excusé" (orange) + disparaît de la liste des absents
- Cliquer encore → "Présent" (vert)
- Recharger la page → l'état est bien persisté

Si un élève n'avait pas d'enregistrement (séance ancienne + membre récent), vérifier qu'on peut le cliquer et que l'enregistrement se crée (Task 1 garantit l'upsert).

- [ ] **Step 5 : Test manuel — permissions**

Se connecter avec un compte non-référent du groupe (ou un membre standard) :
- Vérifier que la carte est visible
- Vérifier que les pastilles **ne sont pas cliquables** (cursor default, pas de changement)

- [ ] **Step 6 : Commit**

```bash
git add src/app/[locale]/\(dashboard\)/groups/\[id\]/sessions/\[num\]/page.tsx
git commit -m "feat: section Présences éditable sur la page séance (3 états + autosave)"
```

---

## Task 6 : Ajouter "Présences" à la table des matières sticky

**Files:**
- Modify: `src/app/[locale]/(dashboard)/groups/[id]/sessions/[num]/page.tsx:817-825`

- [ ] **Step 1 : Ajouter l'entrée en tête du tableau**

Remplacer le tableau actuel (lignes 817-825) :

```tsx
          {[
            { id: 'sec-points', label: 'Points abordés' },
            { id: 'sec-suivi', label: 'Suivi individuel' },
            { id: 'sec-livres', label: 'Livres' },
            { id: 'sec-tafsir', label: 'Tafsir' },
            { id: 'sec-notes', label: 'Notes' },
            { id: 'sec-recherche', label: 'Recherche' },
            { id: 'sec-classement', label: 'Classement' },
            { id: 'sec-pdf', label: 'Export PDF' },
          ].map(s => (
```

par :

```tsx
          {[
            { id: 'sec-presences', label: 'Présences' },
            { id: 'sec-points', label: 'Points abordés' },
            { id: 'sec-suivi', label: 'Suivi individuel' },
            { id: 'sec-livres', label: 'Livres' },
            { id: 'sec-tafsir', label: 'Tafsir' },
            { id: 'sec-notes', label: 'Notes' },
            { id: 'sec-recherche', label: 'Recherche' },
            { id: 'sec-classement', label: 'Classement' },
            { id: 'sec-pdf', label: 'Export PDF' },
          ].map(s => (
```

- [ ] **Step 2 : Test manuel**

Run: `npm run dev`. Sur la page séance, vérifier :
- Le bouton "Présences" apparaît en premier dans la barre sticky
- Cliquer dessus depuis le bas de la page fait défiler jusqu'à la carte Présences

- [ ] **Step 3 : Commit**

```bash
git add src/app/[locale]/\(dashboard\)/groups/\[id\]/sessions/\[num\]/page.tsx
git commit -m "feat: entrée Présences dans la table des matières de la page séance"
```

---

## Task 7 : Vérification finale + déploiement

- [ ] **Step 1 : Lint**

Run: `npm run lint`
Expected: pas d'erreur.

- [ ] **Step 2 : Build complet**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3 : Smoke test final**

Run: `npm run dev`. Ouvrir une page séance, cliquer 5 fois sur différents élèves, recharger, vérifier que tout est persisté. Ouvrir la même page sur mobile (DevTools responsive 375px) — la grille passe en 2 colonnes.

- [ ] **Step 4 : Vérifier git status propre sur les fichiers concernés**

Run: `git status -s src/app/[locale]/\(dashboard\)/groups/\[id\]/sessions/\[num\]/page.tsx src/app/api/sessions/\[id\]/route.ts`
Expected: aucune sortie (tous les changements sont commités).

- [ ] **Step 5 : Push + déploiement VPS**

```bash
git push origin master
ssh root@72.61.105.112 "cd /opt/amilou && git pull && docker-compose down && docker-compose up -d --build"
```

Note : pas de migration Prisma nécessaire (aucun changement de schéma — la contrainte unique vérifiée au Task 1 Step 1 existe déjà ou est ajoutée à ce moment-là).
