#!/bin/bash

# Script rápido para actualizar el backend después de cambios

echo "======================================"
echo "🔄 ACTUALIZANDO BACKEND"
echo "======================================"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}1/3 Compilando cambios...${NC}"
npm run build:prod

echo ""
echo -e "${YELLOW}2/3 Reiniciando con PM2...${NC}"
pm2 restart saas-backend

echo ""
echo -e "${YELLOW}3/3 Verificando estado...${NC}"
pm2 status

echo ""
echo -e "${GREEN}✅ BACKEND ACTUALIZADO${NC}"
echo ""
echo "📊 Ver logs en tiempo real:"
echo "   pm2 logs saas-backend"
echo ""

