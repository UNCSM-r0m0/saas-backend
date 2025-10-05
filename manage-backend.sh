#!/bin/bash

# Script de administración para SAAS Backend
# Autor: r0lm0
# Descripción: Administra la aplicación NestJS con PM2

APP_NAME="saas-backend"
PROJECT_DIR="/mnt/d/WORKSPACES/NESTJS/unscm/saas-backend"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar el uso del script
usage() {
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}🚀 ADMINISTRADOR SAAS BACKEND${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
  echo -e "${YELLOW}Uso: $0 {comando}${NC}"
  echo ""
  echo -e "${GREEN}COMANDOS DISPONIBLES:${NC}"
  echo -e "  ${YELLOW}start${NC}     : Inicia la aplicación '$APP_NAME' con PM2"
  echo -e "  ${YELLOW}stop${NC}      : Detiene la aplicación '$APP_NAME'"
  echo -e "  ${YELLOW}restart${NC}   : Reinicia la aplicación '$APP_NAME'"
  echo -e "  ${YELLOW}reload${NC}    : Recarga la aplicación (sin downtime)"
  echo -e "  ${YELLOW}status${NC}    : Muestra el estado de la aplicación"
  echo -e "  ${YELLOW}logs${NC}      : Muestra los logs en tiempo real"
  echo -e "  ${YELLOW}update${NC}    : Actualiza código, reconstruye y reinicia"
  echo -e "  ${YELLOW}delete${NC}    : Elimina la aplicación de PM2"
  echo -e "  ${YELLOW}build${NC}     : Solo reconstruye la aplicación"
  echo -e "  ${YELLOW}test${NC}      : Prueba los endpoints principales"
  echo -e "  ${YELLOW}clean${NC}     : Limpia logs y archivos temporales"
  echo ""
  echo -e "${BLUE}Ejemplos:${NC}"
  echo -e "  $0 start    # Iniciar aplicación"
  echo -e "  $0 logs     # Ver logs en tiempo real"
  echo -e "  $0 update   # Actualizar y reiniciar"
  echo ""
  exit 1
}

# Función para verificar si estamos en el directorio correcto
check_directory() {
  if [ ! -f "package.json" ] || [ ! -f "ecosystem.config.js" ]; then
    echo -e "${RED}❌ Error: No se encontraron los archivos del proyecto${NC}"
    echo -e "${YELLOW}💡 Asegúrate de estar en: $PROJECT_DIR${NC}"
    exit 1
  fi
}

# Función para mostrar estado con colores
show_status() {
  echo -e "${BLUE}📊 Estado de PM2:${NC}"
  pm2 status
  echo ""
  echo -e "${BLUE}🌐 Endpoints disponibles:${NC}"
  echo -e "  ${GREEN}Health Check:${NC} http://localhost:3000/api/health"
  echo -e "  ${GREEN}Swagger Docs:${NC} http://localhost:3000/api/docs"
  echo -e "  ${GREEN}API Base:${NC} http://localhost:3000/api"
}

# Cambiar al directorio del proyecto
cd "$PROJECT_DIR" || { 
  echo -e "${RED}❌ Error: No se pudo cambiar al directorio $PROJECT_DIR${NC}"
  exit 1 
}

# Verificar que estamos en el directorio correcto
check_directory

# Ejecutar la acción según el argumento
case "$1" in
  start)
    echo -e "${GREEN}🚀 Iniciando '$APP_NAME'...${NC}"
    pm2 start ecosystem.config.js
    pm2 save
    echo -e "${GREEN}✅ Aplicación iniciada${NC}"
    show_status
    ;;
    
  stop)
    echo -e "${YELLOW}🛑 Deteniendo '$APP_NAME'...${NC}"
    pm2 stop "$APP_NAME"
    pm2 save
    echo -e "${GREEN}✅ Aplicación detenida${NC}"
    pm2 status
    ;;
    
  restart)
    echo -e "${YELLOW}🔄 Reiniciando '$APP_NAME'...${NC}"
    pm2 restart "$APP_NAME"
    pm2 save
    echo -e "${GREEN}✅ Aplicación reiniciada${NC}"
    show_status
    ;;
    
  reload)
    echo -e "${YELLOW}♻️ Recargando '$APP_NAME' (sin downtime)...${NC}"
    pm2 reload "$APP_NAME"
    pm2 save
    echo -e "${GREEN}✅ Aplicación recargada${NC}"
    show_status
    ;;
    
  status)
    show_status
    ;;
    
  logs)
    echo -e "${BLUE}📜 Mostrando logs de '$APP_NAME' (Ctrl+C para salir)...${NC}"
    pm2 logs "$APP_NAME" --lines 50 --raw
    ;;
    
  update)
    echo -e "${BLUE}⬇️ Obteniendo código más reciente...${NC}"
    git pull origin r0lm0
    
    echo -e "${BLUE}📦 Reconstruyendo aplicación...${NC}"
    npm run build:prod
    
    echo -e "${BLUE}🔄 Reiniciando '$APP_NAME'...${NC}"
    pm2 restart "$APP_NAME"
    pm2 save
    
    echo -e "${GREEN}✅ Actualización completada${NC}"
    show_status
    ;;
    
  delete)
    echo -e "${RED}🗑️ Eliminando '$APP_NAME' de PM2...${NC}"
    pm2 delete "$APP_NAME"
    pm2 save
    echo -e "${GREEN}✅ Aplicación eliminada${NC}"
    pm2 status
    ;;
    
  build)
    echo -e "${BLUE}🔨 Reconstruyendo aplicación...${NC}"
    npm run build:prod
    echo -e "${GREEN}✅ Build completado${NC}"
    ;;
    
  test)
    echo -e "${BLUE}🧪 Probando endpoints...${NC}"
    echo ""
    
    # Health check
    echo -e "${YELLOW}1. Health Check:${NC}"
    curl -s http://localhost:3000/api/health | jq . 2>/dev/null || curl -s http://localhost:3000/api/health
    echo ""
    
    # Swagger docs
    echo -e "${YELLOW}2. Swagger Docs:${NC}"
    curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:3000/api/docs
    echo ""
    
    # API base
    echo -e "${YELLOW}3. API Base:${NC}"
    curl -s http://localhost:3000/api | head -c 100
    echo ""
    echo ""
    echo -e "${GREEN}✅ Pruebas completadas${NC}"
    ;;
    
  clean)
    echo -e "${YELLOW}🧹 Limpiando archivos temporales...${NC}"
    
    # Limpiar logs de PM2
    pm2 flush
    
    # Limpiar node_modules/.cache si existe
    if [ -d "node_modules/.cache" ]; then
      rm -rf node_modules/.cache
      echo -e "${GREEN}✅ Cache de node_modules limpiado${NC}"
    fi
    
    # Limpiar dist si existe
    if [ -d "dist" ]; then
      rm -rf dist
      echo -e "${GREEN}✅ Directorio dist limpiado${NC}"
    fi
    
    echo -e "${GREEN}✅ Limpieza completada${NC}"
    ;;
    
  *)
    usage
    ;;
esac

echo ""
echo -e "${BLUE}========================================${NC}"
