# Infrastructure Amilou

## Base de données

| Élément | Valeur |
|---------|--------|
| **Provider** | Supabase (Cloud) |
| **Région** | EU West 1 (Irlande) |
| **Host** | `aws-1-eu-west-1.pooler.supabase.com` |
| **Port** | 5432 |
| **Database** | postgres |
| **Project ID** | `eejfdoqakgvbefdjgfut` |

### Accès Supabase Dashboard
- URL: https://supabase.com/dashboard/project/eejfdoqakgvbefdjgfut

### Connection String
```
postgresql://postgres.eejfdoqakgvbefdjgfut:[PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
```

---

## Serveur de Production

| Élément | Valeur |
|---------|--------|
| **IP** | 72.61.105.112 |
| **OS** | Ubuntu |
| **Accès** | SSH root |
| **App URL** | http://72.61.105.112:3000 |

### Structure Docker
```
/docker/amilou/
├── docker-compose.yml
├── .env                 # Variables d'environnement
├── Dockerfile
└── ...
```

### Commandes utiles
```bash
# Se connecter au serveur
ssh root@72.61.105.112

# Aller dans le dossier
cd /docker/amilou

# Voir les logs
docker logs amilou-app -f

# Redémarrer l'app
docker-compose up -d app --no-deps

# Rebuild complet
docker-compose down && docker-compose build --no-cache && docker-compose up -d app --no-deps
```

---

## Déploiement

### Étapes de déploiement
1. **Commit et push** les changements sur `master`
2. **SSH** sur le serveur
3. **Pull et rebuild**:
```bash
cd /docker/amilou
git pull origin master
docker-compose down
docker-compose build --no-cache
docker-compose up -d app --no-deps
```

### Mise à jour du schéma Prisma
La base Supabase se met à jour depuis le poste local:
```bash
cd C:/Users/USER/260108_Amilou
npx prisma db push
```

---

## Variables d'environnement (.env)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Connection string Supabase |
| `NEXTAUTH_URL` | URL de l'app (http://72.61.105.112:3000) |
| `NEXTAUTH_SECRET` | Secret pour NextAuth |
| `AUTH_TRUST_HOST` | true |

---

## Contacts / Accès

- **Supabase**: Compte lié à l'email du projet
- **Serveur**: root@72.61.105.112 (clé SSH)
