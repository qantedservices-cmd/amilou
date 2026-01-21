# Roadmap - Amilou (Suivi Coran)

Application de suivi des cours de Coran avec gestion des groupes, progression et assiduité.

---

## Phase 1: Fondations ✅

| Tâche | Statut |
|-------|--------|
| Setup Next.js 16 + TypeScript | ✅ |
| Configuration Prisma + PostgreSQL | ✅ |
| Schéma BDD complet | ✅ |
| NextAuth v5 (Google + Credentials) | ✅ |
| Internationalisation (FR/AR/EN) | ✅ |
| Composants UI (shadcn) | ✅ |
| Page d'accueil | ✅ |
| Page connexion | ✅ |
| Page inscription | ✅ |
| API inscription | ✅ |

---

## Phase 2: Dashboard & Navigation ✅

| Tâche | Statut |
|-------|--------|
| Layout avec sidebar/navbar | ✅ |
| Page dashboard | ✅ |
| Protection des routes (server auth) | ✅ |
| Sélecteur de langue | ✅ |
| Menu utilisateur (profil, déconnexion) | ✅ |

---

## Phase 3: Programmes & Objectifs ✅

| Tâche | Statut |
|-------|--------|
| Seed données Sourates (114 sourates) | ✅ |
| Seed données Versets (6236 versets) | ✅ |
| Seed programmes (Mémo, Conso, Révision, Lecture, Tafsir) | ✅ |
| Page objectifs utilisateur | ✅ |
| API objectifs CRUD | ✅ |

---

## Phase 4: Suivi d'Avancement ✅

| Tâche | Statut |
|-------|--------|
| Page saisie progression | ✅ |
| Sélecteur Sourate/Versets | ✅ |
| Historique des entrées | ✅ |
| API progression CRUD | ✅ |
| Filtrage par programme | ✅ |

---

## Phase 5: Groupes & Séances ✅

| Tâche | Statut |
|-------|--------|
| CRUD Groupes | ✅ |
| Gestion membres (ajout/suppression) | ✅ |
| Rôles dans le groupe | ✅ |
| Séances de groupe | ✅ |
| Feuille de présence | ✅ |

---

## Phase 6: Évaluations ✅

| Tâche | Statut |
|-------|--------|
| Saisie évaluations par verset | ✅ |
| Notes et commentaires | ✅ |
| Historique évaluations | ✅ |
| API évaluations | ✅ |

---

## Phase 7: Administration ✅

| Tâche | Statut |
|-------|--------|
| Page administration | ✅ |
| Gestion utilisateurs | ✅ |
| Attribution rôles (Admin, Manager, Référent, User) | ✅ |
| API /me (rôle utilisateur courant) | ✅ |
| Sidebar conditionnelle (admin only) | ✅ |
| Gestion multi-utilisateurs (admin) | ✅ |

---

## Phase 8: Nouveau Système d'Assiduité ✅

### 8.1 Paramétrage des Objectifs (Profil)

| Tâche | Statut |
|-------|--------|
| Table `UserProgramSettings` | ✅ |
| API paramètres utilisateur | ✅ |
| UI configuration objectifs par programme | ✅ |
| Quantités avec fractions (1/4, 1/3, 1/2, 3/4) | ✅ |
| Unités (page, quart, demi-hizb, hizb, juz) | ✅ |
| Durées (jour, semaine, mois, année) | ✅ |

### 8.2 Suivi Quotidien (remplace ancien système)

| Tâche | Statut |
|-------|--------|
| Table `DailyLog` (remplace `DailyAttendance`) | ✅ |
| API suivi quotidien | ✅ |
| Calendrier sélection jour | ✅ |
| Saisie par programme (5 programmes) | ✅ |
| Saisie rétroactive | ✅ |

### 8.3 Dashboard enrichi

| Tâche | Statut |
|-------|--------|
| Barre progression globale (% du Coran) | ✅ |
| Stats cumulées (pages, sourates, versets) | ✅ |
| Graphique évolution temporelle | ✅ |
| Bloc "Objectifs vs Réalisé" (5 programmes) | ✅ |
| Taux d'assiduité (semaines actives) | ✅ |

### 8.4 Dashboard Admin

| Tâche | Statut |
|-------|--------|
| Classement du groupe | ✅ |
| Tendances (↗️ → ↘️) | ✅ |
| Alertes utilisateurs inactifs | ✅ |
| Assiduité globale groupe | ✅ |

---

## Phase 9: Import & Export

| Tâche | Statut |
|-------|--------|
| Script import Excel (mémorisation) | ✅ |
| Script import Excel (assiduité) | ✅ |
| Export PDF rapports | ⬜ |
| Export Excel données | ⬜ |

---

## Phase 10: Déploiement

| Tâche | Statut |
|-------|--------|
| Configuration PostgreSQL production | ⬜ |
| Déploiement Vercel/VPS | ⬜ |
| Configuration domaine | ⬜ |
| SSL/HTTPS | ⬜ |

---

## Avancement Global

```
Phase 1:  ████████████████████ 100%  ✅ Fondations
Phase 2:  ████████████████████ 100%  ✅ Dashboard & Navigation
Phase 3:  ████████████████████ 100%  ✅ Programmes & Objectifs
Phase 4:  ████████████████████ 100%  ✅ Suivi d'Avancement
Phase 5:  ████████████████████ 100%  ✅ Groupes & Séances
Phase 6:  ████████████████████ 100%  ✅ Évaluations
Phase 7:  ████████████████████ 100%  ✅ Administration
Phase 8:  ████████████████████ 100%  ✅ Nouveau Assiduité
Phase 9:  ██████████░░░░░░░░░░  50%  Import/Export
Phase 10: ░░░░░░░░░░░░░░░░░░░░   0%  Déploiement
─────────────────────────────────────────────────
TOTAL:    █████████████████░░░  85%
```

---

## Stack Technique

| Catégorie | Technologies |
|-----------|--------------|
| **Frontend** | Next.js 16, React 19, TypeScript 5 |
| **UI** | Tailwind CSS 4, shadcn/ui, Radix UI |
| **Backend** | Next.js API Routes, Prisma ORM |
| **Base de données** | SQLite (dev) / PostgreSQL (prod) |
| **Authentification** | NextAuth v5 (Google, Credentials) |
| **Internationalisation** | next-intl (FR, AR, EN) |
| **Graphiques** | Recharts |
| **Formulaires** | React Hook Form, Zod |

---

## Modèle de Données

### Tables existantes
- **User** - Utilisateurs avec rôles
- **Group** - Groupes d'étude (halaqas)
- **GroupMember** - Membres des groupes
- **Program** - Programmes (Mémorisation, Consolidation, Révision, Lecture, Tafsir)
- **UserObjective** - Objectifs par programme
- **Progress** - Suivi d'avancement par sourate/verset
- **DailyAttendance** - Assiduité quotidienne (ancien système)
- **GroupSession** - Séances de groupe
- **SessionAttendance** - Présence aux séances
- **Evaluation** - Évaluations par verset
- **Surah** - 114 sourates
- **Verse** - 6236 versets avec page, juz, hizb

### Nouvelles tables (Phase 8)
- **UserProgramSettings** - Paramètres objectifs par programme
- **DailyLog** - Suivi quotidien par programme (remplace DailyAttendance)

---

## Changelog

### v0.6.0 (Janvier 2026)
- ✅ Phase 8 complète - Nouveau système d'assiduité
- ✅ Dashboard enrichi avec barre progression globale (% du Coran)
- ✅ Stats cumulées (pages, sourates, versets mémorisés)
- ✅ Graphique d'évolution sur 12 semaines (Recharts)
- ✅ Paramétrage objectifs par programme (quantité/unité/période)
- ✅ Suivi quotidien avec calendrier et saisie rétroactive
- ✅ Dashboard Admin avec classement, tendances et alertes
- ✅ Assiduité globale groupe et utilisateurs inactifs

### v0.5.0 (Janvier 2026)
- ✅ Page Administration complète
- ✅ Gestion des rôles utilisateurs
- ✅ API multi-utilisateurs (admin)
- ✅ Script import Excel (mémorisation + assiduité)

### v0.4.0 (Janvier 2026)
- ✅ Sessions de groupe
- ✅ Évaluations par verset
- ✅ Page paramètres (profil, mot de passe)

### v0.3.0 (Janvier 2026)
- ✅ Assiduité quotidienne
- ✅ Gestion des groupes

### v0.2.0 (Janvier 2026)
- ✅ Objectifs utilisateur
- ✅ Suivi d'avancement
- ✅ Seed sourates et versets

### v0.1.0 (Janvier 2026)
- ✅ Setup initial
- ✅ Authentification
- ✅ Dashboard de base
