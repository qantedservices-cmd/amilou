# Section Présences sur la page séance

## Contexte

La page `/groups/[id]/sessions/[num]` regroupe tout le contenu d'une séance (commentaires, sujets de recherche, classement, livres, tafsir, PDF…) mais ne permet pas de marquer les présences et absences. Aujourd'hui, la saisie des présences est seulement possible depuis `/sessions/new` au moment de la création — il est ensuite impossible de corriger ces présences depuis la page séance elle-même.

Ce qui change : ajouter une section **Présences** éditable directement sur la page séance, alignée sur la même API et la même règle d'inclusion des membres que la création.

## Emplacement et navigation

- Nouvelle carte `<Card id="sec-presences">` insérée **juste après le header**, **avant** la carte "Points abordés / Devoirs"
- Ajout d'une entrée "Présences" en tête de la **table des matières sticky** (premier item, avant les autres sections)

## Affichage (lecture, tous les rôles)

- Titre `Présences (N présents / M membres)` avec barre de progression mince
- Grille responsive de pastilles élèves (2 colonnes mobile, 3-4 colonnes desktop). Chaque pastille affiche :
  - Nom de l'élève
  - Icône d'état :
    - ✓ vert = présent
    - ✗ rouge = absent
    - ⊘ orange = excusé
- En pied de carte, liste compacte des absents non excusés sous forme de badges gris

## Édition (REFERENT du groupe + ADMIN uniquement)

- Clic sur une pastille = cycle **3 états** : `Présent → Absent → Excusé → Présent`
- **Sauvegarde optimiste** : le state local est mis à jour immédiatement, l'appel API part en arrière-plan
- Endpoint : `PUT /api/sessions/[id]` avec `{ attendance: [{userId, present, excused}] }`
  - Cet endpoint est **déjà existant** et utilisé par `/sessions/new`
- Indicateur discret "Sauvegardé" pendant 2 s après chaque clic
- Pas de bouton "Enregistrer" global — l'autosave par clic suffit (cohérent avec le reste de la page séance)
- En cas d'erreur API : rollback du state local + toast d'erreur

## Liste des élèves incluse

Source : `session.attendance` retourné par `GET /api/sessions/[id]`, qui contient déjà les enregistrements `SessionAttendance` créés à la création de la séance.

Règle d'inclusion (déjà appliquée par `POST /api/sessions` lignes 134-144) : tous les `GroupMember` `isActive=true` ayant :
- `role='MEMBER'`, OU
- `role='REFERENT'` ET `isStudent=true`

Conséquence : Samir apparaît dans la liste pour le groupe Amilou (où il est REFERENT+isStudent), mais pas pour Montmagny ni Famille (où il est REFERENT seul).

## Cas séances anciennes / membres ajoutés a posteriori

Certaines séances ont été créées avant qu'un membre ne rejoigne le groupe. Pour gérer ce cas :

- Côté UI : le composant affiche la liste union de `session.attendance` et des membres actifs du groupe (déjà chargés dans la page via `members`)
- Si un membre actif n'a pas d'enregistrement `SessionAttendance` dans la séance, on affiche une ligne implicite `{present: false, excused: false}`
- `PUT /api/sessions/[id]` doit faire un **upsert** par `(sessionId, userId)` : créer l'enregistrement s'il n'existe pas, mettre à jour sinon
  - Vérifier que la logique actuelle de cet endpoint gère bien ce cas, sinon adapter

## Fichiers impactés

| Fichier | Modification |
|---|---|
| `src/app/[locale]/(dashboard)/groups/[id]/sessions/[num]/page.tsx` | Nouvelle carte `sec-presences`, entrée dans la table des matières, state local d'attendance, handler de clic avec autosave optimiste |
| `src/app/api/sessions/[id]/route.ts` | Vérifier/adapter PUT pour upsert sur `(sessionId, userId)` |

## Hors scope

Les sujets suivants sont identifiés mais traités dans des specs séparées si besoin :

- Refonte du flux `/sessions/new` (pré-sélection silencieuse d'Amilou peu intuitive)
- Affichage de Samir (REFERENT+isStudent) dans la liste de présences de `/sessions/new` (incohérence avec le backend)
