#!/bin/bash

# =============================================================================
# 🌐 SCRIPT PARA EXPONER LA API PÚBLICAMENTE (GRATIS)
# =============================================================================

set -e

echo "======================================"
echo "🌐 CONFIGURACIÓN DE TÚNEL PÚBLICO"
echo "======================================"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "Selecciona el método para exponer tu API:"
echo ""
echo "1) 🚀 Cloudflare Quick Tunnel (URL temporal, instantáneo)"
echo "2) 🔒 Tailscale Funnel (URL permanente *.ts.net, requiere cuenta)"
echo "3) ❌ Cancelar"
echo ""
read -p "Opción (1-3): " choice

case $choice in
    1)
        echo ""
        echo -e "${YELLOW}Configurando Cloudflare Quick Tunnel...${NC}"
        echo ""
        
        # Verificar si cloudflared está instalado
        if ! command -v cloudflared &> /dev/null; then
            echo -e "${YELLOW}Instalando cloudflared...${NC}"
            
            # Detectar arquitectura
            ARCH=$(uname -m)
            if [ "$ARCH" = "x86_64" ]; then
                wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
                sudo dpkg -i cloudflared-linux-amd64.deb
                rm cloudflared-linux-amd64.deb
            elif [ "$ARCH" = "aarch64" ]; then
                wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
                sudo dpkg -i cloudflared-linux-arm64.deb
                rm cloudflared-linux-arm64.deb
            else
                echo -e "${RED}❌ Arquitectura no soportada: $ARCH${NC}"
                exit 1
            fi
            
            echo -e "${GREEN}✅ cloudflared instalado${NC}"
        else
            echo -e "${GREEN}✅ cloudflared ya está instalado${NC}"
        fi
        
        echo ""
        echo -e "${GREEN}✅ Configuración completa${NC}"
        echo ""
        echo "======================================"
        echo "🚀 INICIANDO TÚNEL"
        echo "======================================"
        echo ""
        echo -e "${BLUE}Tu API estará disponible en una URL como:${NC}"
        echo -e "${GREEN}https://random-name-1234.trycloudflare.com${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  IMPORTANTE: Copia la URL que aparece abajo${NC}"
        echo -e "${YELLOW}    y úsala en tu frontend de Vercel${NC}"
        echo ""
        echo "Presiona Ctrl+C para detener el túnel"
        echo ""
        
        # Iniciar túnel
        cloudflared tunnel --url http://localhost:3000
        ;;
        
    2)
        echo ""
        echo -e "${YELLOW}Configurando Tailscale Funnel...${NC}"
        echo ""
        
        # Verificar si tailscale está instalado
        if ! command -v tailscale &> /dev/null; then
            echo -e "${YELLOW}Instalando Tailscale...${NC}"
            curl -fsSL https://tailscale.com/install.sh | sh
            echo -e "${GREEN}✅ Tailscale instalado${NC}"
        else
            echo -e "${GREEN}✅ Tailscale ya está instalado${NC}"
        fi
        
        # Verificar si está autenticado
        if ! sudo tailscale status &> /dev/null; then
            echo ""
            echo -e "${YELLOW}Necesitas autenticarte con Tailscale${NC}"
            echo "Se abrirá un navegador para que inicies sesión (es gratis)"
            echo ""
            read -p "Presiona Enter para continuar..."
            sudo tailscale up --ssh
        else
            echo -e "${GREEN}✅ Ya estás autenticado en Tailscale${NC}"
        fi
        
        echo ""
        echo -e "${YELLOW}Habilitando Funnel (exposición pública)...${NC}"
        echo "Debes habilitar Funnel en: https://login.tailscale.com/admin/settings/features"
        echo ""
        read -p "¿Ya habilitaste Funnel en el panel? (s/n): " enabled
        
        if [ "$enabled" = "s" ] || [ "$enabled" = "S" ]; then
            echo ""
            echo -e "${YELLOW}Configurando Funnel...${NC}"
            
            # Servir la API
            sudo tailscale serve https / http://127.0.0.1:3000
            
            # Habilitar Funnel
            sudo tailscale funnel 443 on
            
            echo ""
            echo -e "${GREEN}✅ Funnel configurado${NC}"
            echo ""
            echo "======================================"
            echo "🎉 TU API ESTÁ PÚBLICA"
            echo "======================================"
            echo ""
            echo "Tu URL pública es:"
            sudo tailscale funnel status | grep "https://"
            echo ""
            echo "Esta URL es permanente y funcionará mientras el servidor esté encendido"
            echo ""
        else
            echo -e "${YELLOW}Por favor habilita Funnel primero y vuelve a ejecutar este script${NC}"
        fi
        ;;
        
    3)
        echo "Cancelado"
        exit 0
        ;;
        
    *)
        echo -e "${RED}Opción inválida${NC}"
        exit 1
        ;;
esac

