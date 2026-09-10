# IMPLEMENTACIÓN CORE-LINK — BACKEND SIGD
## Grupo 6 "CoreLink" · Integración, Calidad y Pruebas del Backend

**Entregable de implementación** (Fase 2 — Levantamiento de Observaciones).
Complementa los documentos de especificación `01` a `05` con **código fuente,
esquema de base de datos y suite de pruebas** reales, respondiendo a la
observación: *"solo tiene documentación; falta su implementación: código fuente
o el esquema de base de datos de la tarea del grupo"*.

---

## 1. Contenido y trazabilidad con los entregables documentales

| Carpeta / archivo | Implementa | Especificación |
| :--- | :--- | :--- |
| `src/shared/domain/errors/` | Jerarquía `AppError`, `DomainError` (422), `NotFoundError` (404), `ConflictError` (409), `UnauthorizedError` (401), `ForbiddenError` (403), `ValidationError` (400) | `01_especificacion_middleware_rfc7807.md` §4 |
| `src/shared/request-context/` | `AsyncLocalStorage` (una sola instancia), `crearContexto`, `setUsuarioId` | `01` §8 y `02_arquitectura_auditoria...md` §4 |
| `src/middleware/context-middleware.ts` | Creación del contexto por solicitud y header `x-correlation-id` | `01` §8.2 |
| `src/middleware/error-middleware.ts` | Serializador global RFC 7807/9457 (último eslabón, firma de 4 args) | `01` §5 y §7 |
| `src/errors/` | Matriz determinista PostgreSQL (`23505`, `23503`, `23502`, `P0001`) y mapeo Zod → `invalid_params` | `01` §6 |
| `src/shared/types/` | `CorrelationContext`, `ApiErrorResponse`, `Paginacion*`, `EventoOutboxContract`, `EventoEnvelope` (v1.2), `ExpedienteContract` (`id_expediente`), `EventoRutaDoc` | `04_contratos_intermodulares_unificados.md` §7, §6.2 |
| `src/audit/` | Repos de auditoría y outbox (misma transacción) + `OutboxWorker` con `FOR UPDATE SKIP LOCKED`, backoff exponencial y DLQ | `02` §5, §6 |
| `06_sigd_audit_esquema_ddl.sql` | **Esquema de base de datos** `sigd_audit` (bitácora + outbox + índices + inmutabilidad) | `02` §5 y §6 |
| `tests/` | Setup/teardown Testcontainers, limpieza entre escenarios, 10 casos E2E, prueba unitaria del mapeador | `03_suite_pruebas_testcontainers_k6.md` §4 y §5 |
| `k6/` | Escenario 1 (Radicación 100 VU) y Escenario 2 (Derivación 50 VU) con umbrales | `03` §6 |
| `src/referencia/` | Endpoints **fixture** de referencia para ejercitar el pipeline (Mesa de Partes) | `03` §5 (Módulo TramiCore/RutaDoc) |

---

## 2. Requisitos

- Node.js ≥ 20
- Docker Engine (para `npm run test:e2e`)
- k6 (para `npm run load:*`) — [grafana/k6](https://grafana.com/docs/k6/latest/)
- PostgreSQL 18 solo para el DDL de `sigd_audit`

## 3. Instalación y verificación

```bash
npm install
npm run typecheck      # compilación TypeScript (tsc --noEmit)
npm run build          # build de producción
npm run test:unit      # prueba unitaria del mapeador de errores (sin Docker)
npm run test:e2e       # 10 casos E2E con Testcontainers (PostgreSQL efímero)
```

## 4. Ejecución de la aplicación de referencia

```bash
# 1. Crear esquemas base (incluye el DDL de sigd_audit)
psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 \
     -f ../06_sigd_audit_esquema_ddl.sql

# 2. Levantar la API (pipeline: contexto → caso de uso → auditoría/outbox → errores)
cp .env.example .env   # ajustar DATABASE_URL
npm run dev            # http://localhost:3000/health

# 3. Worker Outbox (procesa evento_outbox)
npm run worker:outbox
```

## 5. Cargas k6

```bash
export BASE_URL=http://localhost:3000
npm run load:radicacion      # ≈ 2 min, umbrales P95<200ms y errores<0.1%
npm run load:derivacion
```

---

## 6. Cómo cubre la observación del profesor

| Verificador | Evidencia |
| :--- | :--- |
| **Esquema de base de datos de la tarea del grupo** | `06_sigd_audit_esquema_ddl.sql` (bitácora forense + transactional outbox) |
| **Código fuente (capa de dominio / compartida)** | `src/shared/domain/errors/`, `src/shared/request-context/`, `src/shared/types/` |
| **Código fuente (integración/cross-cutting)** | `src/middleware/`, `src/errors/`, `src/audit/` (worker incluido) |
| **Suite de pruebas e integración** | `tests/e2e/*` (10 casos) sobre PostgreSQL real en Testcontainers |
| **Pruebas de carga** | `k6/escenario-*-*.js` con thresholds |
| **Códigos de error nuevos** documentados | Se reutilizan los códigos de la matriz del entregable 01 (p. ej. `DUPLICATE_KEY`, `VALIDATION_ERROR`) |