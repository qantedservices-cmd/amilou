#!/bin/bash

# ===========================================
# Amilou - Deployment Script
# ===========================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Default values
COMPOSE_FILE="docker-compose.prod.yml"
DOMAIN=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --dev)
            COMPOSE_FILE="docker-compose.yml"
            shift
            ;;
        --init-ssl)
            INIT_SSL=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo "🚀 Déploiement Amilou..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Fichier .env manquant. Copie depuis .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Veuillez configurer le fichier .env avant de continuer.${NC}"
    echo ""
    echo "Variables requises:"
    echo "  - NEXTAUTH_SECRET (générer avec: openssl rand -base64 32)"
    echo "  - NEXTAUTH_URL (ex: https://amilou.example.com)"
    echo "  - POSTGRES_PASSWORD"
    exit 1
fi

# Pull latest changes
echo -e "${GREEN}📥 Récupération des dernières modifications...${NC}"
git pull origin master

# Initialize SSL certificate
if [ "$INIT_SSL" = true ]; then
    if [ -z "$DOMAIN" ]; then
        echo -e "${RED}❌ Domaine requis pour l'initialisation SSL.${NC}"
        echo "Usage: ./deploy.sh --init-ssl --domain amilou.example.com"
        exit 1
    fi

    echo -e "${GREEN}🔐 Initialisation du certificat SSL pour ${DOMAIN}...${NC}"

    # Create directories
    mkdir -p certbot/conf certbot/www

    # Use init nginx config (without SSL)
    cp nginx/nginx.init.conf nginx/nginx.conf.bak
    cp nginx/nginx.init.conf nginx/nginx.conf

    # Start nginx temporarily
    docker-compose -f $COMPOSE_FILE up -d nginx
    sleep 5

    # Get certificate
    docker-compose -f $COMPOSE_FILE run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email admin@${DOMAIN} \
        --agree-tos \
        --no-eff-email \
        -d ${DOMAIN}

    # Create symbolic link for certificate
    mkdir -p certbot/conf/live/amilou
    ln -sf /etc/letsencrypt/live/${DOMAIN}/fullchain.pem certbot/conf/live/amilou/fullchain.pem 2>/dev/null || true
    ln -sf /etc/letsencrypt/live/${DOMAIN}/privkey.pem certbot/conf/live/amilou/privkey.pem 2>/dev/null || true

    # Restore SSL nginx config
    mv nginx/nginx.conf.bak nginx/nginx.conf 2>/dev/null || true

    # Update nginx config with actual domain
    sed -i "s/server_name _;/server_name ${DOMAIN};/g" nginx/nginx.conf

    echo -e "${GREEN}✅ Certificat SSL obtenu !${NC}"
fi

# Build and start with Docker Compose
echo -e "${GREEN}🐳 Construction et démarrage des conteneurs...${NC}"
docker-compose -f $COMPOSE_FILE down --remove-orphans
docker-compose -f $COMPOSE_FILE build
docker-compose -f $COMPOSE_FILE up -d

# Wait for database to be ready
echo -e "${GREEN}⏳ Attente de la base de données...${NC}"
sleep 10

# Run migrations
echo -e "${GREEN}🗄️  Exécution des migrations...${NC}"
docker-compose -f $COMPOSE_FILE run --rm migrate

# Show status
echo ""
echo -e "${GREEN}✅ Déploiement terminé !${NC}"
echo ""
docker-compose -f $COMPOSE_FILE ps
echo ""

if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
    if [ -n "$DOMAIN" ]; then
        echo -e "${GREEN}🌐 Application disponible sur: https://${DOMAIN}${NC}"
    else
        echo -e "${GREEN}🌐 Application disponible sur: https://votre-domaine.com${NC}"
    fi
else
    echo -e "${GREEN}🌐 Application disponible sur: http://localhost:3000${NC}"
fi
