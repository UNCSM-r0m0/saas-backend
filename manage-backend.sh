#!/bin/bash
# Script de administración para SAAS Backend + Cloudflared (WSL, sin systemd)
# Autor: r0lm0

APP_NAME="saas-backend"
PROJECT_DIR="/mnt/d/WORKSPACES/NESTJS/chat/saas-backend"

# Cloudflared (ajusta si tu which devuelve otra ruta)
CF_NAME="cloudflared"
CF_BIN="/usr/local/bin/cloudflared"     # salida de: which cloudflared
CF_ARGS=(--no-autoupdate --config /etc/cloudflared/config.yml tunnel run)

# Colores
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

usage() {
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}🚀 ADMINISTRADOR SAAS BACKEND${NC}"
  echo -e "${BLUE}========================================${NC}\n"
  echo -e "${YELLOW}Uso: $0 {comando}${NC}\n"
  echo -e "${GREEN}COMANDOS BACKEND:${NC}"
  echo -e "  ${YELLOW}start${NC}         : Inicia túnel + backend"
  echo -e "  ${YELLOW}stop${NC}          : Detiene backend + túnel"
  echo -e "  ${YELLOW}restart${NC}       : Reinicia backend + túnel"
  echo -e "  ${YELLOW}reload${NC}        : Recarga solo backend (sin downtime)"
  echo -e "  ${YELLOW}status${NC}        : Estado PM2 y endpoints"
  echo -e "  ${YELLOW}logs${NC}          : Logs del backend"
  echo -e "  ${YELLOW}update${NC}        : pull + build + restart backend"
  echo -e "  ${YELLOW}delete${NC}        : Elimina backend de PM2"
  echo -e "  ${YELLOW}build${NC}         : Build del backend"
  echo -e "  ${YELLOW}test${NC}          : Pruebas rápidas de endpoints"
  echo -e "  ${YELLOW}clean${NC}         : Limpia logs/cache/dist"
  echo -e "  ${YELLOW}studio${NC}        : Abre Prisma Studio"
  echo -e "  ${RED}recrear${NC}       : ⚠️ Reset DB + seed\n"
  echo -e "${GREEN}COMANDOS TÚNEL:${NC}"
  echo -e "  ${YELLOW}tunnel-start${NC}  : Inicia Cloudflared en PM2"
  echo -e "  ${YELLOW}tunnel-stop${NC}   : Detiene Cloudflared"
  echo -e "  ${YELLOW}tunnel-restart${NC}: Reinicia Cloudflared"
  echo -e "  ${YELLOW}tunnel-logs${NC}   : Logs de Cloudflared\n"
  echo -e "${BLUE}Ejemplos:${NC}"
  echo -e "  $0 start"
  echo -e "  $0 tunnel-logs"
  exit 1
}

# --- Helpers ---
need_file() {
  local f="$1"
  if [ ! -f "$f" ]; then
    echo -e "${RED}❌ Falta archivo: ${f}${NC}"
    exit 1
  fi
}

check_directory() {
  if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ No existe el directorio del proyecto: $PROJECT_DIR${NC}"
    exit 1
  fi
  cd "$PROJECT_DIR" || { echo -e "${RED}❌ No se pudo entrar a $PROJECT_DIR${NC}"; exit 1; }
  need_file "package.json"
  need_file "ecosystem.config.js"
}

check_cloudflared_bin() {
  if [ ! -x "$CF_BIN" ]; then
    echo -e "${RED}❌ No se encontró cloudflared en ${CF_BIN}${NC}"
    echo -e "${YELLOW}➡️  Ejecuta: which cloudflared y actualiza CF_BIN en este script${NC}"
    exit 1
  fi
}

show_status() {
  echo -e "${BLUE}📊 Estado de PM2:${NC}"
  pm2 status
  echo ""
  echo -e "${BLUE}🌐 Endpoints:${NC}"
  echo -e "  ${GREEN}Health (local):${NC}   http://localhost:3000/api/health"
  echo -e "  ${GREEN}Swagger (local):${NC}  http://localhost:3000/api/docs"
  echo -e "  ${GREEN}API Base (local):${NC} http://localhost:3000/api"
  echo -e "  ${GREEN}Health (dominio):${NC} https://api.r0lm0.dev/api/health"
}

tunnel_start() {
  check_cloudflared_bin
  if ! pm2 describe "$CF_NAME" >/dev/null 2>&1; then
    echo -e "${GREEN}🚀 Iniciando túnel Cloudflared...${NC}"
    pm2 start "$CF_BIN" --name "$CF_NAME" -- "${CF_ARGS[@]}"
  else
    echo -e "${YELLOW}🔄 Arrancando proceso existente de Cloudflared...${NC}"
    pm2 start "$CF_NAME"
  fi
}

tunnel_stop() {
  echo -e "${YELLOW}🛑 Deteniendo Cloudflared...${NC}"
  pm2 stop "$CF_NAME" 2>/dev/null || true
}

tunnel_restart() {
  check_cloudflared_bin
  if pm2 describe "$CF_NAME" >/dev/null 2>&1; then
    echo -e "${YELLOW}🔄 Reiniciando Cloudflared...${NC}"
    pm2 restart "$CF_NAME"
  else
    tunnel_start
  fi
}

# --- Flow principal ---
[ $# -lt 1 ] && usage
check_directory

case "$1" in
  start)
    tunnel_start
    echo -e "${GREEN}🚀 Iniciando '${APP_NAME}'...${NC}"
    pm2 start ecosystem.config.js
    pm2 save
    echo -e "${GREEN}✅ Servicios iniciados${NC}"
    show_status
    ;;

  stop)
    echo -e "${YELLOW}🛑 Deteniendo '${APP_NAME}'...${NC}"
    pm2 stop "$APP_NAME" || true
    tunnel_stop
    pm2 save
    echo -e "${GREEN}✅ Servicios detenidos${NC}"
    pm2 status
    ;;

  restart)
    tunnel_restart
    echo -e "${YELLOW}🔄 Reiniciando '${APP_NAME}'...${NC}"
    pm2 restart "$APP_NAME"
    pm2 save
    echo -e "${GREEN}✅ Servicios reiniciados${NC}"
    show_status
    ;;

  reload)
    echo -e "${YELLOW}♻️ Recargando '${APP_NAME}' (sin downtime)...${NC}"
    pm2 reload "$APP_NAME"
    pm2 save
    echo -e "${GREEN}✅ Aplicación recargada${NC}"
    show_status
    ;;

  status)
    show_status
    ;;

  logs)
    echo -e "${BLUE}📜 Logs de '${APP_NAME}' (Ctrl+C para salir)...${NC}"
    pm2 logs "$APP_NAME" --lines 50 --raw
    ;;

  update)
    echo -e "${BLUE}⬇️ git pull...${NC}"
    git pull origin r0lm0
    echo -e "${BLUE}📦 build...${NC}"
    npm run build:prod
    echo -e "${BLUE}🔄 restart '${APP_NAME}'...${NC}"
    pm2 restart "$APP_NAME"
    pm2 save
    echo -e "${GREEN}✅ Actualización completada${NC}"
    show_status
    ;;

  delete)
    echo -e "${RED}🗑️ Eliminando '${APP_NAME}' de PM2...${NC}"
    pm2 delete "$APP_NAME" || true
    pm2 save
    pm2 status
    ;;

  build)
    echo -e "${BLUE}🔨 Build...${NC}"
    npm run build:prod
    echo -e "${GREEN}✅ Build OK${NC}"
    ;;

  test)
    echo -e "${BLUE}🧪 Probando endpoints...${NC}\n"
    echo -e "${YELLOW}1) Health local:${NC}"
    curl -s http://localhost:3000/api/health | jq . 2>/dev/null || curl -s http://localhost:3000/api/health
    echo ""
    echo -e "${YELLOW}2) Swagger local:${NC}"
    curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:3000/api/docs
    echo ""
    echo -e "${YELLOW}3) API base local (preview):${NC}"
    curl -s http://localhost:3000/api | head -c 100; echo ""
    echo -e "${YELLOW}4) Health dominio:${NC}"
    curl -s -o /dev/null -w "Status: %{http_code}\n" https://api.r0lm0.dev/api/health
    echo -e "${GREEN}✅ Pruebas completadas${NC}"
    ;;

  clean)
    echo -e "${YELLOW}🧹 Limpiando...${NC}"
    pm2 flush
    [ -d "node_modules/.cache" ] && rm -rf node_modules/.cache && echo -e "${GREEN}✅ Limpieza cache node_modules${NC}"
    [ -d "dist" ] && rm -rf dist && echo -e "${GREEN}✅ Limpieza dist${NC}"
    echo -e "${GREEN}✅ Listo${NC}"
    ;;

  studio)
    echo -e "${BLUE}📊 Prisma Studio...${NC}"
    npx prisma studio --schema prisma/schema.prisma
    ;;

  recrear)
    echo -e "${RED}🚨 RESET DB COMPLETO${NC}"
    echo -e "${YELLOW}⚠️  Esto elimina TODOS los datos${NC}\n"
    pm2 stop "$APP_NAME" 2>/dev/null || true
    pkill -f "prisma studio" 2>/dev/null || true
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="true" npx prisma db push --force-reset --schema prisma/schema.prisma
    echo -e "${GREEN}🌱 Seed...${NC}"
    npm run prisma:seed
    echo -e "${GREEN}🔧 Generando cliente Prisma...${NC}"
    npx prisma generate --schema prisma/schema.prisma
    echo -e "${GREEN}✅ DB recreada${NC}"
    ;;

  tunnel-start)
    tunnel_start; pm2 save; pm2 status
    ;;

  tunnel-stop)
    tunnel_stop; pm2 save; pm2 status
    ;;

  tunnel-restart)
    tunnel_restart; pm2 save; pm2 status
    ;;

  tunnel-logs)
    pm2 logs "$CF_NAME" --lines 200 --raw
    ;;

  *)
    usage
    ;;
esac

echo -e "\n${BLUE}========================================${NC}"
