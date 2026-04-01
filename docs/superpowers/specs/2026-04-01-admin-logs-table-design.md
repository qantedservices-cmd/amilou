# Admin: Historique connexions/invitations + Refonte tableau utilisateurs

## Contexte

La page admin (`/admin`) a besoin de :
1. Tracer les connexions (succes + echecs) et les invitations par email
2. Refondre la liste utilisateurs en tableau avec colonnes, filtres, groupement et indicateurs
3. Un onglet Historique pour consulter le log complet des evenements

## 1. Modeles de donnees (Prisma)

### LoginLog

```prisma
model LoginLog {
  id        String   @id @default(cuid())
  userId    String?
  email     String
  success   Boolean
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([email])
  @@index([createdAt])
}
```

- `userId` nullable : si echec de connexion avec un email inconnu, pas de user
- `email` toujours renseigne pour tracer les echecs
- `ipAddress` extrait de `x-forwarded-for` ou `request.ip`
- `userAgent` extrait du header `user-agent`

### InvitationLog

```prisma
model InvitationLog {
  id         String    @id @default(cuid())
  email      String
  name       String?
  role       String    @default("USER")
  groupId    String?
  invitedBy  String
  status     String    @default("PENDING") // PENDING | ACCEPTED | EXPIRED
  token      String
  sentAt     DateTime  @default(now())
  acceptedAt DateTime?
  expiresAt  DateTime

  inviter User   @relation(fields: [invitedBy], references: [id])
  group   Group? @relation(fields: [groupId], references: [id])

  @@index([email])
  @@index([status])
  @@index([invitedBy])
  @@index([sentAt])
}
```

### Relations a ajouter sur User et Group

```prisma
// User
loginLogs       LoginLog[]
invitationsSent InvitationLog[]

// Group
invitationLogs  InvitationLog[]
```

## 2. Onglet Utilisateurs (refonte)

### Cartes indicateurs (en haut)

| Indicateur | Calcul |
|---|---|
| Total utilisateurs | count(users) |
| Actifs (vert) | derniere connexion < 7 jours |
| Inactifs (rouge) | derniere connexion > 30 jours |
| Invitations en attente | count(InvitationLog where status=PENDING and expiresAt > now) |

### Tableau a colonnes

| Colonne | Source | Triable | Filtrable |
|---|---|---|---|
| Nom | user.name | oui | recherche texte globale |
| Email | user.email | oui | recherche texte globale |
| Role | user.role | oui | select (ADMIN/REFERENT/USER) |
| Groupe(s) | groupMembers.group.name | non | select (liste groupes) |
| Derniere connexion | MAX(loginLogs.createdAt) where success=true | oui | non |
| Connexions | COUNT(loginLogs) where success=true | oui | non |
| Statut activite | pastille basee sur derniere connexion | non | select (actif/moyen/inactif) |
| Invitation | dernier InvitationLog.status ou "aucune" | non | select (acceptee/en attente/expiree/aucune) |
| Actions | Voir en tant que, Modifier, Inviter | non | non |

### Regles des pastilles d'activite

| Pastille | Condition |
|---|---|
| Verte | derniere connexion < 7 jours |
| Orange | derniere connexion entre 7 et 30 jours |
| Rouge | derniere connexion > 30 jours |
| Grise | jamais connecte |

### Groupement

- Select "Grouper par" : Aucun (defaut) / Role / Groupe
- Quand groupe : sections collapsibles avec titre + compteur d'utilisateurs
- Le tri et les filtres s'appliquent a l'interieur de chaque section

### Recherche textuelle

- Champ de recherche existant conserve
- Filtre sur nom + email (client-side, comme actuellement)

## 3. Onglet Historique (Logs)

### Tableau chronologique

| Colonne | Contenu |
|---|---|
| Date/Heure | Timestamp formate (ex: "01/04/2026 16:30") |
| Type | Badge colore : Connexion (vert) / Echec (rouge) / Invitation envoyee (bleu) / Invitation acceptee (vert) |
| Utilisateur | Nom + email |
| Details | IP + navigateur abrege (connexion) ou groupe + role assigne (invitation) |

### Filtres

- Par utilisateur : select avec tous les utilisateurs
- Par type : select (Tous / Connexion / Echec / Invitation)
- Par periode : select (Aujourd'hui / 7 derniers jours / 30 derniers jours / Tout)

### Pagination

- 50 entrees par page
- Boutons Precedent / Suivant + indicateur "Page X sur Y"

### Acces rapide

- Depuis l'onglet Utilisateurs, cliquer sur la colonne "Derniere connexion" ou "Connexions" bascule vers l'onglet Historique filtre sur cet utilisateur

## 4. Captation des evenements

### Connexions reussies

Dans `src/lib/auth.ts`, callback `signIn` de NextAuth :

```typescript
callbacks: {
  async signIn({ user, account }) {
    // Log successful login
    await prisma.loginLog.create({
      data: {
        userId: user.id,
        email: user.email!,
        success: true,
        // IP et userAgent pas disponibles dans le callback signIn
        // On les captera via un middleware ou une API dediee
      }
    })
    return true
  },
}
```

Probleme : le callback `signIn` n'a pas acces aux headers HTTP. Solution : creer un event handler cote client qui appelle une API apres connexion reussie, ou utiliser l'event NextAuth `signIn` cote API.

**Solution retenue** : API `/api/auth/log-login` appelee :
- Par le callback `signIn` de NextAuth pour les succes (sans IP/UA)
- Ou mieux : par un middleware Next.js qui detecte les requetes POST vers `/api/auth/callback/credentials` et log le resultat

**Solution finale pragmatique** :
1. **Succes** : dans le callback `signIn` de NextAuth, on insere le log. Pour IP/UA, on passe par les headers de la requete NextAuth (accessible via `request` dans le handler).
2. **Echec** : nouvelle API `POST /api/auth/login-log` appelee cote client quand le login echoue (la page login detecte deja les erreurs).

### Connexions echouees

Page login (`/login`), quand `signIn()` retourne une erreur :

```typescript
const result = await signIn('credentials', { redirect: false, email, password })
if (result?.error) {
  // Log l'echec
  await fetch('/api/auth/login-log', {
    method: 'POST',
    body: JSON.stringify({ email, success: false })
  })
}
```

L'API `/api/auth/login-log` :
- Accepte uniquement `success: false` (pas de triche)
- Extrait IP et UA des headers
- Rate-limit implicite (pas critique car c'est juste du logging)

### Invitations

Dans `/api/admin/invite` (route existante) :
- Apres envoi email reussi → `InvitationLog.create({ status: 'PENDING', ... })`

Dans `/api/invite` (activation compte) :
- Quand le token est valide et le compte cree → `InvitationLog.update({ status: 'ACCEPTED', acceptedAt: now })`

### Detection des invitations expirees

Pas de cron. Calculee a la volee :
- Si `status === 'PENDING' && expiresAt < now()` → afficher comme "Expiree"

## 5. APIs

### GET /api/admin/logs

Parametres query :
- `userId` (optionnel) : filtrer par utilisateur
- `type` (optionnel) : `login` | `login-fail` | `invitation` | `all` (defaut)
- `period` (optionnel) : `today` | `7d` | `30d` | `all` (defaut)
- `page` (optionnel) : numero de page (defaut 1)
- `limit` (optionnel) : entrees par page (defaut 50)

Reponse :
```json
{
  "logs": [
    {
      "id": "...",
      "type": "login" | "login-fail" | "invitation-sent" | "invitation-accepted",
      "date": "2026-04-01T16:30:00Z",
      "userId": "...",
      "userName": "Samir",
      "userEmail": "samir@example.com",
      "details": { "ipAddress": "...", "userAgent": "..." }
    }
  ],
  "total": 234,
  "page": 1,
  "totalPages": 5
}
```

Implementation : 2 requetes paralleles (LoginLog + InvitationLog), fusion + tri par date, pagination.

### GET /api/admin/stats (mise a jour)

Ajouter dans la reponse existante :
```json
{
  "loginStats": {
    "activeCount": 12,      // connexion < 7j
    "mediumCount": 3,       // connexion 7-30j
    "inactiveCount": 2,     // connexion > 30j
    "neverConnected": 1,    // aucun LoginLog
    "pendingInvites": 3     // InvitationLog PENDING non expirees
  },
  "lastLogins": {
    "userId1": "2026-04-01T16:30:00Z",
    "userId2": "2026-03-28T10:00:00Z"
  },
  "loginCounts": {
    "userId1": 45,
    "userId2": 12
  },
  "inviteStatuses": {
    "email1@test.com": "ACCEPTED",
    "email2@test.com": "PENDING"
  }
}
```

### POST /api/auth/login-log

Body : `{ email: string, success: false }`
- Uniquement pour les echecs (success=true refuse)
- Extrait IP de `x-forwarded-for` ou `x-real-ip`
- Extrait UA de `user-agent`
- Cherche userId par email si l'utilisateur existe

## 6. Fichiers impactes

| Fichier | Modification |
|---|---|
| `prisma/schema.prisma` | Ajout LoginLog, InvitationLog, relations |
| `src/lib/auth.ts` | Callback signIn pour logger les connexions reussies |
| `src/app/[locale]/login/page.tsx` | Appel API login-log sur echec |
| `src/app/api/auth/login-log/route.ts` | Nouvelle API (echecs connexion) |
| `src/app/api/admin/logs/route.ts` | Nouvelle API (consultation logs) |
| `src/app/api/admin/stats/route.ts` | Ajout loginStats, lastLogins, loginCounts |
| `src/app/api/admin/invite/route.ts` | Creer InvitationLog apres envoi |
| `src/app/api/invite/route.ts` | Mettre a jour InvitationLog sur activation |
| `src/app/[locale]/(dashboard)/admin/page.tsx` | Refonte onglet Utilisateurs + nouvel onglet Historique |
