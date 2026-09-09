# IMPLEMENTACIÓN CORE-LINK — BACKEND SIGD
## Grupo 6 "CoreLink" · Integración, Calidad y Pruebas del Backend

**Entregable de implementación** (Fase 2 — Levantamiento de Observaciones).
Complementa los documentos de especificación `01` a `05` con **código fuente,
esquema de base de datos y suite de pruebas** reales, respondiendo a la
observación: *"solo tiene documentación; falta su implementación: código fuente
o el esquema de base de datos de la tarea del grupo"*.

> **NOTA:** Esta carpeta se mantiene como prototipo técnico aislado.
> Tiene su propio `package.json` y versiones diferentes del proyecto principal.
> La ubicación definitiva (dentro de `backend/src`, como prototipo o en otra
> ubicación) está pendiente de consulta con Geric y el profesor.

---

## 1. Contenido y trazabilidad con los entregables documentales

| Carpeta / archivo | Implementa | Especificación |
| :--- | :--- | :--- |
| `src/shared/domain/errors/` | Jerarquía `AppError`, `DomainError` (422), `NotFoundError` (404), `ConflictError` (409), `UnauthorizedError` (401), `ForbiddenError` (403), `ValidationError` (400) | `../integracion/01_especificacion_middleware_rfc7807.md` §4 |
| `src/shared/request-context/` | `AsyncLocalStorage` (una sola instancia), `crearContexto`, `setUsuarioId` | `../integracion/01_especificacion_middleware_rfc7807.md` §8 y `../integracion/02_arquitectura_auditoria_contexto_asynclocalstorage.md` §4 |
| `src/middleware/context-middleware.ts` | Creación del contexto por solicitud y header `x-correlation-id` con validación UUID | `../integracion/01_especificacion_middleware_rfc7807.md` §8.2 |
| `src/middleware/error-middleware.ts` | Serializador global RFC 7807/9457 (último eslabón, firma de 4 args) | `../integracion/01_especificacion_middleware_rfc7807.md` §5 y §7 |
| `src/errors/` | Matriz determinista PostgreSQL (`23505`, `23503`, `23502`, `P0001`) y mapeo Zod → `invalid_params` | `../integracion/01_especificacion_middleware_rfc7807.md` §6 |
| `src/shared/types/` | `CorrelationContext`, `ApiErrorResponse`, `Paginacion*`, `EventoOutboxContract`, `EventoEnvelope` (v1.2), `ExpedienteContract` (**PROVISIONAL** — pendiente de aprobación bilateral con RutaDoc) | `../integracion/04_contratos_intermodulares_unificados.md` §7, §6.2 |
| `src/audit/` | Repos de auditoría y outbox (misma transacción) + `OutboxWorker` con `FOR UPDATE SKIP LOCKED`, reserva `EN_PROCESO` y backoff exponencial | `../integracion/02_arquitectura_auditoria_contexto_asynclocalstorage.md` §5, §6 |
| `tests/fixtures/` | Fixtures **PROVISIONALES** de los **5 esquemas de módulos** (sigd_auth, sigd_org, sigd_tra, sigd_rut, docucore). `sigd_audit` NO está aquí: se carga exclusivamente el DDL real de `../integracion/06_sigd_audit_esquema_ddl.sql` | `../integracion/03_suite_pruebas_testcontainers_k6.md` |
| `tests/` | Setup/teardown Testcontainers (ciclo correcto setup→teardown), limpieza entre escenarios, 12 casos E2E (incluye atomicidad y concurrencia), prueba unitaria del mapeador | `../integracion/03_suite_pruebas_testcontainers_k6.md` §4 y §5 |
| `k6/` | Escenario 1 (Radicación 100 VU) y Escenario 2 (Derivación 50 VU) con umbrales | `../integracion/03_suite_pruebas_testcontainers_k6.md` §6 |
| `src/referencia/` | Endpoints **fixture** de referencia para ejercitar el pipeline (Mesa de Partes) — **Atribución: Duque (B_DUQUE)** | `../integracion/03_suite_pruebas_testcontainers_k6.md` §5 |

> **Nomenclatura:** todos los identificadores del prototipo siguen D-15 (CONFIRMADO):
> `id_<agregado>` (`id_expediente`, `id_movimiento`, `id_area_destino`, `id_usuario`…).
> **Separación de migraciones:** el prototipo NO carga las migraciones oficiales de
> los otros grupos (`identicore/`, `organicore/`, `tramicore/`, `rutadoc/`, `docucore/`);
> son propiedad de sus ramas. Solo ejercita stubs PROVISIONALES + el DDL real de audit.

---

## 2. Requisitos

- Node.js ≥ 20
- PostgreSQL 16+ (para el DDL de `sigd_audit`)
- Docker Engine (**opcional**: solo si se usa Testcontainers para `npm run test:e2e`;
  sin Docker se puede apuntar la suite a un PostgreSQL existente con `TEST_DATABASE_URL`)
- k6 (para `npm run load:*`) — [grafana/k6](https://grafana.com/docs/k6/latest/)

## 3. Instalación y verificación

```bash
npm install
npm run typecheck      # compilación TypeScript (tsc --noEmit)
npm run build          # build de producción
npm run test:unit      # prueba unitaria del mapeador de errores (sin Docker)

# E2E con PostgreSQL efímero (Testcontainers)
npm run test:e2e
# — o contra un PostgreSQL existente sin Docker (fail-fast, sin fallback silencioso):
$env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/sigd_prueba"
npm run test:e2e
```

> La suite falla con error instructivo si no hay `TEST_DATABASE_URL` ni Docker
> disponible. Nunca cae silenciosamente a un PostgreSQL local fijo.
> Se aplican el DDL real de `sigd_audit` (obligatorio) y los fixtures PROVISIONALES.

## 4. Ejecución de la aplicación de referencia

```bash
# 1. Crear esquemas base: DDL real de sigd_audit + fixtures PROVISIONALES de los 5 módulos
psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 \
     -f ../integracion/06_sigd_audit_esquema_ddl.sql
psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 \
     -f tests/fixtures/01_schema_fixtures_test.sql

# 2. Levantar la API (pipeline: contexto → caso de uso → auditoría/outbox → errores)
cp .env.example .env   # ajustar DATABASE_URL
npm run dev            # http://localhost:3000/health

# 3. Worker Outbox (procesa evento_outbox)
npm run worker:outbox
```

## 5. Cargas k6

```bash
export BASE_URL=http://localhost:3000
export AUTH_TOKEN=<token>            # opcional: si la API exige Authorization: Bearer
npm run load:radicacion      # ≈ 2 min, umbrales P95<200ms y errores<0.1%
npm run load:derivacion
```

## 6. Evidencia de pruebas

Ver `../integracion/08_runbook_evidencia_pruebas.md` para instrucciones paso a paso
sobre cómo generar y conservar evidencia (logs, timestamps, exit codes, P95, tasa de errores).

Evidencia ejecutada (Sección 5 / ronda P2–P12):

- `evidencia/e2e-20260909-123500/` — suite E2E con `TEST_DATABASE_URL`: **12/12 archivos · 22/22
  casos · EXIT_CODE=0** (`e2e.log` + `resumen.txt`).
- `evidencia/k6-20260909-145820/` — carga k6 v2.2.0: radicación **P95 150.96 ms** y derivación
  **P95 144.64 ms** (< 200 ms), **0 % errores**, checks 100 %, EXIT_CODE=0 (logs + summaries + resumen).

> La suite se ejecutó sin Docker (PostgreSQL 16 local). Con Docker disponible use Testcontainers o la
> base efímera del runbook; los umbrales de aceptación son los mismos.

---

## 7. Cómo cubre la observación del profesor

| Verificador | Evidencia |
| :--- | :--- |
| **Esquema de base de datos de la tarea del grupo** | `../integracion/06_sigd_audit_esquema_ddl.sql` (bitácora forense + transactional outbox) |
| **Código fuente (capa de dominio / compartida)** | `src/shared/domain/errors/`, `src/shared/request-context/`, `src/shared/types/` |
| **Código fuente (integración/cross-cutting)** | `src/middleware/`, `src/errors/`, `src/audit/` (worker incluido) |
| **Suite de pruebas e integración** | `tests/e2e/*` (12 casos: happy path, atomicidad, concurrencia, aislamiento AsyncLocalStorage) sobre PostgreSQL real en Testcontainers |
| **Pruebas de carga** | `k6/escenario-*-*.js` con thresholds |
| **Códigos de error nuevos** documentados | Se reutilizan los códigos de la matriz del entregable 01 (p. ej. `DUPLICATE_KEY`, `VALIDATION_ERROR`) |

---

## 8. Atribución

| Componente | Responsable |
| :--- | :--- |
| Middleware Express 5 y error handler | Duque (B_DUQUE) |
| AsyncLocalStorage y contexto de solicitud | Arevalo (B_AREVALO) |
| Esquema de auditoría y outbox DDL | Reátegui (B_REATEGUI) |
| Fixture de referencia (endpoints) | Duque (B_DUQUE) |
| Pruebas E2E y k6 | Arevalo (B_AREVALO) |
| Contratos intermodulares | Pendiente de aprobación bilateral con RutaDoc |

### 8.1. Participación de colaboradores

- **Duque (B_DUQUE):** Implementó el middleware Express 5 (context-middleware.ts, error-middleware.ts)
  y los endpoints de referencia (expediente.router.ts). Verificar en commits de la rama B_DUQUE.
- **Reátegui (B_REATEGUI):** Elaboró el esquema DDL de sigd_audit (06_sigd_audit_esquema_ddl.sql).
  Verificar en commits de la rama B_REATEGUI.
- **Zevallos (B_ZEVALLOS):** Elaboró la especificación de pruebas E2E y k6
  (03_suite_pruebas_testcontainers_k6.md). El runbook de evidencia fue elaborado por Arevalo
  con base en los entregables de Zevallos.
- **Arevalo (B_AREVALO):** Integró las contribuciones de los demás miembros en esta carpeta,
  implementó AsyncLocalStorage, repositorios de auditoría, OutboxWorker y la suite de pruebas.
