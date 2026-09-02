# 05_decisiones_levantamiento_corelink.md

- **Grupo:** Grupo 6 — Coordinación de Integración
- **Documento de referencia:** `06_plan_levantamiento_observaciones_grupo_6_corelink.md` (Hito H2)
- **Estado:** BORRADOR — PENDIENTE DE VALIDACIÓN DEL PROYECTO
- **Alcance:** Registro de decisiones técnicas y consensos del levantamiento de observaciones de CoreLink.
- **Taxonomía:** `CONFIRMADO`, `PROPUESTA`, `PENDIENTE`, `SUPUESTO` o `EJEMPLO` conforme al portal maestro de documentación.

---

## 1. Propósito

Mantener un log trazable de las decisiones técnicas del Grupo 6 durante el levantamiento de observaciones, con su estado y la evidencia o referencia que las sustenta. Cada decisión registrada aquí queda enlazada con los contratos y documentos de la fase.

## 2. Registro de decisiones

| ID | Decisión técnica | Estado | Justificación / referencia | Fecha |
| :--- | :--- | :--- | :--- | :--- |
| `DEC-CORE-001` | Adoptar el estándar RFC 7807 / RFC 9457 para las respuestas de error del backend. | PROPUESTA | Alineado con `02_catalogo_errores_backend.md` y con el middleware global del Hito H1. | 2026-08-30 |
| `DEC-CORE-002` | Usar `correlation_id` (UUIDv4) como identificador de trazabilidad transversal. | PROPUESTA | Contrato de trazabilidad `04_contratos_y_decisiones_pendientes.md` secc. 6. | 2026-08-30 |
| `DEC-CORE-003` | Toda clave primaria técnica y relación intermodular usa `UUID` (`gen_random_uuid()`). | PROPUESTA | Matriz de estandarización de tipos (blueprint secc. 5.8). | 2026-08-30 |
| `DEC-CORE-004` | Todo campo de fecha/hora se declara `TIMESTAMPTZ` (zona `America/Lima`, UTC-5). | PROPUESTA | Blueprint secc. 5.8 — convención global de fechas. | 2026-08-30 |
| `DEC-CORE-005` | Los eventos que requieren notificación o efecto secundario se publican en `sigd_audit.evento_outbox`. | PROPUESTA | Patrón Transactional Outbox del plan de mejora. | 2026-08-30 |
| `DEC-CORE-006` | Los contratos de datos intermodulares se centralizan en `backend/src/shared/types`. | PROPUESTA | Catálogo de tipos compartidos del `04_contratos_intermodulares_unificados.md`. | 2026-08-30 |
| `DEC-CORE-007` | El esquema de auditoría `sigd_audit` se crea con `bitacora_auditoria` (JSONB) y `evento_outbox`. | PENDIENTE | Depende de la especificación de auditoría del Hito H1 (AsyncLocalStorage). | 2026-08-30 |
| `DEC-CORE-008` | Las respuestas de error nunca exponen stack traces, contraseñas, tokens ni detalles internos de BD en producción. | CONFIRMADO | Límite y criterio de validación del plan de levantamiento (secc. 3). | 2026-08-30 |

## 3. Decisiones con dependencia externa (requieren validación de los grupos)

| ID | Decisión / tema | Grupo que debe validar | Estado |
| :--- | :--- | :--- | :--- |
| `DEC-CORE-009` | Formato y vigencia del identificador de expediente (UUID vs secuencial). | G2 | PENDIENTE |
| `DEC-CORE-010` | Mecanismo de validación de áreas y permisos (por petición vs payload central). | G3 | PENDIENTE |
| `DEC-CORE-011` | Validación de existencia y vigencia del usuario sin duplicar datos. | G4 | PENDIENTE |
| `DEC-CORE-012` | Consulta de documento: solo metadatos o también binario; límite de tamaño. | G5 | PENDIENTE |
| `DEC-CORE-013` | Adopción institucional del estándar de trazabilidad y de identificación de correlación. | Institución | PENDIENTE |

## 4. Criterios para cerrar una decisión

1. Toda decisión marcada como `PROPUESTA` se cierra solo con la validación del grupo propietario o la institución, pasando a `CONFIRMADO`.
2. Toda decisión con dependencia externa registra la evidencia de cierre (acuerdo escrito, documento, respuesta o resultado de validación).
3. El estado `PENDIENTE` no se presenta como regla oficial.

## 5. Referencias técnicas

- `backend/docs/levantamiento_de_observaciones/06_plan_levantamiento_observaciones_grupo_6_corelink.md`.
- `backend/docs/levantamiento_de_observaciones/04_contratos_intermodulares_unificados.md`.
- `backend/docs/integracion/04_contratos_y_decisiones_pendientes.md`.
- `backend/docs/Plan_de_mejora_nivel_backend_SIGD.md`.

## 6. Registro de revisiones

| Versión | Fecha | Responsable | Cambio | Estado |
| :--- | :--- | :--- | :--- | :--- |
| 0.1 | 2026-08-30 | Grupo 6 | Creación del registro de decisiones del levantamiento de CoreLink. | **BORRADOR — PENDIENTE DE VALIDACIÓN** |