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

### Tableau résumé (toujours visible)

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

### Matrice détaillée (collapsible)

Sous le tableau résumé, une section repliable **"Détail par séance"** (fermée par défaut).

Tableau matrice :
- **Lignes** : 1 par élève (même ordre que le résumé)
- **Colonnes** : 1 par séance (S1, S2, … Sn) + en-tête date courte (JJ/MM)
- **Cellules** : pastille colorée selon l'état
  - ✓ vert = présent
  - ✗ rouge = absent
  - ⊘ orange = excusé
  - – gris = aucun enregistrement (membre ajouté après cette séance)
- Largeur : scroll horizontal si > N colonnes (responsive)
- Colonne fixe à gauche pour le nom de l'élève
- Survol d'une cellule → tooltip avec date complète + état

**Édition (ADMIN + REFERENT du groupe uniquement)** :
- Clic sur une cellule cycle l'état : Présent → Absent → Excusé → Présent
- Sauvegarde optimiste (state local immédiat, appel `PUT /api/sessions/[sessionId]` en arrière-plan)
- Rollback + toast erreur en cas d'échec
- Recalcul automatique de la colonne `Taux` du résumé après modification
- Pas d'édition possible pour les non-référents → cellules en lecture seule

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
  isReferent: boolean              // permission édition matrice
  sessions: Array<{
    id: string                     // pour PUT /api/sessions/[sessionId]
    number: number                 // S1, S2, …
    date: string                   // ISO
  }>
  members: Array<{
    userId: string
    name: string
    presentCount: number
    absentCount: number
    excusedCount: number
    rate: number                   // 0-100
    perSession: Array<{
      sessionId: string
      present: boolean
      excused: boolean
      hasRecord: boolean           // false = aucun SessionAttendance (gris)
    }>
  }>
}
```

Calculs en 2 requêtes :
1. `groupSession.findMany` pour récupérer toutes les séances du groupe (id, date, attendance inclus)
2. `groupMember.findMany` filtré sur les élèves actifs (MEMBER + REFERENT/isStudent)

Agrégation en JavaScript côté serveur (volume faible, ~30 séances × 20 membres max).

### Édition

Pas de nouvelle route : on réutilise `PUT /api/sessions/[sessionId]` (déjà existant, déjà en upsert depuis la spec Présences) avec body `{ attendance: [{ userId, present, excused }] }`. Une seule cellule modifiée = un seul appel.

## Permissions

| Rôle | Résumé | Matrice (lecture) | Matrice (édition) |
|---|---|---|---|
| USER (membre du groupe) | ✓ | ✓ | ✗ |
| REFERENT du groupe | ✓ | ✓ | ✓ |
| ADMIN | ✓ (tous groupes) | ✓ | ✓ |
| Externe au groupe | ✗ (403) | — | — |

Réutilise le pattern de permissions de `/api/groups/[id]/mastery`. L'édition est protégée par le check existant dans `PUT /api/sessions/[sessionId]` (rôle global ADMIN OU membership REFERENT/ADMIN du groupe).

## Hors scope

Ces sujets sont identifiés mais non couverts par cette spec :
- Filtre de période (toutes séances pour la v1)
- Export PDF / CSV (consultation à l'écran uniquement pour la v1)
- Évolution du taux dans le temps (graphique) — non demandé
- Édition en masse (sélection multiple de cellules) — un clic par cellule pour la v1
