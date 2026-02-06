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
│   │   └── tafsir/             # Tafsir
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
    └── permissions.ts          # Système de permissions/visibilité
```

## Rôles utilisateurs

| Rôle | Description |
|------|-------------|
| `ADMIN` | Administrateur global - accès total |
| `MANAGER` | Gestionnaire (non utilisé actuellement) |
| `REFERENT` | Référent de groupe - gère les membres de son groupe |
| `USER` | Utilisateur standard |

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
| Tableau de bord | Tous | Stats personnelles + stats membres du groupe (si public) |
| Avancement | Tous | Son avancement (écriture) + avancement groupe (lecture si public) |
| Assiduité | Tous | Son assiduité (écriture) + sélecteur groupe (lecture si public) |
| Groupes | Tous | Ses groupes uniquement (ADMIN voit tous) |
| Évaluations | Tous | Ses évaluations (ADMIN/REFERENT voient celles du groupe) |
| Séances | Tous | Séances de ses groupes uniquement (ADMIN voit toutes) |
| Paramètres | Tous | Profil, mot de passe, confidentialité, objectifs par programme |
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

## Base de données

Base PostgreSQL hébergée sur Supabase. Schéma Prisma dans `prisma/schema.prisma`.

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
- `CompletionCycle` : Cycles de révision/lecture complètes

## Déploiement

```bash
# Sur le serveur VPS
cd /opt/amilou
git pull
docker-compose down && docker-compose up -d --build
```

- L'app écoute sur le port 3000
- Le conteneur `amilou-db` local n'est pas utilisé (Supabase)
- `secure: false` pour les cookies (HTTP, pas HTTPS)

## Conventions

- Langue UI : Français principalement
- Messages d'erreur API : en français
- Pas d'emojis dans le code sauf si demandé
- Utiliser `getEffectiveUserId()` dans toutes les APIs pour supporter l'impersonation
- Utiliser `checkDataVisibility()` ou `getVisibleUsers()` pour les permissions
