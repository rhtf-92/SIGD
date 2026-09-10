# 08 · RUNBOOK DE EVIDENCIA EJECUTABLE — E2E (Testcontainers) Y CARGA (k6)

**Entregable:** 08 — Instrucciones para generar la evidencia exigida por la revisión del liderazgo
(PR #79 cancelado)
**Responsable:** Zevallos (`B_ZEVALLOS`) — elaborado por Ricardo (`B_AREVALO`)
**Fecha:** 8 de septiembre de 2026
**Motivo:** El liderazgo requiere **artefactos ejecutables** (no solo documentación): configuración
Testcontainers, Vitest, Supertest, 10 casos E2E, script k6 con `check()` y `thresholds`, logs con
timestamps, exit codes y resultados **P95** y **tasa de errores**. Esta guía se ejecuta en una
máquina con **Docker**; mientras no exista, la evidencia permanece `PENDIENTE` (05 R-10).

---

## 1. Artefactos de evidencia requeridos

| # | Evidencia | Origen | Formato de salida |
| :---: | :--- | :--- | :--- |
| E1 | Config Testcontainers (PostgreSQL 18 Alpine) y Vitest | `vitest.config.ts`, `tests/setup/global-setup.ts` | `npm run test:e2e` |
| E2 | 10 casos E2E con Supertest | `tests/e2e/e2e-01…10.test.ts` | Reporte Vitest (duration, tests passed/failed) |
| E3 | Timestamps y logs de cada ejecución | `tests/setup/global-setup.ts` + captura de consola | Log con hora ([HH:mm:ss]) y fecha |
| E4 | Exit code de cada etapa | Código de retorno de cada comando | `0 = exitoso`, `1 = fallo` |
| E5 | Script k6 con `check()` y `thresholds` | `k6/escenario-1-radicacion.js`, `k6/escenario-2-derivacion.js` | Salida k6 |
| E6 | Resultados P95 y tasa de errores | `thresholds` de k6 | Resumen k6 (`--summary-export`) |

## 2. Requisitos

- Node.js ≥ 20 (verificado con `node --version`).
- Docker Engine en la máquina que ejecuta las pruebas (Linux o Windows con WSL2).
- k6: binario local (`k6 --version`) **o** imagen `grafana/k6` (alternativa en §5.2).

> La suite E2E levanta PostgreSQL 18 (Alpine) con Testcontainers y aplica el DDL
> `06_sigd_audit_esquema_ddl.sql`; no requiere una base local configurada.

## 3. Paso 0 — Preparar el entorno

Desde la carpeta `integracion/implementacion`:

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

## 4. Paso 1 — Ejecutar los 10 E2E con Testcontainers

Se crea una carpeta de evidencia con marca de tiempo y se captura la salida completa:

```powershell
$ev = Join-Path "evidencia" ("e2e-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $ev | Out-Null

# Ejecutar la suite E2E volcando a log con timestamps
npm run test:e2e 2>&1 | Tee-Object -FilePath (Join-Path $ev "e2e.log")
$code = $LASTEXITCODE
"EXIT_CODE=$code" | Add-Content -Path (Join-Path $ev "e2e.log")

# Guardar métricas en resumen corto para el reporte
if ($code -eq 0) { "PASS: 10/10 E2E" } else { "FAIL: revisar e2e.log" } | Out-File (Join-Path $ev "resumen.txt")
```

**Contenido esperado del log:** los 10 casos (`e2e-01` a `e2e-10`) con nombre, duración, timestamps
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
  < ..\06_sigd_audit_esquema_ddl.sql
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

```powershell
$env:BASE_URL = "http://localhost:3000"

# Opción A: k6 instalado localmente
k6 run --summary-export evidencia/k6-radicacion-summary.json k6/escenario-1-radicacion.js 2>&1 |
  Tee-Object -FilePath evidencia/k6-radicacion.log
"EXIT_CODE=$LASTEXITCODE" | Add-Content evidencia/k6-radicacion.log

k6 run --summary-export evidencia/k6-derivacion-summary.json k6/escenario-2-derivacion.js 2>&1 |
  Tee-Object -FilePath evidencia/k6-derivacion.log
"EXIT_CODE=$LASTEXITCODE" | Add-Content evidencia/k6-derivacion.log
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
   - `e2e-*.log` y `resumen.txt` (E1–E4).
   - `k6-radicacion.log` + `k6-radicacion-summary.json` (E5–E6).
   - `k6-derivacion.log` + `k6-derivacion-summary.json` (E5–E6).
2. Actualizar el **entregable 07 §3 (corrección 5)** a `APLICADA` y anotar el enlace a los artefactos.
3. Actualizar en el **entregable 05**: riesgo R-10 → `CERRADO`; D-05, D-06, D-20 y C-08 pasan a
   `CONFIRMADO` **solo** cuando la evidencia demuestre inmutabilidad, atomicidad, cero pérdida y la
   semántica de entrega.

## 7. Criterios de aceptación de la evidencia

| # | Criterio | Cumple |
| :---: | :--- | :---: |
| 1 | Los 10 casos E2E pasan en Testcontainers con exit code 0 y logs con timestamp. | DI |
| 2 | k6 ejecuta los 2 escenarios con `check()` y `thresholds` definidos. | DI |
| 3 | P95 < 200 ms y tasa de errores < 0.1 % en ambos escenarios. | DI |
| 4 | Los artefactos se adjuntan y referencian en 07 §3 y 05 R-10. | DI |

DI = disponible en la máquina con Docker; se completa al ejecutar.

---

*Documento elaborado por Ricardo (`B_AREVALO`) con base en los entregables 03 (Zevallos) y 05.
Revisión 1.0: primera versión del runbook de evidencia tras la cancelación del PR #79.*