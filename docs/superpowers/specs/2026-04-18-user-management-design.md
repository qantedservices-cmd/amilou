# Gestion utilisateurs — Fusion, alertes, onboarding, invitation groupe

## 1. Fusion de comptes

### API : POST /api/admin/merge-users

Body : `{ sourceUserId, targetUserId, replaceEmail?: string }`

- Verification ADMIN uniquement
- Transfere toutes les donnees du source vers le cible :
  - Progress, DailyAttendance, DailyProgramCompletion, DailyLog
  - SurahMastery, SurahRecitation, SessionAttendance
  - Evaluation (evaluatorId + evaluatedId), CompletionCycle, PositionAdjustment
  - UserProgramSettings, UserObjective, WeeklyObjective, WeeklyObjectiveCompletion
  - UserBook, UserItemProgress
  - GroupMember (transferer les appartenances, ignorer les doublons)
  - LoginLog (mettre a jour userId)
- Si `replaceEmail` fourni : met a jour l'email du compte cible
- Supprime le compte source
- Retourne un resume : nombre d'enregistrements transferes par type

### UI : Dialog fusion dans l'onglet Utilisateurs

- Bouton "Fusionner" dans la barre d'actions admin
- Dialog avec :
  - Select "Compte source (a supprimer)" — liste des utilisateurs
  - Select "Compte cible (qui reste)" — liste des utilisateurs (exclut le source)
  - Champ optionnel "Nouvel email pour le compte cible"
  - Resume des donnees a transferer (nombre d'entrees par type)
  - Confirmation avec texte "Cette action est irreversible"

## 2. Alertes admin

### Email instantane a chaque inscription

- Dans `POST /api/auth/register` : apres creation du compte, envoyer un email a l'admin via Resend
- Email : "Nouvel inscrit sur Aamilou : [Nom] ([email]) — [date]"
- Destinataire : tous les utilisateurs avec role ADMIN (ou variable d'env ADMIN_EMAIL)

### Email de synthese periodique

- Route API : `GET /api/admin/digest?secret=...`
- Protegee par un secret (variable d'env `DIGEST_SECRET`)
- Contenu de l'email :
  - Nombre de connexions de la periode
  - Liste des utilisateurs actifs (connectes)
  - Liste des utilisateurs inactifs (pas de connexion)
  - Nouveaux inscrits
  - Invitations en attente
- Frequence : configuree via variable d'env `DIGEST_FREQUENCY` (daily/weekly/monthly), defaut weekly
- Declenchement : crontab sur le VPS qui appelle l'API

### Indicateurs visuels (page admin)

- Badge "Nouveau" a cote des utilisateurs crees il y a moins de 7 jours
- Indicateur vert "En ligne" si derniere connexion < 5 minutes

## 3. Onboarding premiere connexion

### Champ User

Ajouter `hasSeenOnboarding Boolean @default(false)` sur le modele User.

### Flux

1. Premiere connexion detectee (`hasSeenOnboarding === false`)
2. Redirection vers `/presentation`
3. Bandeau en bas de la page Presentation : "Configurer mon compte"
4. Redirection vers `/settings` avec bandeau guide :
   "Bienvenue ! Configurez vos objectifs et votre zone de memorisation pour commencer."
5. Une fois les objectifs + zone de memorisation definis → `hasSeenOnboarding = true`
6. Redirections normales vers `/dashboard` ensuite

### Detection

Dans le middleware ou dans le layout dashboard : si `hasSeenOnboarding === false` et la page courante n'est pas `/presentation` ni `/settings` → rediriger vers `/presentation`.

### Parametres essentiels guides

- Objectifs par programme (quantite + unite + periode)
- Zone de memorisation (sourate de depart + direction)

## 4. Lien d'invitation groupe

### Champ Group

Ajouter `inviteCode String? @unique` sur le modele Group.

### API

- `POST /api/groups/[id]/invite-link` : genere un code aleatoire (6 caracteres alphanumeriques), le stocke dans `group.inviteCode`, retourne le lien complet. Accessible REFERENT du groupe + ADMIN.
- `DELETE /api/groups/[id]/invite-link` : supprime le code (desactive le lien).
- `POST /api/join` : body `{ code }`. Verifie que le code existe, ajoute l'utilisateur au groupe comme MEMBER (isStudent=true). Si deja membre, ignore.

### Page /join

- Route : `/[locale]/join?code=...`
- Si non connecte → rediriger vers `/login` avec `callbackUrl=/join?code=...`
- Si connecte → afficher le nom du groupe + bouton "Rejoindre"
- Apres clic → appel `POST /api/join`, redirection vers la page du groupe

### UI referent

- Page Groupes (`/groups/[id]`) → bouton "Lien d'invitation" pour le referent
- Affiche le lien copiable si code existe
- Boutons : Generer / Regenerer / Desactiver

## 5. Fichiers impactes

| Fichier | Modification |
|---|---|
| `prisma/schema.prisma` | Ajouter hasSeenOnboarding sur User, inviteCode sur Group |
| `src/app/api/admin/merge-users/route.ts` | Nouvelle API fusion |
| `src/app/api/auth/register/route.ts` | Ajouter email admin a l'inscription |
| `src/app/api/admin/digest/route.ts` | Nouvelle API synthese periodique |
| `src/app/api/groups/[id]/invite-link/route.ts` | Nouvelle API lien invitation groupe |
| `src/app/api/join/route.ts` | Nouvelle API rejoindre un groupe |
| `src/app/[locale]/join/page.tsx` | Nouvelle page rejoindre un groupe |
| `src/app/[locale]/(dashboard)/admin/page.tsx` | Dialog fusion + badges Nouveau/En ligne |
| `src/app/[locale]/(dashboard)/groups/[id]/page.tsx` | Bouton lien invitation |
| `src/app/[locale]/(dashboard)/presentation/page.tsx` | Bandeau onboarding |
| `src/app/[locale]/(dashboard)/settings/page.tsx` | Bandeau guide onboarding |
| Middleware ou layout | Redirection onboarding |
