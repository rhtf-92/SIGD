# =============================================================================
# SIGD · Grupo 2 "TramiCore" — LANZADOR DE PRUEBAS REPRODUCIBLES (H4)
#
# Ejecuta el ciclo completo en la base aislada `tramicore_prueba`:
#   1) Reconstruye el esquema (03_esquema_sigd_tra_cut_foliado.sql)
#   2) Carga datos demo (04_datos_demo_tramicore.sql)
#   3) Ejecuta el laboratorio determinista (06_pruebas_laboratorio_tramicore.sql)
#   4) Concurrencia REAL: 5 sesiones x 100 CUTs (año 2026) en paralelo,
#      con logs separados por sesión.
#   5) Carrera de año nuevo: 3 sesiones simultáneas piden el primer CUT del
#      año 2028 (prueba que la inicialización anual no duplica la fila).
#   6) Verifica unicidad total, ausencia de deadlocks y estado final.
#
# Requisitos: PostgreSQL local en localhost:5432, usuario postgres (trust),
#             base `tramicore_prueba` borrable.
# Uso: powershell -ExecutionPolicy Bypass -File 07_lanzador_pruebas_tramicore.ps1
# =============================================================================

# Continue y comprobación explícita de $LASTEXITCODE: los NOTICE de psql van a
# stderr y con 'Stop' PowerShell 5.1 los trataría como error terminante.
$ErrorActionPreference = 'Continue'

$psql   = 'psql'
$dbHost = 'localhost'
$dbPort = '5432'
$dbUser = 'postgres'
$dbName = 'tramicore_prueba'

$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$archivoDdl    = Join-Path $base '03_esquema_sigd_tra_cut_foliado.sql'
$archivoDemo   = Join-Path $base '04_datos_demo_tramicore.sql'
$archivoLab    = Join-Path $base '06_pruebas_laboratorio_tramicore.sql'
$dirLogs       = Join-Path $base 'logs_pruebas'

function Invoke-Sql {
    param([string]$Archivo)
    & $psql -w -h $dbHost -p $dbPort -U $dbUser -d $dbName -v ON_ERROR_STOP=1 -f $Archivo 2>&1
    if ($LASTEXITCODE -ne 0) { throw "FALLO ejecutando $Archivo (exit code $LASTEXITCODE)" }
}

function Invoke-Query {
    param([string]$Sql)
    & $psql -w -h $dbHost -p $dbPort -U $dbUser -d $dbName -At -c $Sql 2>&1
    if ($LASTEXITCODE -ne 0) { throw "FALLO consulta: $Sql" }
}

Write-Host '=== TramiCore H4: lanzador reproducible ===' -ForegroundColor Cyan

# Limpia logs previos y asegura el directorio
if (Test-Path $dirLogs) { Remove-Item -Recurse -Force $dirLogs }
New-Item -ItemType Directory -Path $dirLogs | Out-Null

# 1) Esquema
Write-Host '[1/6] Reconstruyendo esquema...'
try { Invoke-Query "DROP SCHEMA IF EXISTS sigd_tra CASCADE;" | Out-Null } catch { throw }
Invoke-Sql $archivoDdl | Out-Null

# 2) Datos demo
Write-Host '[2/6] Cargando datos demo (no oficiales)...'
Invoke-Sql $archivoDemo | Out-Null

# 3) Laboratorio determinista
Write-Host '[3/6] Ejecutando laboratorio determinista (ROLLBACK final)...'
$salidaLab = Invoke-Sql $archivoLab
$failLab   = @($salidaLab | Where-Object { "$_" -match '\sFALLO\s' })
$okCount   = @($salidaLab | Where-Object { "$_" -match '^\s*P\d+[a-d]?\s*\|\s*OK\s' }).Count
if ($failLab.Count -gt 0) {
    Write-Host 'RESULTADO LABORATORIO: FALLO' -ForegroundColor Red
    $failLab | ForEach-Object { Write-Host $_ }
    exit 1
}
Write-Host "Laboratorio determinista: $okCount pruebas OK" -ForegroundColor Green

# 4) Concurrencia 2026: 5 sesiones x 100 CUTs
Write-Host '[4/6] Lanzando 5 sesiones concurrentes x 100 CUTs (año 2026)...'
$sesionesConcurrentes = 5
$cutsPorSesion = 100
$procesos = @()
for ($i = 0; $i -lt $sesionesConcurrentes; $i++) {
    $sql = Join-Path $dirLogs "concurrente_$i.sql"
    $out = Join-Path $dirLogs "concurrente_$i.log"
    $err = Join-Path $dirLogs "concurrente_$i.err"
    "SELECT sigd_tra.generar_cut_expediente(2026) FROM generate_series(1, $cutsPorSesion);" |
        Set-Content -LiteralPath $sql -Encoding UTF8
    $p = Start-Process -FilePath $psql `
        -ArgumentList @("-w", "-h", $dbHost, "-p", $dbPort, "-U", $dbUser, "-d", $dbName, "-qAt", "-f", $sql) `
        -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
    $procesos += $p
}
$procesos | ForEach-Object { $_.WaitForExit() }

$cuts2026 = @(Get-ChildItem "$dirLogs\concurrente_*.log" |
    ForEach-Object { Get-Content $_.FullName } |
    Where-Object { $_ -match '^EXP-2026-[0-9]{6}\z' })
$totalCuts = $cuts2026.Count
$unicosCuts = @($cuts2026 | Sort-Object -Unique).Count
$errores2026 = @(Get-ChildItem "$dirLogs\concurrente_*.err" |
    ForEach-Object { Get-Content $_.FullName } |
    Where-Object { $_ -match 'ERROR|deadlock|bloqueo' })

Write-Host "CUTs 2026 generados en paralelo: total=$totalCuts unicos=$unicosCuts" -ForegroundColor Yellow
if ($errores2026.Count -gt 0) {
    Write-Host 'SE DETECTARON ERRORES O DEADLOCKS EN SESIONES CONCURRENTES' -ForegroundColor Red
    $errores2026 | Select-Object -First 5 | ForEach-Object { Write-Host "  $_" }
    exit 1
}

# 5) Carrera de año nuevo: 3 sesiones piden el primer CUT de 2028
Write-Host '[5/6] Carrera de inicialización del año 2028 (3 sesiones simultáneas)...'
$procesos = @()
for ($i = 0; $i -lt 3; $i++) {
    $sql = Join-Path $dirLogs "anio_nuevo_$i.sql"
    $out = Join-Path $dirLogs "anio_nuevo_$i.log"
    $err = Join-Path $dirLogs "anio_nuevo_$i.err"
    'SELECT sigd_tra.generar_cut_expediente(2028);' |
        Set-Content -LiteralPath $sql -Encoding UTF8
    $p = Start-Process -FilePath $psql `
        -ArgumentList @("-w", "-h", $dbHost, "-p", $dbPort, "-U", $dbUser, "-d", $dbName, "-qAt", "-f", $sql) `
        -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
    $procesos += $p
}
$procesos | ForEach-Object { $_.WaitForExit() }

$cuts2028 = @(Get-ChildItem "$dirLogs\anio_nuevo_*.log" |
    ForEach-Object { Get-Content $_.FullName } |
    Where-Object { $_ -match '^EXP-2028-[0-9]{6}\z' })
$unicos2028 = @($cuts2028 | Sort-Object -Unique)
$filas2028 = Invoke-Query "SELECT COUNT(*) FROM sigd_tra.secuencia_anual_cut WHERE anio_fiscal = 2028;" | Select-Object -First 1

Write-Host "Año 2028: CUTs=$($cuts2028 -join ', '), filas_anuales=$filas2028" -ForegroundColor Yellow

# 6) Criterios de aprobación
Write-Host '[6/6] Resumen final...' -ForegroundColor Cyan
$criterios = @(
    @{ Nombre = 'Laboratorio determinista (21 pruebas)'; Cond = ($failLab.Count -eq 0 -and $okCount -ge 20) }
    @{ Nombre = '500 CUTs únicos (5 sesiones)'; Cond = ($totalCuts -eq 500 -and $unicosCuts -eq 500) }
    @{ Nombre = 'Sin errores/deadlocks en concurrencia'; Cond = ($errores2026.Count -eq 0) }
    @{ Nombre = 'Carrera año 2028: 3 CUTs únicos y 1 fila anual'; Cond = ($unicos2028.Count -eq 3 -and "$filas2028".Trim() -eq '1') }
)

$fail = $false
$criterios | ForEach-Object {
    $estado = if ($_.Cond) { 'PASS' } else { 'FAIL' }
    if (-not $_.Cond) { $fail = $true }
    Write-Host ("  [{0}] {1}" -f $estado, $_.Nombre) -ForegroundColor $(if ($_.Cond) { 'Green' } else { 'Red' })
}

if ($fail) {
    Write-Host 'RESULTADO GLOBAL: FALLO — revisar logs en ' $dirLogs -ForegroundColor Red
    exit 1
}

Write-Host 'RESULTADO GLOBAL: CONCURRENCIA Y VALIDACIÓN OK (evidencia reproducida)' -ForegroundColor Green
Write-Host ('Logs de sesión disponibles en: ' + $dirLogs)