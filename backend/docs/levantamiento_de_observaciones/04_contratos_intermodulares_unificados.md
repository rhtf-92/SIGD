# 04_contratos_intermodulares_unificados.md

- **Grupo:** Grupo 6 — Coordinación de Integración
- **Documento de referencia:** `06_plan_levantamiento_observaciones_grupo_6_corelink.md` (Hito H2)
- **Estado:** BORRADOR — PENDIENTE DE VALIDACIÓN DEL PROYECTO
- **Alcance:** Matriz final Productor-Consumidor de interfaces, matriz de eventos Outbox y contratos de tipos compartidos entre los 6 módulos del backend SIGD.
- **Dependencias:** Respuestas formales de los grupos propietarios (G1–G5), definición confirmada de endpoints y validaciones.
- **Taxonomía:** `PROPUESTA` (diseño del equipo por validar), `PENDIENTE` (sujeto a confirmación institucional/grupos), `SUPUESTO` (regla adoptada como referencia de trabajo), `EJEMPLO` (dato ficticio).

---

## 1. Propósito

Unificar, en un solo catálogo, las necesidades de datos e interfaces entre los módulos del SIGD, evitando que cada grupo defina el mismo concepto con identificadores, formatos o nombres distintos. Este documento consolida la matriz de dependencias y los eventos que fluyen entre esquemas para que la integración se ejecute sobre contratos estables.

Este documento no oficializa endpooints ni formatos; se limita a proponer y registrar hasta que cada grupo productor y la institución validen la definición final.

## 2. Principios de diseño

1. **Productor define, consumidor referencia.** Cada dato tiene un único propietario (grupo productor); los demás lo referencian por su identificador sin duplicar la entidad.
2. **Clave primaria técnica UUID.** Conforme a la matriz de estandarización de tipos de datos del blueprint (sección 5.8), toda clave primaria técnica y toda relación cruzada entre esquemas se basa en `UUID` generado con `gen_random_uuid()`.
3. **Código de negocio visible (UK).** Los identificadores visibles de negocio (CUT, código de área, DNI/RUC, etc.) son restricciones de unicidad separadas de la PK técnica.
4. **Fechas `TIMESTAMPTZ`.** Todo campo de fecha/hora se declara `TIMESTAMPTZ` con zona horaria `America/Lima` (UTC-5).
5. **Trazabilidad transversal.** Toda operación intermodular propaga el `correlation_id` de extremo a extremo.

## 3. Matriz final Productor-Consumidor (PROPUESTA)

| ID Contrato | Grupo Productor | Esquema | Grupo Consumidor | Dato o capacidad | Referencia intermodular | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `CT-G4-G1-001` | G4 — IdentiCore | `sigd_auth` | G1 — RutaDoc | Identificador y estado del usuario | `cuenta_usuario_id UUID` | PROPUESTA |
| `CT-G3-G1-001` | G3 — OrganiCore | `sigd_org` | G1 — RutaDoc | Áreas, roles y permisos | `area_id UUID` | PROPUESTA |
| `CT-G2-G1-001` | G2 — TramiCore | `sigd_tra` | G1 — RutaDoc | Identificador y vigencia del expediente | `expediente_id UUID` | PROPUESTA |
| `CT-G5-G1-001` | G5 — DocuCore | `sigd_doc` | G1 — RutaDoc | Identificador y versión del documento | `adjunto_id UUID` | PROPUESTA |
| `CT-G4-G2-001` | G4 — IdentiCore | `sigd_auth` | G2 — TramiCore | Solicitante del trámite | `solicitante_id UUID` | PROPUESTA |
| `CT-G3-G2-001` | G3 — OrganiCore | `sigd_org` | G2 — TramiCore | Área de destino y operador | `area_id UUID` | PROPUESTA |
| `CT-G2-G4-001` | G2 — TramiCore | `sigd_tra` | G4 — IdentiCore | Expedientes del solicitante | `expediente_id UUID` | PROPUESTA |
| `CT-G5-G4-001` | G5 — DocuCore | `sigd_doc` | G4 — IdentiCore | Documentos de la persona | `adjunto_id UUID` | PROPUESTA |
| `CT-G6-GX-001` | G6 — CoreLink | `sigd_audit` | Todos los grupos | Bitácora de auditoría y eventos | `correlation_id UUID` | PROPUESTA |

### 3.1. Relaciones cruzadas de clave (SUPUESTO de trabajo)

| Esquema | Entidad principal | PK técnica | UK de negocio | FK hacia otro esquema |
| :--- | :--- | :---: | :--- | :--- |
| `sigd_auth` | `cuenta_usuario` | `UUID` | `numero_documento` (DNI/RUC) | Ninguna (esquema raíz). |
| `sigd_org` | `area` / `rol` | `UUID` | `codigo_area` | `cuenta_usuario_id` → `sigd_auth`. |
| `sigd_doc` | `tipo_documento` / `documento_adjunto` | `UUID` | `codigo_tipo` | `usuario_subida_id` → `sigd_auth`. |
| `sigd_tra` | `expediente` / `asiento_registro` | `UUID` | `codigo_cut` (`EXP-2026-000001`) | `solicitante_id` → `sigd_auth`. |
| `sigd_rut` | `movimiento_tramite` | `UUID` | `numero_secuencia` | `expediente_id` → `sigd_tra`; `area_id` → `sigd_org`; `usuario_id` → `sigd_auth`. |
| `sigd_audit` | `bitacora_auditoria` / `evento_outbox` | `UUID` | `correlation_id` (UUIDv4) | `usuario_id` → `sigd_auth`. |

## 4. Matriz de eventos Outbox (PROPUESTA)

Los eventos de dominio que requieren notificación o efecto secundario se publican transaccionalmente en `sigd_audit.evento_outbox` y se despachan de forma asíncrona, evitando acoplar la transacción de la base de datos a servicios externos.

| ID Evento | Evento de dominio | Esquema de origen | Consumidores / efecto | Medio de despacho | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `EVT-G2-001` | `ExpedienteCreado` | `sigd_tra` | G1 (trazabilidad inicial), G6 (bitácora) | Outbox worker | PROPUESTA |
| `EVT-G1-001` | `TramiteDerivado` | `sigd_rut` | G2 (estado expediente), G6 (bitácora) | Outbox worker | PROPUESTA |
| `EVT-G1-002` | `TramiteAtendido` | `sigd_rut` | G2 (cierre expediente), G6 (bitácora) | Outbox worker | PROPUESTA |
| `EVT-G1-003` | `TramiteCerrado` | `sigd_rut` | G2, G6 (bitácora) | Outbox worker | PROPUESTA |
| `EVT-G5-001` | `DocumentoFoliado` | `sigd_doc` / `sigd_tra` | G1 (historial), G6 (bitácora) | Outbox worker | PROPUESTA |
| `EVT-G6-001` | `AuditoriaRegistrada` | `sigd_audit` | G6 (forense), endpoints de monitoreo | Outbox worker | PROPUESTA |

### 4.1. Envelope estándar del evento (PROPUESTA)

```json
{
  "event_id": "uuid",
  "event_type": "TramiteDerivado",
  "correlation_id": "uuid",
  "producer": "sigd_rut",
  "occurred_at": "2026-08-30T12:00:00-05:00",
  "payload": { }
}
```

- `event_id`: identificador único del evento publicado.
- `event_type`: nombre del evento de dominio en mayúscula PascalCase.
- `correlation_id`: vínculo con la operación original (forense).
- `producer`: esquema que originó el evento.
- `occurred_at`: sello de tiempo `TIMESTAMPTZ`.
- `payload`: datos del evento, validados contra un esquema de contrato (JSON Schema / JSONB).

## 5. Contratos de tipos compartidos (`shared/types`) (PROPUESTA)

Se propone centralizar los contratos de datos intermodulares en `backend/src/shared/types` para que todos los módulos compilen contra las mismas definiciones y no existan divergencias de formato.

| Tipo compartido | Campos propuestos | Uso |
| :--- | :--- | :--- |
| `ReferenciaExpediente` | `expediente_id: UUID`, `codigo_cut: string`, `vigente: boolean` | G2 → G1 / G4 |
| `ReferenciaUsuario` | `usuario_id: UUID`, `dni: string`, `activo: boolean` | G4 → G1 / G2 / G6 |
| `ReferenciaArea` | `area_id: UUID`, `codigo_area: string`, `vigente: boolean` | G3 → G1 / G2 |
| `ReferenciaDocumento` | `adjunto_id: UUID`, `version: number`, `sha256: string` | G5 → G1 / G4 |
| `ErrorResponse` | `type`, `title`, `status`, `detail`, `instance`, `code`, `correlation_id`, `invalid_params?` | Todos (RFC 7807 / RFC 9457) |
| `OutboxEvent` | `event_id`, `event_type`, `correlation_id`, `producer`, `occurred_at`, `payload` | G6 (outbox) |

- `ErrorResponse` se alinea con el contrato de errores `02_catalogo_errores_backend.md` y con el middleware RFC 7807 (Hito H1).
- `OutboxEvent` se alinea con el envelope estándar de la sección 4.1.
- El alcance de cada tipo es **solo lectura de contrato**; los grupos conservan su modelo interno.

## 6. Criterios de aceptación del entregable

1. Cada datos intermodular tiene un único grupo productor identificado.
2. Toda relación cruzada entre esquemas referencia por `UUID`, nunca se duplica la entidad productora.
3. Todo evento que requiera notificación o efecto secundario se publica en `sigd_audit.evento_outbox`.
4. Los tipos compartidos están centralizados en `shared/types` y alineados con los contratos de errores y trazabilidad.
5. Ninguna definición se presenta como `CONFIRMADO` sin la validación del grupo productor y la institución.

## 7. Referencias técnicas

- Plan de mejora integral backend — sección 5.8 (matriz de estandarización de tipos de datos y claves intermodulares).
- `backend/docs/integracion/04_contratos_y_decisiones_pendientes.md` (matriz conceptual, riesgos y preguntas).
- `backend/docs/integracion/02_catalogo_errores_backend.md` (contrato de errores RFC 7807 / RFC 9457).
- RFC 9457 (Problem Details for HTTP APIs): https://www.rfc-editor.org/info/rfc9457/

## 8. Registro de revisiones

| Versión | Fecha | Responsable | Cambio | Estado |
| :--- | :--- | :--- | :--- | :--- |
| 0.1 | 2026-08-30 | Grupo 6 | Creación del documento con matriz Productor-Consumidor, matriz de eventos Outbox y contratos de tipos compartidos | **BORRADOR — PENDIENTE DE VALIDACIÓN** |
