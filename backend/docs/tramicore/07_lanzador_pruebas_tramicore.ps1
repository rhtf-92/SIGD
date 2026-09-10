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
#   6) Pruebas de foliado:
#      6a) NEGATIVA REAL (secuencial): sobre un expediente ya foliado, un INSERT
#          directo con rango solapado es rechazado por el trigger (exit != 0 +
#          'Solapamiento' [23514] en stderr).
#      6b) CONCURRENCIA REAL (positiva): 2 sesiones paralelas folian el MISMO
#          expediente vía la función canónica; ambas terminan exit 0 y los
#          rangos quedan contiguos (1-5 y 6-10), sin solapamientos ni huecos.
#      6c) CONCURRENCIA REAL (negativa, INSERT directo): 2 sesiones paralelas
#          insertan el MISMO rango 1-5 sobre un expediente vacío. El bloqueo
#          previo de la fila del expediente en el trigger serializa la escritura
#          y solo UNA confirma (exit 0); la segunda es rechazada (exit != 0,
#          [23514]). Al final queda un único rango 1|5: no se aceptan rangos
#          incompatibles bajo concurrencia.
#   7) Genera evidencia consolidada en evidencia_h4.json con:
#      - Fecha, hora, versión de PostgreSQL, hash del esquema.
#      - Resultados de cada bloque (EXITCODE, pruebas OK/FALLO).
#      - Listado de errores por sesión concurrente.
#
# NOTA SOBRE EL CONTEO: el laboratorio determinista (06) registra 26 resultados
# (P01, P02, P04..P21, con subtests a-d en P14/P15). P03 (concurrencia real con
# 500 CUTs + carrera de año nuevo) queda DELEGADO al lanzador y se contabiliza por
# separado en los bloques concurrencia_2026 y carrera_anio_nuevo de la evidencia.
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

# Fuerza la salida de psql (stdout y stderr de sesiones y consultas) a UTF-8:
# sin esto, psql escribe los mensajes en la página de códigos de la consola
# (p.ej. cp1252/cp850) y los .log/.err de evidencia quedan con mojibake.
$env:PGCLIENTENCODING = 'UTF8'

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
    $output = & $psql -w -h $dbHost -p $dbPort -U $dbUser -d $dbName -qAt -c $Sql 2>&1
    $exitCode = $LASTEXITCODE
    return @{ Output = $output; ExitCode = $exitCode }
}

# Lanza una sesión psql en paralelo usando System.Diagnostics.Process.
# Necesario porque Start-Process -PassThru (PS 5.1) con redirección de salida
# no expone el ExitCode (siempre $null), y -Wait rompería la concurrencia.
# Los logs por sesión se persisten después (véase el paso 4/5).
function Start-PsqlSession {
    param([Parameter(Mandatory)][string]$SqlFile)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $psql
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    # psql escribe los mensajes en la codificación del cliente (UTF-8 gracias a
    # PGCLIENTENCODING). Sin estos encoders, .NET decodificaría las tuberías con
    # la página de códigos de la consola y los .log/.err quedarían con mojibake
    # (doble codificación de caracteres acentuados).
    $psi.StandardOutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $psi.StandardErrorEncoding = New-Object System.Text.UTF8Encoding($false)
    $psi.Arguments = '-w -h ' + $dbHost + ' -p ' + $dbPort + ' -U ' + $dbUser + ' -d ' + $dbName + ' -qAt -v ON_ERROR_STOP=1 -f "' + $SqlFile + '"'
    return [System.Diagnostics.Process]::Start($psi)
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
$detallesSesion = @{}
for ($i = 0; $i -lt $sesionesConcurrentes; $i++) {
    $sql = Join-Path $dirLogs "concurrente_$i.sql"
    $out = Join-Path $dirLogs "concurrente_$i.log"
    $err = Join-Path $dirLogs "concurrente_$i.err"
    "SELECT sigd_tra.generar_cut_expediente(2026) FROM generate_series(1, $cutsPorSesion);" |
        Set-Content -LiteralPath $sql -Encoding UTF8
    $p = Start-PsqlSession -SqlFile $sql
    $procesos += $p
    $detallesSesion[$p.Id] = @{ Out = $out; Err = $err }
}

# Verificar exit code de CADA proceso y perseguir sus logs
$exitCodesConcurrentes = @{}
$procesos | ForEach-Object {
    $stdout = $_.StandardOutput.ReadToEnd()
    $stderr = $_.StandardError.ReadToEnd()
    $_.WaitForExit()
    $det = $detallesSesion[$_.Id]
    [System.IO.File]::WriteAllText($det.Out, $stdout, (New-Object System.Text.UTF8Encoding($false)))
    [System.IO.File]::WriteAllText($det.Err, $stderr, (New-Object System.Text.UTF8Encoding($false)))
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
$detallesSesion = @{}
for ($i = 0; $i -lt 3; $i++) {
    $sql = Join-Path $dirLogs "anio_nuevo_$i.sql"
    $out = Join-Path $dirLogs "anio_nuevo_$i.log"
    $err = Join-Path $dirLogs "anio_nuevo_$i.err"
    'SELECT sigd_tra.generar_cut_expediente(2028);' |
        Set-Content -LiteralPath $sql -Encoding UTF8
    $p = Start-PsqlSession -SqlFile $sql
    $procesos += $p
    $detallesSesion[$p.Id] = @{ Out = $out; Err = $err }
}

# Verificar exit code de CADA proceso de año nuevo
$exitCodesAnio = @{}
$procesos | ForEach-Object {
    $stdout = $_.StandardOutput.ReadToEnd()
    $stderr = $_.StandardError.ReadToEnd()
    $_.WaitForExit()
    $det = $detallesSesion[$_.Id]
    [System.IO.File]::WriteAllText($det.Out, $stdout, (New-Object System.Text.UTF8Encoding($false)))
    [System.IO.File]::WriteAllText($det.Err, $stderr, (New-Object System.Text.UTF8Encoding($false)))
    $exitCodesAnio[$_.Id] = $_.ExitCode
}
$fallosAnio = $exitCodesAnio.Values | Where-Object { $_ -ne 0 }
if ($fallosAnio.Count -gt 0) {
    Write-Host "FALLO: $($fallosAnio.Count) sesiones de año nuevo terminaron con exit code != 0" -ForegroundColor Red
    exit 1
}

# Leer los CUTs REALMENTE generados por las sesiones (una línea por log).
$cuts2028 = @(Get-ChildItem "$dirLogs\anio_nuevo_*.log" |
    ForEach-Object { Get-Content $_.FullName } |
    Where-Object { $_ -match '^EXP-2028-[0-9]{6}\z' } |
    ForEach-Object { "$_" })

$expected2028 = @('EXP-2028-000001', 'EXP-2028-000002', 'EXP-2028-000003')
$unicos2028 = @($cuts2028 | Sort-Object -Unique)
$coinciden2028 = ($expected2028.Count -eq $unicos2028.Count) -and ($expected2028 | Where-Object { $_ -notin $unicos2028 }).Count -eq 0
$filas2028 = (Invoke-Query "SELECT COUNT(*) FROM sigd_tra.secuencia_anual_cut WHERE anio_fiscal = 2028;").Output

Write-Host "Año 2028: CUTs=$($unicos2028 -join ', '), esperados=$($expected2028 -join ', '), filas_anuales=$filas2028" -ForegroundColor Yellow

# ===========================================================================
# 6) Pruebas de foliado:
#    6a) NEGATIVA REAL (secuencial): INSERT directo con rango solapado sobre un
#        expediente ya foliado es rechazado por el trigger [23514] (exit != 0).
#    6b) CONCURRENCIA REAL (positiva): 2 sesiones paralelas folian el MISMO
#        expediente vía la función canónica; ambas terminan exit 0 y los rangos
#        quedan contiguos (1-5 y 6-10), sin solapamientos ni huecos.
#    6c) CONCURRENCIA REAL (negativa, INSERT directo): 2 sesiones paralelas
#        insertan el MISMO rango 1-5 sobre un expediente vacío. El bloqueo
#        previo de la fila del expediente en el trigger serializa la escritura:
#        solo UNA confirma (exit 0) y la otra es rechazada (exit != 0, [23514]).
# ===========================================================================
Write-Host '[6/7] Pruebas de foliado: negativa real + 2 pruebas concurrentes...'

function New-ExpedienteFoliable {
    $v1 = @((Invoke-Query "INSERT INTO sigd_tra.tramite (asunto, estado, fk_remitente, fk_destinatario) VALUES ('Expediente para prueba de foliado', 'REGISTRADO', 101, 301) RETURNING id_tramite;").Output)
    $idTramite = ($v1 | Where-Object { $_ -is [string] -and $_.Trim() -match '^\d+$' } | Select-Object -First 1).Trim()
    $v2 = @((Invoke-Query "INSERT INTO sigd_tra.expediente (fk_tramite) VALUES ($idTramite) RETURNING id_expediente;").Output)
    $idExp = ($v2 | Where-Object { $_ -is [string] -and $_.Trim() -match '^\d+$' } | Select-Object -First 1).Trim()
    return $idExp
}

# --- 6a) NEGATIVA REAL (secuencial): solapamiento rechazado [23514] ----------
$folioSqlNeg1 = Join-Path $dirLogs "folio_negativo_0.sql"
$folioSqlNeg2 = Join-Path $dirLogs "folio_negativo_1.sql"
$folioOutNeg1 = Join-Path $dirLogs "folio_negativo_0.log"
$folioOutNeg2 = Join-Path $dirLogs "folio_negativo_1.log"
$folioErrNeg1 = Join-Path $dirLogs "folio_negativo_0.err"
$folioErrNeg2 = Join-Path $dirLogs "folio_negativo_1.err"

$idNeg = New-ExpedienteFoliable
@(
    "SET search_path TO sigd_tra, public;",
    "SELECT sigd_tra.agregar_folio_expediente($idNeg, 901, 10);"
) | Set-Content -LiteralPath $folioSqlNeg1 -Encoding UTF8
@(
    "SET search_path TO sigd_tra, public;",
    "INSERT INTO sigd_tra.expediente_documento_folio (id_expediente, id_documento, folio_inicio, folio_fin, total_folios) VALUES ($idNeg, 902, 1, 5, 5);"
) | Set-Content -LiteralPath $folioSqlNeg2 -Encoding UTF8

# Ejecución DETERMINISTA: primero se pueblan los folios 1-10 (sesión 0 termina
# antes de iniciar la sesión 1) y luego el INSERT directo 1-5 (solapado) debe
# ser rechazado. ON_ERROR_STOP=1: sin él, psql continuaría y devolvería exit 0
# pese al error, enmascarando la prueba negativa.
# Nota de codificación: se usa el mismo mecanismo de sesión que 6b/6c
# (redirección cruda de streams) para que los .log/.err queden en UTF-8 limpio;
# el operador `2>` de PowerShell escribiría UTF-16 con prefijo "psql.exe :".
$pNeg0 = Start-PsqlSession -SqlFile $folioSqlNeg1
$stdoutNeg0 = $pNeg0.StandardOutput.ReadToEnd()
$stderrNeg0 = $pNeg0.StandardError.ReadToEnd()
$pNeg0.WaitForExit()
$folioNegExit0 = $pNeg0.ExitCode
[System.IO.File]::WriteAllText($folioOutNeg1, $stdoutNeg0, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText($folioErrNeg1, $stderrNeg0, (New-Object System.Text.UTF8Encoding($false)))
$pNeg1 = Start-PsqlSession -SqlFile $folioSqlNeg2
$stdoutNeg1 = $pNeg1.StandardOutput.ReadToEnd()
$stderrNeg1 = $pNeg1.StandardError.ReadToEnd()
$pNeg1.WaitForExit()
$folioNegExit1 = $pNeg1.ExitCode
[System.IO.File]::WriteAllText($folioOutNeg2, $stdoutNeg1, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText($folioErrNeg2, $stderrNeg1, (New-Object System.Text.UTF8Encoding($false)))
$folioNegErrContent = (Get-Content $folioErrNeg2 -ErrorAction SilentlyContinue) -join "`n"
$folioNegSolapamiento = ($folioNegErrContent -match '23514|Solapamiento|solapamiento')
$folioNegRows = @(Invoke-Query "SELECT string_agg(folio_inicio || '|' || folio_fin, ', ' ORDER BY folio_inicio) FROM sigd_tra.expediente_documento_folio WHERE id_expediente = $idNeg;").Output
Write-Host "Foliado 6a: poblacion exit=$folioNegExit0, rechazo exit=$folioNegExit1, detectado=$folioNegSolapamiento, rangos=$folioNegRows" -ForegroundColor Yellow

# --- 6b) CONCURRENCIA REAL positiva: 2 sesiones canónicas sobre el MISMO
#         expediente. El FOR UPDATE del expediente serializa y ambas confirman
#         rangos contiguos (1-5 y 6-10), sin solapamientos ni huecos. ---------
$idConc = New-ExpedienteFoliable
$procesosConc = @()
$detallesConc = @{}
for ($i = 0; $i -lt 2; $i++) {
    $sql = Join-Path $dirLogs "folio_concurrente_$i.sql"
    $out = Join-Path $dirLogs "folio_concurrente_$i.log"
    $err = Join-Path $dirLogs "folio_concurrente_$i.err"
    $doc = 910 + $i
    @(
        "SET search_path TO sigd_tra, public;",
        "SELECT sigd_tra.agregar_folio_expediente($idConc, $doc, 5);"
    ) | Set-Content -LiteralPath $sql -Encoding UTF8
    $p = Start-PsqlSession -SqlFile $sql
    $procesosConc += $p
    $detallesConc[$p.Id] = @{ Out = $out; Err = $err }
}
$exitCodesConc = @{}
$procesosConc | ForEach-Object {
    $stdout = $_.StandardOutput.ReadToEnd()
    $stderr = $_.StandardError.ReadToEnd()
    $_.WaitForExit()
    $det = $detallesConc[$_.Id]
    [System.IO.File]::WriteAllText($det.Out, $stdout, (New-Object System.Text.UTF8Encoding($false)))
    [System.IO.File]::WriteAllText($det.Err, $stderr, (New-Object System.Text.UTF8Encoding($false)))
    $exitCodesConc[$_.Id] = $_.ExitCode
}
$concErrores = @($exitCodesConc.Values | Where-Object { $_ -ne 0 }).Count
$folioConcRows = @(Invoke-Query "SELECT string_agg(folio_inicio || '-' || folio_fin, ', ' ORDER BY folio_inicio) FROM sigd_tra.expediente_documento_folio WHERE id_expediente = $idConc;").Output
$folioConcContiguos = ("$folioConcRows".Trim() -eq '1-5, 6-10')
Write-Host "Foliado 6b: exit=$($exitCodesConc.Values -join ','), rangos=$folioConcRows, contiguos=$folioConcContiguos" -ForegroundColor Yellow

# --- 6c) CONCURRENCIA REAL negativa: 2 sesiones paralelas insertan el MISMO
#         rango 1-5 sobre un expediente vacío (INSERT directo). El bloqueo
#         previo en el trigger serializa: exactamente UNA confirma (exit 0) y
#         la otra es rechazada (exit != 0, [23514]). Queda un único rango 1|5.
#         Ningún rango incompatible se confirma bajo concurrencia. -------------
$idDirect = New-ExpedienteFoliable
$procesosDirect = @()
$detallesDirect = @{}
for ($i = 0; $i -lt 2; $i++) {
    $sql = Join-Path $dirLogs "folio_concurrente_directo_$i.sql"
    $out = Join-Path $dirLogs "folio_concurrente_directo_$i.log"
    $err = Join-Path $dirLogs "folio_concurrente_directo_$i.err"
    $doc = 920 + $i
    @(
        "SET search_path TO sigd_tra, public;",
        "INSERT INTO sigd_tra.expediente_documento_folio (id_expediente, id_documento, folio_inicio, folio_fin, total_folios) VALUES ($idDirect, $doc, 1, 5, 5);"
    ) | Set-Content -LiteralPath $sql -Encoding UTF8
    $p = Start-PsqlSession -SqlFile $sql
    $procesosDirect += $p
    $detallesDirect[$p.Id] = @{ Out = $out; Err = $err }
}
$exitCodesDirect = @{}
$procesosDirect | ForEach-Object {
    $stdout = $_.StandardOutput.ReadToEnd()
    $stderr = $_.StandardError.ReadToEnd()
    $_.WaitForExit()
    $det = $detallesDirect[$_.Id]
    [System.IO.File]::WriteAllText($det.Out, $stdout, (New-Object System.Text.UTF8Encoding($false)))
    [System.IO.File]::WriteAllText($det.Err, $stderr, (New-Object System.Text.UTF8Encoding($false)))
    $exitCodesDirect[$_.Id] = $_.ExitCode
}
$directExit0 = @($exitCodesDirect.Values | Where-Object { $_ -eq 0 }).Count
$directExitNo0 = @($exitCodesDirect.Values | Where-Object { $_ -ne 0 }).Count
$directErr = @(Get-ChildItem "$dirLogs\folio_concurrente_directo_*.err" |
    ForEach-Object { Get-Content $_.FullName } |
    Where-Object { $_ -match '23514|Solapamiento|solapamiento' })
$folioDirectRows = @(Invoke-Query "SELECT string_agg(folio_inicio || '|' || folio_fin, ', ' ORDER BY folio_inicio) FROM sigd_tra.expediente_documento_folio WHERE id_expediente = $idDirect;").Output
$unSoloAceptado = ($directExit0 -eq 1 -and $directExitNo0 -eq 1 -and $directErr.Count -ge 1 -and "$folioDirectRows".Trim() -eq '1|5')
Write-Host "Foliado 6c: exit0s=$directExit0, rechazos=$directExitNo0, bloqueado=$($directErr.Count -gt 0), rangos=$folioDirectRows" -ForegroundColor Yellow

# ===========================================================================
# 7) Resumen final y evidencia consolidada
# ===========================================================================
Write-Host '[7/7] Resumen final y generación de evidencia...' -ForegroundColor Cyan
$fechaFin = Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ'

$criterios = @(
    @{ Nombre = 'Laboratorio determinista (26 pruebas)'; Cond = ($failLab.Count -eq 0 -and $okCount -eq 26); Detalle = "$okCount pruebas OK, exit $labExitCode" }
    @{ Nombre = '500 CUTs únicos (5 sesiones)'; Cond = ($totalCuts -eq 500 -and $unicosCuts -eq 500); Detalle = "total=$totalCuts unicos=$unicosCuts" }
    @{ Nombre = 'Sin errores/deadlocks en concurrencia'; Cond = ($errores2026.Count -eq 0); Detalle = "errores=$($errores2026.Count)" }
    @{ Nombre = 'Carrera año 2028: 3 CUTs exactos 000001, 000002, 000003 y 1 fila anual'; Cond = ($coinciden2028 -and "$filas2028".Trim() -eq '1'); Detalle = "cuts=$($unicos2028.Count) coinciden=$coinciden2028 filas=$filas2028" }
    @{ Nombre = 'Foliado: solapamiento rechazado (prueba negativa SECUENCIAL)'; Cond = ($folioNegExit0 -eq 0 -and $folioNegExit1 -ne 0 -and $folioNegSolapamiento); Detalle = "popula=$folioNegExit0 solapado=$folioNegExit1 detectado=$folioNegSolapamiento rangos=$folioNegRows" }
    @{ Nombre = 'Foliado concurrente (función canónica): 2 sesiones, rangos contiguos 1-5 y 6-10'; Cond = ($concErrores -eq 0 -and $folioConcContiguos); Detalle = "exit=$($exitCodesConc.Values -join ',') rangos=$folioConcRows contiguos=$folioConcContiguos" }
    @{ Nombre = 'Foliado concurrente (INSERT directo): solo 1 de 2 sesiones confirma el rango 1-5; sin rangos incompatibles'; Cond = $unSoloAceptado; Detalle = "exit0s=$directExit0 rechazos=$directExitNo0 bloqueado=$($directErr.Count -gt 0) rangos=$folioDirectRows" }
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
            resultado    = if ($failLab.Count -eq 0 -and $okCount -eq 26) { 'PASS' } else { 'FAIL' }
        }
        concurrencia_2026 = @{
            sesiones     = $sesionesConcurrentes
            cuts_total   = $totalCuts
            cuts_unicos  = $unicosCuts
            errores      = $errores2026.Count
            exit_codes   = @($exitCodesConcurrentes.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" })
            resultado    = if ($totalCuts -eq 500 -and $unicosCuts -eq 500 -and $errores2026.Count -eq 0) { 'PASS' } else { 'FAIL' }
        }
        carrera_anio_nuevo = @{
            cuts         = @($cuts2028)
            esperados    = $expected2028
            filas_anuales= "$filas2028".Trim()
            exit_codes   = @($exitCodesAnio.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" })
            resultado    = if ($coinciden2028 -and "$filas2028".Trim() -eq '1') { 'PASS' } else { 'FAIL' }
        }
        foliado_negativo_solapamiento = @{
            exit_codes     = @($folioNegExit0, $folioNegExit1)
            rangos         = $folioNegRows
            solapamiento_detectado = $folioNegSolapamiento
            resultado      = if ($folioNegExit0 -eq 0 -and $folioNegExit1 -ne 0 -and $folioNegSolapamiento) { 'PASS' } else { 'FAIL' }
        }
        foliado_concurrente = @{
            sesiones       = 2
            exit_codes     = @($exitCodesConc.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" })
            rangos         = $folioConcRows
            contiguos      = $folioConcContiguos
            resultado      = if ($concErrores -eq 0 -and $folioConcContiguos) { 'PASS' } else { 'FAIL' }
        }
        foliado_concurrente_insert_directo = @{
            sesiones       = 2
            exit_codes     = @($exitCodesDirect.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" })
            rangos         = $folioDirectRows
            un_solo_aceptado      = $unSoloAceptado
            solapamiento_bloqueado = ($directErr.Count -gt 0)
            resultado      = if ($unSoloAceptado) { 'PASS' } else { 'FAIL' }
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
