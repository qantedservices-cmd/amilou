# Modal d'avancement : utilisateur cible + commentaire riche — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un admin/référent d'enregistrer, consulter, modifier et supprimer un avancement pour un autre utilisateur autorisé, et remplacer le champ commentaire du modal par l'éditeur riche tiptap.

**Architecture:** L'autorisation de cibler un autre utilisateur passe systématiquement par `checkDataVisibility(viewerId, targetId, 'progress')` (déjà existant dans `src/lib/permissions.ts`), côté serveur. Les trois handlers de `/api/progress` (GET, POST) et `/api/progress/[id]` (PUT, DELETE) cessent de coder en dur `role === 'ADMIN'` ou `userId: session.user.id`. Le frontend se contente de transmettre `selectedUserId` en POST ; le PUT/DELETE déduit le propriétaire de l'entrée elle-même.

**Tech Stack:** Next.js 16 App Router (route handlers), Prisma, NextAuth (`auth()`), React 19, tiptap (`RichTextEditor` déjà présent).

## Global Constraints

- Aucun framework de test dans le repo (`package.json` n'a pas de script `test`). La vérification par tâche = `npx tsc --noEmit` + `npm run lint` + vérification manuelle décrite dans la tâche. Ne pas introduire de framework de test.
- Aucune nouvelle dépendance npm. `RichTextEditor` et tiptap sont déjà installés.
- Aucun changement de schéma Prisma. Pas de `prisma db push`.
- Messages d'erreur API en français.
- Ne jamais retomber silencieusement sur `session.user.id` quand un `userId` cible est refusé : répondre `403`.
- `createdBy` reste toujours `session.user.id` (auteur réel de l'action), jamais l'utilisateur cible.
- Impersonation : `GET /api/progress` conserve sa branche `isImpersonating` prioritaire, inchangée.
- Ne pas toucher au sélecteur d'utilisateur en tête de page ni à `GET /api/users/manageable` : déjà corrects.

---

### Task 1: `GET /api/progress` — honorer `userId` pour les non-admins

Aujourd'hui, seul un ADMIN peut filtrer par `userId` ; tout autre rôle est forcé sur `where.userId = session.user.id`. Un référent qui sélectionne un membre de son groupe voit donc **ses propres** entrées. Cette tâche précède les autres : sans elle, l'écriture croisée (Tâches 2-3) serait invisible dans l'UI.

**Files:**
- Modify: `src/app/api/progress/route.ts:20-44` (handler `GET`)

**Interfaces:**
- Consumes: `checkDataVisibility(viewerId: string, targetId: string, dataType: 'attendance' | 'progress' | 'stats' | 'evaluations'): Promise<{ canView: boolean; canEdit: boolean; isPrivate: boolean }>` depuis `@/lib/permissions`.
- Produces: `GET /api/progress?userId=<id>` retourne les entrées de `<id>` si le viewer a `canView`, sinon `403`.

- [ ] **Step 1: Ajouter l'import de `checkDataVisibility`**

En tête de `src/app/api/progress/route.ts`, après l'import de `getEffectiveUserId` :

```ts
import { checkDataVisibility } from '@/lib/permissions'
```

- [ ] **Step 2: Remplacer la construction du `where` dans `GET`**

Remplacer le bloc actuel (de `// Get current user to check if admin` jusqu'à la fermeture du `else` du `where.userId`, soit les lignes 22-44) par :

```ts
    // Build where clause
    const where: Record<string, unknown> = {}

    if (isImpersonating) {
      // When impersonating, show the impersonated user's data
      where.userId = effectiveUserId
    } else if (userId && userId !== 'all' && userId !== session.user.id) {
      // Targeting another user: require view permission
      const visibility = await checkDataVisibility(session.user.id, userId, 'progress')
      if (!visibility.canView) {
        return NextResponse.json(
          { error: "Vous n'êtes pas autorisé à consulter l'avancement de cet utilisateur" },
          { status: 403 }
        )
      }
      where.userId = userId
    } else if (userId === 'all') {
      // 'all' is only meaningful for an admin; others fall back to their own data
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      })
      if (currentUser?.role !== 'ADMIN') {
        where.userId = session.user.id
      }
    } else {
      where.userId = session.user.id
    }
```

Note : `userId === 'all'` sans rôle ADMIN retombe sur soi-même — ce n'est pas une écriture, et c'est le comportement actuel ; on le préserve.

- [ ] **Step 3: Vérifier la compilation et le lint**

```bash
npx tsc --noEmit
npm run lint
```
Attendu : aucune erreur. Si `tsc` signale que la variable `isAdmin` n'est plus utilisée, supprimer sa déclaration résiduelle.

- [ ] **Step 4: Vérification manuelle**

Lancer `npm run dev`. Connecté en **référent**, aller sur `/fr/progress` et sélectionner un membre du groupe dans le sélecteur en tête de page.
Attendu : le tableau affiche les entrées **de ce membre** (et non celles du référent). Sélectionner « Moi-même » → ses propres entrées reviennent.
Connecté en **USER** standard : le sélecteur ne propose que soi-même ; forcer `GET /api/progress?userId=<autre-id>` (onglet réseau ou `curl` avec le cookie de session) → `403`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/progress/route.ts
git commit -m "fix(api): GET /api/progress honore userId pour referent/admin via checkDataVisibility"
```

---

### Task 2: `POST /api/progress` — autoriser admin ET référent à cibler un autre utilisateur

**Files:**
- Modify: `src/app/api/progress/route.ts:93-100` (handler `POST`, bloc `isAdmin` / `targetUserId`)

**Interfaces:**
- Consumes: `checkDataVisibility` (importé en Tâche 1).
- Produces: `POST /api/progress` avec `{ userId }` dans le body crée l'entrée sous `userId` si `canEdit`, sinon `403`. La variable locale `targetUserId: string` reste le nom utilisé par la suite du handler (création `Progress`, `SurahRecitation`, `SessionAttendance`) — ne pas la renommer.

- [ ] **Step 1: Remplacer le contrôle d'autorisation**

Dans `POST`, remplacer :

```ts
    // Check if admin and userId provided
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    const isAdmin = currentUser?.role === 'ADMIN'
    const targetUserId = (isAdmin && userId) ? userId : session.user.id
```

par :

```ts
    // Resolve the target user: self by default, another user if allowed
    let targetUserId = session.user.id
    if (userId && userId !== session.user.id) {
      const visibility = await checkDataVisibility(session.user.id, userId, 'progress')
      if (!visibility.canEdit) {
        return NextResponse.json(
          { error: "Vous n'êtes pas autorisé à modifier l'avancement de cet utilisateur" },
          { status: 403 }
        )
      }
      targetUserId = userId
    }
```

Le reste du handler (validation sourate/versets, `prisma.progress.create`, auto-création `SurahRecitation` + `SessionAttendance`) utilise déjà `targetUserId` et `createdBy: session.user.id` : ne rien y changer.

- [ ] **Step 2: Vérifier la compilation et le lint**

```bash
npx tsc --noEmit
npm run lint
```
Attendu : aucune erreur. `currentUser` et `isAdmin` ne sont plus référencés dans `POST` — leurs déclarations doivent avoir disparu (celles du `GET` sont séparées).

- [ ] **Step 3: Vérification manuelle**

`npm run dev`, connecté en **admin**. Via l'onglet réseau ou `curl` avec le cookie de session :

```bash
curl -X POST http://localhost:3000/api/progress \
  -H 'Content-Type: application/json' \
  -b 'authjs.session-token=<token>' \
  -d '{"programId":"<id-memorisation>","surahNumber":108,"verseStart":1,"verseEnd":3,"userId":"<id-membre>"}'
```
Attendu : `200`, et le JSON retourné a `user.id === "<id-membre>"` (et non l'admin).
Rejouer connecté en **USER** standard avec le `userId` d'un autre : attendu `403` avec le message « Vous n'êtes pas autorisé à modifier l'avancement de cet utilisateur ».

- [ ] **Step 4: Commit**

```bash
git add src/app/api/progress/route.ts
git commit -m "feat(api): POST /api/progress autorise admin et referent a cibler un autre utilisateur"
```

---

### Task 3: `PUT` / `DELETE /api/progress/[id]` — édition et suppression croisées

Bug caché actuel : `findFirst({ where: { id, userId: session.user.id } })` renvoie `404` dès qu'un admin ou un référent touche l'entrée d'un autre.

**Files:**
- Modify: `src/app/api/progress/[id]/route.ts:18-24` (handler `PUT`)
- Modify: `src/app/api/progress/[id]/route.ts:86-92` (handler `DELETE`)

**Interfaces:**
- Consumes: `checkDataVisibility` depuis `@/lib/permissions`.
- Produces: helper local `assertCanEditProgress(viewerId: string, ownerId: string, action: 'modifier' | 'supprimer'): Promise<NextResponse | null>` (non exporté, partagé par `PUT` et `DELETE`). `PUT` et `DELETE` sur l'entrée d'un autre utilisateur réussissent si `canEdit`, `403` sinon, `404` si l'entrée n'existe pas. Le propriétaire de l'entrée (`existing.userId`) n'est **jamais** modifié par le `PUT` : le body ne peut pas réassigner l'entrée à quelqu'un d'autre.

- [ ] **Step 1: Ajouter l'import et le helper d'autorisation**

En tête de `src/app/api/progress/[id]/route.ts`, après `import prisma from '@/lib/db'` :

```ts
import { checkDataVisibility } from '@/lib/permissions'
```

Puis, entre les imports et le handler `PUT`, ajouter le helper partagé :

```ts
/**
 * Retourne une réponse 403 si le viewer n'a pas le droit d'agir sur l'entrée
 * d'`ownerId`, sinon `null`. Le propriétaire agit toujours sur ses entrées.
 */
async function assertCanEditProgress(
  viewerId: string,
  ownerId: string,
  action: 'modifier' | 'supprimer'
): Promise<NextResponse | null> {
  if (ownerId === viewerId) return null

  const { canEdit } = await checkDataVisibility(viewerId, ownerId, 'progress')
  if (canEdit) return null

  return NextResponse.json(
    { error: `Vous n'êtes pas autorisé à ${action} l'avancement de cet utilisateur` },
    { status: 403 }
  )
}
```

- [ ] **Step 2: Remplacer la recherche d'entrée dans `PUT`**

Remplacer :

```ts
    const existing = await prisma.progress.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Entrée non trouvée' }, { status: 404 })
    }
```

par :

```ts
    const existing = await prisma.progress.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Entrée non trouvée' }, { status: 404 })
    }

    const denied = await assertCanEditProgress(session.user.id, existing.userId, 'modifier')
    if (denied) return denied
```

Le `prisma.progress.update({ where: { id }, data: { ... } })` en aval reste inchangé : `userId` n'y figure pas, donc le propriétaire est préservé.

- [ ] **Step 3: Appliquer le même traitement dans `DELETE`**

Remplacer :

```ts
    const existing = await prisma.progress.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Entrée non trouvée' }, { status: 404 })
    }
```

par :

```ts
    const existing = await prisma.progress.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Entrée non trouvée' }, { status: 404 })
    }

    const denied = await assertCanEditProgress(session.user.id, existing.userId, 'supprimer')
    if (denied) return denied
```

- [ ] **Step 4: Vérifier la compilation et le lint**

```bash
npx tsc --noEmit
npm run lint
```
Attendu : aucune erreur.

- [ ] **Step 5: Vérification manuelle**

`npm run dev`, connecté en **admin**. Récupérer l'`id` d'une entrée appartenant à un autre utilisateur (via `GET /api/progress?userId=<id-membre>`), puis :

```bash
curl -X PUT http://localhost:3000/api/progress/<entry-id> \
  -H 'Content-Type: application/json' \
  -b 'authjs.session-token=<token>' \
  -d '{"comment":"<p>test</p>"}'
```
Attendu : `200` (auparavant `404`). Vérifier ensuite dans `GET /api/progress?userId=<id-membre>` que le commentaire est modifié et que l'entrée appartient toujours au membre.

```bash
curl -X DELETE http://localhost:3000/api/progress/<entry-id> -b 'authjs.session-token=<token>'
```
Attendu : `200 {"success":true}`.

Rejouer les deux appels connecté en **USER** standard sur l'entrée d'un autre : attendu `403` (et non `404`).

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/progress/[id]/route.ts"
git commit -m "fix(api): PUT/DELETE progress autorisent l'edition croisee admin/referent (fin des 404)"
```

---

### Task 4: Frontend — transmettre l'utilisateur cible et passer au commentaire riche

**Files:**
- Modify: `src/app/[locale]/(dashboard)/progress/page.tsx` — imports (~ligne 41), `handleSubmit` (~lignes 451-465), champ commentaire (~lignes 764-771)

**Interfaces:**
- Consumes: `POST /api/progress` (accepte `userId`, Tâche 2), `PUT /api/progress/[id]` (déduit le propriétaire de l'entrée, Tâche 3), `RichTextEditor({ value: string, onChange: (html: string) => void, placeholder?: string, disabled?: boolean, className?: string })` depuis `@/components/ui/rich-text-editor`.
- Produces: rien (feuille).

Note de conception : la spec proposait d'envoyer `userId` en POST **et** en PUT. On ne l'envoie qu'en POST. En PUT, le propriétaire est déduit de l'entrée existante côté serveur (Tâche 3) ; un `userId` dans le body serait ignoré, et l'accepter ouvrirait la porte à une réassignation d'entrée non voulue.

- [ ] **Step 1: Importer `RichTextEditor`**

Après l'import de `SegmentedProgressBar` (~ligne 42) :

```ts
import { RichTextEditor } from '@/components/ui/rich-text-editor'
```

`Input` reste importé : il est utilisé par d'autres champs du formulaire (versets, date).

- [ ] **Step 2: Envoyer `userId` dans le payload POST**

Dans `handleSubmit`, remplacer :

```ts
    const url = editingId ? `/api/progress/${editingId}` : '/api/progress'
    const method = editingId ? 'PUT' : 'POST'
```

par :

```ts
    const url = editingId ? `/api/progress/${editingId}` : '/api/progress'
    const method = editingId ? 'PUT' : 'POST'

    // Création : cibler l'utilisateur sélectionné (soi-même par défaut).
    // Édition : le serveur déduit le propriétaire de l'entrée existante.
    if (!editingId && selectedUserId) {
      payload.userId = selectedUserId
    }
```

(`payload` est déjà typé `Record<string, unknown>`, l'ajout de clé compile.)

- [ ] **Step 3: Remplacer le champ commentaire par l'éditeur riche**

Remplacer le bloc :

```tsx
              <div className="space-y-2">
                <Label>{t('progress.comment')} (optionnel)</Label>
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Notes ou remarques"
                />
              </div>
```

par :

```tsx
              <div className="space-y-2">
                <Label>{t('progress.comment')} (optionnel)</Label>
                <RichTextEditor
                  value={comment}
                  onChange={setComment}
                  placeholder="Notes ou remarques"
                />
              </div>
```

`comment` reste un `string` (HTML), `resetForm` (`setComment('')`) et `openEditDialog` (`setComment(entry.comment || '')`) restent inchangés : `RichTextEditor` accepte du HTML ou du texte brut en entrée et émet du HTML.

- [ ] **Step 4: Vérifier la compilation, le lint et le build**

```bash
npx tsc --noEmit
npm run lint
npm run build
```
Attendu : aucune erreur. `RichTextEditor` est un composant `'use client'` ; `progress/page.tsx` est déjà `'use client'` (ligne 1), donc pas d'erreur de frontière serveur/client.

- [ ] **Step 5: Vérification manuelle — utilisateur cible (C)**

`npm run dev`, `/fr/progress`.
1. Connecté en **admin** : sélectionner un membre, « Ajouter une entrée », enregistrer. Attendu : l'entrée apparaît dans le tableau du membre sélectionné, et **pas** sous « Moi-même ».
2. Connecté en **référent** : même scénario sur un membre de son groupe → OK. Puis modifier et supprimer cette entrée depuis le tableau → plus de `404`, l'entrée reste rattachée au membre.
3. Connecté en **USER** standard : le sélecteur ne propose que soi-même ; l'ajout fonctionne sur son propre profil.

- [ ] **Step 6: Vérification manuelle — commentaire riche (D)**

Dans le modal, saisir un commentaire avec du gras, une couleur et une taille. Enregistrer, puis rouvrir l'entrée en édition.
Attendu : la mise en forme est restituée à l'identique dans l'éditeur.
Pour une entrée **MEMORIZATION**, ouvrir `/fr/groups/<id>/mastery` : le commentaire de la `SurahRecitation` auto-créée s'affiche en format riche (même rendu que les commentaires saisis depuis la grille).
Ouvrir enfin une **ancienne** entrée dont le commentaire est du texte brut : elle s'affiche normalement, sans balises visibles.

- [ ] **Step 7: Commit**

```bash
git add "src/app/[locale]/(dashboard)/progress/page.tsx"
git commit -m "feat(progress): modal cible l'utilisateur selectionne + commentaire en editeur riche"
```

---

## Couverture de la spec

| Exigence spec | Tâche |
|---|---|
| C1 — Frontend transmet l'utilisateur cible | Tâche 4, Step 2 |
| C2 — POST autorise admin + référent via `checkDataVisibility`, `403` sinon | Tâche 2 |
| C3 — PUT/DELETE autorisent l'édition croisée, fin des `404` | Tâche 3 |
| D — `RichTextEditor` pour le commentaire | Tâche 4, Step 3 |
| (hors spec, prérequis) GET filtre par `userId` pour un référent | Tâche 1 |

Hors périmètre, conformément à la spec : champs « Séance / Versets » de l'éditeur de la grille, impersonation, affichage des commentaires dans le tableau `/progress`.
