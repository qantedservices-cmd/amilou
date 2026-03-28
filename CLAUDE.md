# Amilou - Guide du projet

Application de suivi d'apprentissage du Coran (Next.js 16 + TypeScript + Prisma + PostgreSQL/Supabase).

## Stack technique

- **Frontend** : Next.js 16 App Router, React 19, Tailwind CSS, shadcn/ui
- **Backend** : API Routes Next.js, Prisma ORM
- **Base de données** : PostgreSQL (Supabase)
- **Auth** : NextAuth.js (JWT sessions)
- **i18n** : next-intl (fr, ar, en)
- **Déploiement** : Docker sur VPS 72.61.105.112:3000 (HTTP)

## Structure du projet

```
src/
├── app/
│   ├── [locale]/(dashboard)/   # Pages protégées
│   │   ├── admin/              # Administration (ADMIN only)
│   │   ├── attendance/         # Assiduité quotidienne
│   │   ├── dashboard/          # Tableau de bord
│   │   ├── evaluations/        # Évaluations
│   │   ├── groups/             # Groupes
│   │   ├── objectives/         # Objectifs
│   │   ├── progress/           # Avancement
│   │   ├── sessions/           # Séances de groupe
│   │   ├── settings/           # Paramètres utilisateur
│   │   ├── tafsir/             # Tafsir
│   │   └── presentation/       # Page de présentation spirituelle
│   └── api/                    # API Routes
├── components/
│   ├── layout/                 # Sidebar, Navbar, MobileSidebar
│   └── ui/                     # Composants shadcn/ui
├── contexts/
│   └── ImpersonationContext.tsx # Contexte d'impersonation
└── lib/
    ├── auth.ts                 # Configuration NextAuth
    ├── db.ts                   # Client Prisma
    ├── impersonation.ts        # Utilitaire serveur impersonation
    ├── permissions.ts          # Système de permissions/visibilité
    └── quran-utils.ts          # Utilitaires Coran (hizb↔position, zone mémorisée)
```

## Rôles utilisateurs

| Rôle | Description |
|------|-------------|
| `ADMIN` | Administrateur global - accès total |
| `MANAGER` | Gestionnaire (non utilisé actuellement) |
| `REFERENT` | Référent de groupe - gère les membres de son groupe |
| `USER` | Utilisateur standard |

### Cas Samir

Samir a un rôle particulier :
- **Groupe Amilou** : REFERENT + MEMBER (il participe comme élève)
- **Cours Montmagny** : REFERENT uniquement (superviseur, pas élève)
- **Famille** : REFERENT uniquement (superviseur, pas élève)

Les données de Samir (Progress, Attendance, etc.) sont liées au groupe Amilou uniquement.

## Règles de visibilité et permissions

### Qui voit quoi

| Rôle | Ses données | Membres de son groupe (public) | Membres de son groupe (privé) | Autres |
|------|-------------|-------------------------------|------------------------------|--------|
| **USER** | Lecture + Écriture | Lecture seule | Nom + "Privé" (données masquées) | Aucun accès |
| **REFERENT** | Lecture + Écriture | Lecture + Écriture | Lecture + Écriture | Aucun accès |
| **ADMIN** | Lecture + Écriture | Lecture + Écriture | Lecture + Écriture | Lecture + Écriture |

### Paramètres de confidentialité (modèle User)

Chaque utilisateur peut rendre privé indépendamment :
- `privateAttendance` : Assiduité quotidienne
- `privateProgress` : Avancement
- `privateStats` : Statistiques
- `privateEvaluations` : Évaluations

Par défaut : tout est **public**.

Les données privées restent visibles pour :
- L'utilisateur lui-même
- Les administrateurs
- Les référents du même groupe

### Sélecteur d'utilisateur (page Assiduité, etc.)

- Affiche "Moi-même (Nom)" en premier
- Affiche les membres du même groupe
- Les membres ayant mis leurs données en privé apparaissent avec un cadenas + "Privé" et sont désactivés
- Mode lecture seule quand on consulte les données d'un autre membre (sauf REFERENT/ADMIN)

## Menus et navigation

| Menu | Visible pour | Contenu |
|------|-------------|---------|
| Coran | Tous | Mushaf interactif : grille 114 sourates colorées + vue versets |
| Tableau de bord | Tous | Stats personnelles + stats membres du groupe (si public) |
| Avancement | Tous | Son avancement (écriture) + avancement groupe (lecture si public) |
| Assiduité | Tous | Son assiduité (écriture) + sélecteur groupe (lecture si public) |
| Groupes | Tous | Ses groupes uniquement (ADMIN voit tous) |
| Évaluations | Tous | Ses évaluations (ADMIN/REFERENT voient celles du groupe) |
| Séances | Tous | Séances de ses groupes uniquement (ADMIN voit toutes) |
| Livres | Tous | Catalogue + mes livres + livres de groupe |
| Paramètres | Tous | Profil, mot de passe, confidentialité, objectifs par programme |
| Présentation | Tous | Contenu spirituel sur le Coran et explication des programmes |
| Admin | ADMIN seulement | Gestion utilisateurs, impersonation |

## Impersonation ("Voir en tant que")

Fonctionnalité admin permettant de voir l'application comme un utilisateur spécifique.

- **Cookie** : `amilou_impersonate` (httpOnly, secure=false pour HTTP)
- **Durée** : 2 heures
- **Effet** : Toutes les APIs retournent les données de l'utilisateur impersoné
- **UI** : Bannière jaune en haut + le menu Admin disparaît si l'utilisateur impersoné n'est pas admin
- **Redirection** : Après activation, redirige vers `/fr/dashboard`
- **Fichiers** :
  - `src/app/api/admin/impersonate/route.ts` (API)
  - `src/contexts/ImpersonationContext.tsx` (contexte client)
  - `src/lib/impersonation.ts` (utilitaire serveur `getEffectiveUserId()`)
  - `src/components/ImpersonationBanner.tsx` (bannière)

## Programmes d'apprentissage

| Code | Nom | Description |
|------|-----|-------------|
| MEMORIZATION | Mémorisation | Nouveaux versets à apprendre |
| CONSOLIDATION | Consolidation | Renforcement des acquis récents |
| REVISION | Révision | Révision de l'ancien |
| READING | Lecture | Lecture complète du Coran |
| TAFSIR | Tafsir | Exégèse/interprétation |

## Objectifs utilisateur

- Configurés dans Paramètres → "Mes objectifs par programme"
- Chaque objectif : quantité + unité (page, hizb, juz...) + période (jour, semaine...)
- **Historique** : Chaque modification sauvegarde un snapshot de TOUS les objectifs, avec mise en évidence de celui modifié

## Mushaf interactif (Page Coran)

Page `/quran` — Mushaf interactif avec grille des sourates et vue versets.

### Structure
- `/quran` : Grille des 114 sourates, colorées par statut `SurahMastery`
- `/quran/[surahNumber]` : Texte arabe des versets avec indicateurs de position

### Coloration par statut
| Statut | Couleur |
|--------|---------|
| V (validé) | Vert |
| X (connu) | Bleu |
| 90% | Vert clair |
| 50%/51% | Jaune |
| AM (à mémoriser) | Orange |
| S (récité) | Violet |
| _(aucun)_ | Gris |

### Vue sourate
- Texte arabe Uthmani (champ `textAr` de la table `Verse`, seedé depuis quran.com API)
- Zone mémorisée en fond vert
- Position révision en fond bleu
- Position lecture en fond violet
- Bismillah automatique (sauf sourates 1 et 9)
- Navigation sourate précédente/suivante
- Numéros de versets en chiffres arabes

### APIs
- `/api/quran/surahs` : liste 114 sourates + statut mastery utilisateur
- `/api/quran/surahs/[surahNumber]` : versets + positions + zone mémorisée

## Base de données

Base PostgreSQL hébergée sur Supabase. Schéma Prisma dans `prisma/schema.prisma`.
- `DATABASE_URL` : URL pooler PgBouncer (port 6543) pour les requêtes runtime
- `DIRECT_URL` : URL directe (port 5432) pour les migrations (`prisma db push`)

### Modèles principaux

- `User` : Utilisateurs avec rôles et paramètres de confidentialité
- `Group` / `GroupMember` : Groupes d'étude et membres
- `Program` : Programmes d'apprentissage (5 programmes)
- `Progress` : Entrées d'avancement (sourate, versets, date)
- `DailyAttendance` : Assiduité hebdomadaire (score par jour 0-5)
- `DailyProgramCompletion` : Complétion quotidienne par programme
- `WeeklyObjective` / `WeeklyObjectiveCompletion` : Objectifs hebdomadaires
- `UserProgramSettings` : Objectifs par programme (avec historique)
- `GroupSession` / `SessionAttendance` : Séances de groupe
- `Evaluation` : Évaluations par verset
- `SurahMastery` : État de maîtrise par sourate
- `SurahRecitation` : Historique des récitations en séance
- `CompletionCycle` : Cycles de révision/lecture complètes (CRUD complet via API)
- `Book` : Livres islamiques (Mutun, collections de hadiths)
- `BookChapter` : Chapitres (hiérarchie récursive parent/children)
- `BookItem` : Items (hadith, point, verset) avec textes arabe/français/anglais
- `GroupBook` : Livres assignés à un groupe par le référent
- `UserBook` : Livres personnels d'un utilisateur
- `UserItemProgress` : Progression par item (checkbox completed)

## Suivi de Livres (Mutun & Hadiths)

### Structure
- **Book** : type (HADITH_COLLECTION | MATN), discipline (AQEEDAH, HADITH, FIQH...), collectionId, collectionLevel
- **BookChapter** : hiérarchie récursive (parentId), chapterNumber, depth
- **BookItem** : itemNumber, textes multilingues
- **Complétion en cascade** : checkbox item → % chapitre → % livre

### Collection pré-chargée : Mutun Talib Al-'Ilm
- 7 niveaux, ~18 textes (Al-Usul al-Thalatha, Nawaqid, Kitab at-Tawhid, Nawawi40, etc.)
- Seed : `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-books.ts`

### APIs
- `/api/books` : catalogue (filtrable par discipline/type/search)
- `/api/books/[id]` : détail avec arbre chapitres + progression utilisateur
- `/api/books/[id]/chapters/[chapterId]/items` : items avec progression (lazy-load)
- `/api/books/[id]/progress` : GET progression, PUT toggle complétion (unitaire ou batch)
- `/api/groups/[id]/books` : livres du groupe (assigner/lister)
- `/api/groups/[id]/books/[bookId]` : matrice progression membres + retirer
- `/api/user/books` : mes livres (perso + groupe combinés)

### Pages
- `/books` : catalogue avec vue collection (par niveau) et vue plate
- `/books/[id]` : détail livre avec chapitres dépliables, checkboxes, progression %
- `/groups/[id]/books` : livres du groupe, assigner, matrice membres

## Grille de suivi (Mastery)

Page `/groups/[id]/mastery` - Vue matricielle du suivi par sourate pour un groupe.

### Structure
- **Lignes** : Sourates (1 → 114), format compact "108 الكوثر"
- **Colonnes** : Élèves du groupe (prénom en gras, nom en dessous)
- **Cellules** : Statut (V7, C, 90%, 50%, AM, -) avec indicateur orange si commentaires

### Regroupement
- Sourates sans données sont collapsées (ex: "Sourates 2-99 (aucune donnée)")
- Clic pour développer et permettre la saisie

### Permissions
| Action | Qui peut |
|--------|----------|
| Voir | Tous les membres du groupe |
| Modifier statut | REFERENT uniquement |
| Ajouter commentaire | REFERENT uniquement |
| Supprimer commentaire | REFERENT uniquement |

### Statuts
| Code | Signification | Couleur |
|------|--------------|---------|
| V{n} | Validé semaine n | Vert |
| C | Supposé connu, à valider (stocké comme X) | Bleu |
| 90% | 90% maîtrisé | Vert clair |
| 50%/51% | Partiel | Jaune |
| AM | À mémoriser | Orange |
| S{n} | Récité à un élève sem. n | Violet |

### Commentaires
- Les commentaires sont liés aux séances (`SurahRecitation`)
- Affichés avec numéro de semaine (ex: "S7: Hésitation v.8")
- 3 commentaires visibles par défaut, bouton pour voir plus
- Point orange sur les cellules avec commentaires
- CRUD complet pour le référent

### Export
- **PNG** : Capture haute qualité (pixelRatio 4x), utilise `html-to-image`
- **PDF** : Export avec `jsPDF` + `jspdf-autotable`
  - Format A4 paysage
  - Grille colorée avec statuts
  - Section commentaires en bas du document
  - Fichier : `grille-suivi-{nom-groupe}.pdf`

## Cycles de complétion (Révision/Lecture)

Les cycles représentent les tours complets du Coran (révision ou lecture).

- **API** : `/api/completion-cycles` (GET, POST, PUT, DELETE)
- **Dashboard** : Cartes cliquables pour voir l'historique
- **Dialog** : Liste des cycles avec édition inline, suppression, ajout
- **Données** : `type` (REVISION/LECTURE), `completedAt`, `notes`, `daysToComplete`, `hizbCount`
- **hizbCount** : Nombre de Hizbs couverts (calculé automatiquement depuis la progression mémorisation)
- **daysToComplete** : Recalculé chronologiquement après chaque ajout/modification/suppression

## Indicateur d'avancement Révision & Lecture

Tracker temps réel de la position dans les cycles de Révision et Lecture.

### Champs User (positions en hizbs)
- `readingCurrentHizb` (Float?) : Position lecture (0-60 hizbs)
- `revisionCurrentHizb` (Float?) : Position révision (0-N hizbs dans zone mémorisée)
- `revisionSuspendedHizb` (Float?) : Position sauvegardée quand révision suspendue

### Phase combinée
- Quand la Lecture entre dans la zone mémorisée → Révision se suspend, Lecture avance à vitesse doublée
- Quand la Lecture sort de la zone mémorisée → cycle Révision +1 (note "Mode combiné"), Révision reprend

### API
- `/api/progress-tracker` : GET (recalcul depuis jours complétés) + PUT (modification manuelle)
- Intégré dans `/api/stats` via `progressTracker` dans la réponse

### Utilitaires
- `src/lib/quran-utils.ts` : `hizbToPosition()`, `getMemorizedZone()`, `objectiveToHizbPerDay()`

### Dashboard
- Carte "Mon Avancement Révision & Lecture" avec positions, barres de progression
- Boutons Modifier (dialog) et Recalculer
- Indicateur visuel quand la révision est suspendue (mode combiné)

## Paramètres mémorisation utilisateur

Chaque utilisateur peut configurer son point de départ de mémorisation :
- `memorizationStartSurah` : Sourate de départ
- `memorizationStartVerse` : Verset de départ
- `memorizationDirection` : Sens (FORWARD vers Nas, BACKWARD vers Fatiha)

Ces paramètres sont utilisés pour calculer automatiquement le `hizbCount` des cycles de révision.

## Calcul du taux d'assiduité

Le taux d'assiduité annuel est calculé depuis la **date d'adoption** de l'utilisateur :
- Date d'adoption = première entrée (DailyAttendance ou DailyProgramCompletion)
- Prend en compte les imports Google Forms (DailyAttendance)
- Formule : jours avec complétion / jours depuis adoption

## Navigation par semaine (Dashboard)

- Sélecteur de période (Année/Mois/Global) affecte toutes les données
- Calendrier avec numéros de semaine pour navigation rapide
- Navigation respecte la période sélectionnée (affiche la dernière semaine du mois si période passée)

## Import de données

### Google Forms (Groupe Amilou)

Webhook automatique : les soumissions Google Forms créent des entrées dans `DailyAttendance` et `DailyProgramCompletion`.

### Excel (Montmagny / Famille)

Import manuel depuis le fichier `docs/Suivi_Cours_Montmagny.xlsx` :

```bash
cd C:/Users/USER/260108_Amilou

# Réimporter Montmagny (feuille "Suivi Mémorisation")
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-suivi-memorisation.ts

# Réimporter Famille (feuille "Suivi Famille")
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-suivi-famille.ts
```

Ces scripts :
- Suppriment les anciennes données importées
- Créent des entrées `SurahMastery` (pour les séances)
- Créent des entrées `Progress` (pour le dashboard)

## Déploiement

```bash
# Sur le serveur VPS
cd /opt/amilou
git pull
docker-compose down && docker-compose up -d --build
```

- L'app écoute sur le port 3000
- Base de données : Supabase (pas de conteneur PostgreSQL local)
- `secure: false` pour les cookies (HTTP, pas HTTPS)

## Performance API

L'API `/api/stats` est optimisée avec :
- **Requêtes parallèles** : 14 requêtes initiales groupées dans `Promise.all`
- **Évolution data** : 1 requête au lieu de 12 (N+1 éliminé)
- **Élimination des doublons** : Réutilisation des données déjà chargées

## Préservation du scroll (Dashboard)

Quand on change de période, le scroll est préservé :
- Sauvegarde de `window.scrollY` avant le fetch
- Restauration avec `requestAnimationFrame` après mise à jour des données
- Indicateur de chargement discret (spinner) dans la barre sticky

## Conventions

- Langue UI : Français principalement
- Messages d'erreur API : en français
- Pas d'emojis dans le code sauf si demandé
- Utiliser `getEffectiveUserId()` dans toutes les APIs pour supporter l'impersonation
- Utiliser `checkDataVisibility()` ou `getVisibleUsers()` pour les permissions
