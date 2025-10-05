#!/bin/bash

# =============================================================================
# 🚀 SCRIPT DE DEPLOY COMPLETO PARA UBUNTU 22.04
# =============================================================================

set -e  # Salir si hay error

echo "======================================"
echo "🚀 SAAS BACKEND - DEPLOY EN UBUNTU"
echo "======================================"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# =============================================================================
# PASO 1: VERIFICAR POSTGRESQL
# =============================================================================
echo -e "${YELLOW}📊 Paso 1/7: Verificando PostgreSQL...${NC}"

if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL no está instalado. Instalando...${NC}"
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
    echo -e "${GREEN}✅ PostgreSQL instalado${NC}"
else
    echo -e "${GREEN}✅ PostgreSQL ya está instalado${NC}"
fi

# Verificar que esté corriendo
if sudo systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✅ PostgreSQL está corriendo${NC}"
else
    echo -e "${YELLOW}⚠️  PostgreSQL no está corriendo. Iniciando...${NC}"
    sudo systemctl start postgresql
fi

# =============================================================================
# PASO 2: CREAR BASE DE DATOS Y USUARIO
# =============================================================================
echo ""
echo -e "${YELLOW}📊 Paso 2/7: Configurando base de datos...${NC}"

# Verificar si la base de datos ya existe
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='saas_db'")

if [ "$DB_EXISTS" = "1" ]; then
    echo -e "${GREEN}✅ Base de datos 'saas_db' ya existe${NC}"
else
    echo -e "${YELLOW}Creando base de datos y usuario...${NC}"
    sudo -u postgres psql <<'SQL'
CREATE USER saas WITH PASSWORD 'postgres';
CREATE DATABASE saas_db OWNER saas;
GRANT ALL PRIVILEGES ON DATABASE saas_db TO saas;
\q
SQL
    echo -e "${GREEN}✅ Base de datos 'saas_db' creada${NC}"
fi

# =============================================================================
# PASO 3: CREAR ARCHIVO .ENV
# =============================================================================
echo ""
echo -e "${YELLOW}📊 Paso 3/7: Configurando variables de entorno...${NC}"

if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Archivo .env ya existe. Creando backup...${NC}"
    cp .env .env.backup.$(date +%s)
fi

cat > .env << 'EOF'
# Application
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL="postgresql://saas:postgres@localhost:5432/saas_db?schema=public"

# JWT
JWT_SECRET=super_secreto_produccion_2025_change_me
JWT_EXPIRATION=7d

# OAuth - Google (CAMBIAR POR TUS VALORES REALES)
GOOGLE_CLIENT_ID=tu_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-tu_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# OAuth - GitHub (CAMBIAR POR TUS VALORES REALES)
GITHUB_CLIENT_ID=Ov23li_tu_github_client_id
GITHUB_CLIENT_SECRET=tu_github_client_secret_40_caracteres
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback

# Frontend
FRONTEND_URL=http://localhost:3001

# Ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:7b

# Rate Limits - Anonymous
FREE_USER_MESSAGE_LIMIT=3
FREE_USER_MAX_TOKENS=512

# Rate Limits - Registered
REGISTERED_USER_MESSAGE_LIMIT=10
REGISTERED_USER_MAX_TOKENS=2048

# Rate Limits - Premium
PREMIUM_USER_MESSAGE_LIMIT=1000
PREMIUM_USER_MAX_TOKENS=8192

# Stripe (placeholder)
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
STRIPE_PREMIUM_PRICE_ID=price_placeholder

# File Upload
MAX_FILE_SIZE_MB=10
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp

# Admin
ADMIN_EMAIL=rolmo92@gmail.com
ADMIN_PASSWORD=Jenny23.!
EOF

echo -e "${GREEN}✅ Archivo .env creado${NC}"

# =============================================================================
# PASO 4: MIGRACIONES DE PRISMA
# =============================================================================
echo ""
echo -e "${YELLOW}📊 Paso 4/7: Ejecutando migraciones de Prisma...${NC}"

npx prisma migrate deploy
echo -e "${GREEN}✅ Migraciones aplicadas${NC}"

# =============================================================================
# PASO 5: SEED DE BASE DE DATOS (OPCIONAL)
# =============================================================================
echo ""
echo -e "${YELLOW}📊 Paso 5/7: Ejecutando seed de datos iniciales...${NC}"

if npm run prisma:seed 2>/dev/null; then
    echo -e "${GREEN}✅ Seed ejecutado correctamente${NC}"
else
    echo -e "${YELLOW}⚠️  No hay script de seed o ya se ejecutó antes${NC}"
fi

# =============================================================================
# PASO 6: BUILD DE PRODUCCIÓN
# =============================================================================
echo ""
echo -e "${YELLOW}📊 Paso 6/7: Compilando aplicación para producción...${NC}"

npm run build:prod
echo -e "${GREEN}✅ Build completado${NC}"

# Verificar que el build se creó
if [ -f "dist/src/main.js" ]; then
    echo -e "${GREEN}✅ Archivo dist/src/main.js generado correctamente${NC}"
else
    echo -e "${RED}❌ Error: No se generó el archivo dist/src/main.js${NC}"
    exit 1
fi

# =============================================================================
# PASO 7: CONFIGURAR PM2
# =============================================================================
echo ""
echo -e "${YELLOW}📊 Paso 7/7: Configurando PM2...${NC}"

# Instalar PM2 si no está instalado
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Instalando PM2 globalmente...${NC}"
    sudo npm install -g pm2
    echo -e "${GREEN}✅ PM2 instalado${NC}"
else
    echo -e "${GREEN}✅ PM2 ya está instalado${NC}"
fi

# Detener proceso anterior si existe
pm2 delete saas-api 2>/dev/null || true

# Iniciar aplicación con PM2
echo -e "${YELLOW}Iniciando aplicación con PM2...${NC}"
pm2 start ecosystem.config.js

# Guardar configuración de PM2
pm2 save

# Configurar PM2 para que arranque al iniciar el sistema
echo -e "${YELLOW}Configurando PM2 para inicio automático...${NC}"
pm2 startup systemd -u $USER --hp $HOME | grep "sudo" | bash || true

echo ""
echo "======================================"
echo -e "${GREEN}✅ DEPLOY COMPLETADO EXITOSAMENTE${NC}"
echo "======================================"
echo ""
echo "📊 Estado de la aplicación:"
pm2 status

echo ""
echo "📍 URLs:"
echo "   - API: http://localhost:3000/api"
echo "   - Swagger: http://localhost:3000/api/docs"
echo ""
echo "📝 Comandos útiles:"
echo "   pm2 logs saas-api          # Ver logs en tiempo real"
echo "   pm2 restart saas-api       # Reiniciar aplicación"
echo "   pm2 stop saas-api          # Detener aplicación"
echo "   pm2 status                 # Ver estado"
echo ""
echo "🌐 Para exponer públicamente, ejecuta:"
echo "   ./setup-tunnel.sh          # Configura Cloudflare Tunnel"
echo ""

