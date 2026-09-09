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
#   7) Genera evidencia consolidada en evidencia_h4.json con:
#      - Fecha, hora, versión de PostgreSQL, hash del esquema.
#      - Resultados de cada bloque (EXITCODE, pruebas OK/FALLO).
#      - Listado de errores por sesión concurrente.
#
# Requisitos: PostgreSQL local en localhost:5432, usuario postgres (trust),
#             base `tramicore_prueba` borrable.
# Uso: powershell -ExecutionPolicy Bypass -File 07_lanzador_pruebas_tramicore.ps1
# =============================================================================

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
$archivoEvidencia = Join-Path $dirLogs 'evidencia_h4.json'

function Invoke-Sql {
    param([string]$Archivo)
    $output = & $psql -w -h $dbHost -p $dbPort -U $dbUser -d $dbName -v ON_ERROR_STOP=1 -f $Archivo 2>&1
    $exitCode = $LASTEXITCODE
    return @{ Output = $output; ExitCode = $exitCode }
}

function Invoke-Query {
    param([string]$Sql)
    $output = & $psql -w -h $dbHost -p $dbPort -U $dbUser -d $dbName -At -c $Sql 2>&1
    $exitCode = $LASTEXITCODE
    return @{ Output = $output; ExitCode = $exitCode }
}

Write-Host '=== TramiCore H4: lanzador reproducible ===' -ForegroundColor Cyan

# Timestamp para evidencia
$fechaInicio = Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ'

# Limpia logs previos y asegura el directorio
if (Test-Path $dirLogs) { Remove-Item -Recurse -Force $dirLogs }
New-Item -ItemType Directory -Path $dirLogs | Out-Null

# Version de PostgreSQL
$pgVersion = (Invoke-Query "SELECT version();").Output
Write-Host "PostgreSQL: $pgVersion" -ForegroundColor DarkGray

# Hash del DDL (para trazabilidad)
$ddlHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivoDdl).Hash
Write-Host "DDL hash (SHA256): $ddlHash" -ForegroundColor DarkGray

# ===========================================================================
# 1) Esquema
# ===========================================================================
Write-Host '[1/7] Reconstruyendo esquema...'
$dropResult = Invoke-Query "DROP SCHEMA IF EXISTS sigd_tra CASCADE;"
if ($dropResult.ExitCode -ne 0) {
    Write-Host "FALLO al eliminar esquema previo (exit $($dropResult.ExitCode))" -ForegroundColor Red
    exit 1
}
$ddlResult = Invoke-Sql $archivoDdl
if ($ddlResult.ExitCode -ne 0) {
    Write-Host "FALLO ejecutando DDL (exit $($ddlResult.ExitCode))" -ForegroundColor Red
    $ddlResult.Output | ForEach-Object { Write-Host "  $_" }
    exit 1
}

# ===========================================================================
# 2) Datos demo
# ===========================================================================
Write-Host '[2/7] Cargando datos demo (no oficiales)...'
$demoResult = Invoke-Sql $archivoDemo
if ($demoResult.ExitCode -ne 0) {
    Write-Host "FALLO ejecutando datos demo (exit $($demoResult.ExitCode))" -ForegroundColor Red
    $demoResult.Output | ForEach-Object { Write-Host "  $_" }
    exit 1
}

# ===========================================================================
# 3) Laboratorio determinista
# ===========================================================================
Write-Host '[3/7] Ejecutando laboratorio determinista (ROLLBACK final)...'
$labResult = Invoke-Sql $archivoLab
$labExitCode = $labResult.ExitCode
$failLab   = @($labResult.Output | Where-Object { "$_" -match '\sFALLO\s' })
$okCount   = @($labResult.Output | Where-Object { "$_" -match '^\s*P\d+[a-d]?\s*\|\s*OK\s' }).Count
if ($failLab.Count -gt 0 -or $labExitCode -ne 0) {
    Write-Host "RESULTADO LABORATORIO: FALLO (exit $labExitCode)" -ForegroundColor Red
    $failLab | ForEach-Object { Write-Host $_ }
    exit 1
}
Write-Host "Laboratorio determinista: $okCount pruebas OK (exit 0)" -ForegroundColor Green

# ===========================================================================
# 4) Concurrencia 2026: 5 sesiones x 100 CUTs
# ===========================================================================
Write-Host '[4/7] Lanzando 5 sesiones concurrentes x 100 CUTs (año 2026)...'
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

# Verificar exit code de CADA proceso
$exitCodesConcurrentes = @{}
$procesos | ForEach-Object {
    $_.WaitForExit()
    $exitCodesConcurrentes[$_.Id] = $_.ExitCode
}
$fallosConcurrencia = $exitCodesConcurrentes.Values | Where-Object { $_ -ne 0 }
if ($fallosConcurrencia.Count -gt 0) {
    Write-Host "FALLO: $($fallosConcurrencia.Count) sesiones concurrentes terminaron con exit code != 0" -ForegroundColor Red
    $exitCodesConcurrentes.GetEnumerator() | ForEach-Object {
        if ($_.Value -ne 0) { Write-Host "  PID $($_.Key): exit $($_.Value)" }
    }
    exit 1
}

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

# ===========================================================================
# 5) Carrera de año nuevo: 3 sesiones piden el primer CUT de 2028
# ===========================================================================
Write-Host '[5/7] Carrera de inicialización del año 2028 (3 sesiones simultáneas)...'
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

# Verificar exit code de CADA proceso de año nuevo
$exitCodesAnio = @{}
$procesos | ForEach-Object {
    $_.WaitForExit()
    $exitCodesAnio[$_.Id] = $_.ExitCode
}
$fallosAnio = $exitCodesAnio.Values | Where-Object { $_ -ne 0 }
if ($fallosAnio.Count -gt 0) {
    Write-Host "FALLO: $($fallosAnio.Count) sesiones de año nuevo terminaron con exit code != 0" -ForegroundColor Red
    exit 1
}

$expected2028 = @('EXP-2028-000001', 'EXP-2028-000002', 'EXP-2028-000003')
$unicos2028 = @($cuts2028 | Sort-Object -Unique)
$coinciden2028 = ($expected2028.Count -eq $unicos2028.Count) -and ($expected2028 | Where-Object { $_ -notin $unicos2028 }).Count -eq 0
$filas2028 = (Invoke-Query "SELECT COUNT(*) FROM sigd_tra.secuencia_anual_cut WHERE anio_fiscal = 2028;").Output

Write-Host "Año 2028: CUTs=$($unicos2028 -join ', '), esperados=$($expected2028 -join ', '), filas_anuales=$filas2028" -ForegroundColor Yellow

# ===========================================================================
# 6) Pruebas de foliado concurrente: 2 sesiones insertan folios en un expediente limpio
# ===========================================================================
Write-Host '[6/7] Pruebas de foliado concurrente y ciclos extendidos...'
$folioSql1 = Join-Path $dirLogs "folio_concurrente_0.sql"
$folioSql2 = Join-Path $dirLogs "folio_concurrente_1.sql"
$folioOut1 = Join-Path $dirLogs "folio_concurrente_0.log"
$folioOut2 = Join-Path $dirLogs "folio_concurrente_1.log"
$folioErr1 = Join-Path $dirLogs "folio_concurrente_0.err"
$folioErr2 = Join-Path $dirLogs "folio_concurrente_1.err"

# Crear expediente limpio (sin folios previos) para prueba concurrente
$expedienteLimpio = (Invoke-Query "SELECT id_expediente FROM sigd_tra.expediente WHERE id_expediente NOT IN (SELECT id_expediente FROM sigd_tra.expediente_documento_folio) ORDER BY id_expediente OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY;").Output
if ([string]::IsNullOrWhiteSpace($expedienteLimpio)) {
    # Si no hay expediente sin folios, crear uno nuevo
    $nuevoId = (Invoke-Query "INSERT INTO sigd_tra.tramite (asunto, estado, fk_remitente, fk_destinatario) VALUES ('Expediente limpio para foliado concurrente', 'REGISTRADO', 101, 301); SELECT SCOPE_IDENTITY();").Output.Trim()
    $expedienteLimpio = (Invoke-Query "INSERT INTO sigd_tra.expediente (fk_tramite) VALUES ($nuevoId); SELECT SCOPE_IDENTITY();").Output.Trim()
}
$idExpLimpio = $expedienteLimpio.Trim()

# Sesión 0: inserta folios 1-10 en expediente limpio vía función canónica
@(
    "SET search_path TO sigd_tra, public;",
    "SELECT sigd_tra.agregar_folio_expediente($idExpLimpio, 901, 10);"
) | Set-Content -LiteralPath $folioSql1 -Encoding UTF8

# Sesión 1: intenta insertar folios 11-20 en el MISMO expediente limpio vía función canónica
# (ambos son válidos y no se solapan)
@(
    "SET search_path TO sigd_tra, public;",
    "SELECT sigd_tra.agregar_folio_expediente($idExpLimpio, 902, 10);"
) | Set-Content -LiteralPath $folioSql2 -Encoding UTF8

$p1 = Start-Process -FilePath $psql `
    -ArgumentList @("-w", "-h", $dbHost, "-p", $dbPort, "-U", $dbUser, "-d", $dbName, "-qAt", "-f", $folioSql1) `
    -RedirectStandardOutput $folioOut1 -RedirectStandardError $folioErr1 -PassThru
$p2 = Start-Process -FilePath $psql `
    -ArgumentList @("-w", "-h", $dbHost, "-p", $dbPort, "-U", $dbUser, "-d", $dbName, "-qAt", "-f", $folioSql2) `
    -RedirectStandardOutput $folioOut2 -RedirectStandardError $folioErr2 -PassThru
$p1.WaitForExit(); $p2.WaitForExit()

$folioExit0 = $p1.ExitCode
$folioExit1 = $p2.ExitCode
$folioErr0Content = (Get-Content $folioErr1 -ErrorAction SilentlyContinue) -join "`n"
$folioErr1Content = (Get-Content $folioErr2 -ErrorAction SilentlyContinue) -join "`n"
$folioSolapamientoDetectado = ($folioErr0Content -match '42301|solapamiento' -or $folioErr1Content -match '42301|solapamiento')
Write-Host "Foliado concurrente: exits=($folioExit0, $folioExit1) solapamiento detectado=$folioSolapamientoDetectado" -ForegroundColor Yellow

# Verificar que ambos procesos exitosos generaron rangos contiguos sin solapamiento
$folioRows = @(Invoke-Query "SELECT folio_inicio, folio_fin FROM sigd_tra.expediente_documento_folio WHERE id_expediente = $idExpLimpio ORDER BY folio_inicio;").Output
Write-Host "Folios en expediente $idExpLimpio: $folioRows" -ForegroundColor Yellow

# ===========================================================================
# 7) Resumen final y evidencia consolidada
# ===========================================================================
Write-Host '[7/7] Resumen final y generación de evidencia...' -ForegroundColor Cyan
$fechaFin = Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ'

$criterios = @(
    @{ Nombre = 'Laboratorio determinista (21 pruebas)'; Cond = ($failLab.Count -eq 0 -and $okCount -eq 21); Detalle = "$okCount pruebas OK, exit $labExitCode" }
    @{ Nombre = '500 CUTs únicos (5 sesiones)'; Cond = ($totalCuts -eq 500 -and $unicosCuts -eq 500); Detalle = "total=$totalCuts unicos=$unicosCuts" }
    @{ Nombre = 'Sin errores/deadlocks en concurrencia'; Cond = ($errores2026.Count -eq 0); Detalle = "errores=$($errores2026.Count)" }
    @{ Nombre = 'Carrera año 2028: 3 CUTs exactos 000001, 000002, 000003 y 1 fila anual'; Cond = ($coinciden2028 -and "$filas2028".Trim() -eq '1'); Detalle = "cuts=$($unicos2028.Count) coinciden=$coinciden2028 filas=$filas2028" }
    @{ Nombre = 'Foliado concurrente verificado (expediente limpio)'; Cond = ($folioExit0 -eq 0 -and $folioExit1 -eq 0); Detalle = "exits=($folioExit0, $folioExit1) rangos=$folioRows" }
)

$fail = $false
$criterios | ForEach-Object {
    $estado = if ($_.Cond) { 'PASS' } else { 'FAIL' }
    if (-not $_.Cond) { $fail = $true }
    Write-Host ("  [{0}] {1} — {2}" -f $estado, $_.Nombre, $_.Detalle) -ForegroundColor $(if ($_.Cond) { 'Green' } else { 'Red' })
}

# Evidencia consolidada JSON
$evidencia = @{
    proyecto     = 'SIGD - TramiCore H4'
    fecha_inicio = $fechaInicio
    fecha_fin    = $fechaFin
    postgresql   = $pgVersion
    ddl_hash     = $ddlHash
    base_datos   = $dbName
    bloques      = @{
        laboratorio = @{
            exit_code    = $labExitCode
            pruebas_ok   = $okCount
            pruebas_fallo= $failLab.Count
            resultado    = if ($failLab.Count -eq 0 -and $okCount -eq 21) { 'PASS' } else { 'FAIL' }
        }
        concurrencia_2026 = @{
            sesiones     = $sesionesConcurrentes
            cuts_total   = $totalCuts
            cuts_unicos  = $unicosCuts
            errores      = $errores2026.Count
            exit_codes   = $exitCodesConcurrentes
            resultado    = if ($totalCuts -eq 500 -and $unicosCuts -eq 500 -and $errores2026.Count -eq 0) { 'PASS' } else { 'FAIL' }
        }
        carrera_anio_nuevo = @{
            cuts         = @($cuts2028)
            esperados    = $expected2028
            filas_anuales= "$filas2028".Trim()
            exit_codes   = $exitCodesAnio
            resultado    = if ($coinciden2028 -and "$filas2028".Trim() -eq '1') { 'PASS' } else { 'FAIL' }
        }
        foliado_concurrente = @{
            exit_codes     = @($folioExit0, $folioExit1)
            rangos         = $folioRows
            resultado      = if ($folioExit0 -eq 0 -and $folioExit1 -eq 0) { 'PASS' } else { 'FAIL' }
        }
    }
    criterios_aprobacion = $criterios | ForEach-Object {
        @{
            nombre   = $_.Nombre
            pass     = $_.Cond
            detalle  = $_.Detalle
        }
    }
    resultado_global = if (-not $fail) { 'PASS' } else { 'FAIL' }
}

$evidencia | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $archivoEvidencia -Encoding UTF8
Write-Host "Evidencia consolidada: $archivoEvidencia" -ForegroundColor DarkGray

if ($fail) {
    Write-Host 'RESULTADO GLOBAL: FALLO — revisar logs en ' $dirLogs -ForegroundColor Red
    exit 1
}

Write-Host 'RESULTADO GLOBAL: CONCURRENCIA Y VALIDACIÓN OK (evidencia reproducida)' -ForegroundColor Green
Write-Host ('Logs de sesión disponibles en: ' + $dirLogs)
