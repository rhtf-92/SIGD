param(
  [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$envPath = Join-Path $projectRoot '.env.academico'
$snapshotRoot = Join-Path $projectRoot 'academic-snapshot'

$checks = Get-Content (Join-Path $snapshotRoot 'SHA256SUMS') | Where-Object { $_ -match '^[0-9a-fA-F]{64}  ' }
foreach ($line in $checks) {
  $parts = $line -split '  ', 2
  $path = Join-Path $snapshotRoot $parts[1]
  if (-not (Test-Path -LiteralPath $path) -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $parts[0]) {
    throw "Snapshot inválido: $($parts[1])"
  }
}

if ($VerifyOnly) {
  Write-Host "Snapshot verificado ($($checks.Count) archivos)."
  exit 0
}

if (-not (Test-Path -LiteralPath $envPath)) {
  function New-RandomHex([int]$bytes) {
    # Compatible con Windows PowerShell 5.1 (.NET Framework) y PowerShell 7+.
    $buffer = New-Object byte[] $bytes
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
      $generator.GetBytes($buffer)
      return [BitConverter]::ToString($buffer).Replace('-', '').ToLowerInvariant()
    } finally {
      $generator.Dispose()
    }
  }
  $settings = @(
    "ACADEMIC_POSTGRES_PASSWORD=$(New-RandomHex 24)"
    "ACADEMIC_APP_DB_PASSWORD=$(New-RandomHex 24)"
    "ACADEMIC_JWT_SECRET=$(New-RandomHex 32)"
    "ACADEMIC_WEBHOOK_SECRET=$(New-RandomHex 32)"
    "ACADEMIC_S3_ACCESS_KEY=$(New-RandomHex 12)"
    "ACADEMIC_S3_SECRET_KEY=$(New-RandomHex 24)"
    "ACADEMIC_DEMO_PASSWORD=$(New-RandomHex 12)"
    'ACADEMIC_POSTGRES_PORT=5434'
    'ACADEMIC_REDIS_PORT=6380'
    'ACADEMIC_S3_PORT=9001'
    'ACADEMIC_S3_UI_PORT=8889'
    'ACADEMIC_BACKEND_PORT=3001'
    'ACADEMIC_FRONTEND_PORT=5174'
  )
  [System.IO.File]::WriteAllLines($envPath, $settings)
  Write-Host 'Credenciales académicas locales generadas en .env.academico (excluido de Git).'
}

Push-Location $projectRoot
try {
  docker compose --env-file .env.academico -f docker-compose.academico.yml up -d --build
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar el Docker académico.' }
  docker compose --env-file .env.academico -f docker-compose.academico.yml ps
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo verificar el Docker académico.' }
} finally {
  Pop-Location
}

$frontendPort = if ($env:ACADEMIC_FRONTEND_PORT) { $env:ACADEMIC_FRONTEND_PORT } else { ((Get-Content $envPath | Where-Object { $_ -like 'ACADEMIC_FRONTEND_PORT=*' }) -split '=', 2)[1] }
Write-Host "SIGD académico: http://localhost:$frontendPort/login"
Write-Host 'Usuario de demostración: demo.academico'
Write-Host 'La contraseña local está en ACADEMIC_DEMO_PASSWORD dentro de .env.academico.'
