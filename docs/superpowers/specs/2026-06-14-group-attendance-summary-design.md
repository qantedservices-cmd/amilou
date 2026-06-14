# Bilan des présences par groupe

## Contexte

Les données de présence/absence existent (table `SessionAttendance`, éditables depuis la nouvelle section Présences de la page séance) mais aucune vue n'agrège ces données par élève sur l'ensemble des séances d'un groupe. Le référent (ou l'admin) n'a pas de moyen rapide de savoir qui a un taux d'assiduité faible.

Ce qui change : ajouter une page de bilan accessible par groupe, montrant un récapitulatif par élève pour toutes les séances du groupe.

## Route et navigation

Nouvelle page : `/[locale]/groups/[id]/attendance`

Suit le pattern des sous-pages groupe existantes (`mastery`, `sessions`, `books`, `tafsir`).

Points d'accès vers cette page :
- Page `/groups/[id]/mastery` : nouveau bouton "Bilan présences" dans la barre d'actions du haut
- Page `/groups/[id]/sessions/[num]` : nouveau bouton "Bilan présences" dans la barre d'actions du haut
- Optionnel : icône à côté du nom de groupe dans la légende de `/sessions` (page calendrier) si pertinent — non bloquant

## Données

Calculs côté serveur, agrégés en 1-2 requêtes Prisma :

Pour chaque membre actif du groupe (rôle = `MEMBER` OU rôle = `REFERENT` + `isStudent=true`) :

- `totalSessions` : nombre de séances du groupe (toutes confondues)
- `presentCount` : `SessionAttendance` où `present=true` pour cet utilisateur
- `absentCount` : `SessionAttendance` où `present=false` ET `excused=false` + séances sans enregistrement pour cet utilisateur (implicitement absent)
- `excusedCount` : `SessionAttendance` où `excused=true`
- `rate` : `Math.round((presentCount / totalSessions) * 100)`

Note : un membre ajouté après la création d'une séance peut ne pas avoir d'enregistrement `SessionAttendance` pour les séances antérieures à son adhésion. Pour le calcul, on considère ces lignes comme "absent non excusé" (cohérent avec la règle d'affichage de la page séance).

## UI

### En-tête

- Bouton retour vers `/groups/[id]/mastery`
- Titre : `<Nom du groupe> — Bilan des présences`
- Sous-titre : `Total séances : N · Période : depuis le DD/MM/YYYY` (date de la 1re séance du groupe)

### Tableau

Colonnes :
| Élève | Présent | Absent | Excusé | Taux |

- Tri par taux décroissant par défaut
- En-têtes cliquables pour trier (asc/desc) sur n'importe quelle colonne
- Colonne `Présent` au format `X / N` (ex. `12 / 14`)
- Colonne `Taux` : barre de progression mince + pourcentage
  - Vert : ≥ 80 %
  - Jaune : 60 – 79 %
  - Rouge : < 60 %
- Ligne survol : surbrillance discrète

### États

- **Loading** : skeleton de 4 lignes
- **Vide** (groupe sans séance) : message "Aucune séance enregistrée dans ce groupe."
- **Vide** (séances mais aucun membre actif) : message "Aucun élève dans ce groupe."

## API

Nouvelle route : `GET /api/groups/[id]/attendance-summary`

Réponse :
```ts
{
  groupName: string
  totalSessions: number
  firstSessionDate: string | null  // ISO
  members: Array<{
    userId: string
    name: string
    presentCount: number
    absentCount: number
    excusedCount: number
    rate: number  // 0-100
  }>
}
```

Calculs en 2 requêtes :
1. `groupSession.findMany` pour récupérer toutes les séances du groupe (id, date) + `attendance` inclus
2. `groupMember.findMany` filtré sur les élèves actifs (MEMBER + REFERENT/isStudent)

Agrégation en JavaScript côté serveur (volume faible, ~30 séances × 20 membres max).

## Permissions

- Lecture : tous les membres du groupe (référents, admins, élèves)
- Pas d'écriture (lecture seule, conformément à la décision utilisateur)
- ADMIN voit tous les groupes

Réutilise le pattern de permissions de `/api/groups/[id]/mastery`.

## Hors scope

Ces sujets sont identifiés mais non couverts par cette spec :
- Filtre de période (toutes séances pour la v1)
- Export PDF / CSV (consultation à l'écran uniquement pour la v1)
- Détail par séance (si besoin plus tard, on ajoutera une vue matrice)
- Évolution du taux dans le temps (graphique) — non demandé
