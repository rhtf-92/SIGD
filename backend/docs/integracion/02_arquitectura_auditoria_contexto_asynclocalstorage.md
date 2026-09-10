# ARQUITECTURA DE AUDITORÍA FORENSE, TRAZABILIDAD CON CONTEXTO Y TRANSACTIONAL OUTBOX
## Grupo 6 "CoreLink" · Integración, Calidad y Pruebas del Backend — SIGD

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)
**Institución:** IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI
**Área:** Backend — CoreLink
**Responsable del entregable:** Reátegui · `B_REATEGUI`
**Documento:** `02_arquitectura_auditoria_contexto_asynclocalstorage.md`
**Fecha:** 8 de septiembre de 2026
**Versión:** 1.3 (Revisión del Liderazgo — PR #79 cancelado · correcciones pre-merge)

> [!NOTE]
> Este documento es una **especificación de referencia**. No contiene instrucciones ejecutables ni
> código listo para correr; describe de forma completa y detallada las estructuras de datos, las
> reglas de inmutabilidad, la máquina de estados de eventos y el flujo del worker que los equipos
> deben implementar para garantizar la observabilidad y auditoría forense del backend SIGD.
>
> **Revisión v1.2 (Liderazgo — PR #79):** se completa el contrato del `evento_outbox` con el
> **versionado y la serialización** del `payload`, la **clave de idempotencia**, la normalización de
> identificadores (`id_expediente`, `id_movimiento`, `id_evento`) y las **responsabilidades del
> despachador**. El contrato formal de los eventos de RutaDoc (`ExpedienteDerivado`,
> `ExpedienteAtendido`, `ExpedienteObservado`) se define en el entregable 04, sección 6.2.
>
> **Revisión v1.3 (Liderazgo — PR #79 cancelado):** (1) `correlation_id` de la bitácora queda **sin
> valor por defecto**: debe propagarse siempre desde AsyncLocalStorage y la BD no genera un UUID
> distinto del contexto (DDL 06); (2) la FK `usuario_id -> sigd_auth.cuenta_usuario(id)` queda
> **SUSPENDIDA** (PENDIENTE) hasta que IdentiCore apruebe la columna `id_usuario`; (3) se separan los
> roles `sigd_app` (escribe bitácora y encola eventos) y `sigd_worker` (solo SELECT/UPDATE del outbox);
> (4) las garantías de **inmutabilidad, cero pérdida y atomicidad** quedan en estado `PROPUESTO`
> hasta que existan pruebas E2E ejecutables (ver entregable 03 y evidencia).

---

## 1. Propósito y Problema que Resuelve

Definir la arquitectura de **observabilidad y auditoría forense** del SIGD. El problema que resuelve
es doble:

1. **Propagar el contexto de cada solicitud** (`correlation_id`, `usuario_id`, `ip_origen`,
   `user_agent`) a través de todas las capas de la aplicación **sin ensuciar las firmas** de casos de
   uso, servicios y repositorios.
2. **Registrar de forma inmutable** cada mutación de datos en la bitácora forense
   `sigd_audit.bitacora_auditoria`, y **despachar de forma asíncrona** los eventos de integración
   mediante el patrón *Transactional Outbox* (`sigd_audit.evento_outbox`).

Sin esta arquitectura, cada módulo implementaría auditoría por su cuenta, el `correlation_id` no
viajaría de punta a punta, y las notificaciones/eventos se perderían ante caídas de servicios externos.

### 1.1. Propuesta de valor
- Auditoría **inmutable** (append-only): imposible modificar o borrar el historial forense.
- Trazabilidad total: con el `correlation_id` es posible reconstruir toda la cadena de una solicitud.
- **Cero pérdida de eventos**: se elimina la fragilidad de envíos directos ante fallas de red. *Estado
  `PROPUESTO` hasta validarlo con las pruebas E2E del entregable 03.*
- Registro de datos antes/después en formato `JSONB` para cualquier auditoría de cambios.

---

## 2. Alcance y Elementos Fuera de Alcance

### Dentro del alcance
- Contrato de uso de `AsyncLocalStorage` de Node.js para la trazabilidad de solicitudes HTTP.
- Especificación completa del esquema `sigd_audit.bitacora_auditoria` con almacenamiento `JSONB`.
- Arquitectura del procesador asíncrono (worker) para la tabla `sigd_audit.evento_outbox`
  (Transactional Outbox Pattern).
- Reglas de integración del contexto con la bitácora de auditoría.

### Fuera de alcance
- Middleware de errores RFC 7807 (entregable 01 — Azareño).
- Pruebas de integración Testcontainers / k6 (entregable 03 — Zevallos).
- Contratos intermodulares y matriz Productor-Consumidor (entregable 04 — Ricardo).

---

## 3. Definiciones Necesarias

| Término | Definición |
| :--- | :--- |
| **AsyncLocalStorage** | API de Node.js que mantiene estado asíncrono a lo largo de toda la pila de llamadas de una solicitud, sin pasarlo por parámetros. |
| **`correlation_id`** | UUIDv4 que identifica de forma única toda la cadena de operaciones de una solicitud. |
| **Bitácora forense** | Registro inmutable de auditoría que documenta los datos antes/después de cada mutación (`sigd_audit.bitacora_auditoria`). |
| **Transactional Outbox** | Patrón que escribe eventos dentro de la misma transacción de negocio en `evento_outbox` y luego los despacha de forma asíncrona por un worker. |
| **Append-only** | Política de solo-escritura: los registros de auditoría no se editan ni eliminan. |
| **Dead Letter Queue (DLQ)** | Cola de eventos fallidos derivados a revisión manual tras agotar los reintentos automáticos. |

---

## 4. Propagación de Contexto con AsyncLocalStorage

### 4.1. Contrato del contexto

El contexto de solicitud es **la fuente de verdad de trazabilidad** definida en el entregable 01
(Azareño). Este documento lo **reutiliza** como insumo para la auditoría. Sus portadores son:

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `correlation_id` | string (UUIDv4) | Identificador único de la solicitud completa. |
| `usuario_id` | string \| null | Identidad autenticada del usuario que ejecuta la mutación. |
| `ip_origen` | string | IP del cliente que originó la solicitud. |
| `user_agent` | string | Cliente (navegador/aplicación) que originó la solicitud. |

### 4.2. Cómo se propaga

- Un middleware de Express crea el almacén al inicio de cada solicitud y ejecuta `next()` dentro de él.
- Los casos de uso, servicios y repositorios obtienen el contexto mediante la lectura del almacén
  (getStore), **sin recibir estos datos por parámetros**.
- Cada solicitud tiene su propio almacén aislado; no son variables globales.
- Para procesos que no provienen de HTTP (workers), el contexto puede ser `undefined`; el consumidor
  debe decidir su tratamiento (por ejemplo, registrar el evento como operación de sistema).

### 4.3. Consumo transparente para auditoría

Cuando un caso de uso o repositorio va a registrar una mutación en la bitácora o un evento de
integración, debe **leer el contexto** y transmitirle los valores al repositorio de auditoría en el
mismo momento de la operación. El objeto de contexto consumido por la bitácora tiene la siguiente
forma documental:

```json
{
  "correlation_id": "8f4c2a10-7b21-4d55-8f2a-1c9d3e7b5a01",
  "usuario_id": "3a1b2c3d-0000-0000-0000-000000000001",
  "ip_origen": "190.42.1.13",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}
```

> La Especificación del middleware de contexto (orden de registro, política del header
> `x-correlation-id`, flujo de autenticación que puebla `usuario_id`) está documentada en la sección 8
> del entregable 01.

---

## 5. Especificación de la Bitácora Forense `sigd_audit.bitacora_auditoria`

### 5.1. Propósito y características

- **Registro inmutable (append-only)** de todas las mutaciones `INSERT`, `UPDATE` y `DELETE` sobre los
  datos de negocio.
- Conserva el **antes** (`datos_antes`) y el **después** (`datos_despues`) de cada cambio en formato
  `JSONB`, permitiendo reconstruir estados históricos.
- Cada fila queda ligada al `correlation_id`, al usuario, a la IP y al `user_agent` que originaron la
  operación (tomados del contexto de la sección 4).
- Pertenece al esquema `sigd_audit`, conforme al estándar consolidado del Plan de Mejora Backend SIGD.

### 5.2. Estructura de la tabla (`bitacora_auditoria`)

| Columna | Tipo | Restricción / Default | Descripción |
| :--- | :--- | :--- | :--- |
| `id_auditoria` | UUID | `NOT NULL`, PK, default `gen_random_uuid()` | Identificador interno del registro de auditoría. |
| `correlation_id` | UUID | `NOT NULL`, sin default (v1.3) | Identificador único de la solicitud; **proviene siempre del contexto AsyncLocalStorage**. La BD no lo genera. |
| `usuario_id` | UUID | NULL | Identidad del usuario que ejecutó la operación. FK → `sigd_auth.cuenta_usuario(id_usuario)` **SUSPENDIDA (PENDIENTE)** por contrato con IdentiCore. |
| `ip_origen` | INET | NULL | Dirección IP del cliente (tipo de red nativo de PostgreSQL). |
| `user_agent` | VARCHAR(512) | NULL | Cliente que originó la solicitud. |
| `esquema` | VARCHAR(64) | `NOT NULL` | Esquema afectado (p. ej. `sigd_tra`, `sigd_doc`). |
| `tabla` | VARCHAR(64) | `NOT NULL` | Tabla afectada (p. ej. `expediente`, `movimiento`). |
| `operacion` | VARCHAR(16) | `NOT NULL`, CHECK en (`INSERT`, `UPDATE`, `DELETE`) | Tipo de mutación registrada. |
| `datos_antes` | JSONB | NULL | Estado previo de la fila (NULL para `INSERT`). |
| `datos_despues` | JSONB | `NOT NULL` | Estado posterior de la fila (para `DELETE` puede ser el estado previo a eliminación). |
| `fecha_hora` | TIMESTAMPTZ | `NOT NULL`, default `now()` | Momento en que ocurrió la mutación (alimenta `idx_bitacora_fecha`). |

### 5.3. Reglas y restricciones obligatorias

- `operacion` solo admite `INSERT`, `UPDATE` y `DELETE` (control a nivel de base de datos).
- `id_auditoria` se genera en la BD (`gen_random_uuid()`); el `correlation_id` **NO tiene valor por
  defecto** — la aplicación lo obtiene del contexto AsyncLocalStorage y lo escribe en cada inserción,
  garantizando que la bitácora nunca registre un UUID distinto al de la solicitud.
- `correlation_id` debe estar indexado para permitir reconstruir la cadena completa de una solicitud.
- La FK de `usuario_id` hacia `sigd_auth.cuenta_usuario` está **SUSPENDIDA**: IdentiCore/RutaDoc
  mantienen pendiente la columna `id_usuario` (no `id`). Se activará mediante `ALTER TABLE` cuando se
  firme el contrato bilateral (registro en el entregable 07). La columna queda `NULL` para operaciones
  de sistema (D-10).

### 5.4. Política de inmutabilidad

- La bitácora es de **solo escritura**: los registros no deben editarse ni eliminarse.
- A nivel de roles de base de datos debe revocarse `UPDATE` y `DELETE` a la cuenta de aplicación,
  dejando únicamente `INSERT` y `SELECT`.
- **Separación de roles (v1.3, DDL 06):**
  - `sigd_app` — la API escribe la bitácora (`INSERT`) y **encola** eventos (`INSERT` en el outbox).
  - `sigd_worker` — el despachador solo lee y actualiza `evento_outbox` (`SELECT`, `UPDATE`); no escribe
    la bitácora ni la aplicación modifica el outbox ya insertado.
- Ningún caso de uso de negocio debe poder manipular la bitácora directamente; solo a través del
  repositorio de auditoría.

### 5.5. Índices de consulta forense recomendados

| Índice sugerido | Columnas / Opción | Propósito |
| :--- | :--- | :--- |
| `idx_bitacora_correlation_id` | `(correlation_id)` | Reconstruir la cadena completa de una solicitud. |
| `idx_bitacora_usuario` | `(usuario_id)` | Consultas forenses por usuario. |
| `idx_bitacora_fecha` | `(fecha_hora)` | Consultas por rango de tiempo. |
| `idx_bitacora_tabla` | `(esquema, tabla)` | Auditar una entidad específica. |
| `idx_bitacora_jsonb` | `GIN (datos_despues)` | Búsquedas sobre el contenido JSON de los cambios. |

> **Decisión registrada:** los nombres de índice y el tamaño de columna `user_agent` (512) están en
> estado `PROPUESTO`; deben confirmarse al implementar, manteniendo la semántica aquí descrita.

---

## 6. Especificación del Transactional Outbox `sigd_audit.evento_outbox`

### 6.1. Propósito

- Escribir los eventos de integración/notificación **dentro de la misma transacción** de negocio, de
  modo que la mutación y su evento sean **atómicos** (commit o rollback juntos).
- Asegurar **cero pérdida de notificaciones** aunque el envío a servicios externos (email, casilla,
  sistema de bandeja) falle en el momento: el evento queda persistido y se despacha después.

### 6.2. Estructura de la tabla (`evento_outbox`)

| Columna | Tipo | Restricción / Default | Descripción |
| :--- | :--- | :--- | :--- |
| `id_evento` | UUID | `NOT NULL`, PK, default `gen_random_uuid()` | Identificador interno del evento. |
| `correlation_id` | UUID | `NOT NULL` | Correlación de la solicitud que originó el evento (del contexto). |
| `agregado` | VARCHAR(64) | `NOT NULL` | Agregado que produjo el evento (p. ej. `expediente`, `movimiento`). |
| `tipo_evento` | VARCHAR(64) | `NOT NULL` | Nombre del evento de dominio (p. ej. `TramiteRegistrado`). |
| `payload` | JSONB | `NOT NULL` | Cuerpo del evento a despachar (datos + claves de idempotencia). |
| `estado` | VARCHAR(16) | `NOT NULL`, default `PENDIENTE`, CHECK en (`PENDIENTE`, `PROCESADO`, `FALLIDO`) | Ciclo de vida del evento. |
| `intentos` | SMALLINT | `NOT NULL`, default `0` | Número de reintentos de despacho realizados. |
| `creado_en` | TIMESTAMPTZ | `NOT NULL`, default `now()` | Momento de creación del evento (dentro de la transacción). |
| `procesado_en` | TIMESTAMPTZ | NULL | Momento en que se confirmó el despacho. |

### 6.3. Máquina de estados del evento

| Estado | Significado | Transiciones permitidas |
| :--- | :--- | :--- |
| `PENDIENTE` | Evento persistido en la transacción, esperando despacho. | → `PROCESADO` (éxito) o → `FALLIDO` (fallo persistente). |
| `PROCESADO` | Entregado y confirmado por el servicio externo. Estado final. | Ninguna. |
| `FALLIDO` | Agotó los reintentos; requiere revisión manual (dead-letter). Estado final. | Ninguna (solo revisión manual fuera del flujo). |

**Reglas de transición:**
- Los casos de uso **solo insertan** eventos en estado `PENDIENTE`; jamás los actualizan.
- Únicamente el **worker outbox** modifica `estado, intentos, procesado_en`.
- No se permite reencolar un `PROCESADO`; la idempotencia la garantiza el consumidor con las claves
  del `payload`.

### 6.4. Flujo del worker outbox (diagrama documental)

```mermaid
sequenceDiagram
    participant UC as Caso de Uso (Transacción)
    participant DB as PostgreSQL
    participant OUT as Worker Outbox (Asíncrono)
    participant EXT as Servicio Externo (Email / Casilla)

    UC->>DB: INSERT negocio (expediente, movimiento, etc.)
    UC->>DB: INSERT sigd_audit.evento_outbox (misma transacción)
    Note over UC,DB: Commit ACID: datos + evento quedan atómicos

    OUT->>DB: SELECT estado='PENDIENTE' (lote, FOR UPDATE SKIP LOCKED)
    OUT->>EXT: Envía notificación / evento
    OUT->>DB: UPDATE estado='PROCESADO', procesado_en=now()
    alt Falla el envío
        OUT->>DB: incrementa intentos; aplica backoff exponencial
        OUT->>EXT: reintento con backoff exponencial
        Note over OUT,EXT: Si supera el máximo de intentos → estado='FALLIDO' (Dead Letter Queue)
    end
```

### 6.5. Comportamiento esperado del worker (contrato)

1. **Lote:** consultar un lote de eventos `PENDIENTE` (tamaño recomendado ≈ 100) ordenados por
   `creado_en`.
2. **Concurrencia segura:** usar `FOR UPDATE SKIP LOCKED` para que dos instancias del worker no
   procesen el mismo evento (evita doble envío).
3. **Despacho:** enviar al destino externo (email, casilla, publicador de eventos).
4. **Confirmación:** marcar `PROCESADO` y fijar `procesado_en` **solo tras la confirmación** del
   destino; no antes.
5. **Falla transitoria:** incrementar `intentos`, dejar en `PENDIENTE` y reintentar con **backoff
   exponencial** (esperas crecientes entre reintentos).
6. **Falla persistente:** al superar el máximo de intentos configurado, pasar a `FALLIDO` y derivar el
   evento a una **Dead Letter Queue** para revisión manual.
7. **Idempotencia del consumidor:** el `payload` debe incluir el `correlation_id` y la clave de negocio
   afectada, de modo que el receptor pueda detectar e ignorar duplicados en caso de reintento.

### 6.6. Índice recomendado

| Índice sugerido | Columnas | Propósito |
| :--- | :--- | :--- |
| `idx_outbox_estado_fecha` | `(estado, creado_en)` | Barrido eficiente del worker por orden de creación y estado. |

### 6.7. Contrato de versionado, serialización y nomenclatura del `payload` (v1.2)

Los eventos de dominio se publican en `payload JSONB` siguiendo un **envelope normalizado** (las
definiciones exactas por evento — incluidos los tres de RutaDoc — constan en el entregable 04 §6.2):

| Campo del envelope | Tipo | Descripción |
| :--- | :--- | :--- |
| `schema_version` | entero | Versión de la estructura del payload (inicia en `1`). Un cambio rompiente la incrementa y exige revalidación del consumidor. |
| `tipo_evento` | string | Nombre del evento de dominio (p. ej. `ExpedienteDerivado`). Cada producto es propietario de su `tipo_evento`. |
| `id_evento` | UUID | Identificador del registro en `sigd_audit.evento_outbox`. |
| `id_expediente` | UUID | Expediente afectado (identificador normalizado `id_<agregado>`). |
| `id_movimiento` | UUID | Movimiento que originó el evento (aplica a operaciones de RutaDoc). |
| `ocurrido_en` | ISO-8601 UTC | Fecha y hora del hecho de negocio (adicional a `creado_en` del outbox). |
| `correlation_id` | UUIDv4 | Correlación de la solicitud completa. |
| `clave_idempotencia` | string | `tipo_evento:id_expediente:id_movimiento` (compuesta), para que el consumidor descarte duplicados. |
| `datos` | JSONB | Bloque específico de negocio del evento (autocontenido). |

**Reglas de serialización:**
- Serialización única: **JSON UTF-8 en `snake_case`**, almacenado en `payload JSONB`.
- Los identificadores de negocio usan `id_<agregado>` (`id_expediente`, `id_movimiento`, `id_cuenta`,
  `id_area_*`, `id_usuario_*`). No se alterna con `expediente_id` (corrige inconsistencia de la v1.1).
- El `payload` es **autocontenido**: el consumidor puede procesarlo sin consultar al productor.
- Todo evento debe incluir su `clave_idempotencia` para que el consumidor implemente el descarte de
  duplicados (entregable 04 §6.3).

### 6.8. Responsabilidades del despachador (worker outbox)

| Responsabilidad | Regla |
| :--- | :--- |
| **Solo el worker modifica el ciclo de vida** | Casos de uso: solo `INSERT` con estado `PENDIENTE`. Estado, `intentos` y `procesado_en` son exclusivos del worker (§6.3). |
| **Lote y concurrencia** | Leer lotes `PENDIENTE` (≈100) con `FOR UPDATE SKIP LOCKED`; dos instancias no procesan el mismo evento. |
| **Confirmación previa a `PROCESADO`** | Marcar `PROCESADO` y fijar `procesado_en` **solo tras la confirmación** del destino; jamás antes. |
| **Falla transitoria** | Incrementar `intentos`, permanecer `PENDIENTE` y reintentar con **backoff exponencial**. |
| **Falla persistente** | Tras el máximo de intentos, pasar a `FALLIDO` y derivar a **Dead Letter Queue** para revisión manual. |
| **Sin reencolado** | No reencolar `PROCESADO`; la idempotencia del consumidor (clave de la sección 6.7) cubre los reintentos. |
| **No decide duplicados** | El worker entrega y confirma; la detección de duplicados es exclusiva del consumidor. |

---

## 7. Flujo de Auditoría y Notificación de Extremo a Extremo

Diagrama documental de referencia (el middleware de contexto es del entregable 01):

```mermaid
sequenceDiagram
    participant CLI as Cliente
    participant CTX as Middleware de Contexto (AsyncLocalStorage)
    participant UC as Caso de Uso
    participant DB as PostgreSQL
    participant OUT as Worker Outbox

    CLI->>CTX: POST /api/expedientes (con/sin x-correlation-id)
    CTX->>CTX: Genera/acepta correlation_id y crea RequestContext
    CTX->>UC: next() dentro del contexto
    UC->>DB: INSERT expediente (transacción)
    UC->>DB: INSERT bitacora_auditoria (datos_antes/despues, contexto)
    UC->>DB: INSERT evento_outbox (estado PENDIENTE) — misma transacción
    Note over UC,DB: Commit ACID
    OUT->>DB: Lee PENDIENTE (FOR UPDATE SKIP LOCKED)
    OUT->>EXT: Despacha notificación / evento
    OUT->>DB: estado='PROCESADO'
    Note over CLI,OUT: Toda la cadena comparte el mismo correlation_id
```

**Pasos del flujo:**

1. El cliente envía una solicitud a `POST /api/expedientes`, opcionalmente con el header
   `x-correlation-id`.
2. El middleware de contexto genera o acepta el `correlation_id` e inicializa el `RequestContext`.
3. El caso de uso crea el expediente; en la **misma transacción** el repositorio:
   - registra la mutación en `bitacora_auditoria` (con `datos_antes`/`datos_despues` y el contexto), y
   - escribe el evento en `evento_outbox` con estado `PENDIENTE`.
4. El worker outbox lee el evento `PENDIENTE`, despacha la notificación al área destino y lo marca
   `PROCESADO`.
5. Toda la cadena queda trazable con el mismo `correlation_id`.

---

## 8. Guía de Avance para los Equipos (Lista de Verificación)

1. [ ] **Crear el esquema `sigd_audit`** (DDL) con las tablas `bitacora_auditoria` y `evento_outbox`
       según las secciones 5 y 6.
2. [ ] **Configurar los defaults `gen_random_uuid()`** solo para `id_auditoria` e `id_evento`
       (requiere la extensión adecuada en PostgreSQL). El `correlation_id` **no** lleva default (v1.3).
3. [ ] **Crear los índices** de las secciones 5.5 y 6.6.
4. [ ] **Aplicar la política de inmutabilidad:** revocar `UPDATE`/`DELETE` sobre la bitácora al rol de
       aplicación.
5. [ ] **Separar roles (v1.3):** `sigd_app` (bitácora `INSERT`/`SELECT`; outbox `INSERT`/`SELECT`) y
       `sigd_worker` (outbox `SELECT`/`UPDATE` únicamente).
6. [ ] **No crear la FK de `usuario_id`** hasta el contrato aprobado con IdentiCore (columna
       `id_usuario`); registrarlo en el entregable 07.
7. [ ] **Implementar el repositorio de auditoría** que consuma el contexto de la sección 4 y persista
       en la bitácora dentro de la transacción de negocio.
8. [ ] **Implementar el repositorio outbox** que inserte el evento en la misma transacción (nunca en
       transacción separada).
9. [ ] **Implementar el worker outbox** con lote, `FOR UPDATE SKIP LOCKED`, backoff exponencial y
       dead-letter. Consumir el contexto `undefined` de forma tolerante (eventos de sistema).
10. [ ] **Garantizar idempotencia** en el consumidor externo con la `clave_idempotencia` compuesta
        `(tipo_evento, id_expediente, id_movimiento)` y el descarte de la sección 6.7.
11. [ ] **Validar el esquema** con la suite del entregable 03 (casos E2E-06 y E2E-07) y registrar logs,
        timestamps, exit codes y métricas (entregable 08).
12. [ ] **Implementar el envelope normalizado** (6.7): `schema_version`, `id_evento`,
        `id_expediente`, `id_movimiento`, `ocurrido_en`, `correlation_id`, `clave_idempotencia`.
13. [ ] **Consolidar el contrato de eventos RutaDoc** (04 §6.2) para los tres eventos
        (`ExpedienteDerivado`, `ExpedienteAtendido`, `ExpedienteObservado`) y registrar su aprobación
        bilateral.

---

## 9. Criterios de Aceptación de la Especificación

| # | Criterio | Cumple |
| :---: | :--- | :---: |
| 1 | El esquema define la bitácora forense inmutable con `datos_antes`/`datos_despues` en `JSONB`. | ✅ |
| 2 | La bitácora se integra con el contexto (`correlation_id`, `usuario_id`, `ip_origen`, `user_agent`) de forma transparente. | ✅ |
| 3 | `evento_outbox` implementa el patrón Transactional Outbox con escritura atómica. | ✅ |
| 4 | El worker especifica lote, `FOR UPDATE SKIP LOCKED`, confirmación previa a `PROCESADO`, backoff exponencial y dead-letter. | ✅ |
| 5 | Se plantea cero pérdida de notificaciones ante fallas de los servicios externos. | 🟡 (PROPUESTO — validar con E2E, entregable 03/08) |
| 6 | El `payload` define versionado (`schema_version`), serialización JSON `snake_case` y clave de idempotencia compuesta (v1.2). | ✅ |
| 7 | El despachador define responsabilidades: confirmación previa a `PROCESADO`, reintentos con backoff, DLQ y no reencolado. | ✅ |
| 8 | Los identificadores de negocio se normalizan a `id_<agregado>` (`id_expediente`, `id_movimiento`). | ✅ |
| 9 | `correlation_id` no tiene valor por defecto y proviene siempre del contexto AsyncLocalStorage (v1.3). | ✅ |
| 10 | La FK `usuario_id -> sigd_auth` queda SUSPENDIDA (PENDIENTE) hasta el contrato con IdentiCore (`id_usuario`). | ✅ |
| 11 | Los roles `sigd_app` y `sigd_worker` separan escritura de bitácora/encolado del despacho del outbox (v1.3). | ✅ |
| 12 | La documentación queda lista para que los equipos implementen sin ambigüedad. | ✅ |

---

## 10. Dependencias y Decisiones

- **Dependencia (Azareño):** el `RequestContext` se complementa con la especificación del middleware
  RFC 7807 (`01_especificacion_middleware_rfc7807.md`), que lo usa para poblar `correlation_id` en las
  respuestas de error. Este documento **consume** ese contrato para la auditoría.
- **Dependencia (Zevallos):** la reproducibilidad de las migraciones y el comportamiento de outbox y
  bitácora se validan en la suite Testcontainers (`03_suite_pruebas_testcontainers_k6.md`, casos
  E2E-06 y E2E-07).
- **Decisiones registradas:**
  - El esquema consolida la nomenclatura `sigd_*` del Plan de Mejora (reemplaza variantes anteriores
    como `sigd_identi`, `sigd_tramite`, etc.).
  - `usuario_id` es **nullable** porque existen operaciones legítimas sin sesión de usuario
    (registros de sistema, migraciones, integraciones máquina-a-máquina).
  - `evento_outbox` no se limpia automáticamente; la retención es una decisión operativa posterior.
  - **Revisión v1.2 (Liderazgo — PR #79):** se agrega `fecha_hora` a la bitácora, el envelope
    versionado del `payload` (§6.7), las responsabilidades del despachador (§6.8) y la normalización
    de identificadores a `id_<agregado>`. El contrato de los eventos de RutaDoc (E-02, E-05, E-06 y
    E-07) se define y se cierra en el entregable 04 §6.2.
  - **Revisión v1.3 (PR #79 cancelado):** `correlation_id` sin default (solo desde contexto), FK de
    `usuario_id` SUSPENDIDA hasta contrato con IdentiCore, roles `sigd_app`/`sigd_worker` separados, y
    garantías de atomicidad, cero pérdida e inmutabilidad en estado `PROPUESTO` hasta su validación
    con pruebas E2E ejecutables.
- **Taxonomía:** `CONFIRMADO` — patrón Transactional Outbox y esquema base; `PROPUESTO` — índices,
  tamaño de columna `user_agent` y garantías de atomicidad/cero pérdida/inmutabilidad hasta su
  validación; `EJEMPLO` — payloads mostrados.

---

*Documento elaborado por Reátegui (`B_REATEGUI`) como entregable de Fase 2 — Levantamiento de
Observaciones del Grupo 6 CoreLink. Revisión 1.2: atiende las observaciones del liderazgo sobre el
PR #79 (fecha_hora en la bitácora, versionado/serialización del payload, idempotencia, nomenclatura
de identificadores y responsabilidades del despachador). Revisión 1.3: corrige la revisión del
liderazgo tras la cancelación del PR #79 (correlation_id sin default, FK de IdentiCore SUSPENDIDA,
roles sigd_app/sigd_worker, garantías a PROPUESTO hasta pruebas E2E). La autoría nominal de este
entregable requiere confirmación escrita de Reátegui (entregable 04 §10.1).*