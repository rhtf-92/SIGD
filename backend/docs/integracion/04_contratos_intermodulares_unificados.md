# CONTRATOS INTERMODULARES UNIFICADOS Y MATRIZ PRODUCTOR-CONSUMIDOR
## Grupo 6 "CoreLink" · Integración, Calidad y Pruebas del Backend — SIGD

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)
**Institución:** IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI
**Área:** Backend — CoreLink
**Responsable del entregable:** Ricardo · `B_AREVALO`
**Documento:** `04_contratos_intermodulares_unificados.md`
**Fecha:** 3 de septiembre de 2026
**Versión:** 1.1 (Fase 2 — Levantamiento de Observaciones · Revisión de documentación)

> [!NOTE]
> Este documento es una **especificación de referencia**. No contiene instrucciones ejecutables ni
> código listo para correr; consolida los contratos entre los 6 módulos del backend SIGD, la matriz
> **Productor-Consumidor** de interfaces y eventos Outbox, y el catálogo de tipos compartidos
> (`shared/types`) que los equipos deben acordar e implementar. Todo contenido marcado como
> `PROPUESTO` o `PENDIENTE` requiere validación antes de ser tratado como definitivo.

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
- Reglas de integración alineadas con el manejo de errores del entregable 01 (Azareño) y con la
  validación del entregable 03 (Zevallos).

---

## 2. Alcance y Elementos Fuera de Alcance

### Dentro del alcance
- Matriz Productor-Consumidor de **contratos de API** entre los 6 módulos.
- Matriz Productor-Consumidor de **eventos Outbox** (`sigd_audit.evento_outbox`).
- Catálogo conceptual de **tipos compartidos** (`shared/types`) con su contrato de campos.
- Reglas de integración, versionado, idempotencia y nomenclatura.
- Riesgos de integración con responsables y evidencia requerida para cerrarlos.

### Fuera de alcance
- Middleware de errores RFC 7807 (entregable 01 — Azareño).
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
| **Evento de dominio** | Hecho relevante del negocio publicado vía Outbox (p. ej. `TramiteRegistrado`). |
| **`shared/types`** | Espacio común de tipos/contratos que todos los módulos importan; evita duplicación. |
| **Idempotencia** | Propiedad que permite procesar un mismo mensaje varias veces sin efectos duplicados. |
| **Evento Outbox** | Publicación asíncrona persistida en `sigd_audit.evento_outbox` (ver entregable 02). |

---

## 4. Módulos y Esquemas de Referencia

| Esquema | Módulo | Rol en la integración |
| :--- | :--- | :--- |
| `sigd_auth` | IdentiCore | Identidad: personas, cuentas, usuarios internos/externos. |
| `sigd_org` | OrganiCore | Organización: áreas, jerarquías, roles, permisos RBAC/ABAC. |
| `sigd_doc` | DocuCore | Catálogo documental: tipos documentales, requisitos, formularios, adjuntos. |
| `sigd_tra` | TramiCore | Trámite, expediente y asiento de registro (núcleo documental). |
| `sigd_rut` | RutaDoc | Trazabilidad: movimientos, recepción, derivación y atención. |
| `sigd_audit` | CoreLink | Bitácora forense y cola de eventos Outbox (transversal). |

---

## 5. Matriz Productor-Consumidor de Contratos de API

La siguiente matriz declara, por contrato: **productor**, **consumidor(es)**, **recurso/dato/servicio**,
**validación esperada** y **estado**. Los estados usan la taxonomía oficial
(`CONFIRMADO`, `PROPUESTO`, `PENDIENTE`).

| # | Productor | Consumidor(es) | Recurso / Dato / Servicio | Validación esperada | Estado |
| :---: | :--- | :--- | :--- | :--- | :---: |
| C-01 | TramiCore (Mesa de Partes) | RutaDoc, Documentadores | `expediente` radicado: número único, fecha, tipo documental, área destino. | Unicidad del número; tipo documental debe existir en `sigd_doc`. | CONFIRMADO |
| C-02 | IdentiCore | Todos los módulos | Identidad del solicitante: `persona_id` / `cuenta_id`, datos básicos. | Los `usuario_id` referenciados deben existir en `sigd_auth.cuenta_usuario`. | CONFIRMADO |
| C-03 | OrganiCore | TramiCore, RutaDoc | Área destino/jefatura y rol del operador. | El área debe existir y estar vigente; validación de permisos en derivación. | CONFIRMADO |
| C-04 | DocuCore | TramiCore | Tipo documental y requisitos asociados para radicación. | El tipo documental debe ser válido para el trámite seleccionado. | PROPUESTO |
| C-05 | RutaDoc | TramiCore, OrganiCore | Movimiento/derivación del expediente y estado actual. | La transición de estado debe estar permitida por la máquina de estados. | PROPUESTO |
| C-06 | TramiCore | RutaDoc | Creación del expediente dispara `movimiento` inicial. | Toda radicación debe generar al menos un movimiento inicial. | PENDIENTE |
| C-07 | CoreLink | Todos los módulos | `correlation_id` y formato de error RFC 7807/9457. | Respuestas de error conforme al entregable 01; nunca exponer rastros. | CONFIRMADO |
| C-08 | CoreLink | Todos los módulos | Bitácora de auditoría y cola Outbox. | Toda mutación registra y todo evento se persiste de forma atómica (entregable 02). | CONFIRMADO |

### 5.1. Reglas que rigen los contratos de API

- **Un solo emisor por dato:** el productor es responsable de la validez y del ciclo de vida del dato
  que publica; los consumidores no deben redefinirlo ni duplicarlo.
- **Ausencia garantizada, presencia exigida:** si un contrato declara que un campo es obligatorio, el
  productor lo envía siempre; si es opcional, los consumidores deben tolerar su ausencia.
- **Errores comunes:** toda falla entre módulos se serializa conforme al entregable 01; los consumidores
  no deben interpretar errores ad-hoc.
- **Registro de contradicciones:** si un contrato propuesto contradice una regla funcional de otro
  módulo, se registra como `PENDIENTE` y se consulta con el grupo propietario, sin resolverlo en silencio.

---

## 6. Matriz Productor-Consumidor de Eventos Outbox

Los eventos de integración se publican a través de `sigd_audit.evento_outbox` (entregable 02). Esta
matriz declara: **agregado**, **tipo de evento**, **productor**, **consumidor(es)**, **contenido del
payload** y **clave de idempotencia**.

| # | Agregado | Tipo de evento | Productor | Consumidor(es) | Contenido del payload | Clave de idempotencia | Estado |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| E-01 | `expediente` | `TramiteRegistrado` | TramiCore | RutaDoc; notificador (email/casilla) | `expediente_id`, número, tipo documental, solicitante, área destino, `correlation_id`. | `expediente_id` | CONFIRMADO |
| E-02 | `movimiento` | `ExpedienteDerivado` | RutaDoc | TramiCore; notificador | `expediente_id`, área origen, área destino, fecha, motivo, `correlation_id`. | `id_movimiento` (o expediente+secuencia) | PROPUESTO |
| E-03 | `cuenta_usuario` | `UsuarioRegistrado` | IdentiCore | Notificador (casilla Ley 29733) | `cuenta_id`, correo, medio de contacto, `correlation_id`. | `cuenta_id` | PROPUESTO |
| E-04 | `tramite` | `RequisitoValidado` | DocuCore | TramiCore | `expediente_id`, requisito_id, resultado de admisibilidad. | `expediente_id + requisito_id` | PENDIENTE |
| E-05 | `expediente` | `ExpedienteFinalizado` | RutaDoc | Archivo histórico; notificador | `expediente_id`, resultado, fecha de cierre, `correlation_id`. | `expediente_id` | PENDIENTE |

### 6.1. Reglas de los eventos Outbox

- **Atomicidad:** el evento se escribe en la **misma transacción** que la mutación de negocio
  (regla del entregable 02).
- **Payload autocontenido:** el consumidor debe poder procesar el evento sin consultar al productor;
  si precisa más datos, se amplía el contrato del payload.
- **Idempotencia obligatoria:** la clave de idempotencia identificada en la matriz debe permitir al
  consumidor detectar e ignorar duplicados ante reintentos del worker.
- **Propiedad del tipo de evento:** el productor la mantiene; ningún otro módulo publica un evento con
  el mismo `tipo_evento` para un agregado distinto.

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
> registra como propuesta en el entregable 05.

### 7.4. `EventoOutboxContract`
Forma mínima de un evento publicado por el Outbox (entregable 02): `id_evento`, `correlation_id`,
`agregado`, `tipo_evento`, `payload`, `estado`, `intentos`, `creado_en`, `procesado_en`. El
`payload` de cada tipo de evento respeta su fila de la matriz (sección 6).

### 7.5. `ExpedienteContract` (núcleo documental transversal)
Contrato del dato más consumido por los módulos:

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `expediente_id` | UUID | Identificador único del expediente. |
| `numero` | string | Número único de radicación (ver TramiCore). |
| `tipo_documental_id` | UUID | Tipo documental vigente en `sigd_doc`. |
| `solicitante_id` | UUID | Identidad del solicitante en `sigd_auth`. |
| `area_destino_id` | UUID | Área destino en `sigd_org`. |
| `fecha_radicacion` | timestamp | Momento de radicación. |

> 🔎 **Criterio de avance:** este catálogo se expandirá cuando TramiCore confirme su modelo como
> `CONFIRMADO`; mientras tanto, se trata como `PROPUESTO` y los consumidores deben validar su
> tolerancia a cambios.

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
5. **Idempotencia en eventos:** todo consumidor de Outbox implementa descarte de duplicados usando la
   clave de idempotencia de la sección 6.
6. **Sin invención de endpoints ajenos:** CoreLink especifica contratos; cada grupo propietario define
   sus rutas. Si un contrato requiere un endpoint aún inexistente, queda como `PENDIENTE`.
7. **Contradicciones explícitas:** si una regla entrante contradice documentación vigente de otro
   grupo, se registra y consulta; jamás se resuelve silenciosamente.

---

## 9. Riesgos de Integración, Responsables y Evidencia

| # | Riesgo | Impacto | Responsable(s) | Evidencia para cerrar | Estado |
| :---: | :--- | :--- | :--- | :--- | :---: |
| R-01 | Divergencia en el nombre de esquemas (`sigd_*`) entre los 6 DDL | Fallas de migración e integración E2E | Todos los grupos; valida Zevallos | Migraciones ejecutables en la suite del entregable 03 | EN GESTIÓN |
| R-02 | Contrato del `numero` de expediente sin confirmar (TramiCore) | C-01 inconsistente para RutaDoc | TramiCore / Ricardo | Confirmación del contrato `ExpedienteContract` (7.5) | PENDIENTE |
| R-03 | Consumidores sin idempotencia de eventos | Duplicados de notificación/derivación | Cada consumidor; coordina Ricardo | Revisión de la matriz E-01 a E-05 | PENDIENTE |
| R-04 | Módulos respondiendo errores sin RFC 7807 | Contrato de error roto ante los consumidores | Todos los módulos; valida Azareño | Pasos E2E-02/03/08/09/10 (entregable 03) | EN GESTIÓN |
| R-05 | `usuario_id` ausente en operaciones de sistema | Auditoría sin identidad | Reátegui | Política de `usuario_id` nullable documentada (entregable 02) | CONFIRMADO |

---

## 10. Guía de Avance para los Equipos (Lista de Verificación)

1. [ ] **Difundir la matriz C-01 a C-08** a los grupos propietarios (TramiCore, RutaDoc, etc.) para
       que validen su estado.
2. [ ] **Confirmar el `ExpedienteContract` (7.5)** con TramiCore y resolver R-02.
3. [ ] **Crear la carpeta común `shared/types`** e incorporar los tipos de la sección 7.
4. [ ] **Difundir la matriz de eventos Outbox (sección 6)** a productores y consumidores.
5. [ ] **Validar idempotencia** de cada consumidor (R-03).
6. [ ] **Verificar nomenclatura `sigd_*`** en los DDL de los 6 módulos (R-01).
7. [ ] **Sincronizar con el entregable 03:** incluir casos E2E que validen C-01, C-03 y el evento
       E-01 en la suite de Zevallos.
8. [ ] **Registrar pendientes** en el log del entregable 05 conforme avanza cada grupo.

---

## 11. Criterios de Aceptación de la Especificación

| # | Criterio | Cumple |
| :---: | :--- | :---: |
| 1 | La matriz Productor-Consumidor de contratos de API cubre los 6 módulos. | ✅ |
| 2 | La matriz de eventos Outbox define productor, consumidores, payload e idempotencia. | ✅ |
| 3 | El catálogo `shared/types` describe los contratos comunes sin duplicación. | ✅ |
| 4 | Las reglas de integración son consistentes con los entregables 01 y 02. | ✅ |
| 5 | Los riesgos tienen responsable, impacto y evidencia para su cierre. | ✅ |
| 6 | Los supuestos no confirmados quedan marcados con la taxonomía oficial. | ✅ |

---

## 12. Dependencias y Decisiones

- **Dependencia (Azareño):** el formato de error y el `correlation_id` provienen del entregable 01.
- **Dependencia (Reátegui):** el despacho de eventos se apoya en `sigd_audit.evento_outbox` del
  entregable 02.
- **Dependencia (Zevallos):** los contratos C-01, C-03 y E-01 se verifican en los casos E2E del
  entregable 03.
- **Decisiones registradas:**
  - `CONFIRMADO`: identidad vía `sigd_auth` (C-02), área vía `sigd_org` (C-03) y errores/vínculos de
    CoreLink (C-07, C-08).
  - `PROPUESTO`: contrato de tipo documental (C-04), movimientos (C-05) y eventos E-02/E-03.
  - `PENDIENTE`: movimiento inicial (C-06), admisibilidad documental (E-04), finalización (E-05) y
    detalle del `numero` de expediente.

---

*Documento elaborado por Ricardo (`B_AREVALO`) como entregable de Fase 2 — Levantamiento de
Observaciones del Grupo 6 CoreLink. Revisión 1.1: convertido a especificación de documentación pura,
sin código ejecutable, para consolidar los contratos que los 6 módulos deben acordar e implementar.*