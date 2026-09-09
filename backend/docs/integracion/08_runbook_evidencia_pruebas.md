# 08 · RUNBOOK DE EVIDENCIA EJECUTABLE — E2E (Testcontainers) Y CARGA (k6)

**Entregable:** 08 — Instrucciones para generar la evidencia exigida por la revisión del liderazgo
(PR #79 cancelado)
**Responsable:** Zevallos (`B_ZEVALLOS`) — elaborado por Ricardo (`B_AREVALO`)
**Fecha:** 8 de septiembre de 2026
**Motivo:** El liderazgo requiere **artefactos ejecutables** (no solo documentación): configuración
Testcontainers, Vitest, Supertest, 10 casos E2E, script k6 con `check()` y `thresholds`, logs con
timestamps, exit codes y resultados **P95** y **tasa de errores**. Esta guía se ejecuta preferentemente
en una máquina con **Docker** (PostgreSQL aislado) o con un PostgreSQL existente vía
`TEST_DATABASE_URL`; la **evidencia ya fue ejecutada** (v1.2): suite E2E completa y carga k6 dentro de
umbrales — ver §7 y el bloque final de evidencia.

---

## 1. Artefactos de evidencia requeridos

| # | Evidencia | Origen | Formato de salida |
| :---: | :--- | :--- | :--- |
| E1 | Config Testcontainers (PostgreSQL 18 Alpine) **o** PostgreSQL existente vía `TEST_DATABASE_URL` + Vitest | `vitest.config.ts`, `tests/setup/global-setup.ts` | `npm run test:e2e` |
| E2 | 12 archivos de casos E2E con Supertest (22 casos) | `tests/e2e/e2e-01…12.test.ts` | Reporte Vitest (duration, tests passed/failed) |
| E3 | Timestamps y logs de cada ejecución | `tests/setup/global-setup.ts` + captura de consola | Log con hora ([HH:mm:ss]) y fecha |
| E4 | Exit code de cada etapa | Código de retorno de cada comando | `0 = exitoso`, `1 = fallo` |
| E5 | Script k6 con `check()` y `thresholds` | `k6/escenario-1-radicacion.js`, `k6/escenario-2-derivacion.js` | Salida k6 |
| E6 | Resultados P95 y tasa de errores | `thresholds` de k6 | Resumen k6 (`--summary-export`) |

## 2. Requisitos

- Node.js ≥ 20 (verificado con `node --version`).
- Docker Engine en la máquina que ejecuta las pruebas (Linux o Windows con WSL2).
- k6: binario local (`k6 --version`) **o** imagen `grafana/k6` (alternativa en §5.2).

> La suite E2E aplica el DDL `06_sigd_audit_esquema_ddl.sql` + los fixtures PROVISIONALES del
> prototipo. Se ejecuta con **Testcontainers (PostgreSQL 18 Alpine)** o, en máquinas sin Docker, con un
> PostgreSQL existente definido explícitamente: `TEST_DATABASE_URL=postgres://...` (el global-setup
> **falla con error instructivo** si no hay ninguna de las dos opciones; nunca usa un fallback local
> silencioso).

## 3. Paso 0 — Preparar el entorno

Desde la carpeta `backend/docs/implementacion`:

```powershell
# 1) Instalar dependencias (una sola vez)
npm install

# 2) Verificar compilación y tipos (no requiere Docker)
npm run typecheck
npm run build

# 3) Pruebas unitarias (no requiere Docker)
npm run test:unit
```

Registrar el exit code de cada uno; deben terminar en `0`.

## 4. Paso 1 — Ejecutar la suite E2E (12 archivos / 22 casos)

Se crea una carpeta de evidencia con marca de tiempo y se captura la salida completa:

```powershell
$ev = Join-Path "evidencia" ("e2e-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $ev | Out-Null

# Opción A: Testcontainers (requiere Docker)
npm run test:e2e 2>&1 | Tee-Object -FilePath (Join-Path $ev "e2e.log")

# Opción B: PostgreSQL existente sin Docker (define TEST_DATABASE_URL explícitamente)
$env:TEST_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/sigd_prueba"
npm run test:e2e 2>&1 | Tee-Object -FilePath (Join-Path $ev "e2e.log")

$code = $LASTEXITCODE
"EXIT_CODE=$code" | Add-Content -Path (Join-Path $ev "e2e.log")

# Guardar métricas en resumen corto para el reporte
if ($code -eq 0) { "PASS: 12/12 archivos, 22/22 casos E2E" } else { "FAIL: revisar e2e.log" } | Out-File (Join-Path $ev "resumen.txt")
```

**Contenido esperado del log:** los 12 archivos (`e2e-01` a `e2e-12`) con nombre, duración, timestamps
de Vitest y el `EXIT_CODE`. Al adjuntarse al PR se cumple E1–E4.

## 5. Paso 2 — Carga con k6 (radicación y derivación)

### 5.1. Levantar la API contra una PostgreSQL real

k6 requiere el servidor en ejecución (Docker para Postgres, la app con `npm run dev`):

```powershell
# PostgreSQL efímero para la prueba de carga (recrea la base del E2E)
docker run -d --name sigd-pg-k6 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sigd_prueba `
  -p 5432:5432 postgres:18-alpine

# Aplicar el esquema de CoreLink
docker exec -i sigd-pg-k6 psql -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 `
  < ../integracion/06_sigd_audit_esquema_ddl.sql
```

En otra terminal, iniciar la API (en `implementacion/`):

```powershell
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:5432/sigd_prueba"
npm run dev
```

> Nota: los escenarios k6 envían datos ficticios (números `EXP-<VU>-<ts>`) y validan
> `HTTP 201` con `check()`; los umbrales son `p(95)<200` ms y `rate<0.001` (§6.1 del entregable 03,
> decisión D-08).

### 5.2. Ejecutar los escenarios y exportar resúmenes

Se crea una carpeta con marca de tiempo y se guardan logs y summaries:

```powershell
$ev = Join-Path "evidencia" ("k6-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $ev | Out-Null
$env:BASE_URL = "http://localhost:3000"

# Opción A: k6 instalado localmente
k6 run --summary-export (Join-Path $ev "k6-radicacion-summary.json") k6/escenario-1-radicacion.js 2>&1 |
  Tee-Object -FilePath (Join-Path $ev "k6-radicacion.log")
"EXIT_CODE=$LASTEXITCODE" | Add-Content (Join-Path $ev "k6-radicacion.log")

k6 run --summary-export (Join-Path $ev "k6-derivacion-summary.json") k6/escenario-2-derivacion.js 2>&1 |
  Tee-Object -FilePath (Join-Path $ev "k6-derivacion.log")
"EXIT_CODE=$LASTEXITCODE" | Add-Content (Join-Path $ev "k6-derivacion.log")
```

**Opción B (sin instalar k6):** usar la imagen oficial

```powershell
docker run --rm -i -e BASE_URL=http://host.docker.internal:3000 -v "${PWD}/k6:/k6" grafana/k6 run `
  --summary-export /k6/k6-radicacion-summary.json /k6/escenario-1-radicacion.js
```

### 5.3. Lectura de resultados

- En la salida de k6: `http_req_duration p(95)` (debe ser `< 200 ms`) y `http_req_failed rate`
  (debe ser `< 0.001`, es decir, error < 0.1 %).
- Los `checks` deben mostrar `100.00%` de `HTTP 201`.
- El `EXIT_CODE` de k6 será `0` **solo si se cumplen los thresholds** (los fallos de umbral devuelven
  código no nulo); eso es parte de la evidencia E5–E6.

## 6. Paso 3 — Consolidar la evidencia y adjuntarla

1. Copiar la carpeta `evidencia/` al repositorio (contenido final):
   - `e2e-20260909-123500/` → `e2e.log` y `resumen.txt` (E1–E4).
   - `k6-20260909-145820/` → `k6-radicacion.log` + `k6-radicacion-summary.json` y
     `k6-derivacion.log` + `k6-derivacion-summary.json` (E5–E6) + `resumen.txt`.
2. Actualizar el **entregable 07 §3 (corrección 5)** a `APLICADA` y anotar el enlace a los artefactos.
   (v1.2 ya aplicada: la evidencia E2E/k6 está cargada en `implementacion/evidencia/`.)
3. Actualizar en el **entregable 05**: riesgo R-10 → `CERRADO` (v1.2 ya aplicado); D-06, D-20 y C-08
   pasan a `CONFIRMADO` **solo** cuando la evidencia demuestre atomicidad, cero pérdida y la semántica
   de entrega (v1.5: demostrado con E2E-07/E2E-12); D-05 (inmutabilidad) permanece `PROPUESTO` hasta
   la prueba de permisos del rol `sigd_app` en el UAT.

## 7. Criterios de aceptación de la evidencia

| # | Criterio | Cumple |
| :---: | :--- | :---: |
| 1 | Los 12 archivos / 22 casos E2E pasan (Testcontainers o `TEST_DATABASE_URL`) con exit code 0 y logs con timestamp. | ✅ |
| 2 | k6 ejecuta los 2 escenarios con `check()` y `thresholds` definidos. | ✅ |
| 3 | P95 < 200 ms y tasa de errores < 0.1 % en ambos escenarios. | ✅ |
| 4 | Los artefactos se adjuntan y referencian en 07 §3 y 05 R-10. | ✅ |

✅ = evidencia ejecutada y adjuntada en `implementacion/evidencia/` (E2E 12/12 · 22/22 EXIT 0; k6
radicación P95 150.96 ms y derivación P95 144.64 ms, 0 % errores, EXIT 0). La ejecución de referencia
usó un PostgreSQL 16 local (`TEST_DATABASE_URL`) y la API compilada en `localhost:3000`; Docker
permanece como alternativa de mayor fidelidad para el UAT.

---

*Documento elaborado por Ricardo (`B_AREVALO`) con base en los entregables 03 (Zevallos) y 05.
Revisión 1.1: incorpora la alternativa `TEST_DATABASE_URL` (sin Docker) y la suite completa de
12 archivos / 22 casos E2E. Revisión 1.2: consolida la evidencia ejecutada (E2E + k6) y declara los
criterios de aceptación cumplidos.*

> **Evidencia E2E ejecutada:** `implementacion/evidencia/e2e-20260909-123500/` (PASS 12/12 · 22/22 ·
> EXIT_CODE=0) — ronda de correcciones P2–P11 del prototipo. Ejecutada con `TEST_DATABASE_URL`
> (`postgres://postgres:postgres@localhost:5432/sigd_prueba`), psql 16, el DDL real de `sigd_audit` y
> los fixtures PROVISIONALES de los 5 esquemas.
>
> **Evidencia de carga k6 ejecutada:** `implementacion/evidencia/k6-20260909-145820/` (k6 v2.2.0
> local, API compilada en `localhost:3000`, PostgreSQL 16 local). Escenario 1 — Radicación: 94 525
> peticiones, P95 = **150.96 ms** (< 200 ms ✅), errores **0.00 %** (< 0.1 % ✅), checks 100 %,
> EXIT_CODE=0. Escenario 2 — Derivación: 55 254 peticiones, P95 = **144.64 ms** (< 200 ms ✅), errores
> **0.00 %** (< 0.1 % ✅), checks 100 % (área 201 · expediente 201 · derivación 200), EXIT_CODE=0.
> Resumen consolidado y limitaciones en `resumen.txt` del mismo directorio.