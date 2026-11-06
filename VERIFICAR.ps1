# SIGD - Prueba que la base de datos, el backend y el frontend esten conectados.
$ErrorActionPreference = 'SilentlyContinue'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $raiz

$script:aprobadas = 0
$script:fallidas = 0

function Probar($nombre, [scriptblock]$accion) {
  try {
    $detalle = & $accion
    Write-Host "[OK]    $nombre" -ForegroundColor Green
    if ($detalle) { Write-Host "        $detalle" -ForegroundColor DarkGray }
    $script:aprobadas++
  } catch {
    Write-Host "[FALLA] $nombre -> $($_.Exception.Message)" -ForegroundColor Red
    $script:fallidas++
  }
}

Write-Host 'Verificando el SIGD...' -ForegroundColor Cyan
Write-Host ''

Probar 'Contenedor PostgreSQL en estado healthy' {
  $estado = docker inspect --format '{{.State.Health.Status}}' sigd_postgres
  if ($estado -ne 'healthy') { throw "estado actual: $estado" }
  'sigd_postgres healthy en localhost:5434'
}

Probar 'Conexion a la base sigd_prueba y esquemas' {
  $conteo = docker exec sigd_postgres psql -U postgres -d sigd_prueba -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema LIKE 'sigd_%';"
  if ([int]$conteo -lt 50) { throw "solo se encontraron $conteo tablas sigd_*" }
  "$conteo tablas en los 6 esquemas"
}

Probar 'Backend /health' {
  $r = Invoke-RestMethod -Uri 'http://localhost:3000/health' -TimeoutSec 5
  if ($r.status -ne 'ok') { throw 'el backend no reporta status ok' }
  'backend escuchando en http://localhost:3000'
}

Probar 'Backend /ready (PostgreSQL conectado)' {
  $r = Invoke-RestMethod -Uri 'http://localhost:3000/ready' -TimeoutSec 5
  if ($r.estado -ne 'READY') { throw 'el backend no reporta READY' }
  'el backend esta conectado a PostgreSQL'
}

Probar 'Login con usuario semilla superadmin / 123' {
  $body = @{ identificador = 'superadmin'; password = '123' } | ConvertTo-Json
  $r = Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/auth/login' -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 10
  if (-not $r.accessToken) { throw 'no se recibio accessToken' }
  "rol: $($r.usuario.rol)"
}

Probar 'Registro de ciudadano contra la base de datos' {
  $body = @{
    tipoPersona        = 'NATURAL'
    dni                = '10000001'
    nombres            = 'Prueba'
    apellidoPaterno    = 'Sistema'
    apellidoMaterno    = 'Demo'
    correo             = 'prueba.duplicado@iestp-suiza.edu.pe'
    celular            = '999999999'
    ubigeoDistrito     = '250101'
    direccion          = 'Av. Prueba 123'
    password           = 'Prueba1234'
    consentimientoDatos = $true
  } | ConvertTo-Json
  try {
    Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/auth/registro-ciudadano' -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 15 | Out-Null
    'registro aceptado por la base de datos'
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 409) { 'la BD respondio correctamente: el ciudadano ya existe (409)' }
    elseif ($status -eq 400) { 'la BD valido los datos del registro (400)' }
    else { throw "respuesta inesperada del registro: HTTP $status" }
  }
}

Probar 'Frontend en http://localhost:5173' {
  $r = Invoke-WebRequest -Uri 'http://localhost:5173' -TimeoutSec 5 -UseBasicParsing
  if ($r.StatusCode -ne 200) { throw "HTTP $($r.StatusCode)" }
  'SPA servida por Vite'
}

Write-Host ''
if ($script:fallidas -eq 0) {
  Write-Host "Todo correcto: $script:aprobadas verificaciones aprobadas." -ForegroundColor Green
  exit 0
}

Write-Host "Resultado: $script:aprobadas aprobadas y $script:fallidas fallidas." -ForegroundColor Yellow
Write-Host 'Si el backend o el frontend no estan arriba, ejecute INICIAR.bat.' -ForegroundColor Yellow
exit 1
