$ErrorActionPreference = "Stop"

# Prisma DB Manager
$BackendRoot = $PSScriptRoot
$LocalDockerUrl = "postgresql://postgres:postgres@localhost:5432/saas_db?schema=public"

function Write-Header { Write-Host $args[0] -ForegroundColor Cyan }
function Write-Success { Write-Host $args[0] -ForegroundColor Green }
function Write-ErrorMsg { Write-Host $args[0] -ForegroundColor Red }
function Write-WarningMsg { Write-Host $args[0] -ForegroundColor Yellow }

function Ensure-Backend {
  if (-not (Test-Path $BackendRoot)) {
    Write-ErrorMsg "[ERROR] No se encuentra: $BackendRoot"
    return $false
  }
  return $true
}

function Choose-DatabaseUrl {
  Write-Host "" 
  Write-Header "[CONEXION DB]"
  Write-Host "1) Docker local (localhost:5432)" -ForegroundColor Yellow
  Write-Host "2) Usar DATABASE_URL del .env" -ForegroundColor Yellow
  $choice = Read-Host "Opcion (1/2)"
  if ($choice -eq "1") {
    return $LocalDockerUrl
  }
  return $null
}

function Run-Prisma {
  param([string[]]$Args)
  Push-Location $BackendRoot
  try {
    $dbUrl = Choose-DatabaseUrl
    if ($dbUrl) {
      $env:DATABASE_URL = $dbUrl
    }
    & npx prisma @Args
  } finally {
    Pop-Location
  }
}

function Show-Menu {
  Clear-Host
  Write-Header "`n========================================="
  Write-Header "           PRISMA DB MANAGER"
  Write-Header "========================================="
  Write-Host "`n[PRISMA]" -ForegroundColor Yellow
  Write-Host "  1. migrate deploy"
  Write-Host "  2. migrate dev (crea nueva migracion)"
  Write-Host "  3. generate"
  Write-Host "  4. db seed"
  Write-Host "  5. migrate status"
  Write-Host "  6. migrate reset (BORRA TODO)"
  Write-Host "  7. studio"
  Write-Host "  8. db push"
  Write-Host "  9. db pull"
  Write-Host " 10. reset + migrate deploy"
  Write-Host " 11. reset + migrate deploy + seed"
  Write-Host " 12. reset + db push"
  Write-Host " 13. reset + db push + seed"
  Write-Host "  0. Salir"
  Write-Host ""
  Write-Host "[INFO] Las opciones reset borran toda la BD." -ForegroundColor Yellow
}

if (-not (Ensure-Backend)) { exit 1 }

do {
  Show-Menu
  $choice = Read-Host "Selecciona una opcion"
  switch ($choice) {
    "1" { Run-Prisma @("migrate", "deploy") }
    "2" {
      $name = Read-Host "Nombre de la migracion"
      if ([string]::IsNullOrWhiteSpace($name)) {
        Write-WarningMsg "Nombre invalido"
      } else {
        Run-Prisma @("migrate", "dev", "--name", $name)
      }
    }
    "3" { Run-Prisma @("generate") }
    "4" { Run-Prisma @("db", "seed") }
    "5" { Run-Prisma @("migrate", "status") }
    "6" {
      $confirm = Read-Host "Esto borra toda la BD. Escribe RESET para confirmar"
      if ($confirm -eq "RESET") {
        Run-Prisma @("migrate", "reset", "--force")
      } else {
        Write-WarningMsg "Cancelado"
      }
    }
    "7" { Run-Prisma @("studio") }
    "8" { Run-Prisma @("db", "push") }
    "9" { Run-Prisma @("db", "pull") }
    "10" {
      $confirm = Read-Host "Esto borra toda la BD. Escribe RESET para confirmar"
      if ($confirm -eq "RESET") {
        Run-Prisma @("migrate", "reset", "--force")
        Run-Prisma @("migrate", "deploy")
      } else {
        Write-WarningMsg "Cancelado"
      }
    }
    "11" {
      $confirm = Read-Host "Esto borra toda la BD. Escribe RESET para confirmar"
      if ($confirm -eq "RESET") {
        Run-Prisma @("migrate", "reset", "--force")
        Run-Prisma @("migrate", "deploy")
        Run-Prisma @("db", "seed")
      } else {
        Write-WarningMsg "Cancelado"
      }
    }
    "12" {
      $confirm = Read-Host "Esto borra toda la BD. Escribe RESET para confirmar"
      if ($confirm -eq "RESET") {
        Run-Prisma @("migrate", "reset", "--force")
        Run-Prisma @("db", "push")
      } else {
        Write-WarningMsg "Cancelado"
      }
    }
    "13" {
      $confirm = Read-Host "Esto borra toda la BD. Escribe RESET para confirmar"
      if ($confirm -eq "RESET") {
        Run-Prisma @("migrate", "reset", "--force")
        Run-Prisma @("db", "push")
        Run-Prisma @("db", "seed")
      } else {
        Write-WarningMsg "Cancelado"
      }
    }
    "0" { Write-Success "`nHasta luego!`n"; exit }
    default { Write-WarningMsg "Opcion invalida" }
  }
  Write-Host "`nPresiona cualquier tecla para continuar..."; $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} while ($true)
