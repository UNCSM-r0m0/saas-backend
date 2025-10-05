#!/bin/bash

# Script para actualizar CORS después de obtener la URL pública

echo "======================================"
echo "🌐 ACTUALIZAR CORS"
echo "======================================"
echo ""

# Pedir la URL de Tailscale
read -p "Ingresa tu URL de Tailscale (ej: https://legion-r7.tail123abc.ts.net): " TAILSCALE_URL

# Pedir la URL del frontend de Vercel
read -p "Ingresa tu URL de Vercel (ej: https://tu-app.vercel.app): " VERCEL_URL

echo ""
echo "Actualizando variables de entorno..."

# Actualizar FRONTEND_URL en .env
sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=${VERCEL_URL}|g" .env

echo "✅ .env actualizado"
echo ""
echo "⚠️  IMPORTANTE: Debes actualizar main.ts con estas URLs:"
echo ""
echo "En src/main.ts, busca app.enableCors() y agrega:"
echo ""
echo "app.enableCors({"
echo "  origin: ["
echo "    '${VERCEL_URL}',"
echo "    '${TAILSCALE_URL}',"
echo "    /\.vercel\.app$/,"
echo "    /\.ts\.net$/,"
echo "  ],"
echo "  credentials: true,"
echo "});"
echo ""
read -p "¿Quieres que actualice main.ts automáticamente? (s/n): " UPDATE_MAIN

if [ "$UPDATE_MAIN" = "s" ] || [ "$UPDATE_MAIN" = "S" ]; then
    echo "Actualizando main.ts..."
    # Aquí agregarías la lógica para modificar main.ts
    echo "⚠️  Por favor, actualiza main.ts manualmente con las URLs mostradas arriba"
    echo "Luego ejecuta:"
    echo "  npm run build:prod"
    echo "  pm2 restart saas-api"
fi

