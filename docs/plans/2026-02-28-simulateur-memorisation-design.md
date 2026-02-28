# Simulateur de projection - Mémorisation

## Contexte

Ajouter un outil de projection qui permet de visualiser quand l'utilisateur terminera sa mémorisation du Coran, et de simuler différents scénarios en modifiant le rythme.

## Décisions prises

- **Programme :** Mémorisation uniquement (seul programme avec une "fin")
- **Base du rythme :** Rythme réel calculé depuis l'historique Progress (pas les objectifs configurés)
- **Période de calcul :** 3 derniers mois (90 jours)
- **Architecture :** Hybride - calcul du rythme côté API, projections côté client
- **Conversions :** Basées sur la table `Verse` (données exactes), pas des moyennes

## Architecture

### 1. API - Champ `memorizationPace` dans `/api/stats`

Ajout dans la réponse existante :

```typescript
memorizationPace: {
  versesPerDay: number       // moyenne versets/jour sur jours actifs (3 mois)
  activeDays: number         // jours avec au moins 1 entrée mémorisation
  totalDays: number          // jours calendaires (90)
  totalNewVerses: number     // versets mémorisés sur la période
  consistency: number        // activeDays / totalDays (0 à 1)
  remainingVerses: number    // versets non encore mémorisés
  remainingPages: number     // pages restantes (depuis table Verse)
  remainingHizbs: number     // hizbs restants
  remainingJuz: number       // juz restants
} | null                     // null si aucune donnée
```

**Calcul du rythme :**
1. Récupérer toutes les entrées `Progress` du programme MEMORIZATION des 90 derniers jours
2. Sommer les versets distincts par jour (verseEnd - verseStart + 1)
3. `versesPerDay` = totalNewVerses / activeDays
4. `consistency` = activeDays / totalDays

**Calcul des restants :**
1. Récupérer les versets mémorisés (depuis `globalProgress.memorizedVerses`)
2. Compter dans `Verse` les pages/hizbs/juz correspondant aux versets restants

**Table de correspondance pour le simulateur :**
Ajouter un champ `versemilestones` : tableau de jalons tous les ~100 versets mémorisés supplémentaires, avec la page/hizb/juz correspondante. Permet au client de convertir un nombre de versets projetés en unités lisibles sans requêtes supplémentaires.

```typescript
verseMilestones: Array<{
  verses: number   // nombre cumulé de versets depuis le point actuel
  page: number
  hizb: number
  juz: number
  surah: number    // numéro de sourate atteinte
}>
```

### 2. Carte Dashboard - "Projection Mémorisation"

**Position :** Après la carte "Mon Avancement Global - Mémorisation".

**Contenu :**
- Rythme actuel : `X versets/jour`
- Restant : `Y versets`
- Fin estimée : `Mois Année` (remainingVerses / versesPerDay / consistency)
- Bouton "Simuler" → ouvre le dialog

**Cas limites :**
- Aucune donnée sur 3 mois → "Pas assez de données pour projeter"
- Mémorisation terminée (100%) → message de félicitations, pas de projection

### 3. Dialog Simulateur

Dialog modal ouvert par le bouton "Simuler".

**Paramètre commun (en haut) :**
- Rythme modifiable : input numérique + sélecteur d'unité (versets/jour, pages/semaine, hizb/mois)
- Pré-rempli avec le rythme réel
- Label de référence : "Rythme actuel : X versets/jour"

**3 onglets :**

1. **"Quand je finis ?"** (défaut)
   - Affiche la date de fin estimée au rythme choisi
   - Se recalcule quand on modifie le rythme

2. **"Quand j'atteins X ?"**
   - Input : quantité + unité (versets, pages, hizbs, juz)
   - Résultat : date estimée

3. **"Où j'en serai le X ?"**
   - Date picker : date future
   - Résultat : niveau atteint (versets, pages, hizbs, juz, sourates, %)

**Conversions :** Utilisent la table `verseMilestones` pour convertir versets → autres unités.

**Pas de sauvegarde :** Tout est éphémère, purement simulation.

## Fichiers impactés

- `src/app/api/stats/route.ts` — ajout calcul `memorizationPace` + `verseMilestones`
- `src/app/[locale]/(dashboard)/dashboard/page.tsx` — ajout carte projection
- Nouveau : `src/components/SimulatorCard.tsx` — carte synthèse
- Nouveau : `src/components/SimulatorDialog.tsx` — dialog interactif

## Non-inclus

- Projection pour d'autres programmes (révision, lecture, etc.)
- Sauvegarde de scénarios
- Comparaison objectif configuré vs rythme réel (peut-être plus tard)
