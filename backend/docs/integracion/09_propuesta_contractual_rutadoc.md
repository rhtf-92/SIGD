# 09 · PROPUESTA CONTRACTUAL — EVENTOS DE RUTaDoc (Grupo 1)
## Estado: **PROPUESTO / PENDIENTE** (aprobación bilateral de RutaDoc exigida)

**Grupo 6 "CoreLink" · Integración, Calidad y Pruebas del Backend — SIGD**
**Proponente:** CoreLink (Ricardo `B_AREVALO`)
**Grupo contraparte:** RutaDoc (Grupo 1)
**Fecha:** 9 de septiembre de 2026
**Versión:** 1.0
**Base normativa:** entregable `04_contratos_intermodulares_unificados.md` §6.2 / §6.3 (v1.3/v1.4) y
decisión D-15 (nomenclatura `id_<agregado>`).
**Regla de cierre (04 §10.2; decisión D-18):** este documento pasa a `CONFIRMADO` **solo** con la
aprobación escrita de RutaDoc (ruta, rama, commit/PR, definición aceptada y confirmación contractual).

---

## 1. Propósito

Definir, en un único documento autocontenido, la propuesta formal de CoreLink para el contrato de
eventos **RutaDoc → TramiCore / CoreLink-notificador**. Es el entregable que el liderazgo solicitó como
materialización de la sección 6.2 del entregable 04 para facilitar la revisión y aprobación de RutaDoc.

## 2. Eventos del contrato

| Evento | ID | Productor | Consumidores |
| :--- | :--- | :--- | :--- |
| `ExpedienteDerivado` | E-02 | RutaDoc | TramiCore (ubicación/estado), notificador |
| `ExpedienteAtendido` | E-06 | RutaDoc | TramiCore (estado), notificador, Archivo histórico |
| `ExpedienteObservado` | E-07 | RutaDoc | TramiCore (estado), notificador, Archivo histórico |

## 3. Envelope común (`payload`)

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `schema_version` | entero | Versión de la estructura (inicia en `1`; se incrementa en cambios rompientes). |
| `tipo_evento` | string | `ExpedienteDerivado`, `ExpedienteAtendido` o `ExpedienteObservado`. |
| `id_evento` | UUID | Identificador del registro en `sigd_audit.evento_outbox`. |
| `id_expediente` | UUID | Expediente afectado (`sigd_tra`); nomenclatura `id_<agregado>` (D-15). |
| `id_movimiento` | UUID | Movimiento que originó el evento (`sigd_rut.movimiento_tramite`). |
| `ocurrido_en` | ISO-8601 UTC | Fecha y hora del hecho de negocio. |
| `correlation_id` | UUIDv4 | Correlación de la solicitud completa (entregable 01). |
| `clave_idempotencia` | string | `tipo_evento:id_expediente:id_movimiento`. |
| `datos` | JSON | Bloque específico del evento (sección 4). |

## 4. Bloque `datos` por evento

| Campo | `ExpedienteDerivado` | `ExpedienteAtendido` | `ExpedienteObservado` |
| :--- | :--- | :--- | :--- |
| `id_area_origen` | sí | — | — |
| `id_area_destino` | sí | — | — |
| `motivo` | sí | — | — |
| `id_area_atencion` | — | sí | sí |
| `id_usuario_atencion` | — | sí | sí |
| `resultado` | — | `ATENDIDO` | `OBSERVADO` |
| `detalle_observacion` | — | `null` | sí |
| `plazo_subsanacion_dias` | — | `null` | sí (opcional) |
| `id_area_destino` (siguiente) | re-derivación (opcional) | — | — |

## 5. Idempotencia

1. El productor incluye `clave_idempotencia` = `tipo_evento:id_expediente:id_movimiento`.
2. El consumidor implementa índice único `(tipo_evento, clave_idempotencia)` en su proyección local y,
   ante una clave ya existente, **descarta el evento sin efectos y responde éxito**.
3. Ante rechazo por unicidad (PG `23505`), se trata como duplicado confirmado.
4. El worker **no** decide duplicados; entrega al-menos-una-vez y el consumidor degrada a uno-efecto.

## 6. Estados y política de reintentos del outbox (CoreLink)

- Estados: `PENDIENTE` → `EN_PROCESO` (reserva `FOR UPDATE SKIP LOCKED`) → `PROCESADO`, o
  `PENDIENTE` → `FALLIDO` (DLQ).
- El worker aplica backoff exponencial: `proxima_reintento_en = now() + backoffBaseMs × 2^(intentos-1)`.
- Máximo 5 intentos; error transitorio mantiene `PENDIENTE` e incrementa `intentos`; error persistente
  deriva a `FALLIDO`. Confirma `PROCESADO` solo tras la aceptación del consumidor.
- Columnas del outbox: `estado`, `intentos`, `procesado_en`, `proxima_reintento_en` (DDL 06 v1.5).

## 7. Responsabilidades

| Actor | Responsabilidad |
| :--- | :--- |
| **RutaDoc (productor)** | Emitir los eventos según este contrato y el envelope normalizado. |
| **Worker outbox (CoreLink)** | Leer lotes con `FOR UPDATE SKIP LOCKED`, despachar, confirmar antes de `PROCESADO`, aplicar reintentos/backoff y derivar a `FALLIDO`. |
| **TramiCore / notificador (consumidores)** | Validar el contrato, deduplicar por `clave_idempotencia` y responder éxito en duplicados. |

## 8. Aprobación bilateral exigida

Se requiere de RutaDoc (Grupo 1): ruta del archivo, rama, commit o PR, definición exacta aceptada,
explicación de autoría y confirmación del estado contractual. El registro de aprobación se incorpora a
`07_evidencia_autorias_y_aprobaciones.md` §2 y a 04 §10.2.

---

*Propuesta elaborada por Ricardo (`B_AREVALO`) para CoreLink. Estado `PROPUESTO`; no constituye
contrato vigente hasta la aprobación bilateral con RutaDoc.*