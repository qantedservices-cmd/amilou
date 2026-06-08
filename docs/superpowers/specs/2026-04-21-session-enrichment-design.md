# Enrichissement page Séance — Sujets de recherche, commentaire, tafsir

## 1. Sujets de recherche dans la page Séance

### Etat actuel
- La saisie des sujets se fait uniquement dans la page Grille de suivi (mastery)
- La page séance a juste une checkbox "Sujets de recherches" dans les points abordés
- Le modèle ResearchTopic existe : question, réponse (answer), assignedTo, isValidated, sessionId

### Ce qui change
Ajouter une section "Sujets de recherche" dans la page séance (`/groups/[id]/sessions/[num]`) :

- **Sujets en attente** : liste des sujets non validés du groupe (question + assigné à), le référent peut saisir la réponse et marquer comme validé
- **Ajouter un sujet** : formulaire (assigné à, question), lié à cette séance
- **Historique** : tous les sujets du groupe (validés + en attente), comme dans l'annexe PDF

API existante : `GET/POST/PATCH/DELETE /api/groups/[id]/research-topics` — à réutiliser.

## 2. Commentaire général de séance

### Etat actuel
- Le champ `GroupSession.notes` existe en DB
- Il n'est pas exposé dans l'UI de la page séance

### Ce qui change
Ajouter un champ texte "Commentaire de la séance" dans la page séance, visible et éditable par le référent. Sauvegardé dans `GroupSession.notes`.

## 3. Suivi Tafsir/Traduction par séance

### Etat actuel
- `GroupSession.tafsirEntries` (Json) stocke `[{type: 'SENS'|'TAFSIR', surahNumber, verseStart, verseEnd}]`
- La page séance a un champ pour saisir ces entrées (dans les points abordés)
- Mais pas de vue progression d'une séance à l'autre

### Ce qui change
- Enrichir la section tafsir existante dans la page séance avec un résumé "dernière séance : Al-Baqara v.1-20"
- Permettre de saisir les versets couverts cette séance (sourate, verseStart, verseEnd, type SENS/TAFSIR)
- Afficher la progression cumulative

## 4. Grille Tafsir/Traduction par groupe

### Nouvelle page/onglet
Accessible depuis le menu du groupe ou la grille de suivi. Affiche l'avancement collectif :

| Sourate | Tafsir | Traduction |
|---|---|---|
| 1. Al-Fatiha | Complet | Complet |
| 2. Al-Baqara | v.1-40 | v.1-20 |

- Données depuis les `tafsirEntries` de toutes les séances du groupe
- Sourates sans données collapsées (même pattern)

## 5. Fichiers impactés

| Fichier | Modification |
|---|---|
| `src/app/[locale]/(dashboard)/groups/[id]/sessions/[num]/page.tsx` | Sujets de recherche + commentaire + résumé tafsir |
| `src/app/api/sessions/[id]/route.ts` | Exposer/sauvegarder notes |
| Grille tafsir groupe (nouveau) | Vue matricielle tafsir/traduction |
