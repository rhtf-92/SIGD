# SIGD - Apaga el backend, el frontend y la base de datos Docker.
$ErrorActionPreference = 'SilentlyContinue'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $raiz

Write-Host 'Deteniendo Backend (puerto 3000) y Frontend (puerto 5173)...' -ForegroundColor Cyan
foreach ($puerto in 3000, 5173) {
  $conexiones = Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue
  foreach ($conexion in $conexiones) {
    Stop-Process -Id $conexion.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

Write-Host 'Deteniendo contenedores Docker (los datos se conservan)...' -ForegroundColor Cyan
docker compose stop | Out-Host

Write-Host 'SIGD detenido correctamente.' -ForegroundColor Green
