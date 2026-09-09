# CONTRATOS INTERMODULARES UNIFICADOS Y MATRIZ PRODUCTOR-CONSUMIDOR
## Grupo 6 "CoreLink" · Integración, Calidad y Pruebas del Backend — SIGD

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)
**Institución:** IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI
**Área:** Backend — CoreLink
**Responsable del entregable:** Ricardo · `B_AREVALO`
**Documento:** `04_contratos_intermodulares_unificados.md`
**Fecha:** 8 de septiembre de 2026
**Versión:** 1.3 (Revisión del Liderazgo — PR #79 cancelado · correcciones pre-merge)

> [!NOTE]
> Este documento es una **especificación de referencia**. No contiene instrucciones ejecutables ni
> código listo para correr; consolida los contratos entre los 6 módulos del backend SIGD, la matriz
> **Productor-Consumidor** de interfaces y eventos Outbox, y el catálogo de tipos compartidos
> (`shared/types`). Toda afirmación marcada como `PROPUESTO` o `PENDIENTE` **requiere aprobación del
> grupo propietario** antes de tratarse como definitiva; los contratos cruzados **no se marcan
> `CONFIRMADO`** mientras el grupo propietario no entregue evidencia de aprobación bilateral.
>
> **Revisión v1.2 (Liderazgo — PR #79):** se incorporan los eventos RutaDoc faltantes
> (`ExpedienteAtendido`, `ExpedienteObservado`), se normaliza la nomenclatura de identificadores
> (`id_expediente`, `id_movimiento`, `id_evento`), se define la estrategia de idempotencia y se
> reclasifican a `PROPUESTO`/`PENDIENTE` los contratos que aún dependen de aprobación de los grupos
> propietarios. El contrato formal con RutaDoc se especifica en la sección 6.2.
>
> **Revisión v1.3 (PR #79 cancelado):** C-08 pasa a `PROPUESTO` (su garantía de registro **atómico**
> de bitácora + evento requiere pruebas E2E ejecutables); la FK `usuario_id -> sigd_auth` queda
> SUSPENDIDA hasta contrato con IdentiCore (`id_usuario`, no `id`); se registra la discrepancia de
> autoría del entregable 01 entre el plan de Fase 1 (Duque) y el de Fase 2 (Azareño), **resuelta** en
> favor del plan Fase 1 (07 §1.2): la atribución vigente es **Duque** (§10.1).

---

## 1. Propósito y Problema que Resuelve

Coordinar las **dependencias entre módulos** del backend SIGD de forma explícita y documentada, de
modo que cada grupo sepa **qué produce**, **qué consume**, **con qué forma** y **con qué reglas**.

Sin este documento, cada módulo definiría sus propias interpretaciones de los datos ajenos, los
eventos de integración se diseñarían en cada equipo por su cuenta y el resultado sería:

- **Acoplamiento oculto:** un módulo asumiría campos que otro jamás garantizó.
- **Eventos inconsistentes:** dos productores generarían eventos con la misma intención pero distinta
  estructura, rompiendo consumidores compartidos.
- **Duplicación de contrato:** cada equipo definiría su propia versión de tipos comunes
  (identidad de usuario, contexto de correlación, respuesta de error), divergiendo entre sí.

### 1.1. Propuesta de valor
- Un único lugar de verdad para **quiénes se comunican con quién** y **mediante qué contrato**.
- Contratos tipados (`shared/types`) que toda la organización Backend puede importar sin duplicar.
- Matriz de eventos Outbox alineada con el despacho asíncrono del entregable 02 (Reátegui).
- Contrato de eventos **versionado** con clave de idempotencia explícita y serialización definida.
- Reglas de integración alineadas con el manejo de errores del entregable 01 (Duque) y con la
  validación del entregable 03 (Zevallos).

---

## 2. Alcance y Elementos Fuera de Alcance

### Dentro del alcance
- Matriz Productor-Consumidor de **contratos de API** entre los 6 módulos.
- Matriz Productor-Consumidor de **eventos Outbox** (`sigd_audit.evento_outbox`), con la
  incorporación de los tres eventos de RutaDoc y su contrato formal (sección 6.2).
- Catálogo conceptual de **tipos compartidos** (`shared/types`) con su contrato de campos.
- Reglas de integración, **versionado de eventos**, **nomenclatura de identificadores**, **idempotencia**
  y serialización (sección 6.3 y 8).
- Riesgos de integración con responsables y evidencia requerida para cerrarlos.
- Registro de aprobaciones bilaterales y evidencia de autoría (sección 10).

### Fuera de alcance
- Middleware de errores RFC 7807 (entregable 01 — Duque).
- Arquitectura de auditoría y AsyncLocalStorage (entregable 02 — Reátegui).
- Suite de pruebas Testcontainers / k6 (entregable 03 — Zevallos).
- Endpoints funcionales concretos de los módulos: cada grupo define sus rutas cumpliendo estos
  contratos, sin que CoreLink los invente.

---

## 3. Definiciones Necesarias

| Término | Definición |
| :--- | :--- |
| **Integración** | Comunicación entre dos o más módulos mediante contratos explícitos (API o eventos). |
| **Productor** | Módulo que provee un dato, un servicio o que publica un evento. |
| **Consumidor** | Módulo que depende de un dato, servicio o evento producido por otro. |
| **Contrato** | Acuerdo de estructura y comportamiento (campos, tipos, reglas, códigos de error). |
| **Evento de dominio** | Hecho relevante del negocio publicado vía Outbox (p. ej. `ExpedienteDerivado`). |
| **`shared/types`** | Espacio común de tipos/contratos que todos los módulos importan; evita duplicación. |
| **Idempotencia** | Propiedad que permite procesar un mismo mensaje varias veces sin efectos duplicados. |
| **Clave de idempotencia** | Valor o compuesto de valores que el consumidor usa para detectar e ignorar duplicados. |
| **`schema_version`** | Versión de la estructura del `payload` del evento (entero, correlativa). |
| **Evento Outbox** | Publicación asíncrona persistida en `sigd_audit.evento_outbox` (ver entregable 02). |
| **Identificador normalizado** | Convención `id_<agregado>` (`id_expediente`, `id_movimiento`, `id_evento`) usada en los contratos. |

---

## 4. Módulos y Esquemas de Referencia

| Esquema | Módulo | Rol en la integración |
| :--- | :--- | :--- |
| `sigd_auth` | IdentiCore | Identidad: personas, cuentas, usuarios internos/externos. |
| `sigd_org` | OrganiCore | Organización: áreas, jerarquías, roles, permisos RBAC/ABAC. |
| `sigd_doc` | DocuCore | Catálogo documental: tipos documentales, requisitos, formularios, adjuntos. |
| `sigd_tra` | TramiCore | Trámite, expediente y asiento de registro (núcleo documental). |
| `sigd_rut` | RutaDoc | Trazabilidad: movimientos, recepción, derivación, **atención y observación** (Grupo 1). |
| `sigd_audit` | CoreLink | Bitácora forense y cola de eventos Outbox (transversal). |

---

## 5. Matriz Productor-Consumidor de Contratos de API

La siguiente matriz declara, por contrato: **productor**, **consumidor(es)**, **recurso/dato/servicio**,
**validación esperada**, **estado** y **aprobación requerida**. Los estados usan la taxonomía oficial
(`CONFIRMADO`, `PROPUESTO`, `PENDIENTE`). **Regla v1.2:** ningún contrato cruzado aparece `CONFIRMADO`
sin evidencia de aprobación del grupo propietario.

| # | Productor | Consumidor(es) | Recurso / Dato / Servicio | Validación esperada | Estado | Aprobación requerida |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| C-01 | TramiCore (Mesa de Partes) | RutaDoc, Documentadores | Expediente radicado: `numero`, fecha, tipo documental, área destino. | Unicidad del número; tipo documental debe existir en `sigd_doc`. | PROPUESTO | TramiCore |
| C-02 | IdentiCore | Todos los módulos | Identidad del solicitante: `id_persona` / `id_cuenta`, datos básicos. | Los `usuario_id` referenciados deben existir en `sigd_auth.cuenta_usuario`. La FK de CoreLink está SUSPENDIDA: IdentiCore mantiene pendiente la columna `id_usuario` (v1.3). | PROPUESTO | IdentiCore |
| C-03 | OrganiCore | TramiCore, RutaDoc | Área destino/jefatura y rol del operador. | El área debe existir y estar vigente; validación de permisos en derivación. | PROPUESTO | OrganiCore |
| C-04 | DocuCore | TramiCore | Tipo documental y requisitos asociados para radicación. | El tipo documental debe ser válido para el trámite seleccionado. | PENDIENTE | DocuCore |
| C-05 | RutaDoc | TramiCore, OrganiCore | Movimiento/derivación/atención/observación del expediente y estado actual. | La transición debe estar permitida por la máquina de estados de RutaDoc. | PENDIENTE | RutaDoc |
| C-06 | TramiCore | RutaDoc | Creación del expediente dispara `movimiento` inicial. | Toda radicación debe generar al menos un movimiento inicial. | PENDIENTE | TramiCore / RutaDoc |
| C-07 | CoreLink | Todos los módulos | `correlation_id` y formato de error RFC 7807/9457. | Respuestas de error conforme al entregable 01; nunca exponer rastros. | CONFIRMADO | CoreLink (propio) |
| C-08 | CoreLink | Todos los módulos | Bitácora de auditoría y cola Outbox. | Toda mutación registra y todo evento se persiste de forma atómica (entregable 02). La garantía de **registro atómico** queda `PROPUESTO` hasta validarla con las pruebas E2E (03/08). | PROPUESTO | CoreLink (propio) |

### 5.1. Reglas que rigen los contratos de API

- **Un solo emisor por dato:** el productor es responsable de la validez y del ciclo de vida del dato
  que publica; los consumidores no deben redefinirlo ni duplicarlo.
- **Ausencia garantizada, presencia exigida:** si un contrato declara que un campo es obligatorio, el
  productor lo envía siempre; si es opcional, los consumidores deben tolerar su ausencia.
- **Errores comunes:** toda falla entre módulos se serializa conforme al entregable 01; los consumidores
  no deben interpretar errores ad-hoc.
- **Registro de contradicciones:** si un contrato propuesto contradice una regla funcional de otro
  módulo, se registra como `PENDIENTE` y se consulta con el grupo propietario, sin resolverlo en silencio.
- **Identificadores normalizados:** en los contratos de datos se usan `id_<agregado>` (sección 8).

---

## 6. Matriz Productor-Consumidor de Eventos Outbox

Los eventos de integración se publican a través de `sigd_audit.evento_outbox` (entregable 02). Esta
matriz declara: **agregado**, **tipo de evento**, **versión**, **productor**, **consumidor(es)**,
**contenido del payload**, **clave de idempotencia**, **estado** y **aprobación requerida**.

| # | Agregado | Tipo de evento | Versión | Productor | Consumidor(es) | Contenido del payload | Clave de idempotencia | Estado | Aprobación |
| :---: | :--- | :--- | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| E-01 | `expediente` | `TramiteRegistrado` | 1 | TramiCore | RutaDoc; notificador (email/casilla) | `id_expediente`, número, tipo documental, solicitante, área destino, `correlation_id`. | `id_expediente` | PROPUESTO | TramiCore |
| E-02 | `movimiento` | `ExpedienteDerivado` | 1 | **RutaDoc** | TramiCore; notificador | `id_expediente`, `id_movimiento`, `id_area_origen`, `id_area_destino`, motivo, `ocurrido_en`, `correlation_id`. | `(tipo_evento, id_expediente, id_movimiento)` | PENDIENTE | **RutaDoc** |
| E-03 | `cuenta_usuario` | `UsuarioRegistrado` | 1 | IdentiCore | Notificador (casilla Ley 29733) | `id_cuenta`, correo, medio de contacto, `correlation_id`. | `id_cuenta` | PENDIENTE | IdentiCore |
| E-04 | `tramite` | `RequisitoValidado` | 1 | DocuCore | TramiCore | `id_expediente`, `id_requisito`, resultado de admisibilidad. | `(id_expediente, id_requisito)` | PENDIENTE | DocuCore |
| E-05 | `expediente` | `ExpedienteFinalizado` | 1 | **RutaDoc** | Archivo histórico; notificador | `id_expediente`, resultado, fecha de cierre, `correlation_id`. | `id_expediente` | PENDIENTE | **RutaDoc** |
| E-06 | `expediente` | `ExpedienteAtendido` | 1 | **RutaDoc** | TramiCore; Archivo; notificador | `id_expediente`, `id_movimiento`, `id_area_atencion`, `id_usuario_atencion`, resultado, `ocurrido_en`, `correlation_id`. | `(tipo_evento, id_expediente, id_movimiento)` | PENDIENTE | **RutaDoc** |
| E-07 | `expediente` | `ExpedienteObservado` | 1 | **RutaDoc** | TramiCore; notificador | `id_expediente`, `id_movimiento`, `id_area_atencion`, `id_usuario_atencion`, detalle de observación, plazo de subsanación, `ocurrido_en`, `correlation_id`. | `(tipo_evento, id_expediente, id_movimiento)` | PENDIENTE | **RutaDoc** |

> **Corrección de la revisión v1.2:** en la v1.1 solo aparecía `ExpedienteDerivado` (E-02) para el
> dominio de RutaDoc. Se incorporan **`ExpedienteAtendido` (E-06)** y **`ExpedienteObservado` (E-07)**
> para cubrir la máquina de estados completa de RutaDoc (recepción → derivación → atención → cierre,
> con la alternativa de observación). Los tres requieren aprobación del Grupo 1.

### 6.1. Reglas de los eventos Outbox

- **Atomicidad:** el evento se escribe en la **misma transacción** que la mutación de negocio
  (regla del entregable 02).
- **Payload autocontenido:** el consumidor debe poder procesar el evento sin consultar al productor;
  si precisa más datos, se amplía el contrato del payload previa aprobación.
- **Idempotencia obligatoria:** la clave de idempotencia identificada en la matriz debe permitir al
  consumidor detectar e ignorar duplicados ante reintentos del worker (sección 6.3).
- **Propiedad del tipo de evento:** el productor la mantiene; ningún otro módulo publica un evento con
  el mismo `tipo_evento` para un agregado distinto.
- **Versionado:** todo evento lleva `schema_version`; un cambio rompiente incrementa la versión y
  requiere re-aprobación del consumidor afectado.
- **Identificadores:** en los payloads se usa `id_expediente` / `id_movimiento` (nunca se alterna con
  `expediente_id`).

### 6.2. Contrato formal de eventos de RutaDoc (criterio de cierre — revisión PR #79)

Para cerrar el contrato con el Grupo 1 (RutaDoc) se definen a continuación los elementos exigidos por
el liderazgo. Este bloque permanece en estado **`PENDIENTE`** hasta la aprobación bilateral de RutaDoc.

| # | Requisito exigido | Definición para RutaDoc |
| :---: | :--- | :--- |
| 1 | **Los tres eventos** | `ExpedienteDerivado`, `ExpedienteAtendido`, `ExpedienteObservado` (E-02, E-06, E-07). |
| 2 | **Versión del evento** | Campo `schema_version` (entero, inicia en `1`) + sufijo `@v1` en la documentación. Se incrementa ante cambios rompientes del payload. |
| 3 | **Identificador del evento y del movimiento** | `id_evento` (UUID del registro en `sigd_audit.evento_outbox`) e `id_movimiento` (UUID del movimiento en `sigd_rut.movimiento_tramite`). |
| 4 | **`id_expediente`** | UUID del expediente en `sigd_tra` (identificador normalizado; no se usa `expediente_id` en los eventos). |
| 5 | **`correlation_id`** | UUIDv4 de la solicitud que originó la operación (entregable 01); viaja en el envelope y en la bitácora. |
| 6 | **Clave de idempotencia** | Compuesta `(tipo_evento, id_expediente, id_movimiento)`. El consumidor la usa como índice único y descarta el evento si ya existe. Para `ExpedienteFinalizado` (E-05), valor `id_expediente`; para `TramiteRegistrado` (E-01), `id_expediente`. |
| 7 | **Fecha y hora** | `ocurrido_en` (timestamp UTC ISO 8601 del hecho de negocio) y `creado_en` (persistencia en el outbox, del entregable 02). |
| 8 | **Productor y consumidores** | Productor: **RutaDoc**. Consumidores: **TramiCore** (actualiza ubicación/estado y cargas de notificación) y **notificador** (email/casilla); Archivo histórico en E-05/E-06. |
| 9 | **Estructura del payload** | Envelope normalizado (tabla 6.2.1) + bloque específico por evento (tabla 6.2.2). |
| 10 | **Serialización** | JSON UTF-8 en `snake_case`, almacenado en `payload JSONB`. Cabecera con `schema_version`, `id_evento`, `id_expediente`, `id_movimiento`, `correlation_id` y `ocurrido_en`. |
| 11 | **Estados del Outbox** | `PENDIENTE` → `EN_PROCESO` (reserva `FOR UPDATE SKIP LOCKED`) → `PROCESADO`, o `PENDIENTE` → `FALLIDO` (dead-letter). Solo `INSERT` desde los casos de uso; solo el worker modifica `estado`, `intentos`, `procesado_en` y `proxima_reintento_en` (entregable 02 §6.3; DDL 06 v1.5). |
| 12 | **Reintentos y manejo de errores** | Backoff exponencial real (`proxima_reintento_en` = `intento_desde` + `backoffBaseMs × 2^(intentos-1)`); máximo 5 intentos; error transitorio mantiene `PENDIENTE`, incrementa `intentos` y agenda `proxima_reintento_en`; error persistente deriva a `FALLIDO` (DLQ). Confirmación del consumidor antes de marcar `PROCESADO`. |
| 13 | **Responsabilidades del despachador** | Despachador = **worker outbox** (CoreLink). Debe: leer lotes con `FOR UPDATE SKIP LOCKED`, despachar al destino, confirmar antes de `PROCESADO`, aplicar reintentos/backoff, derivar a `FALLIDO` y no reencolar `PROCESADO`. |
| 14 | **Aprobación bilateral** | Evidencia del Grupo 1 (RutaDoc): ruta del archivo, rama, commit o PR, definición exacta, explicación de autoría y confirmación del estado contractual (sección 10). |

#### 6.2.1. Estructura del envelope (common `payload` de RutaDoc)

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `schema_version` | entero | Versión de la estructura (inicia en 1). |
| `tipo_evento` | string | `ExpedienteDerivado`, `ExpedienteAtendido` o `ExpedienteObservado`. |
| `id_evento` | UUID | Identificador del registro en `sigd_audit.evento_outbox`. |
| `id_expediente` | UUID | Expediente afectado (`sigd_tra`). |
| `id_movimiento` | UUID | Movimiento que originó el evento (`sigd_rut.movimiento_tramite`). |
| `ocurrido_en` | ISO-8601 UTC | Fecha y hora del hecho de negocio. |
| `correlation_id` | UUIDv4 | Correlación de la solicitud completa. |
| `clave_idempotencia` | string | `tipo_evento:id_expediente:id_movimiento` (para derivación/atención/observación). |
| `datos` | JSON | Bloque específico del evento (tabla 6.2.2). |

#### 6.2.2. Bloque `datos` específico por evento

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

### 6.3. Estrategia de idempotencia (resuelta en v1.2)

1. **En el productor:** el `payload` incluye `clave_idempotencia` = `tipo_evento:id_expediente:id_movimiento`
   (o la clave de la matriz, sección 6). La clave garantiza que reintentos del worker no generen
   efectos dobles.
2. **En el consumidor:** cada consumidor mantiene un índice único sobre
   `(tipo_evento, clave_idempotencia)` en su proyección local. Antes de procesar un evento, consulta
   si la clave ya existe; si existe, **lo descarta sin efectos** y responde éxito (no error), de modo
   que el worker puede marcar `PROCESADO` incluso en duplicados.
3. **En la base de datos:** la restricción de unicidad es el mecanismo real de defensa; la comprobación
   en el consumidor es solo optimización. Ante rechazo por unicidad (PG `23505`), se trata como
   duplicado confirmado.
4. **Fuera del alcance del worker:** el worker **no** decide duplicados; solo entrega. La idempotencia
   es responsabilidad del consumidor (entregable 02 §6.5.7).

---

## 7. Catálogo de Tipos Compartidos (`shared/types`)

Contrato de los tipos comunes que la organización Backend acuerda importar desde una ubicación
compartida, con el detalle de sus campos. **No se listan aquí como código; se describe su contenido.**

### 7.1. `CorrelationContext`
Contexto de la solicitud compartido entre capas (definido en el entregable 01 y reutilizado en el 02):

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `correlation_id` | UUIDv4 | Identificador único de la solicitud. |
| `usuario_id` | UUID \| null | Identidad autenticada, si existe. |
| `ip_origen` | string | IP del cliente. |
| `user_agent` | string | Cliente que originó la solicitud. |

### 7.2. `ApiErrorResponse`
Respuesta de error estandarizada (entregable 01): `type`, `title`, `status`, `detail`, `instance`,
`code`, `correlation_id`, `invalid_params`. Los consumidores deben validar contra este contrato y
nunca asumir campos adicionales.

### 7.3. `PaginacionRequest` / `PaginacionResponse`
Contrato común de paginación para listados entre módulos:

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `pagina` | number | Número de página solicitada (base 1). |
| `por_pagina` | number | Tamaño de página (límite acordado). |
| `total` | number | Total de registros (respuesta). |
| `datos` | array | Conjunto de la página (respuesta). |

> **Nota:** la decisión del tamaño mínimo/máximo de `por_pagina` y el convenio de ordenamiento se
> registra como propuesta en el entregable 05 (D-13, estado `PROPUESTO`).

### 7.4. `EventoOutboxContract`
Forma mínima de un evento publicado por el Outbox (entregable 02): `id_evento`, `correlation_id`,
`agregado`, `tipo_evento`, `payload`, `estado`, `intentos`, `creado_en`, `procesado_en`. En v1.2 el
`payload` incorpora el envelope normalizado de la sección 6.2.1 (**`schema_version`**, `id_expediente`,
`id_movimiento`, `ocurrido_en`, `clave_idempotencia`).

### 7.5. `ExpedienteContract` (núcleo documental transversal)
Contrato del dato más consumido por los módulos. **En v1.2 se normaliza el identificador a
`id_expediente`** (reemplaza `expediente_id`); permanece **`PROPUESTO`** hasta ratificación de TramiCore.

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id_expediente` | UUID | Identificador único del expediente (`id_<agregado>`). |
| `numero` | string | Número único de radicación (ver TramiCore). |
| `id_tipo_documental` | UUID | Tipo documental vigente en `sigd_doc`. |
| `id_solicitante` | UUID | Identidad del solicitante en `sigd_auth`. |
| `id_area_destino` | UUID | Área destino en `sigd_org`. |
| `fecha_radicacion` | timestamp | Momento de radicación. |

> 🔎 **Criterio de avance:** este catálogo se expandirá cuando TramiCore confirme su modelo como
> `CONFIRMADO`; mientras tanto, se trata como `PROPUESTO` y los consumidores deben validar su
> tolerancia a cambios (sección 10: aprobación TramiCore pendiente).

### 7.6. `EventoRutaDoc` (nuevo — refleja la sección 6.2)
Unión tipada de los tres eventos de RutaDoc: `ExpedienteDerivado`, `ExpedienteAtendido`,
`ExpedienteObservado`. Cada evento implementa el envelope normalizado (6.2.1) con su bloque `datos`
(6.2.2). Estado **`PENDIENTE`** (aprobación RutaDoc).

---

## 8. Reglas de Integración Generales

1. **Importar, no duplicar:** los tipos comunes se importan desde `shared/types`; ningún módulo
   redefine localmente uno existente.
2. **Una verdad de identidad:** `usuarios`/`personas` se resuelven únicamente contra `sigd_auth`;
   los demás módulos referencian `usuario_id` sin replicar datos personales.
3. **Errores uniformes:** cualquier falla entre módulos sigue el formato del entregable 01; los
   códigos nuevos se proponen en la matriz del entregable 01 antes de implementarse.
4. **Trazabilidad obligatoria:** toda comunicación lleva `correlation_id`; la auditoría registra
   mutaciones conforme al entregable 02.
5. **Idempotencia en eventos:** todo consumidor de Outbox implementa el descarte de duplicados usando
   la clave de idempotencia de la sección 6.3 (índice único + respuesta de éxito sobre duplicados).
6. **Versionado:** todo evento lleva `schema_version`; los cambios rompientes incrementan la versión y
   requieren revalidación de consumidores.
7. **Nomenclatura de identificadores:** los contratos de datos usan `id_<agregado>` (`id_expediente`,
   `id_movimiento`, `id_area_*`, `id_usuario_*`, `id_cuenta`). No alternar con `expediente_id` ni
   variantes (corrige inconsistencia de la v1.1).
8. **Sin invención de endpoints ajenos:** CoreLink especifica contratos; cada grupo propietario define
   sus rutas. Si un contrato requiere un endpoint aún inexistente, queda como `PENDIENTE`.
9. **Contradicciones explícitas:** si una regla entrante contradice documentación vigente de otro
   grupo, se registra y consulta; jamás se resuelve silenciosamente.
10. **Aprobación previa a CONFIRMADO:** ningún contrato cruzado se marca `CONFIRMADO` sin la evidencia
    bilateral del grupo propietario (sección 10).

---

## 9. Riesgos de Integración, Responsables y Evidencia

| # | Riesgo | Impacto | Responsable(s) | Evidencia para cerrar | Estado |
| :---: | :--- | :--- | :--- | :--- | :---: |
| R-01 | Divergencia en el nombre de esquemas (`sigd_*`) entre los 6 DDL | Fallas de migración e integración E2E | Todos los grupos; valida Zevallos | Migraciones ejecutables en la suite del entregable 03 | EN GESTIÓN |
| R-02 | Contrato del `numero` de expediente sin confirmar (TramiCore) | C-01 y `ExpedienteContract` inconsistentes | TramiCore / Ricardo | Confirmación del `ExpedienteContract` (7.5) con `id_expediente` | PENDIENTE |
| R-03 | Consumidores sin idempotencia de eventos | Duplicados de notificación/derivación | Cada consumidor; coordina Ricardo | Índice único `(tipo_evento, clave_idempotencia)` (sección 6.3) | PENDIENTE |
| R-04 | Módulos respondiendo errores sin RFC 7807 | Contrato de error roto ante los consumidores | Todos los módulos; valida Duque | Pasos E2E-02/03/08/09/10 (entregable 03) | EN GESTIÓN |
| R-05 | `usuario_id` ausente en operaciones de sistema | Auditoría sin identidad | Reátegui | Política de `usuario_id` nullable documentada (entregable 02) | CONFIRMADO |
| R-06 | Nomenclatura de identificadores alternada (`id_expediente` vs `expediente_id`) | Contratos y eventos inconsistentes | Ricardo; valida cada módulo | Normalización en v1.2 (secciones 6.2, 7.5 y 8) | EN GESTIÓN |
| R-07 | Eventos de RutaDoc `ExpedienteAtendido` y `ExpedienteObservado` no definidos/aprobados | Máquina de estados de RutaDoc incompleta en integración | RutaDoc (Grupo 1) / Ricardo | Contrato formal 6.2 aprobado bilateralmente | PENDIENTE |
| R-08 | Autoría de entregables concentrada en una cuenta (commits solo desde `B_AREVALO`) | Trazabilidad individual de Duque, Reátegui y Zevallos sin evidencia | Todos / Ricardo | Registro de autoría y aprobación (sección 10) | EN GESTIÓN |

---

## 10. Evidencia de Aprobación Bilateral y de Autoría

Para cerrar cada contrato cruzado se requiere que **cada sublíder** envíe al responsable de CoreLink
(Ricardo · `B_AREVALO`) la siguiente información por entregable, según formato exigido por el liderazgo:

| Campo requerido por el liderazgo | Descripción |
| :--- | :--- |
| **Ruta del archivo** | Ruta del documento/artefacto dentro del repositorio. |
| **Rama** | Rama en la que trabajó el autor (`B_XX`). |
| **Commit o PR** | Hash del commit o número del PR que contiene el entregable. |
| **Definición exacta** | Definición textual del contrato/entregable acordado. |
| **Explicación de autoría (cuando falten commits)** | Declaración de quién elaboró realmente cada parte si los commits no lo reflejan. |
| **Confirmación del estado contractual** | Confirmación de `CONFIRMADO` / `PROPUESTO` / `PENDIENTE` por el grupo propietario. |

### 10.1. Registro de autoría de los entregables del Grupo 6 (v1.2, nota v1.3)

> ⚠️ **Nota v1.3 — discrepancia de autoría del entregable 01:** el plan de **Fase 1**
> (`planes_trabajo/06_plan_trabajo_grupo_6_corelink.md`) asigna las convenciones de API a **Duque
> (`B_DUQUE`)**, mientras el plan de **Fase 2** (`levantamiento_de_observaciones/06_plan_...`) asigna
> la especificación del middleware RFC 7807 a **Azareño (`B_AZAREÑO`)**. **RESUELTO (9 sept 2026):**
> prevalece el plan de Fase 1; la atribución corregida es **Duque** (07 §1.2). Los documentos de
> Fase 2 mantienen la referencia histórica. Autor declarado: Duque.

| Entregable | Autor declarado en el documento | Rama | Commit / PR | Explicación de autoría (si solo hay commits en `B_AREVALO`) | Estado contractual |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `01_especificacion_middleware_rfc7807.md` | Duque (`B_DUQUE`) — plan Fase 1 | `B_DUQUE` | <commit/PR pendiente> | Atribución corregida a Duque (07 §1.2); la mención a Azareño en Fase 2 fue error de planificación | PENDIENTE |
| `02_arquitectura_auditoria_contexto_asynclocalstorage.md` | Reátegui (`B_REATEGUI`) | `B_REATEGUI` | PR #79 (consolidado) | Pendiente de confirmación por Reátegui | PENDIENTE |
| `03_suite_pruebas_testcontainers_k6.md` | Zevallos (`B_ZEVALLOS`) | `B_ZEVALLOS` | PR #79 (consolidado) | Pendiente de confirmación por Zevallos | PENDIENTE |
| `04_contratos_intermodulares_unificados.md` | Ricardo (`B_AREVALO`) | `B_AREVALO` | PR #79 | Sublíder y coordinador de integración | PROPUESTO |
| `05_decisiones_levantamiento_corelink.md` | Ricardo (`B_AREVALO`) | `B_AREVALO` | PR #79 | Sublíder y coordinador de integración | PROPUESTO |
| `06_sigd_audit_esquema_ddl.sql` | Reátegui (`B_REATEGUI`) | `B_REATEGUI` | PR #79 (consolidado) | Pendiente de confirmación por Reátegui | PENDIENTE |
| `implementacion/` (código fuente) | Grupo 6 | — | PR #79 | Autoría por área pendiente de confirmación individual | PENDIENTE |

> ⚠️ **Seguimiento de autoría:** el liderazgo observó que **todos los commits de PR #79 provienen de
> la cuenta `B_AREVALO`**. La responsabilidad nominal de cada entregable consta en el plan de trabajo
> (06_plan_levantamiento...) y en la cabecera de cada documento, pero **falta la confirmación escrita
> de Duque, Reátegui y Zevallos** indicando rama, commit y definición de su autoría. Deben completarse
> las filas anteriores como primer paso para el cierre del PR.

### 10.2. Registro de aprobaciones bilaterales (contratos cruzados)

| Contrato | Grupo propietario | Evidencia de aprobación bilateral | Estado |
| :--- | :--- | :--- | :---: |
| C-01 / E-01 (`TramiteRegistrado`) | TramiCore | — | PENDIENTE |
| C-02 / E-03 (`UsuarioRegistrado`) | IdentiCore | — | PENDIENTE |
| C-03 | OrganiCore | — | PENDIENTE |
| C-04 / E-04 (`RequisitoValidado`) | DocuCore | — | PENDIENTE |
| C-05 / E-02 · E-05 · E-06 · E-07 (RutaDoc) | **RutaDoc** | — | PENDIENTE |
| C-06 | TramiCore / RutaDoc | — | PENDIENTE |

> El liderazgo requiere presentar la **evidencia de aprobación bilateral** de cada contrato; mientras
> no exista, el estado del contrato será `PENDIENTE`. Dicha evidencia se integrará en el PR cuando el
> profesor lo autorice (el PR #79 fue cancelado).

---

## 11. Guía de Avance para los Equipos (Lista de Verificación)

1. [ ] **Difundir la matriz C-01 a C-08** y la matriz de eventos (E-01 a E-07) a los grupos
       propietarios para su aprobación bilateral (sección 10.2).
2. [ ] **Presentar a RutaDoc el contrato formal (6.2)** — tres eventos, envelope, idempotencia,
       versionado — y registrar su aprobación en 10.2.
3. [ ] **Confirmar el `ExpedienteContract` (7.5)** con TramiCore usando `id_expediente` y resolver R-02.
4. [ ] **Reclasificar a `CONFIRMADO`** cada contrato únicamente con evidencia bilateral firmada.
5. [ ] **Crear la carpeta común `shared/types`** e incorporar los tipos de la sección 7, incluido
       `EventoRutaDoc` (7.6) y el envelope de 6.2.1.
6. [ ] **Validar idempotencia** de cada consumidor (R-03) con el índice único de la sección 6.3.
7. [ ] **Verificar nomenclatura `sigd_*`** e **identificadores `id_<agregado>`** en los DDL de los
       6 módulos (R-01, R-06).
8. [ ] **Recolectar la evidencia de autoría** de Duque, Reátegui y Zevallos (sección 10.1) para
       cerrar R-08.
9. [ ] **Sincronizar con el entregable 03:** incluir casos E2E que validen C-01, C-03 y los eventos
       E-01, E-02, E-06 y E-07 en la suite de Zevallos.
10. [ ] **Registrar pendientes** en el log del entregable 05 conforme avanza cada grupo.

---

## 12. Criterios de Aceptación de la Especificación

| # | Criterio | Cumple |
| :---: | :--- | :---: |
| 1 | La matriz Productor-Consumidor de contratos de API cubre los 6 módulos y refleja el estado real de aprobación. | ✅ |
| 2 | La matriz de eventos Outbox define productor, consumidores, payload, versión e idempotencia, **incluidos los tres eventos de RutaDoc**. | ✅ |
| 3 | El contrato formal con RutaDoc (6.2) define los 14 elementos exigidos por el liderazgo. | ✅ |
| 4 | El catálogo `shared/types` describe los contratos comunes con identificadores normalizados (`id_*`). | ✅ |
| 5 | Las reglas de integración son consistentes con los entregables 01 y 02 y resuelven la idempotencia. | ✅ |
| 6 | Los riesgos tienen responsable, impacto y evidencia para su cierre. | ✅ |
| 7 | Los supuestos no confirmados quedan marcados con la taxonomía oficial y con su aprobación requerida. | ✅ |
| 8 | La evidencia de autoría y aprobación bilateral queda registrada para el cierre del PR #79. | ✅ |

---

## 13. Dependencias y Decisiones

- **Dependencia (Duque):** el formato de error y el `correlation_id` provienen del entregable 01.
- **Dependencia (Reátegui):** el despacho de eventos se apoya en `sigd_audit.evento_outbox` del
  entregable 02 y en el DDL `06_sigd_audit_esquema_ddl.sql`.
- **Dependencia (Zevallos):** los contratos C-01, C-03 y los eventos E-01, E-02, E-06 y E-07 se
  verifican en los casos E2E del entregable 03.
- **Decisiones registradas:**
  - `CONFIRMADO` (propios de CoreLink): C-07 y la política de `usuario_id` nullable (R-05).
  - `PROPUESTO` (propio de CoreLink): C-08 — su garantía de **registro atómico** (bitácora + evento)
    requiere validación con pruebas E2E ejecutables (v1.3).
  - `PROPUESTO`: identidad vía `sigd_auth` (C-02), área vía `sigd_org` (C-03), `ExpedienteContract`
    (7.5) y evento E-01.
  - `PENDIENTE`: contratos de movimientos/estados de RutaDoc (C-05, C-06) y eventos
    E-02, E-03, E-04, E-05, E-06, E-07, hasta la aprobación bilateral de los grupos propietarios.
  - **v1.2:** se normalizan los identificadores a `id_<agregado>`, se incorporan
    `ExpedienteAtendido`/`ExpedienteObservado`, se define la clave de idempotencia compuesta y se
    exige evidencia de autoría y aprobación bilateral para marcar `CONFIRMADO`.
  - **v1.3:** C-08 a `PROPUESTO`; FK `usuario_id -> sigd_auth` SUSPENDIDA (IdentiCore usa `id_usuario`);
    discrepancia de autoría del entregable 01 (Duque vs Azareño) **resuelta** a Duque (07 §1.2).
  - **v1.4:** contrato formal de RutaDoc materializado como propuesta autocontenida en el entregable
    `09_propuesta_contractual_rutadoc.md`; `ExpedienteContract` 7.5 y reintentos del outbox alineados
    con D-15/DDL 06 v1.5 (`proxima_reintento_en`, estado `EN_PROCESO`).

---

*Documento elaborado por Ricardo (`B_AREVALO`) como entregable de Fase 2 — Levantamiento de
Observaciones del Grupo 6 CoreLink. Revisión 1.2: atiende las observaciones del liderazgo sobre el
PR #79 (eventos RutaDoc, nomenclatura de identificadores, idempotencia, estado contractual y
evidencia de autoría/aprobación bilateral). Revisión 1.3: corrige la revisión del liderazgo tras la
cancelación del PR #79 (C-08 a `PROPUESTO` por garantía atómica pendiente de pruebas, FK de
IdentiCore SUSPENDIDA y discrepancia de autoría del entregable 01 registrada).*