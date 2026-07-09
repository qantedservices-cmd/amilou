# Modal d'avancement : utilisateur cible + commentaire riche (C+D)

**Date** : 2026-07-10
**Branche** : `feature/progress-modal-target-comment` (basée sur `master`)
**Fichiers** : `src/app/[locale]/(dashboard)/progress/page.tsx`, `src/app/api/progress/route.ts`, `src/app/api/progress/[id]/route.ts`

## Contexte

Deux améliorations sur le modal « Ajouter une entrée » de la page Avancement (`/progress`) :

- **C** — Un admin ou un référent doit pouvoir enregistrer, modifier et supprimer un avancement pour un autre utilisateur (les membres de son groupe pour un référent, tout le monde pour un admin). Le profil de l'utilisateur courant reste sélectionné par défaut.
- **D** — Le champ « Commentaire » du modal doit utiliser le même éditeur riche que la grille de suivi (Gras / Couleur / Taille / alignement), au lieu d'un champ texte simple.

## État existant (déjà en place)

- Sélecteur d'utilisateur en tête de page (`manageableUsers` / `selectedUserId`), alimenté par `GET /api/users/manageable?dataType=progress` → `getVisibleUsers()`. « Moi-même » sélectionné par défaut au montage (`selfUser.isSelf`).
- Permissions : `checkDataVisibility(viewerId, targetId, 'progress')` renvoie `{ canView, canEdit, isPrivate }`. `canEdit = true` pour un admin (tout le monde) et pour un référent sur un membre d'un groupe partagé. `getVisibleUsers()` expose déjà `canEdit` / `isSelf` / `isPrivate` par utilisateur.
- `POST /api/progress` accepte déjà un champ `userId` dans le body, mais ne l'honore **que** pour un ADMIN.
- Composant `RichTextEditor` (`src/components/ui/rich-text-editor.tsx`, tiptap) déjà utilisé dans la grille (`groups/[id]/mastery`). Aucune nouvelle dépendance requise.
- Les commentaires d'avancement ne sont **pas** ré-affichés dans le tableau de la page `/progress` ; ils alimentent `SurahRecitation.comment` (pour les entrées MEMORIZATION), affiché en format riche dans la grille.

## Problèmes à corriger

1. **Frontend** — `handleSubmit` (progress/page.tsx) n'envoie jamais `userId` dans le payload. Une entrée ajoutée « pour un autre » via le sélecteur est en réalité enregistrée sur l'utilisateur courant.
2. **API POST** — l'autorisation de cibler un autre utilisateur est réservée à `ADMIN` (`isAdmin && userId`) ; un référent ne peut pas cibler un membre de son groupe et retombe silencieusement sur lui-même.
3. **API PUT / DELETE `/api/progress/[id]`** — la recherche de l'entrée est verrouillée sur `where: { id, userId: session.user.id }`. Modifier ou supprimer l'entrée d'un autre utilisateur renvoie donc `404 Entrée non trouvée`, même pour un admin/référent autorisé (bug caché).
4. **Frontend D** — le champ commentaire est un `<Input>` texte simple.

## Conception

### C1 — Frontend : transmettre l'utilisateur cible

Dans `handleSubmit` (progress/page.tsx), ajouter `userId: selectedUserId` au `payload` envoyé en POST **et** en PUT. La valeur est toujours présente (le sélecteur par défaut = soi-même), l'API décide de l'autorisation.

### C2 — API POST : autoriser admin ET référent

Dans `POST /api/progress`, remplacer :

```ts
const isAdmin = currentUser?.role === 'ADMIN'
const targetUserId = (isAdmin && userId) ? userId : session.user.id
```

par une autorisation basée sur `checkDataVisibility` :

- Si `userId` absent ou égal à `session.user.id` → `targetUserId = session.user.id`.
- Sinon, appeler `checkDataVisibility(session.user.id, userId, 'progress')`.
  - `canEdit === true` → `targetUserId = userId`.
  - sinon → répondre `403` (« Vous n'êtes pas autorisé à modifier l'avancement de cet utilisateur »), **sans** retomber silencieusement sur soi-même.

Le reste du POST (validation sourate/versets, création `Progress`, auto-création `SurahRecitation` + `SessionAttendance`) utilise déjà `targetUserId` et reste inchangé. `createdBy` reste `session.user.id`.

### C3 — API PUT / DELETE : autoriser l'édition/suppression croisée

Dans `PUT` et `DELETE /api/progress/[id]` :

1. Rechercher l'entrée par `id` seul : `prisma.progress.findUnique({ where: { id } })`. `404` si introuvable.
2. Si `existing.userId !== session.user.id`, appeler `checkDataVisibility(session.user.id, existing.userId, 'progress')` et exiger `canEdit === true`, sinon `403`.
3. Poursuivre la mise à jour / suppression comme aujourd'hui.

### D — Éditeur riche pour le commentaire

Dans progress/page.tsx, remplacer le bloc `<Input>` du commentaire (actuellement ~lignes 766-770) par :

```tsx
<RichTextEditor
  value={comment}
  onChange={setComment}
  placeholder="Notes ou remarques"
/>
```

Importer `RichTextEditor` depuis `@/components/ui/rich-text-editor`. L'état `comment` (string HTML) et la logique `openEditDialog` / `resetForm` restent inchangés : le composant accepte du HTML en entrée et émet du HTML. Les anciens commentaires en texte brut s'affichent normalement. Le commentaire HTML circule tel quel vers `SurahRecitation.comment` (déjà rendu en format riche dans la grille).

## Hors périmètre

- Champs « Séance / Versets » de l'éditeur de la grille (le modal a déjà Sourate + Versets).
- Impersonation (« Voir en tant que ») : mécanisme distinct, non modifié.
- Affichage des commentaires dans le tableau de la page `/progress` (ils n'y figurent pas).

## Vérification

Pas de suite de tests automatisés dans le repo. Vérification manuelle sur une instance après `npm run build` :

1. **Admin** sélectionne un membre → ajoute une entrée → l'entrée apparaît bien sous ce membre (et non sous l'admin).
2. **Référent** sélectionne un membre de son groupe → ajoute / modifie / supprime → OK ; pour un utilisateur hors de son groupe → refus.
3. **USER** standard → ne peut cibler que lui-même (sélecteur mono-utilisateur, API refuse tout autre `userId` avec 403).
4. Édition puis suppression d'une entrée d'un autre utilisateur par un admin/référent → plus de 404.
5. Commentaire riche : mise en forme (couleur, taille, gras) saisie dans le modal → correctement enregistrée et restituée à la ré-ouverture, et rendue en format riche dans la grille pour une entrée MEMORIZATION.
