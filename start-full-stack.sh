#!/bin/bash

# =============================================================================
# 🚀 SCRIPT COMPLETO PARA INICIAR BACKEND + TÚNEL PÚBLICO
# =============================================================================

set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo "🚀 INICIANDO STACK COMPLETO - SAAS BACKEND"
echo "=========================================="
echo ""

# =============================================================================
# PASO 1: ACTUALIZAR Y REINICIAR BACKEND
# =============================================================================
echo -e "${BLUE}📦 PASO 1/4: Actualizando Backend...${NC}"
echo ""

echo -e "${YELLOW}🔨 Compilando aplicación...${NC}"
if npm run build:prod; then
    echo -e "${GREEN}✅ Build exitoso${NC}"
else
    echo -e "${RED}❌ Error en build - abortando${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔄 Reiniciando PM2...${NC}"
# Matar procesos duplicados y reiniciar limpio
pm2 delete saas-backend 2>/dev/null || true
pm2 delete saas-api 2>/dev/null || true

if pm2 start ecosystem.config.js; then
    echo -e "${GREEN}✅ PM2 iniciado correctamente${NC}"
else
    echo -e "${RED}❌ Error iniciando PM2${NC}"
    pm2 logs saas-backend --lines 10
    exit 1
fi

# =============================================================================
# PASO 2: VERIFICAR QUE EL BACKEND FUNCIONA
# =============================================================================
echo ""
echo -e "${BLUE}🧪 PASO 2/4: Verificando Backend...${NC}"
echo ""

echo -e "${YELLOW}⏳ Esperando que el backend esté listo...${NC}"
sleep 5

# Verificar que responde
BACKEND_OK=false
for i in {1..5}; do
    if curl -f -s http://localhost:3000/api > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend respondiendo correctamente${NC}"
        BACKEND_OK=true
        break
    else
        echo -e "${YELLOW}⏳ Intento $i/5 - esperando...${NC}"
        sleep 2
    fi
done

if [ "$BACKEND_OK" = false ]; then
    echo -e "${RED}❌ Backend no responde después de 5 intentos${NC}"
    echo -e "${YELLOW}📊 Logs de PM2:${NC}"
    pm2 logs saas-backend --lines 20
    exit 1
fi

# Mostrar estado de PM2
echo ""
pm2 status

# =============================================================================
# PASO 3: CONFIGURAR TÚNEL PÚBLICO
# =============================================================================
echo ""
echo -e "${BLUE}🌐 PASO 3/4: Configurando Túnel Público...${NC}"
echo ""

# Verificar si el túnel nombrado está funcionando
echo -e "${YELLOW}🔍 Verificando túnel nombrado (api.r0lm0.dev)...${NC}"

# Verificar status del servicio cloudflared
if systemctl is-active --quiet cloudflared; then
    echo -e "${GREEN}✅ Servicio cloudflared activo${NC}"
    
    # Testear si el túnel nombrado funciona
    if curl -f -s https://api.r0lm0.dev/api > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Túnel nombrado funcionando: https://api.r0lm0.dev${NC}"
        TUNNEL_URL="https://api.r0lm0.dev"
        TUNNEL_TYPE="nombrado"
    else
        echo -e "${YELLOW}⚠️  Túnel nombrado no responde, usando Quick Tunnel...${NC}"
        TUNNEL_TYPE="quick"
    fi
else
    echo -e "${YELLOW}⚠️  Servicio cloudflared inactivo, usando Quick Tunnel...${NC}"
    TUNNEL_TYPE="quick"
fi

# =============================================================================
# PASO 4: INICIAR TÚNEL (NOMBRADO O QUICK)
# =============================================================================
echo ""
echo -e "${BLUE}🔗 PASO 4/4: Iniciando Túnel...${NC}"
echo ""

if [ "$TUNNEL_TYPE" = "nombrado" ]; then
    echo -e "${GREEN}🎉 ¡TÚNEL NOMBRADO ACTIVO!${NC}"
    echo -e "${GREEN}🌐 URL Pública: $TUNNEL_URL${NC}"
    
    # Verificar configuración del túnel
    echo ""
    echo -e "${YELLOW}📋 Configuración del túnel:${NC}"
    sudo systemctl status cloudflared --no-pager | head -10
    
    echo ""
    echo -e "${BLUE}🧪 Testing endpoints:${NC}"
    echo "• API: $TUNNEL_URL/api"
    echo "• Swagger: $TUNNEL_URL/api/docs" 
    echo "• Auth: $TUNNEL_URL/api/auth/profile"
    
else
    echo -e "${YELLOW}🚀 Iniciando Cloudflare Quick Tunnel...${NC}"
    echo ""
    echo -e "${BLUE}📋 INFORMACIÓN IMPORTANTE:${NC}"
    echo -e "${YELLOW}• La URL aparecerá abajo - cópiala para tu frontend${NC}"
    echo -e "${YELLOW}• Esta URL es temporal y cambia cada vez que reinicias${NC}"
    echo -e "${YELLOW}• Presiona Ctrl+C para detener el túnel${NC}"
    echo ""
    
    # Matar cualquier quick tunnel existente
    pkill -f "cloudflared tunnel --url" 2>/dev/null || true
    
    # Iniciar quick tunnel
    echo -e "${GREEN}🌐 Iniciando túnel público...${NC}"
    cloudflared tunnel --url http://localhost:3000
fi

# =============================================================================
# INFORMACIÓN FINAL
# =============================================================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ STACK COMPLETAMENTE INICIADO${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

if [ "$TUNNEL_TYPE" = "nombrado" ]; then
    echo -e "${BLUE}🌐 URLs Públicas:${NC}"
    echo -e "${GREEN}  API: https://api.r0lm0.dev/api${NC}"
    echo -e "${GREEN}  Swagger: https://api.r0lm0.dev/api/docs${NC}"
    echo ""
    echo -e "${BLUE}🔧 URLs Locales:${NC}"
    echo -e "${YELLOW}  API: http://localhost:3000/api${NC}"
    echo -e "${YELLOW}  Swagger: http://localhost:3000/api/docs${NC}"
    echo -e "${YELLOW}  Prisma Studio: http://localhost:5555${NC}"
    echo ""
    echo -e "${BLUE}📊 Comandos útiles:${NC}"
    echo -e "${YELLOW}  Ver logs: pm2 logs saas-backend${NC}"
    echo -e "${YELLOW}  Restart: pm2 restart saas-backend${NC}"
    echo -e "${YELLOW}  DB Studio: npm run prisma:studio${NC}"
    echo -e "${YELLOW}  Túnel status: sudo systemctl status cloudflared${NC}"
else
    echo -e "${YELLOW}⚠️  Quick Tunnel iniciado - copia la URL de arriba${NC}"
fi

echo ""
