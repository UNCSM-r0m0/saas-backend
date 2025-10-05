# Script para iniciar el backend en modo producción

Write-Host "🚀 Iniciando SAAS Backend en modo producción..." -ForegroundColor Cyan

# 1. Generar cliente de Prisma
Write-Host "`n📦 Generando cliente de Prisma..." -ForegroundColor Yellow
npm run prisma:generate

# 2. Build de producción
Write-Host "`n🔨 Compilando aplicación..." -ForegroundColor Yellow
npm run build

# 3. Aplicar migraciones de base de datos
Write-Host "`n🗄️  Aplicando migraciones de base de datos..." -ForegroundColor Yellow
npx prisma migrate deploy

# 4. Iniciar servidor
Write-Host "`n✅ Iniciando servidor en modo producción..." -ForegroundColor Green
Write-Host "📍 API disponible en: http://localhost:3000/api" -ForegroundColor Cyan
Write-Host "📚 Swagger disponible en: http://localhost:3000/api/docs" -ForegroundColor Cyan
Write-Host "`nPresiona Ctrl+C para detener el servidor`n" -ForegroundColor Gray

npm run start:prod

