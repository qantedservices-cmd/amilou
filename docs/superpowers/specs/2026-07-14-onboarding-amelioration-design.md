# Amélioration de l'onboarding — checklist, rejoindre/créer un groupe, usage sans groupe

**Date** : 2026-07-14
**Type** : Amélioration UX (nouvel arrivant)

## Contexte

À l'inscription (`/register` → `POST /api/auth/register`), un utilisateur est créé **sans groupe** et **sans zone de mémorisation**. L'onboarding actuel se limite à une bannière sur le dashboard (« Configurer mon compte » + « Découvrir l'app ») qui ne mentionne pas les groupes. Résultat : le nouvel arrivant ne sait pas qu'il peut rejoindre/créer un groupe, ni que la zone de mémorisation conditionne le suivi Révision/Lecture — et il peut croire, à tort, que l'app est inutilisable sans groupe.

## Objectifs

1. Guider le nouvel arrivant avec une **checklist** claire sur le dashboard.
2. Lui permettre de **rejoindre un groupe (par code) OU d'en créer un** (en devenant référent participant ou superviseur) directement depuis l'onboarding.
3. Guider le réglage de la **zone de mémorisation**.
4. Garantir qu'un utilisateur **sans groupe** peut utiliser l'app et suivre son avancement, sans écran vide/bloquant.

## Existant réutilisé (rien à recréer)

- `POST /api/groups` : **déjà ouvert à tout utilisateur connecté** ; le créateur est ajouté comme `REFERENT`. Le body accepte `name`, `description`, `sessionFrequency`.
- `GET /api/join?code=` (vérifie un code, renvoie le groupe) et `POST /api/join` (rejoint : `GroupMember` `role=MEMBER`, `isStudent=true`). Le `inviteCode` fait **6 caractères hex majuscules** (ex: `A3F9C1`), donc saisissable à la main. Le lien `/join?code=…` (généré par les référents) continue de fonctionner.
- Page **Paramètres** : section « Zone de mémorisation » (sourate/verset/sens de départ, `memorizationStartSurah/Verse/Direction`).
- Champ `User.hasSeenOnboarding` (`Boolean`, défaut `false`) : déjà utilisé pour la bannière actuelle.
- Page Avancement : une entrée de mémorisation sans groupe crée bien le `Progress` (elle saute juste la récitation de séance). Le suivi solo fonctionne déjà.

## Conception

### 1. État d'onboarding — étendre `GET /api/me`

`/api/me` renvoie aujourd'hui `hasSeenOnboarding` et `memorizationStartDate`, mais **pas** l'appartenance à un groupe ni `memorizationStartSurah`. On y ajoute deux booléens dérivés :

- `hasGroup` : `true` si l'utilisateur (effectif) a au moins un `GroupMember`.
- `hasMemorizationZone` : `true` si `memorizationStartSurah` n'est pas `null`.

Ces champs sont calculés côté serveur (une requête `groupMember.count` + le `select` de `memorizationStartSurah`). Impersonation respectée via `getEffectiveUserId()` comme aujourd'hui.

### 2. Composant `OnboardingChecklist` (dashboard)

Remplace la bannière actuelle (`showOnboardingBanner`, ~lignes 3231-3252 de `dashboard/page.tsx`). Carte en haut du dashboard, affichée si `!hasSeenOnboarding`. Items à état réel :

| Item | Coché quand | Action |
|------|-------------|--------|
| Suivre mon avancement | **toujours coché** (informatif) | lien vers `/progress` |
| Rejoindre ou créer un groupe | `hasGroup === true` | ouvre `JoinOrCreateGroupDialog` |
| Configurer ma zone de mémorisation | `hasMemorizationZone === true` | lien vers `/settings#zone-memorisation` |

- Compteur d'étapes faites (ex. « 1/2 » sur les deux items actionnables).
- Bouton **Masquer** → `PUT /api/user/profile { hasSeenOnboarding: true }` (l'endpoint honore déjà ce champ). La carte disparaît.
- Quand `hasGroup && hasMemorizationZone`, la carte se met automatiquement en état « Tout est configuré » avec un bouton pour la masquer définitivement (ou se masque d'elle-même — au choix d'implémentation, mais la valeur par défaut retenue : afficher un état de félicitation dismissable).
- Le premier item coché d'emblée porte le message clé : **le groupe est un plus, pas un prérequis.**

### 3. Composant `JoinOrCreateGroupDialog`

Modale (shadcn `Dialog`) à deux onglets (`Tabs`) :

**Onglet « Rejoindre »**
- Champ texte pour le **code à 6 caractères** (normalisé en majuscules).
- À la validation : `GET /api/join?code=CODE`. Si OK → affiche le nom (et description) du groupe + bouton « Rejoindre ». Si erreur → message (« Code invalide »).
- « Rejoindre » → `POST /api/join { code }`. Au succès : fermer la modale, rafraîchir l'état d'onboarding (l'item « groupe » se coche), toast de confirmation.

**Onglet « Créer »**
- Champ **nom** (requis), **description** (optionnel).
- Choix de rôle (radio) — **Q2·A** :
  - ○ « Je participe aussi comme élève » → `isStudent = true`
  - ○ « Je supervise seulement » → `isStudent = false`
- « Créer » → `POST /api/groups { name, description, isStudent }`. Au succès : fermer, rafraîchir l'état, toast, l'item « groupe » se coche.

### 4. `POST /api/groups` — honorer `isStudent`

Aujourd'hui le créateur est créé en dur `{ role: 'REFERENT' }` (donc `isStudent` au défaut `true`). On lit `isStudent` dans le body et on le passe à la création du `GroupMember` :

```ts
const { name, description, sessionFrequency, isStudent } = await request.json()
// ...
members: { create: { userId: session.user.id, role: 'REFERENT', isStudent: isStudent !== false } }
```

`isStudent !== false` → défaut `true` si non fourni (rétrocompatible avec les appels existants).

### 5. Zone de mémorisation — ancre dans Paramètres

L'item « Configurer ma zone » renvoie vers `/settings#zone-memorisation`. Ajouter un `id="zone-memorisation"` sur la section « Zone de mémorisation » de `settings/page.tsx` (~ligne 909) et un défilement vers l'ancre au chargement si le hash est présent. On réutilise le formulaire existant (une seule source de vérité) plutôt que de le dupliquer dans une modale.

### 6. Utilisable sans groupe — masquage léger + non-blocage

Deux points, volontairement limités (l'optimisation complète du dashboard est un chantier séparé) :

- **Vérification de non-blocage** : parcourir les pages principales (dashboard, avancement, assiduité, séances, évaluations, groupes) connecté en utilisateur **sans groupe** et confirmer qu'aucune ne plante ni n'affiche un écran d'erreur. Corriger uniquement les blocages réels rencontrés.
- **Masquage des sections strictement liées au groupe** quand `hasGroup === false` : au minimum la section « Classement Groupe - Mémorisation » du dashboard (~ligne 2837). Une section qui n'a de sens qu'avec un groupe ne doit pas s'afficher (vide) pour un utilisateur seul. Les autres sections vides/par-donnée (Tafsir, Livres, Hadiths…) relèvent du chantier dashboard séparé et ne sont **pas** traitées ici.

## Hors périmètre (chantier dashboard séparé)

- Refonte globale du dashboard : décider pour tous les utilisateurs ce qui reste en évidence vs repliable vs supprimé, structure des sections dépliables, nettoyage des doublons (« Mes Livres » ×2, « Programmes Journaliers » ×2). Fera l'objet de son propre brainstorm → spec → plan.
- Vérification email à l'inscription, auto-login après inscription : non traités ici.

## Vérification

Pas de framework de test dans le repo. Vérification manuelle (base jetable + Playwright, cf. pratique établie) :

1. **Nouvel utilisateur** (sans groupe, sans zone) : la checklist s'affiche avec le 1er item coché, les deux autres décochés.
2. **Rejoindre par code** : saisir un code valide → nom du groupe affiché → rejoindre → item « groupe » coché, toast.
3. **Créer un groupe, participant** : nom + « je participe » → créé → `GroupMember` `REFERENT` + `isStudent=true` ; item coché.
4. **Créer un groupe, superviseur** : « je supervise seulement » → `GroupMember` `REFERENT` + `isStudent=false`.
5. **Zone de mémorisation** : « Configurer » → arrive sur `/settings` à la section zone ; après réglage, l'item se coche.
6. **Masquer** : `hasSeenOnboarding=true` → la carte ne réapparaît plus.
7. **Sans groupe** : aucune page ne bloque ; « Classement Groupe » n'apparaît pas ; l'avancement solo fonctionne (une entrée de mémorisation crée le `Progress`).
