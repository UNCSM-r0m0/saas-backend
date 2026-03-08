$ErrorActionPreference = "Stop"

# Backend Microservices Manager
$ComposeFile = Join-Path (Split-Path $PSScriptRoot -Parent) "docker-compose.yml"
$ProjectName = "saas-backend"

function Write-Header { Write-Host $args[0] -ForegroundColor Cyan }
function Write-Success { Write-Host $args[0] -ForegroundColor Green }
function Write-ErrorMsg { Write-Host $args[0] -ForegroundColor Red }
function Write-WarningMsg { Write-Host $args[0] -ForegroundColor Yellow }
function Write-Info { Write-Host $args[0] -ForegroundColor Blue }

function Check-Docker {
  try {
    docker version | Out-Null
    return $true
  } catch {
    Write-ErrorMsg "[ERROR] Docker no esta corriendo o no esta instalado"
    return $false
  }
}

function Ensure-ComposeFile {
  if (-not (Test-Path $ComposeFile)) {
    Write-ErrorMsg "[ERROR] No se encuentra docker-compose.yml en $PSScriptRoot"
    return $false
  }
  return $true
}

function Compose {
  param([string[]]$Args)
  & docker compose -p $ProjectName -f $ComposeFile @Args
}

function Start-Core {
  Write-Header "`n[INICIANDO CORE: postgres, nats, redis]"
  Compose @("up", "-d", "postgres", "nats", "redis")
  Write-Success "[OK] Core iniciado"
}

function Start-All {
  Write-Header "`n[INICIANDO TODO]"
  Compose @("up", "-d")
  Write-Success "[OK] Servicios iniciados"
}

function Stop-All {
  Write-Header "`n[DETENIENDO TODO]"
  Compose @("down")
  Write-Success "[OK] Servicios detenidos"
}

function Restart-All {
  Write-Header "`n[REINICIANDO TODO]"
  Compose @("down")
  Start-Sleep -Seconds 1
  Compose @("up", "-d")
  Write-Success "[OK] Servicios reiniciados"
}

function Show-Status {
  Write-Header "`n[ESTADO DE SERVICIOS]"
  Compose @("ps")
}

function Show-Logs {
  Write-Header "`n[LOGS]"
  Write-Host "Servicios disponibles: gateway, auth, users, chat, billing, usage, postgres, nats, redis" -ForegroundColor Yellow
  $service = Read-Host "Servicio (vacío = todos)"
  if ([string]::IsNullOrWhiteSpace($service)) {
    Compose @("logs", "-f")
  } else {
    Compose @("logs", "-f", $service)
  }
}

function Run-NatsHealth {
  Write-Header "`n[PRUEBA NATS: users.health]"
  if (-not (Test-Path (Join-Path $PSScriptRoot "saas-backend\scripts\nats-users-health.js"))) {
    Write-WarningMsg "No existe el script nats-users-health.js"
    return
  }
  Push-Location (Join-Path $PSScriptRoot "saas-backend")
  try {
    node scripts/nats-users-health.js
  } finally {
    Pop-Location
  }
}

function Show-Menu {
  Clear-Host
  Write-Header "`n========================================="
  Write-Header "     BACKEND MICROSERVICES MANAGER"
  Write-Header "========================================="
  Write-Host "`n[SERVICIOS]" -ForegroundColor Yellow
  Write-Host "  1. Iniciar core (postgres, nats, redis)"
  Write-Host "  2. Iniciar todo"
  Write-Host "  3. Detener todo"
  Write-Host "  4. Reiniciar todo"
  Write-Host "  5. Ver estado"
  Write-Host "  6. Ver logs"
  Write-Host "  7. Probar NATS users.health"
  Write-Host "  0. Salir"
  Write-Host ""
}

if (-not (Check-Docker)) { exit 1 }
if (-not (Ensure-ComposeFile)) { exit 1 }

do {
  Show-Menu
  $choice = Read-Host "Selecciona una opcion"
  switch ($choice) {
    "1" { Start-Core }
    "2" { Start-All }
    "3" { Stop-All }
    "4" { Restart-All }
    "5" { Show-Status }
    "6" { Show-Logs }
    "7" { Run-NatsHealth }
    "0" { Write-Success "`nHasta luego!`n"; exit }
    default { Write-WarningMsg "Opcion invalida" }
  }
  Write-Host "`nPresiona cualquier tecla para continuar..."; $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} while ($true)
