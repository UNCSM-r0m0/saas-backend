$ErrorActionPreference = "Stop"

# Manager for backend + n8n stacks
$BackendCompose = Join-Path (Split-Path $PSScriptRoot -Parent) "docker-compose.yml"
$BackendProject = "saas-backend"

$N8nCompose = "C:\Users\r0lm0\n8n-cloudflare\docker-compose.yml"
$N8nProject = "n8n-cloudflare"

function Write-Header { Write-Host $args[0] -ForegroundColor Cyan }
function Write-Success { Write-Host $args[0] -ForegroundColor Green }
function Write-ErrorMsg { Write-Host $args[0] -ForegroundColor Red }
function Write-WarningMsg { Write-Host $args[0] -ForegroundColor Yellow }

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
  param([string]$File)
  if (-not (Test-Path $File)) {
    Write-ErrorMsg "[ERROR] No se encuentra: $File"
    return $false
  }
  return $true
}

function Compose {
  param([string]$File, [string]$Project, [string[]]$ComposeArgs)
  if (-not $ComposeArgs -or $ComposeArgs.Count -eq 0) {
    Write-WarningMsg "No se proporcionaron argumentos para docker compose"
    return
  }
  & docker compose -p $Project -f $File @ComposeArgs
}

function Start-Backend {
  Write-Header "`n[INICIANDO BACKEND]"
  Compose $BackendCompose $BackendProject @("up", "-d")
  Write-Success "[OK] Backend iniciado"
}

function Rebuild-Backend {
  Write-Header "`n[REBUILD BACKEND]"
  Compose $BackendCompose $BackendProject @("up", "-d", "--build", "gateway", "users")
  Write-Success "[OK] Backend rebuild completado"
}

function Rebuild-Service {
  Write-Header "`n[REBUILD SERVICIO]"
  Write-Host "1) gateway" -ForegroundColor Yellow
  Write-Host "2) auth" -ForegroundColor Yellow
  Write-Host "3) users" -ForegroundColor Yellow
  Write-Host "4) chat" -ForegroundColor Yellow
  Write-Host "5) billing" -ForegroundColor Yellow
  Write-Host "6) usage" -ForegroundColor Yellow
  $choice = Read-Host "Servicio (1-6)"
  $service = switch ($choice) {
    "1" { "gateway" }
    "2" { "auth" }
    "3" { "users" }
    "4" { "chat" }
    "5" { "billing" }
    "6" { "usage" }
    default { $null }
  }
  if (-not $service) {
    Write-WarningMsg "Opcion invalida"
    return
  }
  Compose $BackendCompose $BackendProject @("up", "-d", "--build", $service)
  Write-Success "[OK] Rebuild completado: $service"
}

function Rebuild-All-Services {
  Write-Header "`n[REBUILD TODOS LOS SERVICIOS]"
  Compose $BackendCompose $BackendProject @("up", "-d", "--build", "gateway", "auth", "users", "chat", "billing", "usage")
  Write-Success "[OK] Rebuild completo de servicios"
}

function Stop-Backend {
  Write-Header "`n[DETENIENDO BACKEND]"
  Compose $BackendCompose $BackendProject @("down")
  Write-Success "[OK] Backend detenido"
}

function Start-N8n {
  Write-Header "`n[INICIANDO N8N]"
  Compose $N8nCompose $N8nProject @("up", "-d")
  Write-Success "[OK] n8n iniciado"
}

function Stop-N8n {
  Write-Header "`n[DETENIENDO N8N]"
  Compose $N8nCompose $N8nProject @("down")
  Write-Success "[OK] n8n detenido"
}

function Show-Status {
  Write-Header "`n[ESTADO BACKEND]"
  Compose $BackendCompose $BackendProject @("ps")
  Write-Header "`n[ESTADO N8N]"
  Compose $N8nCompose $N8nProject @("ps")
}

function Show-Logs {
  Write-Header "`n[LOGS]"
  Write-Host "1) Backend" -ForegroundColor Yellow
  Write-Host "2) n8n" -ForegroundColor Yellow
  $stack = Read-Host "Stack (1/2)"
  $service = Read-Host "Servicio (vacio = todos)"
  Write-Host "Modo logs:" -ForegroundColor Yellow
  Write-Host "  1) Ver ultimas 200 lineas" -ForegroundColor Yellow
  Write-Host "  2) Seguir en otra ventana" -ForegroundColor Yellow
  $mode = Read-Host "Opcion (1/2)"
  if ($stack -eq "1") {
    if ($mode -eq "2") {
      $args = if ([string]::IsNullOrWhiteSpace($service)) { "logs -f" } else { "logs -f $service" }
      Start-Process powershell -ArgumentList "-NoExit", "-Command", "docker compose -p $BackendProject -f `"$BackendCompose`" $args"
    } else {
      if ([string]::IsNullOrWhiteSpace($service)) { Compose $BackendCompose $BackendProject @("logs", "--tail", "200") }
      else { Compose $BackendCompose $BackendProject @("logs", "--tail", "200", $service) }
    }
  } elseif ($stack -eq "2") {
    if ($mode -eq "2") {
      $args = if ([string]::IsNullOrWhiteSpace($service)) { "logs -f" } else { "logs -f $service" }
      Start-Process powershell -ArgumentList "-NoExit", "-Command", "docker compose -p $N8nProject -f `"$N8nCompose`" $args"
    } else {
      if ([string]::IsNullOrWhiteSpace($service)) { Compose $N8nCompose $N8nProject @("logs", "--tail", "200") }
      else { Compose $N8nCompose $N8nProject @("logs", "--tail", "200", $service) }
    }
  } else {
    Write-WarningMsg "Opcion invalida"
  }
}

function Health-Checks {
  Write-Header "`n[HEALTH CHECKS]"
  Write-Host "1) Backend: users.health (NATS)" -ForegroundColor Yellow
  Write-Host "2) Gateway: /api/health" -ForegroundColor Yellow
  Write-Host "3) n8n: HTTP status" -ForegroundColor Yellow
  $choice = Read-Host "Opcion (1/2/3)"
  if ($choice -eq "1") {
    $scriptPath = Join-Path $PSScriptRoot "scripts\nats-users-health.js"
    if (-not (Test-Path $scriptPath)) {
      Write-WarningMsg "No existe el script nats-users-health.js"
      return
    }
    Push-Location $PSScriptRoot
    try {
      node scripts/nats-users-health.js
    } finally {
      Pop-Location
    }
  } elseif ($choice -eq "2") {
    try {
      $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5
      Write-Success "gateway /api/health: $($resp.StatusCode)"
    } catch {
      Write-WarningMsg "No se pudo acceder a gateway en http://localhost:3000/api/health"
    }
  } elseif ($choice -eq "3") {
    try {
      $resp = Invoke-WebRequest -Uri "http://localhost:5678/healthz" -TimeoutSec 5
      Write-Success "n8n healthz: $($resp.StatusCode)"
    } catch {
      Write-WarningMsg "No se pudo acceder a n8n en http://localhost:5678/healthz"
    }
  } else {
    Write-WarningMsg "Opcion invalida"
  }
}

function Show-Menu {
  Clear-Host
  Write-Header "`n========================================="
  Write-Header "        STACK MANAGER (BACKEND + N8N)"
  Write-Header "========================================="
  Write-Host "`n[BACKEND]" -ForegroundColor Yellow
  Write-Host "  1. Iniciar backend"
  Write-Host "  2. Detener backend"
  Write-Host "`n[N8N]" -ForegroundColor Yellow
  Write-Host "  3. Iniciar n8n"
  Write-Host "  4. Detener n8n"
  Write-Host "`n[AMBOS]" -ForegroundColor Yellow
  Write-Host "  5. Iniciar ambos"
  Write-Host "  6. Detener ambos"
  Write-Host "  7. Ver estado"
  Write-Host "  8. Ver logs"
  Write-Host "  9. Health checks"
  Write-Host " 10. Rebuild gateway/users"
  Write-Host " 11. Rebuild servicio (uno)"
  Write-Host " 12. Rebuild todos los servicios"
  Write-Host "  0. Salir"
  Write-Host ""
}

if (-not (Check-Docker)) { exit 1 }
if (-not (Ensure-ComposeFile $BackendCompose)) { exit 1 }
if (-not (Ensure-ComposeFile $N8nCompose)) { exit 1 }

do {
  Show-Menu
  $choice = Read-Host "Selecciona una opcion"
  switch ($choice) {
    "1" { Start-Backend }
    "2" { Stop-Backend }
    "3" { Start-N8n }
    "4" { Stop-N8n }
    "5" { Start-Backend; Start-N8n }
    "6" { Stop-Backend; Stop-N8n }
    "7" { Show-Status }
    "8" { Show-Logs }
    "9" { Health-Checks }
    "10" { Rebuild-Backend }
    "11" { Rebuild-Service }
    "12" { Rebuild-All-Services }
    "0" { Write-Success "`nHasta luego!`n"; exit }
    default { Write-WarningMsg "Opcion invalida" }
  }
  Write-Host "`nPresiona cualquier tecla para continuar..."; $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} while ($true)
