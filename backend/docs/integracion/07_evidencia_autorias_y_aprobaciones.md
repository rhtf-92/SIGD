# 07 · Evidencia de Autorías y Aprobaciones Bilaterales del Grupo 6 CoreLink

**Entregable:** 07 — Registro de trazabilidad de autoría y aprobación contractual
**Responsable:** Ricardo (`B_AREVALO`) — Sublíder Grupo 6 CoreLink (Integración, Calidad y Pruebas)
**Fecha:** 9 de septiembre de 2026
**Motivo:** Cumplir la observación del liderazgo sobre el **PR #79** (todos los commits provienen de la
cuenta `B_AREVALO`, sin trazabilidad de Duque, Reátegui y Zevallos) y el requisito de que cada
sublíder declare la **autoría** y el **estado contractual** de su entregable. Complementa la sección
10 del entregable 04 y la sección 6.1 del entregable 05. **Revisión v1.4:** tras la cancelación del
PR #79, registra también la **discrepancia de autoría del entregable 01** (plan Fase 1 → Duque, plan
Fase 2 → Azareño), el **estado de cada corrección exigida** por el liderazgo (sección 3), la
demostración de estado contractual (`PENDIENTE` mientras no haya commit/PR y firma) y la propuesta
formal de eventos RutaDoc (entregable 09). **Revisión v1.5:** consolida el cierre de las correcciones
3 y 5 de la sección 3 con la evidencia ejecutable completa (worker ejecutado en E2E-12 y carga k6
dentro de umbrales, P95 < 200 ms, 0 % errores). **Revisión v1.6 (REQUIERE CORRECCIONES):** la
evidencia E2E/k6 se declara **`PARCIAL`** (ejecutada en PostgreSQL 16 local contra el prototipo
CoreLink; pendiente Testcontainers/PG18 y migraciones reales de los 6 módulos); se amplía E2E-07 a
3 casos (rollback de derivación), se añade la contribución concreta de cada integrante (§1.3) y se
registran las 10 nuevas correcciones (sección 3.1).

> [!NOTE]
> Este documento es la **plantilla oficial y el registro vivo** del grupo para reportar al liderazgo:
> (1) ruta del archivo, (2) rama, (3) commit/PR, (4) definición exacta del entregable, (5) explicación
> de autoría y (6) confirmación del estado del contrato. Cada sublíder completa su fila; solo la
> aprobación bilateral documentada en la sección 2 cambia un contrato de `PROPUESTO`/`PENDIENTE` a
> `CONFIRMADO`.

## 1. Registro de autoría por integrante del Grupo 6

| # | Entregable y ruta | Autor / rama | Commit / PR | Definición exacta | Explicación de autoría | Estado contractual confirmado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `01_especificacion_middleware_rfc7807.md` | Duque (`B_DUQUE`) — plan vigente Fase 1 | <commit/PR pendiente> | Especificación de la respuesta de error RFC 7807/9457 y la jerarquía de excepciones (7 clases) que no exponen rastros internos. | **Atribución corregida:** el plan vigente (Fase 1) asigna el middleware a Duque. Los documentos de Fase 2 lo atribuían a Azareño por error de planificación. No hubo reasignación formal documentada; se mantiene la atribución original del plan. | PENDIENTE (commit/PR y firma) — v1.4
| 2 | `02_arquitectura_auditoria_contexto_asynclocalstorage.md` | Reátegui (`B_REATEGUI`) | <commit/PR pendiente> | Arquitectura del contexto por solicitud (AsyncLocalStorage) y del patrón Transactional Outbox, con bitácora `sigd_audit.bitacora_auditoria` (incluye `fecha_hora`) y `evento_outbox` versionado (envelope v1.2, §§6.7–6.8). | Reátegui declara elaborar el contenido y acepta que el commit se publique desde la cuenta `B_AREVALO` por su sublíder. | PENDIENTE (commit/PR y firma)
| 3 | `03_suite_pruebas_testcontainers_k6.md` | Zevallos (`B_ZEVALLOS`) | <commit/PR pendiente> | Suite de 10 casos E2E (Testcontainers) y 2 escenarios de carga k6 sobre los entregables 01, 02, 04 y el esquema `06_sigd_audit_esquema_ddl.sql`. | Zevallos declara elaborar el contenido y acepta que el commit se publique desde la cuenta `B_AREVALO` por su sublíder. | PENDIENTE (commit/PR y firma)
| 4 | `04_contratos_intermodulares_unificados.md` (v1.3) | Ricardo (`B_AREVALO`) | <commit/PR pendiente> | Matriz de contratos C-01…C-08 y eventos E-01…E-07, término del contrato RutaDoc §6.2 (14 requisitos), idempotencia §6.3, registros de autoría y aprobación §10. | Elaborado por el sublíder; incluye la síntesis de las observaciones de los tres integrantes. | Ver sección 2.
| 5 | `05_decisiones_levantamiento_corelink.md` (v1.3) | Ricardo (`B_AREVALO`) | <commit/PR pendiente> | Log de decisiones D-01…D-23 y registro de revisión del sublíder y del liderazgo, riesgos R-01…R-10. | Elaborado por el sublíder consolidando aportes del grupo. | Ver sección 2.
| 6 | `06_sigd_audit_esquema_ddl.sql` (v1.3) | Ricardo (`B_AREVALO`) | <commit/PR pendiente> | DDL canónico del esquema `sigd_audit` (`bitacora_auditoria` con `fecha_hora`, `evento_outbox`, 6 índices, roles `sigd_app`/`sigd_worker` separados, `correlation_id` **sin default**, FK `usuario_id` SUSPENDIDA por contrato IdentiCore). | Aprobado por Reátegui y Zevallos (fuente de verdad de las migraciones E2E). | PENDIENTE (commit/PR y firma) — v1.4/v1.5

### 1.2. Discrepancia de autoría del entregable 01 (plan Fase 1 vs plan Fase 2)

> **RESUELTO (9 sept 2026):** Se corrige la atribución a **Duque** según el plan vigente (Fase 1).
> No existe reasignación formal documentada a Azareño; la atribución a Azareño en la Fase 2 fue
> un error de planificación. Se mantienen los documentos de Fase 2 como referencia histórica.
>
> - **Plan de Fase 1** (`planes_trabajo/06_plan_trabajo_grupo_6_corelink.md`): integrantes = Ricardo,
>   **Duque**, Reátegui y Zevallos; Duque es responsable de **convenciones de API** (origen del
>   middleware/especificación de errores). ← **ATRIBUCIÓN VIGENTE**
> - **Plan de Fase 2** (`levantamiento_de_observaciones/06_plan_levantamiento_observaciones_grupo_6_corelink.md`):
>   integrantes = Ricardo, **Azareño**, Reátegui y Zevallos; Azareño es responsable de la
>   **especificación del middleware RFC 7807** (D-01, D-02, D-04, D-14). ← ERROR DE PLANIFICACIÓN
>
> **Atribución corregida:** Duque (`B_DUQUE`). Si se requiere reasignación futura, debe documentarse
> formalmente con la firma del integrante afectado.
| 7 | `implementacion/` (proyecto Node/TS) | Ricardo (`B_AREVALO`) | <commit/PR pendiente> | Código de referencia: errores, middleware RFC 7807, mapeadores PG/Zod, repositorios de auditoría/outbox, OutboxWorker, app Express 5, E2E Testcontainers, k6, README con trazabilidad. | Elaborado por el sublíder con la supervisión de los autores de los entregables 01–03. | Ver contrato de datos (válido solo con la aprobación de CoreLink). |

### 1.1. Declaración del sublíder

> Confirmo que las tablas de la sección 1 contienen la **declaración de autoría de cada integrante**
> pendiente de firma, que se adjuntará al próximo PR autorizado junto con la ruta, rama y commit de
> cada archivo.

**Firma Ricardo (`B_AREVALO`):** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ — **Fecha:** \_\_/\_\_/2026
**Firma Duque (`B_DUQUE`):** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ — **Fecha:** \_\_/\_\_/2026
**Firma Reátegui (`B_REATEGUI`):** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ — **Fecha:** \_\_/\_\_/2026
**Firma Zevallos (`B_ZEVALLOS`):** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ — **Fecha:** \_\_/\_\_/2026

### 1.3. Contribuciones efectivas de cada integrante (v1.6)

Para evitar que "el sublíder hizo todo", se declara **transparentemente** qué aportó cada integrante
al entregable y cómo se incorporó (todo se publica desde `B_AREVALO`; el sublíder integra, no autor):

| Integrante | Contribución efectiva | Incorporado en |
| :--- | :--- | :--- |
| Duque (`B_DUQUE`) | Especificación RFC 7807/9457 y jerarquía de excepciones (entregable 01); decisiones D-01, D-02, D-04, D-14 (05); revisión de contratos de error C-01/C-03. | 01, 05 §4 revisiones, 04 C-01/C-03 |
| Reátegui (`B_REATEGUI`) | Arquitectura AsyncLocalStorage + Transactional Outbox (entregable 02); decisiones D-06, D-20, D-21 (05); diseño del DDL `sigd_audit` (entregable 06); validación de los casos de atomicidad E2E-07 (v1.6: rollback de derivación). | 02, 05, 06 §6, 03 §5.7 |
| Zevallos (`B_ZEVALLOS`) | Suite de pruebas Testcontainers + escenarios k6 (entregable 03); decisión D-07 (05); semántica de umbrales k6 y sanitización de logs (v1.6); ejecución de la evidencia E2E/k6 en entorno local. | 03, 05 D-07, 08, `evidencia/` |

> **Estado (R-08 / D-19):** estas contribuciones quedan `PENDIENTE` de la **declaración firmada por
> cada integrante con su rama/commit**; se adjuntará al próximo PR autorizado (sección 1.1).

## 2. Registro de aprobaciones bilaterales (contratos intermodulares)

Regla (entregable 04 §10.2, decisión D-18): **ningún contrato cruzado pasa a `CONFIRMADO` sin la
aprobación escrita de los dos grupos involucrados.** El sublíder de cada grupo confirma: archivo
revisado, rama/commit, definición aceptada y el estado contractual resultante.

| Contrato / evento | Grupo propietario | Grupo dependiente | Aprobación del propietario | Aprobación del dependiente | Estado resultante |
| :--- | :--- | :--- | :--- | :--- | ---: |
| C-02 / E-03 (`UsuarioRegistrado`) | IdentiCore | CoreLink (notificador) | PENDIENTE | Ricardo: PENDIENTE | PROPUESTO |
| C-04 / E-04 (`RequisitoValidado`) | DocuCore | TramiCore | PENDIENTE | PENDIENTE | PROPUESTO |
| C-05 / E-02 · E-05 · E-06 · E-07 (RutaDoc) | **RutaDoc** | TramiCore · CoreLink | PENDIENTE | PENDIENTE | PROPUESTO |

La **propuesta contractual autocontenida** que CoreLink envía a RutaDoc está en el entregable
`09_propuesta_contractual_rutadoc.md` (envelope, bloque `datos`, idempotencia, estados y reintentos).
| C-06 / C-07 / C-08 (CoreLink → módulos) | CoreLink | Según módulo | Ricardo: PENDIENTE | PENDIENTE | PROPUESTO |

Fechas y evidencias de cada aprobación (captura de chat/confirmación por correo) se adjuntarán al
próximo PR autorizado conforme se reciban.

## 3. Correcciones del liderazgo tras la cancelación del PR #79

Registro vivo de cada corrección exigida, responsable y estado. Sustituye al listado informal del
comentario de revisión; las correcciones aplicadas constan en los entregables v1.3.

| # | Corrección exigida | Responsable | Dónde quedó registrada | Estado |
| :---: | :--- | :--- | :--- | :---: |
| 1 | Retirar/posponer la FK a `sigd_auth.cuenta_usuario(id)` sin contrato con IdentiCore (`id_usuario` pendiente). | Reátegui / Ricardo | DDL 06 v1.3; 02 §5.2/§5.3; D-22 | APLICADA (PENDIENTE de contrato) |
| 2 | `correlation_id` no debe generarse en BD sino propagarse desde AsyncLocalStorage. | Reátegui | DDL 06 v1.3; 02 §5.2/§5.3; D-21 | APLICADA |
| 3 | Worker Outbox ejecutable y permisos separados aplicación vs worker. | Reátegui | DDL 06 v1.3 (roles `sigd_app`/`sigd_worker`); 02 §6.8 | APLICADA — worker ejecutado en E2E-12 (concurrencia, `SKIP LOCKED`, no-doble-despacho, reintentos → `FALLIDO`); **v1.6:** distingue errores **transitorios/permanentes** (permanente → `FALLIDO` inmediato, sin reintentar) y el despachador de demostración queda rotulado como no productivo |
| 4 | Atomicidad, cero pérdida, inmutabilidad y entrega como `PROPUESTO` hasta prueba. | Ricardo | 02 §9/§10; 05 D-05/D-06/D-20; 04 C-08 | APLICADA — **v1.6:** D-06/D-20/C-08 → **`PARCIAL`** (E2E-07 campos en **PostgreSQL 16 local** contra el prototipo; pendiente Testcontainers/PG18); D-05 sigue `PROPUESTO` (inmutabilidad no ejercitada en el prototipo) |
| 5 | Evidencia ejecutable: Vitest, Supertest, 12 E2E, k6 (P95, error rate). | Zevallos | Runbook 08 + `implementacion/evidencia/e2e-20260909-204737/` | APLICADA (**PARCIAL**) — E2E 12/12 · **23/23** EXIT 0 (con `TEST_DATABASE_URL`, PostgreSQL 16 local) y carga k6 2/2 EXIT 0 (P95 150.96/144.64 ms, 0 % errores) — `implementacion/evidencia/k6-20260909-145820/`. La ejecución exigida (Testcontainers/PG18 + migraciones reales) queda `PENDIENTE` (R-10) |
| 6 | Aprobación bilateral de contratos y eventos. | Ricardo | 07 §2; 04 §10.2 | PENDIENTE |
| 7 | Decisiones con alternativa, justificación, impacto y evidencia. | Ricardo | 05 §4.3 | APLICADA |
| 8 | D-12 con estado único. | Ricardo | 05 D-12 | APLICADA — v1.6 también D-18 y propuesta 09 con estado único |
| 9 | Discrepancia de autoría del entregable 01 (Duque vs Azareño). | Ricardo / liderazgo | 07 §1.2; 04 §10.1 | APLICADA — Atribución corregida a Duque (plan Fase 1) |
| 10 | Reconciliar `B_AREVALO` con `origin/B_GERIC` (4 commits de base). | Ricardo | Merge aplicado (`5b382e0`) | APLICADA |
| 11 | No reabrir PR hasta autorización del profesor. | Todos | 05 §6.2/§8 | CONTROL |

### 3.1. Segunda revisión del liderazgo (REQUIERE CORRECCIONES) — correcciones aplicadas

Registro de las observaciones de la revisión del 9 de septiembre de 2026 y su estado.

| # | Corrección exigida | Responsable | Dónde quedó registrada | Estado |
| :---: | :--- | :--- | :--- | :---: |
| 12 | Declarar alcance de la suite: valida el **prototipo CoreLink**, no las migraciones realizadas de los 6 módulos. | Ricardo / Zevallos | `tests/setup/global-setup.ts`; 03 §5; 05; 08 §6.2 | APLICADA |
| 13 | Evidencia PG16 local ⇒ estados `PARCIAL`/`PENDIENTE` (no `CONFIRMADO`) hasta Testcontainers/PG18 + migraciones reales. | Zevallos | 04 C-08; 05 D-06/D-07/D-20/R-10; 07 §3 | APLICADA |
| 14 | `x-correlation-id`: aceptar cualquier UUID RFC 4122 (v1–v5); corregir la documentación (header no válido ⇒ se genera v4). | Ricardo | `context-middleware.ts`; 02; 04; 05 D-04 | APLICADA |
| 15 | `DATABASE_URL` explícita, sin fallback ni credenciales implícitas (error claro si falta). | Ricardo | `src/server.ts`; `src/audit/worker/outbox-worker.ts`; `.env.example` (EJEMPLO LOCAL, NO PRODUCTIVO) | APLICADA |
| 16 | Logs versionados sin rutas personales, ANSI, mojibake ni stack traces internos. | Ricardo | `evidencia/` + `resumen.txt`; 08 §6.1; `git diff --check` limpio | APLICADA |
| 17 | Ampliar E2E-07: rollback inducido en `sigd_rut.movimiento_tramite` (derivación), sin persistencia ni bitácora. | Reátegui | `tests/e2e/e2e-07-atomicidad-outbox.test.ts` (3 casos); 03 §5.7 | APLICADA |
| 18 | Eventos RutaDoc (E-02/E-06/E-07): declarar **`PENDIENTE` con productor RutaDoc**, sin implementación en CoreLink. | Ricardo | 04 §6.2; 09 | APLICADA (declarado) |
| 19 | Worker: clasificar errores **transitorios/permanentes** y rotular el despachador de demostración. | Reátegui | `src/audit/outbox-worker.ts`; `src/audit/worker/outbox-worker.ts` | APLICADA |
| 20 | Documentar la semántica de `thresholds` de k6 (`false` = umbral NO incumplido; señal autoritativa = EXIT_CODE + consola). | Zevallos | `evidencia/k6-20260909-145820/resumen.txt`; 03 §6.5; 08 §5.3 | APLICADA |
| 21 | Estado único en celdas y propuesta 09 (eliminar combos `PROPUESTO/PENDIENTE`; donde aplique `PARCIAL`-con-pendiente se redacta con estado único y detalle de la condición). | Ricardo | 05 D-12/D-18; 09; tabla taxonómica §5 | APLICADA |

## 4. Checklist de cierre (cuando el profesor autorice)

- [ ] Completar commit/PR de cada fila de la sección 1 con la rama correspondiente.
- [ ] Obtener la firma (o confirmación por chat/correo) de Duque, Reátegui y Zevallos (§1.1).
- [ ] Recibir la aprobación bilateral del contrato RutaDoc de los sublíderes involucrados (§2) y
      actualizar 04 §10.2 / 05 §6.2.
- [x] Ejecutar la evidencia E2E/k6 y adjuntar reportes. **Ejecutado (parcial)** (runbook 08): E2E 12/12 ·
      **23/23** con `TEST_DATABASE_URL` y carga k6 2/2 dentro de umbrales —
      `implementacion/evidencia/e2e-20260909-204737/` y `implementacion/evidencia/k6-20260909-145820/`.
      La suite se ejecutó en **PostgreSQL 16 local** contra el prototipo CoreLink; la ejecución exigida
      (Testcontainers/PG18 + migraciones reales de los 6 módulos) queda `PENDIENTE` (R-10).
- [ ] Pedir la declaración firmada de Duque, Reátegui y Zevallos con su rama/commit (§1.3 / R-08).
- [ ] Reconciliar `B_AREVALO` con `origin/B_GERIC` antes de reabrir el PR.
- [ ] Adjuntar esta plantilla y las evidencias como anexos del PR autorizado.
- [ ] Actualizar este documento en cuanto cambie cualquier estado.

---

*Registro elaborado por Ricardo (`B_AREVALO`) para la revisión del liderazgo del PR #79 (cancelado).
Alineado con los entregables 04 (§10), 05 (§6.1/§6.2), 09 (propuesta RutaDoc) y el runbook 08.
Revisión v1.4: incorpora la discrepancia de autoría del entregable 01, el registro de correcciones de
la revisión, la taxonomía `PENDIENTE` de autorías sin evidencia y la propuesta contractual 09.
Revisión v1.5: consolida el cierre de la corrección 3 (worker ejecutado en E2E-12) y de la corrección
5 (evidencia E2E 12/12 + carga k6 2/2 dentro de umbrales). Revisión v1.6 (REQUIERE CORRECCIONES):
baja la evidencia a `PARCIAL` (PostgreSQL 16 local, prototipo CoreLink; Testcontainers/PG18
`PENDIENTE`), registra las correcciones 12–21 (§3.1), la contribución efectiva de cada integrante
(§1.3), E2E-07 ampliado a 3 casos y las referencias a `e2e-20260909-204737/` (23/23).*