#!/bin/bash

# ===========================================
# Amilou - Deployment Script
# ===========================================

set -e

echo "🚀 Déploiement Amilou..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Fichier .env manquant. Copie depuis .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Veuillez configurer le fichier .env avant de continuer.${NC}"
    exit 1
fi

# Pull latest changes
echo -e "${GREEN}📥 Récupération des dernières modifications...${NC}"
git pull origin master

# Build and start with Docker Compose
echo -e "${GREEN}🐳 Construction et démarrage des conteneurs...${NC}"
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# Wait for database to be ready
echo -e "${GREEN}⏳ Attente de la base de données...${NC}"
sleep 10

# Run migrations
echo -e "${GREEN}🗄️  Exécution des migrations...${NC}"
docker-compose run --rm migrate

# Show status
echo -e "${GREEN}✅ Déploiement terminé !${NC}"
echo ""
docker-compose ps
echo ""
echo -e "${GREEN}🌐 Application disponible sur: http://localhost:3000${NC}"
