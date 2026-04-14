# Suivi Livres en Seance — Spec

## Contexte

L'annexe 3 du rapport PDF contient actuellement des donnees hardcodees pour le livre Arc en Ciel. On remplace par un systeme dynamique : saisie de l'avancement livre en seance, stockage en DB, generation automatique dans le PDF.

## 1. Modele de donnees

### SessionBookProgress (nouveau)

```prisma
model SessionBookProgress {
  id         String   @id @default(cuid())
  sessionId  String
  bookId     String
  chapterId  String?
  pageStart  Int?
  pageEnd    Int?
  isRead     Boolean  @default(false)
  isQaDone   Boolean  @default(false)
  comment    String?
  createdBy  String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  session GroupSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  book    Book         @relation(fields: [bookId], references: [id])
  chapter BookChapter? @relation(fields: [chapterId], references: [id])

  @@index([sessionId])
  @@index([bookId])
}
```

### Relations a ajouter

```prisma
// GroupSession
bookProgress SessionBookProgress[]

// Book
sessionProgress SessionBookProgress[]

// BookChapter
sessionProgress SessionBookProgress[]
```

## 2. Gestion chapitres post-creation

### API: POST /api/books/[id]/chapters

Existe deja. Le referent peut ajouter des chapitres apres la creation du livre :

- `title` (requis), `titleAr` (optionnel)
- `parentId` (optionnel — null = racine, ou ID d'un chapitre parent)
- `pageStart`, `pageEnd` (optionnel)
- `chapterNumber`, `sortOrder`

Auto-creation d'items (pages) si pageStart et pageEnd fournis.

Accessible aux ADMIN et REFERENT du groupe qui a le livre.

### UI: Bouton "Ajouter un chapitre" sur la page livre

Sur `/books/[id]`, visible pour ADMIN et REFERENT :
- Dialog avec : titre, titre arabe, chapitre parent (select), page debut, page fin
- Le chapitre cree apparait immediatement dans l'arbre

## 3. Saisie avancement livre en seance

### API: /api/sessions/[id]/book-progress

**GET** — Retourne les entrees SessionBookProgress de la seance, avec livre et chapitre inclus.

**POST** — Cree une entree :
```json
{
  "bookId": "...",
  "chapterId": "..." (optionnel),
  "pageStart": 26,
  "pageEnd": 27,
  "isRead": true,
  "isQaDone": true,
  "comment": "Revoir definition Nisab"
}
```
Accessible aux ADMIN et REFERENT uniquement.

**PUT** — Modifie une entree existante (meme champs).

**DELETE** — Supprime une entree.

### UI: Section "Avancement Livres" dans la page seance

Dans `/groups/[id]/sessions/[num]`, nouvelle section apres les recitations :

- Titre : "Avancement Livres"
- Liste des entrees existantes pour cette seance avec : livre, chapitre/cours, pages, statuts, commentaire, boutons editer/supprimer
- Formulaire d'ajout :
  - Select livre (parmi les livres du groupe)
  - Select chapitre (arbre : chapitre > cours, filtre par livre selectionne)
  - Pages debut / fin
  - Checkboxes : Lu en classe / Q&R faites
  - Commentaire (texte libre)
  - Bouton Ajouter

Visible uniquement pour REFERENT et ADMIN.

## 4. Rapport PDF — Annexe 3 dynamique

### Remplacement de l'annexe 3 hardcodee

L'annexe 3 actuelle (donnees Arc en Ciel en dur dans le code) est remplacee par une generation dynamique.

### Source des donnees

Requete : tous les `SessionBookProgress` du groupe pour les seances dans la plage selectionnee (annexeArcEnCielFrom → annexeArcEnCielTo), groupes par livre.

### Format du tableau (un par livre du groupe)

Titre : "Annexe 3 — [Nom du livre]"

| Ch. | Titre Chapitre | N° | Titre Cours | Pages | Lecture | Q/R |
|---|---|---|---|---|---|---|
| 1 | La croyance musulmane | 1 | Noms et Attributs d'Allah | 2-5 | S2 | S2 |
| 1 | La croyance musulmane | 2 | Les Anges | 6-9 | S4 | S4 |
| 3 | L'Adoration | 1 | La Zakat | 26-27 | S17 | S17 |

- Lignes = chapitres depth 0 × cours depth 1
- Colonnes Lecture/Q/R = numero de seance ou le cours a ete couvert (depuis SessionBookProgress)
- Cours non couverts = "—"
- Commentaires affiches en dessous du tableau si presents

### Generation

- Pour chaque livre du groupe ayant des SessionBookProgress dans la plage de seances :
  - Recuperer la structure du livre (chapitres + cours)
  - Pour chaque cours, trouver le SessionBookProgress correspondant (match par chapterId)
  - Remplir le tableau avec le numero de seance

Si aucun livre n'a d'avancement → section omise du PDF.

S'il y a plusieurs livres → une page par livre.

## 5. Fichiers impactes

| Fichier | Modification |
|---|---|
| `prisma/schema.prisma` | Ajout SessionBookProgress + relations |
| `src/app/api/sessions/[id]/book-progress/route.ts` | Nouvelle API CRUD |
| `src/app/[locale]/(dashboard)/groups/[id]/sessions/[num]/page.tsx` | Section saisie avancement livres |
| `src/app/[locale]/(dashboard)/groups/[id]/mastery/page.tsx` | Remplacement annexe 3 hardcodee par dynamique |
| `src/app/[locale]/(dashboard)/books/[id]/page.tsx` | Bouton ajout chapitre (referent/admin) |
| `src/app/api/books/[id]/chapters/route.ts` | Verifier/completer POST avec auto-creation items |
