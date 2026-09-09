# REGISTRO DE DECISIONES DEL LEVANTAMIENTO — CORE-LINK
## Grupo 6 "CoreLink" · Integración, Calidad y Pruebas del Backend — SIGD

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)
**Institución:** IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI
**Área:** Backend — CoreLink
**Responsable del entregable:** Ricardo · `B_AREVALO`
**Documento:** `05_decisiones_levantamiento_corelink.md`
**Fecha:** 8 de septiembre de 2026
**Versión:** 1.2 (Revisión del Liderazgo — PR #79 · Cierre contractual y evidencia de autoría)

> [!NOTE]
> Este documento es una **especificación de referencia**. No contiene instrucciones ejecutables ni
> código listo para correr; es el **log de decisiones (ADR)** del Grupo 6 durante la Fase 2.
> Consolida las decisiones técnicas tomadas, su estado según la taxonomía oficial y el registro de
> revisión del sublíder sobre los entregables 01 a 04 del grupo.

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
| D-01 | 03/09/2026 | Necesidad de un estándar de errores internacional y vigente. | Adoptar **RFC 9457** manteniendo compatibilidad con RFC 7807, con los 8 campos especificados. | CONFIRMADO | Azareño |
| D-02 | 03/09/2026 | Evitar respuestas HTTP dispersas en cada módulo. | Todo módulo **lanza** la jerarquía `AppError` al detectar un error; solo el middleware global serializa a HTTP. | CONFIRMADO | Azareño |
| D-03 | 03/09/2026 | Propagar contexto sin ensuciar firmas de métodos. | Usar **una única instancia de AsyncLocalStorage** compartida vía `shared`; cada solicitud crea su almacén. | CONFIRMADO | Reátegui |
| D-04 | 03/09/2026 | Correlacionar solicitudes de punta a punta. | `correlation_id` es **UUIDv4**; se acepta del header `x-correlation-id` o se genera; siempre se devuelve en la respuesta. | CONFIRMADO | Azareño |
| D-05 | 03/09/2026 | Auditoría inmutable y reconstrucción de estados. | Bitácora **append-only** (`sigd_audit.bitacora_auditoria`) con `datos_antes/datos_despues` en `JSONB`; revocar `UPDATE/DELETE` al rol de aplicación. | CONFIRMADO | Reátegui |
| D-06 | 03/09/2026 | Evitar pérdida de notificaciones ante caídas externas. | Patrón **Transactional Outbox** en `sigd_audit.evento_outbox`; el worker usa lote y `FOR UPDATE SKIP LOCKED`, confirma antes de marcar `PROCESADO`, con backoff exponencial y DLQ. | CONFIRMADO | Reátegui |
| D-07 | 03/09/2026 | Pruebas de integración reproducibles y sin mocks de datos. | Entorno efímero con **Testcontainers (PostgreSQL 18 Alpine)** + migraciones de los 6 esquemas y `TRUNCATE ... CASCADE` entre escenarios. | CONFIRMADO | Zevallos |
| D-08 | 03/09/2026 | Aptitud de rendimiento antes de producción. | Umbrales k6: **P95 < 200 ms** y **tasa de errores < 0.1 %**; escenarios de radicación (100 VU) y derivación (50 VU). | CONFIRMADO | Zevallos |
| D-09 | 03/09/2026 | Unificar los nombres de esquemas entre los 6 DDL. | Nomenclatura consolidada `sigd_auth`, `sigd_org`, `sigd_doc`, `sigd_tra`, `sigd_rut`, `sigd_audit`, reemplazando variantes anteriores. | CONFIRMADO | Ricardo |
| D-10 | 03/09/2026 | Mutaciones legítimas sin sesión de usuario (migraciones, máquina-a-máquina). | `usuario_id` es **nullable** en la bitácora; la ausencia se documenta y no se trata como inconsistencia. | CONFIRMADO | Reátegui |
| D-11 | 03/09/2026 | Tamaño de `user_agent` y nombres de índices. | Propuesta de `VARCHAR(512)` y de índices específicos; sujetos a confirmación al implementar. | PROPUESTO | Reátegui |
| D-12 | 03/09/2026 (v1.2) | Contratos entre módulos y eventos. | Matrices Productor-Consumidor C-01 a C-08 y eventos E-01 a E-07 (v1.2). Los contratos propios de CoreLink (C-07, C-08) están `CONFIRMADO`; los cruzados quedan `PROPUESTO`/`PENDIENTE` hasta la aprobación bilateral (04 §10.2). | PROPUESTO / PENDIENTE | Ricardo |
| D-13 | 03/09/2026 | Límites de paginación y ordenamiento común. | Definir `pagina`/`por_pagina`/`total`/`datos` en `shared/types`; tamaño mínimo/máximo de página aún por confirmar. | PROPUESTO | Ricardo |
| D-14 | 03/09/2026 | Cumplimiento del estándar con ejemplo de falla crítica. | Respuesta `500 INTERNAL_ERROR` genérica; el detalle completo solo a logs internos con el `correlation_id`. | CONFIRMADO | Azareño |
| D-15 | 08/09/2026 | Se alternaba `id_expediente` con `expediente_id` en contratos y eventos. | Nomenclatura normalizada **`id_<agregado>`** en todos los contratos de datos y eventos (`id_expediente`, `id_movimiento`, `id_cuenta`, `id_area_*`). | CONFIRMADO (propio) | Ricardo |
| D-16 | 08/09/2026 | Faltaban `ExpedienteAtendido` y `ExpedienteObservado` para RutaDoc. | Incorporar los tres eventos de RutaDoc (`ExpedienteDerivado`, `ExpedienteAtendido`, `ExpedienteObservado`) con contrato formal (04 §6.2). | PENDIENTE (aprobación RutaDoc) | Ricardo |
| D-17 | 08/09/2026 | Estrategia de idempotencia no resuelta. | Clave de idempotencia compuesta `tipo_evento:id_expediente:id_movimiento`; el consumidor implementa índice único `(tipo_evento, clave_idempotencia)` y descarta duplicados (04 §6.3). | CONFIRMADO (propio) | Ricardo |
| D-18 | 08/09/2026 | Contratos cruzados marcados `CONFIRMADO` sin aprobación de los grupos propietarios. | Ningún contrato cruzado se marca `CONFIRMADO` sin evidencia bilateral; los pendientes quedan `PROPUESTO`/`PENDIENTE` hasta la aprobación documentada (04 §10.2). | CONFIRMADO (propio) | Ricardo |
| D-19 | 08/09/2026 | Los commits de PR #79 provienen únicamente de la cuenta `B_AREVALO`. | Exigir declaración de autoría (ruta, rama, commit/PR, definición, confirmación de estado) de Duque, Reátegui y Zevallos; incorporar registro de evidencia (04 §10.1). | PENDIENTE | Todos |

---

## 5. Resumen de Estado por Taxonomía

| Estado | Decisión(es) | Interpretación |
| :--- | :--- | :--- |
| **CONFIRMADO** | D-01…D-10, D-14, D-15, D-17, D-18 | Acordado por el equipo y coherente con el plan de mejora; base para implementar (incluidos nomenclatura `id_<agregado>`, idempotencia y gobernanza de estado contractual). |
| **PROPUESTO** | D-11, D-12 (parcial), D-13 | Propuesta técnica elaborada que requiere validación al implementar o por el grupo propietario. |
| **PENDIENTE** | D-12 (parcial: C-06, E-04, E-05, número de expediente), D-16 (RutaDoc), D-19 (autoría) | Requiere confirmación de otro grupo, de las autoridades o la evidencia de autoría de los integrantes. |
| **EJEMPLO** | Payloads y URLs de los documentos 01 a 04 | Dato ficticio de demostración; no representa datos reales de alumnos ni instituciones. |

---

## 6. Registro de Revisión del Sublíder (Ricardo · `B_AREVALO`)

Revisión documental de los entregables del grupo. Cada observación se registra sin reescribir el
trabajo del autor; se solicita corrección al responsable cuando corresponde.

| Entregable | Autor | Resultado de la revisión | Observaciones / Correcciones | Estado |
| :--- | :--- | :--- | :--- | :---: |
| `01_especificacion_middleware_rfc7807.md` | Azareño | Aprobado con correcciones menores | Convertir a documentación pura; verificar que la jerarquía `AppError` cubre PostgreSQL/Zod y no expone rastros. | CORREGIDO |
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
| Commits del PR #79 solo desde `B_AREVALO`; falta trazabilidad de Duque, Reátegui y Zevallos. | Registro de autoría y plantilla de declaración (D-19; 04 §10.1). | EN GESTIÓN |

### 6.2. Conformidad final

| Rol | Responsable | Acción | Estado |
| :--- | :--- | :--- | :---: |
| Sublíder CoreLink | Ricardo · `B_AREVALO` | Actualizar PR #79 con los entregables v1.2 y la evidencia de aprobación bilateral. | EN CURSO |
| Sublíderes RutaDoc / TramiCore / DocuCore | Según contrato | Enviar la evidencia de aprobación requerida en 04 §10.2. | PENDIENTE |
| Líder General | Geric · `B_GERIC` | Revisar y decidir la integración final del subgrupo. | PENDIENTE |

---

## 7. Riesgos y Pendientes del Grupo

| # | Pendiente / Riesgo | Impacto | Responsable | Evidencia para cerrar | Estado |
| :--- | :--- | :--- | :--- | :--- | :---: |
| R-01 | Nombre de esquemas `sigd_*` no unificado en los 6 DDL. | Fallas de migración y E2E. | Todos / Zevallos | Migraciones en la suite (entregable 03). | EN GESTIÓN |
| R-02 | Contrato del `numero` de expediente sin confirmar. | C-01 inconsistente para RutaDoc. | TramiCore / Ricardo | Confirmación del `ExpedienteContract`. | PENDIENTE |
| R-03 | Consumidores de Outbox sin idempotencia. | Duplicados de notificación. | Cada consumidor / Ricardo | Revisión de E-01 a E-07. | EN GESTIÓN |
| R-04 | Módulos sin RFC 7807. | Contrato de error roto. | Todos / Azareño | E2E-02/03/08/09/10. | EN GESTIÓN |
| R-05 | Confirmar límites de paginación. | Contrato `Paginacion*` incompleto. | Ricardo | Acuerdo entre módulos (D-13). | PENDIENTE |
| R-06 | Reutilizar `expediente_id` en contratos de CoreLink. | Rompe el contrato normalizado `id_*`. | Ricardo / todos | Grep de contratos y eventos en 04 §7. | EN GESTIÓN |
| R-07 | RutaDoc opera sin eventos de atención/observación. | RutaDoc no recibe retorno del ciclo expediente. | RutaDoc / Ricardo | Aprobación bilateral de E-06 y E-07 (04 §10.2). | PENDIENTE |
| R-08 | Autoría de Reátegui, Zevallos y Duque no verificable en los commits del PR #79. | Trazabilidad del trabajo en equipo exigida por el liderazgo. | Duque / Reátegui / Zevallos | Declaraciones de autoría con rama y commit (04 §10.1). | PENDIENTE |

---

## 8. Guía de Avance para el Grupo (Checklist de Cierre de la Fase 2)

1. [ ] Confirmar D-11, D-12 y D-13 con los grupos propietarios y actualizar este log.
2. [ ] Difundir los entregables 01 a 04 a los equipos de los 6 módulos.
3. [ ] Recoger la aprobación bilateral del contrato RutaDoc (04 §6.2/§10.2) de TramiCore, DocuCore y RutaDoc.
4. [ ] Recoger las declaraciones de autoría de Duque, Reátegui y Zevallos (04 §10.1) con rama y commit.
5. [ ] Elaborar el PR de integración en `B_AREVALO` con los commits individuales verificables.
6. [ ] Registrar la revisión final de Geric (`B_GERIC`) en la sección 6.2.
7. [ ] Actualizar este documento ante cada nuevo cambio de estado (CONFIRMADO / PROPUESTO / PENDIENTE).

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

---

## 10. Dependencias y Decisiones

- **Dependencias:** consolida las decisiones de los entregables 01 (Azareño), 02 (Reátegui), 03
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
estado contractual por aprobación bilateral y trazabilidad de autoría en los commits).*