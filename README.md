# Amilou - Application de Suivi Coran

Application web de suivi d'apprentissage du Coran pour les mosquées et écoles coraniques.

![Next.js](https://img.shields.io/badge/Next.js-16.1-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-5-teal)

---

## Fonctionnalités

### Pour les apprenants

| Fonctionnalité | Description |
|----------------|-------------|
| **Dashboard personnel** | Vue d'ensemble de la progression, statistiques, graphiques |
| **Suivi d'avancement** | Enregistrement quotidien par sourate/versets |
| **Objectifs personnalisés** | Définir ses objectifs par programme (quantité, unité, durée) |
| **Assiduité quotidienne** | Suivi des 5 programmes avec calendrier |
| **Progression globale** | Pourcentage du Coran mémorisé/révisé |

### Pour les enseignants/administrateurs

| Fonctionnalité | Description |
|----------------|-------------|
| **Gestion des groupes** | Création et gestion des halaqas |
| **Séances de groupe** | Planification et suivi de présence |
| **Évaluations** | Notes et commentaires par verset |
| **Administration** | Gestion des utilisateurs et rôles |
| **Statistiques groupe** | Classement, taux d'assiduité global |

---

## Les 5 Programmes de Suivi

| Programme | Description | Objectif type |
|-----------|-------------|---------------|
| **Mémorisation** | Nouveaux versets appris (Hifz) | 1/2 page/jour |
| **Consolidation** | Renforcement des versets récents (Tathbit) | 2 pages/jour |
| **Révision** | Maintien des acquis anciens (Mourajaa) | 1 hizb/semaine |
| **Lecture** | Lecture fluide (Tilawa) | 1 juz/semaine |
| **Tafsir** | Lecture avec exégèse | 1/4 hizb/mois |

---

## Paramétrage des Objectifs

Chaque utilisateur configure ses objectifs dans son profil :

```
┌─────────────┬──────────┬─────────────┬──────────┐
│ Programme   │ Quantité │ Unité       │ Durée    │
├─────────────┼──────────┼─────────────┼──────────┤
│ Mémorisation│ 1/2      │ page        │ jour     │
│ Consolidation│ 1       │ hizb        │ semaine  │
│ Révision    │ 2        │ page        │ jour     │
│ Lecture     │ 1        │ juz         │ semaine  │
│ Tafsir      │ 1/4      │ hizb        │ mois     │
└─────────────┴──────────┴─────────────┴──────────┘
```

**Quantités disponibles** : 1/4, 1/3, 1/2, 3/4, 1, 2, 3...

**Unités disponibles** : page, quart, demi-hizb, hizb, juz

**Durées disponibles** : jour, semaine, mois, année

---

## Dashboard

### Vue Utilisateur

```
┌─────────────────────────────────────────────────────────┐
│  Mon Avancement Global                                  │
│  ████████████░░░░░░░░░░░░░░░░░░░░░  18.5% du Coran     │
│  112 pages | 4 sourates | 249 versets                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Mon Assiduité 2025                                     │
│  48/49 semaines actives | Taux: 98%                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Objectifs vs Réalisé (cette semaine)                   │
│                                                         │
│  Mémorisation:   3/3.5 pages (86%)   ████████░░         │
│  Consolidation:  2/2 hizb (100%)     ██████████         │
│  Révision:       8/14 pages (57%)    █████░░░░░         │
│  Lecture:        1/1 juz (100%)      ██████████         │
│  Tafsir:         0.5/1 hizb (50%)    █████░░░░░         │
└─────────────────────────────────────────────────────────┘
```

### Vue Admin (groupe)

```
┌─────────────────────────────────────────────────────────┐
│  Classement du groupe                                   │
├──────────────────┬────────┬───────┬──────────┬─────────┤
│ Nom              │ Pages  │ Taux  │ Tendance │ Statut  │
├──────────────────┼────────┼───────┼──────────┼─────────┤
│ Samir            │ 112    │ 98%   │ ↗        │ Actif   │
│ Abdelmoughite    │ 57     │ 37%   │ →        │ Moyen   │
│ Mohamed B.       │ 13     │ 39%   │ ↘        │ Alerte  │
└──────────────────┴────────┴───────┴──────────┴─────────┘

│  Assiduité globale groupe: 50%                          │
└─────────────────────────────────────────────────────────┘
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

## Installation

### Prérequis

- Node.js 20+
- npm ou pnpm

### Installation

```bash
# Cloner le repo
git clone https://github.com/qantedservices-cmd/amilou.git
cd amilou

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos paramètres

# Initialiser la base de données
npm run db:push
npm run db:seed

# Lancer le serveur de développement
npm run dev
```

### Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Lancer en production |
| `npm run db:push` | Synchroniser le schéma Prisma |
| `npm run db:seed` | Peupler la base de données |
| `npm run db:studio` | Interface Prisma Studio |

---

## Structure du Projet

```
src/
├── app/
│   ├── [locale]/              # Pages localisées
│   │   ├── (dashboard)/       # Pages protégées
│   │   │   ├── admin/         # Administration
│   │   │   ├── attendance/    # Assiduité
│   │   │   ├── dashboard/     # Tableau de bord
│   │   │   ├── evaluations/   # Évaluations
│   │   │   ├── groups/        # Groupes
│   │   │   ├── objectives/    # Objectifs
│   │   │   ├── progress/      # Avancement
│   │   │   ├── sessions/      # Séances
│   │   │   └── settings/      # Paramètres
│   │   ├── login/
│   │   └── register/
│   └── api/                   # API Routes
├── components/
│   ├── layout/                # Sidebar, Navbar
│   └── ui/                    # Composants shadcn
├── lib/                       # Utilitaires (auth, db)
├── i18n/                      # Configuration i18n
└── messages/                  # Traductions (fr.json, ar.json, en.json)
```

---

## Rôles Utilisateurs

| Rôle | Permissions |
|------|-------------|
| **USER** | Saisir sa progression, voir son dashboard |
| **REFERENT** | + Voir les membres de son groupe |
| **MANAGER** | + Gérer les groupes, saisir pour les membres |
| **ADMIN** | + Gestion complète, tous les utilisateurs |

---

## Licence

Projet privé - Tous droits réservés

---

## Contact

Développé par [Qanted Services](https://github.com/qantedservices-cmd)
