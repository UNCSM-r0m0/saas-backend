#!/bin/bash

# Script para iniciar el backend en modo producción (Linux/Mac)

echo "🚀 Iniciando SAAS Backend en modo producción..."

# 1. Generar cliente de Prisma
echo ""
echo "📦 Generando cliente de Prisma..."
npm run prisma:generate

# 2. Build de producción
echo ""
echo "🔨 Compilando aplicación..."
npm run build

# 3. Aplicar migraciones de base de datos
echo ""
echo "🗄️  Aplicando migraciones de base de datos..."
npx prisma migrate deploy

# 4. Iniciar servidor
echo ""
echo "✅ Iniciando servidor en modo producción..."
echo "📍 API disponible en: http://localhost:3000/api"
echo "📚 Swagger disponible en: http://localhost:3000/api/docs"
echo ""
echo "Presiona Ctrl+C para detener el servidor"
echo ""

npm run start:prod

