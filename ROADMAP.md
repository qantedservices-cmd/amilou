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
| Table `UserProgramSettings` avec historique (startDate/endDate) | ✅ |
| API paramètres batch (sauvegarde tous les programmes en une fois) | ✅ |
| UI configuration objectifs : formulaire unique 5 programmes | ✅ |
| Quantités avec fractions (1/4, 1/3, 1/2, 3/4) | ✅ |
| Unités (page, quart, demi-hizb, hizb, juz) | ✅ |
| Périodes (jour, semaine, mois, année) | ✅ |
| Historique des objectifs (archivage avec dates) | ✅ |

### 8.2 Assiduité (Score 0-5)

| Tâche | Statut |
|-------|--------|
| Table `DailyAttendance` score Int 0-5 par jour | ✅ |
| Score = nb programmes accomplis (Mémo, Conso, Révision, Lecture, Tafsir) | ✅ |
| Tableau assiduité avec couleurs par score | ✅ |
| Table `DailyLog` suivi quotidien par programme | ✅ |
| API suivi quotidien | ✅ |
| Saisie par programme (5 programmes) | ✅ |

### 8.3 Dashboard enrichi

| Tâche | Statut |
|-------|--------|
| Barre progression globale (% du Coran) | ✅ |
| Stats cumulées (pages, sourates, versets) | ✅ |
| Graphique évolution temporelle (12 semaines) | ✅ |
| Bloc "Objectifs vs Réalisé" (5 programmes) | ✅ |
| Taux d'assiduité (semaines actives) | ✅ |
| Sélecteur de période (semaine/mois/année) | ✅ |
| Navigation semaine (prev/next/courante) | ✅ |
| Cumul par programme (semaine, mois, année) | ✅ |

### 8.4 Dashboard Admin

| Tâche | Statut |
|-------|--------|
| Classement du groupe | ✅ |
| Tendances | ✅ |
| Alertes utilisateurs inactifs | ✅ |
| Assiduité globale groupe | ✅ |

---

## Phase 9: Import, Export & Intégrations

| Tâche | Statut |
|-------|--------|
| Script import Excel (mémorisation) | ✅ |
| Script import Excel (assiduité) | ✅ |
| Webhook Google Forms (mémorisation) | ✅ |
| Webhook Google Forms (assiduité, score 0-5) | ✅ |
| Google Apps Script trigger automatique | ✅ |
| Export PDF rapports | ⬜ |
| Export Excel données | ⬜ |

---

## Phase 10: Déploiement ✅

| Tâche | Statut |
|-------|--------|
| Configuration PostgreSQL production (Docker) | ✅ |
| Déploiement VPS Docker Compose (72.61.105.112:3000) | ✅ |
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
Phase 9:  ██████████████░░░░░░  70%  Import/Export/Intégrations
Phase 10: ██████████░░░░░░░░░░  50%  Déploiement
─────────────────────────────────────────────────
TOTAL:    ██████████████████░░  92%
```

---

## Stack Technique

| Catégorie | Technologies |
|-----------|--------------|
| **Frontend** | Next.js 16, React 19, TypeScript 5 |
| **UI** | Tailwind CSS 4, shadcn/ui, Radix UI |
| **Backend** | Next.js API Routes, Prisma ORM |
| **Base de données** | PostgreSQL (Docker) |
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
- **DailyAttendance** - Assiduité hebdomadaire (score 0-5 par jour)
- **GroupSession** - Séances de groupe
- **SessionAttendance** - Présence aux séances
- **Evaluation** - Évaluations par verset
- **Surah** - 114 sourates
- **Verse** - 6236 versets avec page, juz, hizb

### Tables Phase 8
- **UserProgramSettings** - Objectifs par programme avec historique (startDate/endDate)
- **DailyLog** - Suivi quotidien détaillé par programme

---

## Changelog

### v0.8.0 (Février 2026)
- ✅ Cycles révision : ajout du nombre de Hizbs (hizbCount) calculé automatiquement
- ✅ Paramètres mémorisation utilisateur (sourate/verset de départ, direction)
- ✅ Taux d'assiduité basé sur date d'adoption (pas début de période)
- ✅ Prise en compte des imports Google Forms pour date d'adoption
- ✅ Objectifs non définis : affichage "-" avec bannière informative
- ✅ Sélecteur de période sticky (visible au scroll)
- ✅ Préservation du scroll lors des changements de période
- ✅ Optimisation API stats : requêtes parallèles (14 queries en 1 batch)
- ✅ Script backfill hizbCount pour cycles existants
- ✅ Grille de suivi sourates : vue groupe (élèves × sourates)
- ✅ Regroupement sourates sans données (collapsible)
- ✅ Édition statut par le référent (V, C, 90%, AM, etc.)
- ✅ Scripts d'import corrigés (SurahMastery + Progress)
- ✅ Grille de suivi : noms formatés (prénom en gras, nom en dessous)
- ✅ Grille de suivi : colonne sourate compacte
- ✅ Système de commentaires avec historique des séances
- ✅ Indicateur visuel (point orange) sur cellules avec commentaires
- ✅ CRUD commentaires pour le référent

### v0.7.0 (Janvier 2026)
- ✅ Assiduité score 0-5 (nb programmes accomplis par jour)
- ✅ Objectifs avec historique (archivage startDate/endDate)
- ✅ Formulaire objectifs unifié (5 programmes, 1 bouton sauvegarder)
- ✅ Sélecteur de période dashboard (semaine/mois/année)
- ✅ Navigation semaine (précédente/suivante/courante)
- ✅ Webhook Google Forms fonctionnel (mémorisation + assiduité)
- ✅ Google Apps Script avec trigger automatique onFormSubmit
- ✅ Déploiement Docker Compose sur VPS

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
