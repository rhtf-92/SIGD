# REGISTRO DE DECISIONES DEL LEVANTAMIENTO — CORE-LINK
## Grupo 6 "CoreLink" · Integración, Calidad y Pruebas del Backend — SIGD

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)
**Institución:** IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI
**Área:** Backend — CoreLink
**Responsable del entregable:** Ricardo · `B_AREVALO`
**Documento:** `05_decisiones_levantamiento_corelink.md`
**Fecha:** 9 de septiembre de 2026
**Versión:** 1.6 (Revisión del Liderazgo — veredicto `REQUIERE CORRECCIONES`: evidencia PG16 local,
alcance prototipo, semántica de umbrales k6, URN/DATABASE_URL y autorías)

> [!NOTE]
> Este documento es una **especificación de referencia**. No contiene instrucciones ejecutables ni
> código listo para correr; es el **log de decisiones (ADR)** del Grupo 6 durante la Fase 2.
> Consolida las decisiones técnicas tomadas, su estado según la taxonomía oficial y el registro de
> revisión del sublíder sobre los entregables 01 a 04 del grupo.
>
> **Revisión v1.3 (PR #79 cancelado):** (1) D-05 y D-06 pasan a `PROPUESTO` — las garantías de
> inmutabilidad, cero pérdida y atomicidad requieren pruebas E2E ejecutables; (2) D-12 adopta **estado
> único** `PROPUESTO`; (3) se agrega el **detalle de decisiones** (alternativa, justificación, impacto
> y evidencia) en §4.3; (4) se registran D-20 a D-23 (entrega al-menos-una-vez, `correlation_id` sin
> default, FK de IdentiCore SUSPENDIDA y roles `sigd_app`/`sigd_worker`).
>
> **Revisión v1.4 (segunda ronda del liderazgo):** (1) se corrige la atribución de D-01, D-02, D-04 y
> D-14 a **Duque**; (2) se documenta la separación de migraciones en la suite (DDL real de `sigd_audit`
> + stubs provisionales de los 5 esquemas, sin cargar los DDL oficiales de los demás grupos).
>
> **Revisión v1.5 (evidencia ejecutada):** D-06 (atomicidad y cero pérdida) y D-20 (entrega
> al-menos-una-vez) pasan a `CONFIRMADO` con los casos E2E-07 y E2E-12 ejecutados; C-08 también queda
> `CONFIRMADO` (04). D-05 (inmutabilidad) permanece `PROPUESTO`: la garantía no se ejercita en el
> prototipo porque la suite corre como dueño del esquema y el `REVOKE` por rol no aplica; requiere una
> prueba de permisos del rol `sigd_app` en el UAT. El riesgo R-10 pasa a `CERRADO` (evidencia E2E y k6).
>
> **Revisión v1.6 (veredicto `REQUIERE CORRECCIONES`):** (1) la evidencia E2E/k6 se generó en
> **PostgreSQL 16 local** y contra el **prototipo CoreLink** — D-06/D-20 bajan a `PARCIAL`, D-07 queda
> `PENDIENTE` y R-10 vuelve a `PENDIENTE (avance parcial)` hasta la re-ejecución exigida
> (Testcontainers/PG18 + migraciones reales de los 6 módulos); (2) la suite valida solo el prototipo
> CoreLink (declarado en `tests/setup/global-setup.ts` y runbook 08); (3) `x-correlation-id` acepta
> cualquier UUID RFC 4122 (v1–v5) y la documentación lo declara (D-04); (4) `DATABASE_URL` es exigida de
> forma explícita sin credenciales implícitas (server.ts y worker); (5) los logs versionados quedan
> sanitizados (sin ANSI, sin rutas personales, sin stack traces, sin mojibake; `git diff --check`
> limpio); (6) E2E-07 ampliado a 3 casos incluye rollback de `movimiento_tramite`; (7) los eventos de
> RutaDoc (E-02/E-06/E-07) se declaran `PENDIENTE` con **productor RutaDoc** y sin implementación en
> CoreLink; (8) el worker distingue errores **transitorios/permanentes** y el despachador de demo queda
> rotulado como demostración; (9) la semántica de los booleans `thresholds` de k6 se documenta
> (`false` = umbral NO incumplido; señal autoritativa = EXIT_CODE + consola); (10) las celdas con estado
> combinado `PROPUESTO/PENDIENTE` se reducen a estado único (D-12/D-18 y propuesta 09).

---

## 1. Propósito y Problema que Resuelve

Dejar **registro explícito y trazable** de cada decisión técnica del Grupo 6 en el Levantamiento de
Observaciones, diferenciando lo **confirmado**, lo **propuesto** y lo **pendiente**.

Sin este log, las decisiones quedarían implícitas en el texto de cada archivo, se perdería el contexto
del porqué y no habría una lista única que revisar al momento de integrar en `B_AREVALO` y aprobar en
`B_GERIC`.

### 1.1. Propuesta de valor
- Una sola lista de decisiones con contexto, estado y responsable.
- Registro de revisión del sublíder de los 5 documentos del grupo (01 a 04).
- Riesgos y pendientes con responsable y evidencia requerida.
- Base de auditoría para la revisión final de Geric.

---

## 2. Alcance y Elementos Fuera de Alcance

### Dentro del alcance
- Registro de decisiones técnicas de la Fase 2 (estándar RFC, contexto, auditoría, pruebas).
- Resumen de decisiones confirmadas, propuestas y pendientes.
- Registro de observaciones de revisión del sublíder sobre los entregables 01 a 04.
- Matriz de riesgos residuales y responsables.

### Fuera de alcance
- Contenido técnico de los entregables 01 a 04 (cada documento conserva su autoría y detalle).
- Contratación o seguimiento institucional de las autoridades del IESTP "Suiza".
- Decisiones de otros grupos que no involucren a CoreLink.

---

## 3. Definiciones Necesarias

| Término | Definición |
| :--- | :--- |
| **ADR (Architecture Decision Record)** | Registro breve que documenta una decisión, su contexto y sus consecuencias. |
| **Taxonomía oficial** | Etiquetas `CONFIRMADO`, `PROPUESTO`, `PENDIENTE` y `EJEMPLO` usadas en toda la documentación del SIGD. |
| **Revisión documental** | Verificación de que un entregable cumple su objetivo, es coherente con los demás y está listo para integrar. |
| **Conformidad** | Aprobación de la integración del subgrupo por parte del Líder General (Geric). |

---

## 4. Registro de Decisiones de la Fase 2

### 4.1. Formato del registro

Cada decisión se documenta con: número, fecha, contexto, decisión, estado y responsable. El estado
sigue la taxonomía oficial.

### 4.2. Decisiones registradas

| # | Fecha | Contexto | Decisión | Estado | Responsable |
| :---: | :--- | :--- | :--- | :---: | :--- |
| D-01 | 03/09/2026 | Necesidad de un estándar de errores internacional y vigente. | Adoptar **RFC 9457** manteniendo compatibilidad con RFC 7807, con los 8 campos especificados. | CONFIRMADO | Duque |
| D-02 | 03/09/2026 | Evitar respuestas HTTP dispersas en cada módulo. | Todo módulo **lanza** la jerarquía `AppError` al detectar un error; solo el middleware global serializa a HTTP. | CONFIRMADO | Duque |
| D-03 | 03/09/2026 | Propagar contexto sin ensuciar firmas de métodos. | Usar **una única instancia de AsyncLocalStorage** compartida vía `shared`; cada solicitud crea su almacén. | CONFIRMADO | Reátegui |
| D-04 | 03/09/2026 | Correlacionar solicitudes de punta a punta. | `correlation_id` se genera como **UUIDv4** (randomUUID); el header `x-correlation-id` acepta cualquier UUID RFC 4122 válido (versiones 1 a 5); si no es UUID válido RFC 4122 se genera uno nuevo (v4); siempre se devuelve en la respuesta. | CONFIRMADO | Duque |
| D-05 | 03/09/2026 (v1.3) | Auditoría inmutable y reconstrucción de estados. | Bitácora **append-only** (`sigd_audit.bitacora_auditoria`) con `datos_antes/datos_despues` en `JSONB`; revocar `UPDATE/DELETE` al rol de aplicación. La garantía de **inmutabilidad real** es `PROPUESTO` (v1.5): no se ejercita en el prototipo porque la suite corre como dueño del esquema; requiere prueba de permisos del rol `sigd_app` en el UAT. | PROPUESTO | Reátegui |
| D-06 | 03/09/2026 (v1.3/1.5/1.6) | Evitar pérdida de notificaciones ante caídas externas. | Patrón **Transactional Outbox** en `sigd_audit.evento_outbox`; el worker usa lote y `FOR UPDATE SKIP LOCKED`, confirma antes de marcar `PROCESADO`, con backoff exponencial, distinción **transitorio/permanente** y DLQ. **v1.5:** `CONFIRMADO` con E2E-07 (persistencia conjunta + rollback de radicación). **v1.6 (REQUIERE CORRECCIONES):** baja a `PARCIAL` — E2E-07 ampliado a 3 casos (incluye rollback de **derivación** sobre `sigd_rut.movimiento_tramite`) se ejecutó en **PostgreSQL 16 local** contra el prototipo CoreLink; la ejecución exigida (Testcontainers/PG18 + migraciones reales de los 6 módulos) queda `PENDIENTE`. | PARCIAL | Reátegui |
| D-07 | 03/09/2026 | Pruebas de integración reproducibles y sin mocks de datos. | Entorno efímero con **Testcontainers (PostgreSQL 18 Alpine)** + migraciones de los 6 esquemas y `TRUNCATE ... CASCADE` entre escenarios. La ejecución exigida **no se ha realizado**: sin Docker en la máquina, la evidencia se generó en PostgreSQL 16 local y contra el DDL real de `sigd_audit` + stubs provisionales (prototipo, P3). **v1.6:** `PENDIENTE` (PARCIAL). | PENDIENTE | Zevallos |
| D-08 | 03/09/2026 | Aptitud de rendimiento antes de producción. | Umbrales k6: **P95 < 200 ms** y **tasa de errores < 0.1 %**; escenarios de radicación (100 VU) y derivación (50 VU). | CONFIRMADO | Zevallos |
| D-09 | 03/09/2026 | Unificar los nombres de esquemas entre los 6 DDL. | Nomenclatura consolidada `sigd_auth`, `sigd_org`, `sigd_doc`, `sigd_tra`, `sigd_rut`, `sigd_audit`, reemplazando variantes anteriores. | CONFIRMADO | Ricardo |
| D-10 | 03/09/2026 | Mutaciones legítimas sin sesión de usuario (migraciones, máquina-a-máquina). | `usuario_id` es **nullable** en la bitácora; la ausencia se documenta y no se trata como inconsistencia. | CONFIRMADO | Reátegui |
| D-11 | 03/09/2026 | Tamaño de `user_agent` y nombres de índices. | Propuesta de `VARCHAR(512)` y de índices específicos; sujetos a confirmación al implementar. | PROPUESTO | Reátegui |
| D-12 | 03/09/2026 (v1.3) | Contratos entre módulos y eventos. | Matrices Productor-Consumidor C-01 a C-08 y eventos E-01 a E-07 (v1.2). **Estado único (v1.3):** `PROPUESTO`. Los contratos propios de CoreLink (C-07) están `CONFIRMADO`; los cruzados quedan `PROPUESTO`/`PENDIENTE` hasta la aprobación bilateral (04 §10.2). Elementos aún pendientes: C-06, E-04, E-05 y el número de expediente. | PROPUESTO | Ricardo |
| D-13 | 03/09/2026 | Límites de paginación y ordenamiento común. | Definir `pagina`/`por_pagina`/`total`/`datos` en `shared/types`; tamaño mínimo/máximo de página aún por confirmar. | PROPUESTO | Ricardo |
| D-14 | 03/09/2026 | Cumplimiento del estándar con ejemplo de falla crítica. | Respuesta `500 INTERNAL_ERROR` genérica; el detalle completo solo a logs internos con el `correlation_id`. | CONFIRMADO | Duque |
| D-15 | 08/09/2026 | Se alternaba `id_expediente` con `expediente_id` en contratos y eventos. | Nomenclatura normalizada **`id_<agregado>`** en todos los contratos de datos y eventos (`id_expediente`, `id_movimiento`, `id_cuenta`, `id_area_*`). | CONFIRMADO (propio) | Ricardo |
| D-16 | 08/09/2026 | Faltaban `ExpedienteAtendido` y `ExpedienteObservado` para RutaDoc. | Incorporar los tres eventos de RutaDoc (`ExpedienteDerivado`, `ExpedienteAtendido`, `ExpedienteObservado`) con contrato formal (04 §6.2). | PENDIENTE (aprobación RutaDoc) | Ricardo |
| D-17 | 08/09/2026 | Estrategia de idempotencia no resuelta. | Clave de idempotencia compuesta `tipo_evento:id_expediente:id_movimiento`; el consumidor implementa índice único `(tipo_evento, clave_idempotencia)` y descarta duplicados (04 §6.3). | CONFIRMADO (propio) | Ricardo |
| D-18 | 08/09/2026 | Contratos cruzados marcados `CONFIRMADO` sin aprobación de los grupos propietarios. | Ningún contrato cruzado se marca `CONFIRMADO` sin evidencia bilateral; los pendientes quedan en estado único **`PENDIENTE`** (o `PROPUESTO`, con parciales listados) hasta la aprobación documentada (04 §10.2). | CONFIRMADO (propio) | Ricardo |
| D-19 | 08/09/2026 | Los commits de PR #79 provienen únicamente de la cuenta `B_AREVALO`. | Exigir declaración de autoría (ruta, rama, commit/PR, definición, confirmación de estado) de Duque, Reátegui y Zevallos; incorporar registro de evidencia (07). | PENDIENTE | Todos |
| D-20 | 08/09/2026 (v1.5/1.6) | Semántica de entrega del outbox y duplicados. | El worker entrega **al-menos-una-vez** con `FOR UPDATE SKIP LOCKED`; distingue errores **transitorios** (reintento con backoff exponencial) de **permanentes** (→ `FALLIDO`/DLQ directo, sin reintentar); la idempotencia la garantiza el consumidor con la `clave_idempotencia`. **No se promete entrega exactamente-una-vez** (requiere coordinador transaccional externo). **v1.5:** `CONFIRMADO` con E2E-12. **v1.6:** baja a `PARCIAL` — E2E-12 ejecutado en PostgreSQL 16 local contra el prototipo; pendiente Testcontainers/PG18 y migraciones reales. | PARCIAL | Reátegui |
| D-21 | 08/09/2026 | `correlation_id` con `DEFAULT gen_random_uuid()` podía diferir del contexto. | `correlation_id` de la bitácora **sin valor por defecto** (v1.3 del DDL 06): se propaga siempre desde AsyncLocalStorage; la BD no genera un UUID distinto; inserción sin contexto falla de forma explícita. | CONFIRMADO (propio) | Reátegui |
| D-22 | 08/09/2026 | FK a `sigd_auth.cuenta_usuario(id)` sin contrato aprobado. | FK `usuario_id` **SUSPENDIDA (PENDIENTE)**: IdentiCore/RutaDoc mantienen la columna `id_usuario`; se activa solo con contrato bilateral aprobado (07). La decisión de suspender está confirmada; su activación, pendiente. | CONFIRMADO (propio) | Ricardo |
| D-23 | 08/09/2026 | La aplicación podía actualizar el outbox y no existía rol de worker. | Separar roles (DDL 06 v1.3): `sigd_app` (bitácora y encolado) y `sigd_worker` (solo SELECT/UPDATE del outbox). La aplicación no modifica eventos ya insertados. | CONFIRMADO (propio) | Reátegui |

> Atribución (Revisión 1.3): las decisiones D-01, D-02, D-04 y D-14, ligadas al entregable 01
> (RFC 7807/9457, jerarquía de errores y correlación), se atribuyen a **Duque**, según la corrección
> de autoría registrada en `07_evidencia_autorias_y_aprobaciones.md` §1.
> **Separación de migraciones (P3):** la decisión D-07 (entorno efímero + "migraciones de los
> 6 esquemas") se implementa cargando el **DDL real de `sigd_audit`** y **stubs PROVISIONALES** de los
> 5 esquemas de módulos; los DDL oficiales de identicore/organicore/tramicore/rutadoc/docucore no se
> cargan en el prototipo (incompatibles entre sí y propiedad de sus ramas).

### 4.3. Detalle de decisiones: alternativa, justificación, impacto y evidencia (v1.3)

Cada decisión incluye la siguiente trazabilidad, respondiendo a la observación del liderazgo sobre
decisiones sin fundamento documentado:

| # | Alternativa considerada | Justificación | Impacto | Evidencia para cerrar |
| :---: | :--- | :--- | :--- | :--- |
| D-01 | Solo RFC 7807 (sin 9457). | RFC 9457 incorpora `errors`/`base_uri` y mantiene compatibilidad con 7807. | Máquina de estados y contrato de error estables para todos los módulos. | Doc 01 §6; E2E-02/03/08/09/10. |
| D-02 | Serializar errores en cada controlador. | Un solo punto de serialización evita dispersión y filtraciones. | Todo módulo debe lanzar `AppError`; el middleware es el único serializador. | Doc 01 §7; E2E-10. |
| D-03 | Pasar contexto por parámetros. | AsyncLocalStorage evita contaminar firmas de casos de uso y repositorios. | `RequestContext` shared e instancia por solicitud. | Doc 02 §4; E2E-06. |
| D-04 | Generar un `correlation_id` nuevo por capa. | Un solo UUID por solicitud permite reconstruir la cadena completa. | Header `x-correlation-id` opcional; respuesta siempre lo incluye. | Doc 02 §4; rastreo del envelope §6.7. |
| D-05 | Bitácora editable con `datos_despues` final. | Append-only preserva el historial forense (antes/después). | Revocación `UPDATE/DELETE`; garantía a validar (v1.3). | DDL 06; prueba de permisos `sigd_app` en UAT (v1.5). |
| D-06 | Envío directo a servicios externos. | Outbox en la misma transacción evita pérdidas ante caídas. | Worker con lote, `SKIP LOCKED`, backoff y DLQ; garantía validada (v1.5). | DDL 06; E2E-07 ejecutado (12/12). |
| D-07 | Base de datos compartida de desarrollo. | Testcontainers aísla y reproduce el entorno real sin mocks. | Migraciones de los 6 esquemas + `TRUNCATE ... CASCADE`. | Doc 03; ejecución real del entorno (08). |
| D-08 | Sin umbrales de rendimiento. | Umbrales objetivos (P95, tasa de error) evitan aprobaciones subjetivas. | k6 con escenarios de radicación y derivación. | Doc 03; reporte k6 ejecutado (08). |
| D-09 | Nombres de esquemas por módulo. | Nomenclatura consolidada `sigd_*` única para migraciones. | Unificación de los 6 DDL. | Migraciones y búsqueda grep. |
| D-10 | `usuario_id` obligatorio. | Existen mutaciones de sistema legítimas sin sesión. | Columna nullable; NULL documentado, no inconsistencia. | Doc 02 §5.2. |
| D-11 | Tamaños/índices fijos por ahora. | Confirmar al implementar manteniendo semántica. | `VARCHAR(512)` y 6 índices propuestos. | Doc 02 §5.5/§6.6. |
| D-12 | Contratos definidos unilateralmente. | Estados por aprobación bilateral; C-07 propio confirmado. | `PROPUESTO` (estado único v1.3) con parciales pendientes. | Doc 04 §10.2; 07. |
| D-13 | Paginación libre por módulo. | Contrato común `pagina/por_pagina/total/datos`. | Tipos compartidos en `shared/types`. | Doc 04 §5; revisión de otros grupos. |
| D-14 | Respuesta `500` con detalle técnico. | No filtrar rastros ni rutas internas; detalle solo a logs. | `500 INTERNAL_ERROR` genérico + `correlation_id`. | E2E-10; doc 01 §6. |
| D-15 | Alternar `id_expediente`/`expediente_id`. | Nomenclatura `id_<agregado>` uniforme en contratos y eventos. | Renombrado en tipos y DDL del grupo. | `grep` de contratos (04 §7). |
| D-16 | Solo `ExpedienteDerivado`. | RutaDoc necesita atención y observación del ciclo. | E-06 y E-07 con contrato formal. | Aprobación bilateral RutaDoc (07). |
| D-17 | Idempotencia en el productor. | Clave compuesta `tipo_evento:id_expediente:id_movimiento` en consumidor. | Índice único y descarte de duplicados. | Doc 04 §6.3. |
| D-18 | Marcar `CONFIRMADO` cruzado. | Ningún contrato cruzado se confirma sin evidencia bilateral. | Reclasificación a `PROPUESTO`/`PENDIENTE`. | Doc 04 §10.2; 07. |
| D-19 | Confiar solo en commits de `B_AREVALO`. | Autoría verificable por integrante en sus ramas. | Declaraciones de autoría con ruta/rama/commit. | Doc 07. |
| D-20 | Prometer entrega exactamente-una-vez. | Al-menos-una-vez + idempotencia del consumidor es realista sin coordinador. | Semántica honesta; validada con worker ejecutable (v1.5). | E2E-12 ejecutado (SKIP LOCKED, no-doble-despacho, FALLIDO). |
| D-21 | Default `gen_random_uuid()` en `correlation_id`. | La BD sin default evita divergencia con el contexto. | Bitácora con UUID del contexto; inserción sin contexto falla. | DDL 06 v1.3; E2E-06. |
| D-22 | FK física hacia `cuenta_usuario(id)`. | Suspendida hasta contrato con IdentiCore (`id_usuario`). | Columna nullable; integridad verificada por aplicación. | 07 (contrato IdentiCore). |
| D-23 | Un solo rol para app y worker. | Separar escritura de bitácora/encolado del despacho. | `sigd_app` vs `sigd_worker` en DDL 06. | DDL 06 v1.3. |

---

## 5. Resumen de Estado por Taxonomía

| Estado | Decisión(es) | Interpretación |
| :--- | :--- | :--- |
| **CONFIRMADO** | D-01…D-04, D-08…D-10, D-14, D-15, D-17, D-18, D-21, D-22, D-23 | Acordado por el equipo y coherente con el plan de mejora; base para implementar (incluidos nomenclatura `id_<agregado>`, idempotencia, gobernanza de estado contractual y las correcciones v1.3). |
| **PARCIAL** | D-06, D-20 (v1.6) | Garantías validadas con prueba ejecutable, pero en **PostgreSQL 16 local** contra el prototipo CoreLink; la ejecución exigida (Testcontainers/PG18 + migraciones reales de los 6 módulos) queda `PENDIENTE`. |
| **PROPUESTO** | D-05, D-11, D-12, D-13 | Propuesta técnica elaborada que requiere validación al implementar o por el grupo propietario. D-05 (inmutabilidad) requiere la prueba de permisos del rol `sigd_app` en el UAT. |
| **PENDIENTE** | D-07 (v1.6: Testcontainers/PG18 no ejecutado), D-16 (RutaDoc), D-19 (autoría); contenido parcial de D-12 (C-06, E-04, E-05, número de expediente) y activación de D-22 (contrato IdentiCore) | Requiere infraestructura (Docker/Testcontainers), confirmación de otro grupo, de las autoridades o la evidencia de autoría de los integrantes. |
| **EJEMPLO** | Payloads y URLs de los documentos 01 a 04 | Dato ficticio de demostración; no representa datos reales de alumnos ni instituciones. |

---

## 6. Registro de Revisión del Sublíder (Ricardo · `B_AREVALO`)

Revisión documental de los entregables del grupo. Cada observación se registra sin reescribir el
trabajo del autor; se solicita corrección al responsable cuando corresponde.

| Entregable | Autor | Resultado de la revisión | Observaciones / Correcciones | Estado |
| :--- | :--- | :--- | :--- | :---: |
| `01_especificacion_middleware_rfc7807.md` | Duque (corrección de autoría, 07 §1.2) | Aprobado con correcciones menores | Convertir a documentación pura; verificar que la jerarquía `AppError` cubre PostgreSQL/Zod y no expone rastros. | CORREGIDO |
| `02_arquitectura_auditoria_contexto_asynclocalstorage.md` | Reátegui | Aprobado con correcciones menores | Convertir a documentación pura; corregir numeración de secciones; confirmar tamaño `user_agent` (D-11). | CORREGIDO |
| `03_suite_pruebas_testcontainers_k6.md` | Zevallos | Aprobado con correcciones menores | Convertir a documentación pura; declarar explícitamente las tablas del `TRUNCATE` y los pasos de evaluación k6. | CORREGIDO |
| `04_contratos_intermodulares_unificados.md` | Ricardo | Elaborado por el sublíder | Revisión v1.2 (PR #79): contratos RutaDoc, nomenclatura `id_*`, idempotencia y aprobación bilateral. | CORREGIDO (v1.2) |
| `05_decisiones_levantamiento_corelink.md` | Ricardo | Elaborado por el sublíder | Log de decisiones y registro de revisión consolidado; nuevas decisiones D-15 a D-19. | CORREGIDO (v1.2) |

### 6.1. Revisión del liderazgo (PR #79) y correcciones aplicadas

| Observación del liderazgo | Corrección aplicada | Estado |
| :--- | :--- | :---: |
| Solo aparece `ExpedienteDerivado` para RutaDoc; faltan `ExpedienteAtendido` y `ExpedienteObservado`. | Incorporados E-06 y E-07 con contrato formal en 04 §6.2. | APLICADA |
| Se alternan `id_expediente` y `expediente_id`. | Nomenclatura normalizada `id_<agregado>` (D-15; 04 §8). | APLICADA |
| Estrategia de idempotencia no resuelta. | Clave compuesta + índice único del consumidor (D-17; 04 §6.3). | APLICADA |
| Contratos `CONFIRMADO` sin aprobación de los grupos propietarios. | Reclasificación a `PROPUESTO`/`PENDIENTE` + registro de aprobación bilateral (D-18; 04 §10.2). | APLICADA |
| Commits del PR #79 solo desde `B_AREVALO`; falta trazabilidad de Duque, Reátegui y Zevallos. | Registro de autoría y plantilla de declaración (D-19; 04 §10.1 / 07). | EN GESTIÓN |
| `correlation_id` con `DEFAULT gen_random_uuid()` podía divergir del valor del contexto. | Sin default en la BD; se propaga siempre desde AsyncLocalStorage (D-21; DDL 06 v1.3). | APLICADA |
| FK física a `sigd_auth.cuenta_usuario(id)` sin contrato aprobado con IdentiCore. | FK SUSPENDIDA hasta contrato bilateral; IdentiCore/RutaDoc usan `id_usuario` (D-22). | APLICADA |
| Permisos que no separaban aplicación del worker Outbox. | Roles `sigd_app` y `sigd_worker` separados (D-23; DDL 06 v1.3). | APLICADA |
| Garantías (inmutabilidad, cero pérdida, atomicidad, entrega) marcadas `CONFIRMADO` sin prueba ejecutable. | D-05, D-06 y D-20 a `PROPUESTO` hasta evidencia E2E (03/08). | APLICADA — **v1.5:** D-06 y D-20 pasan a `CONFIRMADO` con E2E-07/E2E-12; D-05 permanece `PROPUESTO` (inmutabilidad no ejercitada en el prototipo). |
| D-12 con estado combinado (`PROPUESTO`/`PENDIENTE`). | Estado único `PROPUESTO` con parciales pendientes listados (v1.3). | APLICADA |
| Decisiones sin alternativa, justificación, impacto ni evidencia. | Sección 4.3 de detalle ADR completa (D-01…D-23). | APLICADA |

### 6.2. Conformidad final

| Rol | Responsable | Acción | Estado |
| :--- | :--- | :--- | :---: |
| Sublíder CoreLink | Ricardo · `B_AREVALO` | Aplicar las correcciones v1.3 y, **cuando el profesor lo autorice**, reabrir/crear el PR con la base `B_GERIC` actualizada y la evidencia completa. | EN CURSO |
| Sublíderes RutaDoc / TramiCore / DocuCore | Según contrato | Enviar la evidencia de aprobación requerida en 04 §10.2. | PENDIENTE |
| Líder General | Geric · `B_GERIC` | Revisar y decidir la integración final del subgrupo. | PENDIENTE |

---

## 7. Riesgos y Pendientes del Grupo

| # | Pendiente / Riesgo | Impacto | Responsable | Evidencia para cerrar | Estado |
| :--- | :--- | :--- | :--- | :--- | :---: |
| R-01 | Nombre de esquemas `sigd_*` no unificado en los 6 DDL. | Fallas de migración y E2E. | Todos / Zevallos | Migraciones en la suite (entregable 03). | EN GESTIÓN |
| R-02 | Contrato del `numero` de expediente sin confirmar. | C-01 inconsistente para RutaDoc. | TramiCore / Ricardo | Confirmación del `ExpedienteContract`. | PENDIENTE |
| R-03 | Consumidores de Outbox sin idempotencia. | Duplicados de notificación. | Cada consumidor / Ricardo | Revisión de E-01 a E-07. | EN GESTIÓN |
| R-04 | Módulos sin RFC 7807. | Contrato de error roto. | Todos / Duque | E2E-02/03/08/09/10. | EN GESTIÓN |
| R-05 | Confirmar límites de paginación. | Contrato `Paginacion*` incompleto. | Ricardo | Acuerdo entre módulos (D-13). | PENDIENTE |
| R-06 | Reutilizar `expediente_id` en contratos de CoreLink. | Rompe el contrato normalizado `id_*`. | Ricardo / todos | Grep de contratos y eventos en 04 §7. | EN GESTIÓN |
| R-07 | RutaDoc opera sin eventos de atención/observación. | RutaDoc no recibe retorno del ciclo expediente. | RutaDoc / Ricardo | Aprobación bilateral de E-06 y E-07 (04 §10.2). | PENDIENTE |
| R-08 | Autoría de Reátegui, Zevallos y Duque no verificable en los commits del PR #79. | Trazabilidad del trabajo en equipo exigida por el liderazgo. | Duque / Reátegui / Zevallos | Declaraciones de autoría con rama y commit (07). | PENDIENTE |
| R-09 | FK `usuario_id` suspendida sin contrato IdentiCore. | Sin integridad referencial de identidad mientras no se active. | Ricardo | Contrato bilateral aprobado y excepción (`ALTER TABLE`) registrada (07). | PENDIENTE |
| R-10 | Evidencia E2E/k6 sin ejecutar. | Garantías y umbrales no demostrados; bloquea `CONFIRMADO`. | Zevallos / Ricardo | **v1.6:** la evidencia E2E/k6 se ejecutó, pero en **PostgreSQL 16 local** contra el prototipo CoreLink (E2E 12/12 archivos · **23/23** casos · EXIT_CODE=0; k6 P95 150.96 / 144.64 ms < 200 ms · 0 % errores · EXIT_CODE=0). Artefactos: `implementacion/evidencia/e2e-20260909-204737/` y `implementacion/evidencia/k6-20260909-145820/`. **Permanecerá `PENDIENTE`** hasta re-ejecutar en Testcontainers/PostgreSQL 18 con las migraciones reales de los 6 módulos. | PENDIENTE (avance parcial) |

---

## 8. Guía de Avance para el Grupo (Checklist de Cierre de la Fase 2)

1. [ ] Confirmar D-11, D-12 y D-13 con los grupos propietarios y actualizar este log.
2. [ ] Difundir los entregables 01 a 08 a los equipos de los 6 módulos.
3. [ ] Recoger la aprobación bilateral del contrato RutaDoc (04 §6.2/§10.2) de TramiCore, DocuCore y RutaDoc.
4. [ ] Recoger las declaraciones de autoría de Duque, Reátegui y Zevallos (07) con rama y commit.
5. [x] Ejecutar la evidencia E2E/k6 y adjuntar reportes (logs, timestamps, exit codes, P95, error
       rate). **Ejecutado (parcial):** E2E 12/12 · **23/23** con `TEST_DATABASE_URL` y k6 2/2 dentro de
       umbrales — `implementacion/evidencia/e2e-20260909-204737/` y `implementacion/evidencia/k6-20260909-145820/`
       (runbook 08). **Pendiente:** re-ejecución en Testcontainers/PG18 (R-10).
5b. [ ] Reforzar la **sanitización de evidencias**: capturar con `[Console]::OutputEncoding = UTF8`,
       sin códigos ANSI, sin rutas personales ni stack traces en los logs versionados (runbook 08 §6.1), y
       explicar la semántica de los booleans `thresholds` de k6 (`false` = umbral NO incumplido; la señal
       autoritativa es EXIT_CODE y la marca de consola) en el resumen.txt de cada corrida (corrección 9).
6. [ ] Reconciliar `B_AREVALO` con `origin/B_GERIC` (4 commits de base) sin perder las correcciones v1.3.
7. [ ] **No reabrir el PR hasta que el profesor lo autorice** tras cancelar el PR #79.
8. [ ] Registrar la revisión final de Geric (`B_GERIC`) en la sección 6.2.
9. [ ] Actualizar este documento ante cada nuevo cambio de estado (CONFIRMADO / PROPUESTO / PENDIENTE).

---

## 9. Criterios de Aceptación del Documento

| # | Criterio | Cumple |
| :---: | :--- | :---: |
| 1 | Todas las decisiones de la Fase 2 quedan registradas con número, contexto y estado. | ✅ |
| 2 | Las decisiones se diferencian por taxonomía oficial (`CONFIRMADO`/`PROPUESTO`/`PENDIENTE`). | ✅ |
| 3 | Se documenta la revisión del sublíder sobre los entregables 01 a 04 sin apropiarse del trabajo ajeno. | ✅ |
| 4 | Riesgos y pendientes tienen responsable y evidencia de cierre. | ✅ |
| 5 | El documento sirve como evidencia para la revisión y conformidad de Geric. | ✅ |
| 6 | Se registran las decisiones D-15 a D-19 de la revisión del liderazgo (nomenclatura, idempotencia, estados y autoría). | ✅ |
| 7 | Riesgos y pendientes de autoría (R-08) y aprobación bilateral (R-07) tienen responsable y evidencia de cierre. | ✅ |
| 8 | Las garantías de inmutabilidad, cero pérdida, atomicidad y entrega están en `PROPUESTO` hasta tener pruebas E2E (v1.3). | ✅ |
| 9 | Todas las decisiones incluyen alternativa, justificación, impacto y evidencia (§4.3). | ✅ |
| 10 | Cada decisión tiene un estado único y la taxonomía no mezcla estados (v1.3). | ✅ |

---

## 10. Dependencias y Decisiones

- **Dependencias:** consolida las decisiones de los entregables 01 (Duque), 02 (Reátegui), 03
  (Zevallos) y 04 (Ricardo). Cualquier cambio de decisión en uno de ellos debe reflejarse aquí.
- **Decisiones registradas:**
  - La revisión del sublíder se limita a observaciones y solicitudes de corrección; la autoría de cada
    entregable permanece en su rama.
  - Este log se actualiza de forma continua durante la Fase 2 y queda como evidencia histórica del
    Grupo 6.

---

*Documento elaborado por Ricardo (`B_AREVALO`) como entregable de Fase 2 — Levantamiento de
Observaciones del Grupo 6 CoreLink. Revisión 1.2: atiende las observaciones del liderazgo sobre el
PR #79 con las decisiones D-15 a D-19 (nomenclatura `id_<agregado>`, eventos RutaDoc, idempotencia,
estado contractual por aprobación bilateral y trazabilidad de autoría en los commits). Revisión 1.3:
corrige la revisión del liderazgo tras la cancelación del PR #79 (garantías a `PROPUESTO` hasta
pruebas E2E, D-12 con estado único, detalle ADR en §4.3 y decisiones D-20 a D-23). Revisión 1.4:
atribuciones a Duque y separación de migraciones en la suite (P3/P10). Revisión 1.5: D-06 (atomicidad
y cero pérdida) y D-20 (entrega al-menos-una-vez) pasan a `CONFIRMADO` con la evidencia E2E ejecutada;
D-05 (inmutabilidad) se acota a `PROPUESTO` pendiente de la prueba de permisos `sigd_app` en UAT; el
riesgo R-10 queda `CERRADO` con la carga k6 ejecutada (P95 < 200 ms, 0 % errores). **Revisión 1.6
(REQUIERE CORRECCIONES):** D-06 y D-20 bajan a **`PARCIAL`** y D-07 queda `PENDIENTE` porque la
evidencia se ejecutó en PostgreSQL 16 local contra el prototipo CoreLink; R-10 pasa a `PENDIENTE
(avance parcial)` con e2e-20260909-204737 (23/23); se aclara la semántica de `thresholds` de k6 y la
exigencia de `DATABASE_URL` explícita; se eliminan las celdas con estado combinado `PROPUESTO/PENDIENTE`
(D-12/D-18) y los eventos RutaDoc permanecen `PENDIENTE` con productor RutaDoc.*