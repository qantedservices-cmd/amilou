# Roadmap : Suivi Récitations & Mastery

## Objectif
Permettre la saisie en séance des récitations d'élèves avec suivi par sourate, commentaires indexés par séance, et statuts (AM, V12, PARTIAL...).

---

## Architecture

```
GitHub (qantedservices-cmd/amilou)
    ↓ push
Serveur 72.61.105.112:3000 (Docker)
    ↓ DATABASE_URL
Supabase PostgreSQL (aws-1-eu-west-1)
```

---

## Phase 1 : Base de données

| # | Tâche | Status |
|---|-------|--------|
| 1.1 | Ajouter `SurahMastery` dans schema.prisma | ✅ |
| 1.2 | Ajouter `SurahRecitation` dans schema.prisma | ✅ |
| 1.3 | Créer et appliquer migration Prisma | ✅ |
| 1.4 | Créer groupe "Cours Montmagny" (14 élèves) | ✅ |
| 1.5 | Créer groupe "Famille" (7 membres) | ✅ |
| 1.6 | Créer les 21 utilisateurs | ✅ |

---

## Phase 2 : APIs

| # | Tâche | Endpoint | Status |
|---|-------|----------|--------|
| 2.1 | Créer session de groupe | POST `/api/sessions` | ✅ |
| 2.2 | Lister sessions | GET `/api/sessions` | ✅ |
| 2.3 | Sauvegarder présences | POST `/api/sessions/[id]/attendance` | ✅ (existant) |
| 2.4 | Ajouter récitation | POST `/api/sessions/[id]/recitations` | ✅ |
| 2.5 | Lister récitations séance | GET `/api/sessions/[id]/recitations` | ✅ |
| 2.6 | Mastery par élève | GET `/api/students/[id]/mastery` | ✅ |
| 2.7 | Historique récitations élève | GET `/api/students/[id]/recitations` | ✅ |
| 2.8 | Mise à jour mastery auto | (dans POST recitation) | ✅ |

---

## Phase 3 : Interface saisie séance

| # | Tâche | Page/Composant | Status |
|---|-------|----------------|--------|
| 3.1 | Bouton "Nouvelle séance" | `/sessions` | ✅ |
| 3.2 | Page création séance | `/sessions/new` | ✅ |
| 3.3 | Sélecteur de groupe | `GroupSelector` | ✅ |
| 3.4 | Grille présences (checkboxes) | `AttendanceGrid` | ✅ |
| 3.5 | Liste élèves présents | `PresentStudentsList` | ✅ |
| 3.6 | Formulaire récitations | `RecitationForm` | ✅ |
| 3.7 | Sélecteur sourate + versets | `SurahVerseSelector` | ✅ |
| 3.8 | Sélecteur statut (AM, V, etc.) | `StatusSelector` | ✅ |
| 3.9 | Champ commentaire | (dans RecitationForm) | ✅ |
| 3.10 | Bouton enregistrer séance | (validation complète) | ✅ |

---

## Phase 4 : Interface consultation

| # | Tâche | Page/Composant | Status |
|---|-------|----------------|--------|
| 4.1 | Grille mastery élève (sourates × statuts) | `/students/[id]` | ⬜ |
| 4.2 | Historique récitations par sourate | Modal `RecitationHistory` | ⬜ |
| 4.3 | Vue groupe (tous élèves) | `/groups/[id]/mastery` | ⬜ |
| 4.4 | Filtre par sourate/statut | (dans vues) | ⬜ |
| 4.5 | Export Excel | Bouton export | ⬜ |

---

## Phase 5 : Import données Excel

| # | Tâche | Status |
|---|-------|--------|
| 5.1 | Script import présences Montmagny | ⬜ |
| 5.2 | Script import mastery (statuts V12, AM...) | ⬜ |
| 5.3 | Script import commentaires séances | ⬜ |
| 5.4 | Script import données Famille | ⬜ |
| 5.5 | Vérification données importées | ⬜ |

---

## Phase 6 : Déploiement

| # | Tâche | Status |
|---|-------|--------|
| 6.1 | Build local | ⬜ |
| 6.2 | Tests fonctionnels | ⬜ |
| 6.3 | Push GitHub | ⬜ |
| 6.4 | Déployer sur serveur | ⬜ |
| 6.5 | Vérifier en production | ⬜ |

---

## Modèles de données

### SurahMastery (état actuel par élève/sourate)
```prisma
model SurahMastery {
  id            String   @id @default(cuid())
  userId        String
  surahNumber   Int
  status        String   // AM | PARTIAL | VALIDATED | KNOWN
  validatedWeek Int?
  validatedAt   DateTime?
  verseStart    Int?
  verseEnd      Int?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  surah Surah @relation(fields: [surahNumber], references: [number])

  @@unique([userId, surahNumber])
  @@index([userId])
}
```

### SurahRecitation (historique par séance)
```prisma
model SurahRecitation {
  id          String   @id @default(cuid())
  sessionId   String
  userId      String
  surahNumber Int
  type        String   // MEMORIZATION | REVISION
  verseStart  Int
  verseEnd    Int
  status      String   // AM | PARTIAL | VALIDATED | KNOWN
  comment     String?
  createdBy   String
  createdAt   DateTime @default(now())

  session GroupSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  user    User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  surah   Surah        @relation(fields: [surahNumber], references: [number])

  @@index([sessionId])
  @@index([userId, surahNumber])
}
```

---

## Groupes à créer

### Cours Montmagny (14 élèves)
1. AIT ASSI Nassim
2. ATTAR Yanis
3. BEN BELKACEM Iyad
4. BEN BELKACEM Sabri
5. BOUAZZOUZ Sofiane
6. BRIK Imran
7. DJOUADI Souheil
8. FLILOU Houdeyfa
9. GHANEM Anass
10. KHEIR Mohamed
11. LOGHMARI Bilel
12. MEDINI Younes
13. RAMI Selim
14. TANDJIGORA Luqman

### Famille (7 membres)
1. Haroun
2. Hiba
3. Bilel
4. Esma
5. Inès
6. Tasnim
7. Siwar

---

## Notes
- Compatible avec système existant (Progress, Groupe Amilou)
- Utilisable par tous les groupes
- Commentaires indexés par séance (historique complet)
