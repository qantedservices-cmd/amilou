# Roadmap - Amilou (Suivi Coran)

Application de suivi des cours de Coran avec gestion des groupes, progression et assiduité.

---

## Phase 1: Fondations ✅

| Tâche | Statut |
|-------|--------|
| Setup Next.js 16 + TypeScript | ✅ |
| Configuration Prisma + SQLite | ✅ |
| Schéma BDD complet | ✅ |
| NextAuth v5 (Google + Credentials) | ✅ |
| Internationalisation (FR/AR/EN) | ✅ |
| Composants UI (shadcn) | ✅ |
| Page d'accueil | ✅ |
| Page connexion | ✅ |
| Page inscription | ✅ |
| API inscription | ✅ |

---

## Phase 2: Dashboard & Navigation

| Tâche | Statut |
|-------|--------|
| Layout avec sidebar/navbar | ⬜ |
| Page dashboard | ⬜ |
| Protection des routes (middleware auth) | ⬜ |
| Sélecteur de langue | ⬜ |
| Menu utilisateur (profil, déconnexion) | ⬜ |

---

## Phase 3: Gestion des Programmes

| Tâche | Statut |
|-------|--------|
| Seed données Sourates/Versets (114 sourates) | ⬜ |
| Seed programmes (Mémorisation, Consolidation, Révision, Lecture, Tafsir) | ⬜ |
| Page objectifs utilisateur | ⬜ |
| Calculateur d'objectifs quotidiens | ⬜ |

---

## Phase 4: Suivi d'Avancement

| Tâche | Statut |
|-------|--------|
| Page saisie progression | ⬜ |
| Sélecteur Sourate/Versets intelligent | ⬜ |
| Historique des entrées | ⬜ |
| Graphiques de progression (recharts) | ⬜ |
| Vue par programme | ⬜ |

---

## Phase 5: Assiduité

| Tâche | Statut |
|-------|--------|
| Calendrier assiduité quotidienne | ⬜ |
| Vue hebdomadaire/mensuelle | ⬜ |
| Statistiques taux d'assiduité | ⬜ |
| Historique par période | ⬜ |

---

## Phase 6: Groupes & Séances

| Tâche | Statut |
|-------|--------|
| CRUD Groupes | ⬜ |
| Gestion membres (ajout/suppression) | ⬜ |
| Rôles dans le groupe (admin, référent, membre) | ⬜ |
| Séances de groupe | ⬜ |
| Feuille de présence | ⬜ |
| Historique des séances | ⬜ |

---

## Phase 7: Évaluations

| Tâche | Statut |
|-------|--------|
| Saisie évaluations par verset | ⬜ |
| Historique évaluations | ⬜ |
| Notes et commentaires | ⬜ |
| Vue récapitulative | ⬜ |

---

## Phase 8: Administration

| Tâche | Statut |
|-------|--------|
| Gestion utilisateurs | ⬜ |
| Attribution rôles (Admin, Manager, Référent, Représentant, User) | ⬜ |
| Système de représentants | ⬜ |
| Export données (Excel/PDF) | ⬜ |
| Tableau de bord admin | ⬜ |

---

## Avancement Global

```
Phase 1: ████████████████████ 100%  ✅ Fondations
Phase 2: ░░░░░░░░░░░░░░░░░░░░   0%  Dashboard & Navigation
Phase 3: ░░░░░░░░░░░░░░░░░░░░   0%  Programmes
Phase 4: ░░░░░░░░░░░░░░░░░░░░   0%  Avancement
Phase 5: ░░░░░░░░░░░░░░░░░░░░   0%  Assiduité
Phase 6: ░░░░░░░░░░░░░░░░░░░░   0%  Groupes
Phase 7: ░░░░░░░░░░░░░░░░░░░░   0%  Évaluations
Phase 8: ░░░░░░░░░░░░░░░░░░░░   0%  Administration
─────────────────────────────────────────────────
TOTAL:   ██░░░░░░░░░░░░░░░░░░  12%
```

---

## Stack Technique

- **Frontend**: Next.js 16, React 19, TypeScript
- **UI**: Tailwind CSS 4, shadcn/ui, Radix UI
- **Backend**: Next.js API Routes, Prisma ORM
- **Base de données**: SQLite (dev) / PostgreSQL (prod)
- **Authentification**: NextAuth v5 (Google, Credentials)
- **Internationalisation**: next-intl (FR, AR, EN)
- **Graphiques**: Recharts
- **Formulaires**: React Hook Form, Zod

---

## Structure du Projet

```
src/
├── app/
│   ├── [locale]/           # Pages localisées
│   │   ├── login/
│   │   ├── register/
│   │   ├── dashboard/
│   │   └── ...
│   └── api/                # API Routes
│       └── auth/
├── components/
│   └── ui/                 # Composants shadcn
├── lib/                    # Utilitaires
├── i18n/                   # Configuration i18n
├── messages/               # Traductions
└── types/                  # Types TypeScript
```

---

## Modèle de Données

- **User**: Utilisateurs avec rôles
- **Group**: Groupes d'étude
- **Program**: Programmes (Mémorisation, Révision...)
- **Progress**: Suivi d'avancement par verset
- **DailyAttendance**: Assiduité quotidienne
- **Evaluation**: Évaluations par verset
- **Surah/Verse**: Données coraniques de référence
