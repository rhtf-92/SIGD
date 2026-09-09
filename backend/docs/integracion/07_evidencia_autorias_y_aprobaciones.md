# 07 · Evidencia de Autorías y Aprobaciones Bilaterales del Grupo 6 CoreLink

**Entregable:** 07 — Registro de trazabilidad de autoría y aprobación contractual
**Responsable:** Ricardo (`B_AREVALO`) — Sublíder Grupo 6 CoreLink (Integración, Calidad y Pruebas)
**Fecha:** 8 de septiembre de 2026
**Motivo:** Cumplir la observación del liderazgo sobre el **PR #79** (todos los commits provienen de la
cuenta `B_AREVALO`, sin trazabilidad de Duque, Reátegui y Zevallos) y el requisito de que cada
sublíder declare la **autoría** y el **estado contractual** de su entregable. Complementa la sección
10 del entregable 04 y la sección 6.1 del entregable 05.

> [!NOTE]
> Este documento es la **plantilla oficial y el registro vivo** del grupo para reportar al liderazgo:
> (1) ruta del archivo, (2) rama, (3) commit/PR, (4) definición exacta del entregable, (5) explicación
> de autoría y (6) confirmación del estado del contrato. Cada sublíder completa su fila; solo la
> aprobación bilateral documentada en la sección 2 cambia un contrato de `PROPUESTO`/`PENDIENTE` a
> `CONFIRMADO`.

## 1. Registro de autoría por integrante del Grupo 6

| # | Entregable y ruta | Autor / rama | Commit / PR | Definición exacta | Explicación de autoría | Estado contractual confirmado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `01_especificacion_middleware_rfc7807.md` | Azareño (`B_AZAREÑO`) | <commit/PR pendiente> | Especificación de la respuesta de error RFC 7807/9457 y la jerarquía de excepciones (7 clases) que no exponen rastros internos. | Azareño declara elaborar el contenido y acepta que el commit se publique desde la cuenta `B_AREVALO` por su sublíder. | CONFIRMADO
| 2 | `02_arquitectura_auditoria_contexto_asynclocalstorage.md` | Reátegui (`B_REATEGUI`) | <commit/PR pendiente> | Arquitectura del contexto por solicitud (AsyncLocalStorage) y del patrón Transactional Outbox, con bitácora `sigd_audit.bitacora_auditoria` (incluye `fecha_hora`) y `evento_outbox` versionado (envelope v1.2, §§6.7–6.8). | Reátegui declara elaborar el contenido y acepta que el commit se publique desde la cuenta `B_AREVALO` por su sublíder. | CONFIRMADO
| 3 | `03_suite_pruebas_testcontainers_k6.md` | Zevallos (`B_ZEVALLOS`) | <commit/PR pendiente> | Suite de 10 casos E2E (Testcontainers) y 2 escenarios de carga k6 sobre los entregables 01, 02, 04 y el esquema `06_sigd_audit_esquema_ddl.sql`. | Zevallos declara elaborar el contenido y acepta que el commit se publique desde la cuenta `B_AREVALO` por su sublíder. | CONFIRMADO
| 4 | `04_contratos_intermodulares_unificados.md` (v1.2) | Ricardo (`B_AREVALO`) | <commit/PR pendiente> | Matriz de contratos C-01…C-08 y eventos E-01…E-07, término del contrato RutaDoc §6.2 (14 requisitos), idempotencia §6.3, registros de autoría y aprobación §10. | Elaborado por el sublíder; incluye la síntesis de las observaciones de los tres integrantes. | Ver sección 2.
| 5 | `05_decisiones_levantamiento_corelink.md` (v1.2) | Ricardo (`B_AREVALO`) | <commit/PR pendiente> | Log de decisiones D-01…D-19 y registro de revisión del sublíder y del liderazgo (PR #79), riesgos R-01…R-08. | Elaborado por el sublíder consolidando aportes del grupo. | Ver sección 2.
| 6 | `06_sigd_audit_esquema_ddl.sql` | Ricardo (`B_AREVALO`) | <commit/PR pendiente> | DDL canónico del esquema `sigd_audit` (`bitacora_auditoria` con `fecha_hora`, `evento_outbox`, 6 índices, rol `sigd_app` de solo INSERT/SELECT, REVOKE UPDATE/DELETE). | Aprobado por Reátegui y Zevallos (fuente de verdad de las migraciones E2E). | CONFIRMADO
| 7 | `implementacion/` (proyecto Node/TS) | Ricardo (`B_AREVALO`) | <commit/PR pendiente> | Código de referencia: errores, middleware RFC 7807, mapeadores PG/Zod, repositorios de auditoría/outbox, OutboxWorker, app Express 5, E2E Testcontainers, k6, README con trazabilidad. | Elaborado por el sublíder con la supervisión de los autores de los entregables 01–03. | Ver contrato de datos (válido solo con la aprobación de CoreLink). |

### 1.1. Declaración del sublíder

> Confirmo que las tablas de la sección 1 contienen la **declaración de autoría de cada integrante**
> pendiente de firma, que se adjuntará al PR #79 junto con la ruta, rama y commit de cada archivo.

**Firma Ricardo (`B_AREVALO`):** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ — **Fecha:** \_\_/\_\_/2026
**Firma Azareño (`B_AZAREÑO`):** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ — **Fecha:** \_\_/\_\_/2026
**Firma Reátegui (`B_REATEGUI`):** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ — **Fecha:** \_\_/\_\_/2026
**Firma Zevallos (`B_ZEVALLOS`):** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ — **Fecha:** \_\_/\_\_/2026

## 2. Registro de aprobaciones bilaterales (contratos intermodulares)

Regla (entregable 04 §10.2, decisión D-18): **ningún contrato cruzado pasa a `CONFIRMADO` sin la
aprobación escrita de los dos grupos involucrados.** El sublíder de cada grupo confirma: archivo
revisado, rama/commit, definición aceptada y el estado contractual resultante.

| Contrato / evento | Grupo propietario | Grupo dependiente | Aprobación del propietario | Aprobación del dependiente | Estado resultante |
| :--- | :--- | :--- | :--- | :--- | ---: |
| C-02 / E-03 (`UsuarioRegistrado`) | IdentiCore | CoreLink (notificador) | PENDIENTE | Ricardo: PENDIENTE | PROPUESTO |
| C-04 / E-04 (`RequisitoValidado`) | DocuCore | TramiCore | PENDIENTE | PENDIENTE | PROPUESTO |
| C-05 / E-02 · E-05 · E-06 · E-07 (RutaDoc) | **RutaDoc** | TramiCore · CoreLink | PENDIENTE | PENDIENTE | PROPUESTO |
| C-06 / C-07 / C-08 (CoreLink → módulos) | CoreLink | Según módulo | Ricardo: PENDIENTE | PENDIENTE | PROPUESTO |

Fechas y evidencias de cada aprobación (captura de chat/confirmación por correo) se adjuntarán al
PR #79 conforme se reciban.

## 3. Checklist de cierre para el PR #79

- [ ] Completar commit/PR de cada fila de la sección 1 con la rama correspondiente.
- [ ] Obtener la firma (o confirmación por chat/correo) de Azareño, Reátegui y Zevallos (§1.1).
- [ ] Recibir la aprobación bilateral del contrato RutaDoc de los sublíderes involucrados (§2) y
      actualizar 04 §10.2 / 05 §6.2.
- [ ] Adjuntar esta plantilla y las evidencias como anexos del PR #79.
- [ ] Actualizar este documento en cuanto cambie cualquier estado.

---

*Registro elaborado por Ricardo (`B_AREVALO`) para la revisión del liderazgo del PR #79. Alineado
con los entregables 04 (§10) y 05 (§6.1).*