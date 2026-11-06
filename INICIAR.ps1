#requires -Version 5.1
# SIGD - Prende la base de datos Docker y luego el backend + frontend.
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $raiz

function Paso($texto) { Write-Host $texto -ForegroundColor Cyan }

Write-Host '==================================================' -ForegroundColor Yellow
Write-Host ' SIGD - Inicio completo (Base de datos + Proyecto)' -ForegroundColor Yellow
Write-Host '==================================================' -ForegroundColor Yellow

# 1) Docker debe estar abierto.
try {
  docker version --format '{{.Server.Version}}' | Out-Null
} catch {
  throw 'Docker no esta en ejecucion. Abra Docker Desktop y vuelva a intentar.'
}

# 2) Levantar SOLO PostgreSQL (la app corre localmente en Node).
Paso '[1/3] Levantando PostgreSQL en Docker (puerto 5434)...'
docker compose up -d postgres | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'No se pudo levantar el contenedor de PostgreSQL.' }

Paso '[2/3] Esperando a que PostgreSQL este saludable...'
$estado = ''
for ($i = 0; $i -lt 60; $i++) {
  $estado = (docker inspect --format '{{.State.Health.Status}}' sigd_postgres 2>$null)
  if ($estado -eq 'healthy') { break }
  Start-Sleep -Seconds 2
}
if ($estado -ne 'healthy') { throw "PostgreSQL no alcanzo el estado healthy (estado actual: $estado)." }
Write-Host '      PostgreSQL listo: localhost:5434 / base sigd_prueba' -ForegroundColor Green

# 3) Dependencias (solo si faltan).
if (-not (Test-Path 'backend\node_modules')) {
  Paso 'Instalando dependencias del backend...'
  npm --prefix backend install | Out-Host
}
if (-not (Test-Path 'frontend\node_modules')) {
  Paso 'Instalando dependencias del frontend...'
  npm --prefix frontend install | Out-Host
}

# 4) Iniciar backend (3000) + frontend (5173).
Paso '[3/3] Iniciando Backend (3000) y Frontend (5173)...'
Write-Host '      Abra el navegador en: http://localhost:5173' -ForegroundColor Yellow
Write-Host '      Para apagar todo: ejecute DETENER.bat o presione Ctrl+C.' -ForegroundColor Yellow
Write-Host ''
npm run dev
