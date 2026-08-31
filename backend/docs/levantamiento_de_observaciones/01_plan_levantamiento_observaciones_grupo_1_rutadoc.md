# PLAN DE TRABAJO: LEVANTAMIENTO DE OBSERVACIONES
## Grupo 1 “RutaDoc” · Trazabilidad, Recepción, Derivación y Atención

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Institución:** IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI  
**Área:** Backend  
**Líder General:** Geric · `B_GERIC`  
**Integrantes:** Geric (`B_GERIC`), Jacobo (`B_JACOBO`), Jhasy (`B_JHASY`)  
**Fecha:** 30 de agosto de 2026  
**Versión:** 2.0 (Fase 2 — Reingeniería Arquitectural y Desacoplamiento)  
**Ubicación:** `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md`

---

## 1. Objetivo del Levantamiento de Observaciones

Subsanar las observaciones críticas de arquitectura identificadas en el diagnóstico senior, migrando la lógica de negocio y la orquestación de transiciones de estado desde los triggers PL/pgSQL hacia la Capa de Dominio en TypeScript (**State Pattern**), eliminando los bloqueos globales de concurrencia (`pg_advisory_xact_lock`), implementando el patrón **Transactional Outbox** para notificaciones asíncronas y particionando la tabla histórica `movimiento_tramite` por año fiscal.

---

## 2. Alcance Específico de las Mejoras

1. **Desacoplamiento de la Máquina de Estados:**
   - Modelar las 13 transiciones y 10 estados en clases y Value Objects en TypeScript puro dentro de `src/modules/trazabilidad_rutas/domain/`.
   - Reducir el trigger de base de datos para que únicamente garantice **inmutabilidad estricta** (rechazo de `UPDATE` y `DELETE` sobre movimientos) y validación de claves compuestas.
2. **Eliminación de Contención Concurrente:**
   - Suprimir el uso de `pg_advisory_xact_lock` a nivel de base de datos completa.
   - Implementar control de concurrencia pesimista por fila de expediente (`SELECT ... FOR UPDATE` sobre el registro específico del expediente en `sigd_tra.expediente`).
3. **Implementación del Patrón Transactional Outbox:**
   - Incorporar la tabla `sigd_audit.evento_outbox` en las transacciones de derivación, atención y observación para registrar eventos de dominio atómicos (`ExpedienteDerivado`, `ExpedienteAtendido`, `ExpedienteObservado`).
4. **Particionamiento Anual de Movimientos:**
   - Definir el DDL de `sigd_rut.movimiento_tramite` con particionamiento por rango de fecha (`PARTITION BY RANGE (fecha_hora)`), creando las particiones anuales `movimiento_tramite_2026`, `movimiento_tramite_2027`.

---

## 3. Límites y Criterios de Validación

- No se alterará el principio de inmutabilidad histórica: ningún movimiento registrado podrá ser editado o eliminado.
- La tabla de proyección `sigd_rut.estado_actual_tramite` se actualizará de forma determinista dentro de la misma transacción del caso de uso.
- Toda decisión técnica se etiquetará según la taxonomía oficial: `CONFIRMADO`, `PROPUESTO`, `PENDIENTE` o `EJEMPLO`.

---

## 4. Organización del Equipo y Ramas Git

| Integrante | Rama Personal | Rol / Responsabilidad en Levantamiento | Entregable Principal |
| :--- | :--- | :--- | :--- |
| **Geric** | `B_GERIC` | Líder General y Arquitecto | Modelo de datos v2.0, diseño de agregados de dominio y consolidación. |
| **Jacobo** | `B_JACOBO` | Analista Funcional | Especificación formal del State Pattern y matriz de eventos Outbox. |
| **Jhasy** | `B_JHASY` | Implementadora SQL y QA | Script DDL particionado, simplificación de triggers y pruebas de concurrencia. |

---

## 5. Responsabilidades Individuales Detalladas

### Jacobo (`B_JACOBO`)
- Redactar `01_analisis_dominio_transiciones_rutadoc.md`, detallando las reglas de la máquina de estados en el dominio, validaciones previas a la persistencia y definición de eventos de dominio Outbox con su respectivo payload JSON.
- Documentar los casos de prueba de concurrencia de derivaciones simultáneas hacia diferentes áreas.

### Geric (`B_GERIC`)
- Diseñar `02_modelo_datos_rutadoc_v2.md` y `02_diccionario_datos_rutadoc_v2.md` con el esquema `sigd_rut`, llaves foráneas hacia `sigd_tra` y tabla de eventos Outbox.
- Redactar `05_decisiones_levantamiento_rutadoc.md` justificando el paso de triggers a Domain Layer.
- Revisar y autorizar los Pull Requests de Jacobo y Jhasy hacia `B_GERIC`.

### Jhasy (`B_JHASY`)
- Implementar `03_esquema_sigd_rut_particionado.sql` con la tabla `movimiento_tramite` particionada, índices B-Tree/BRIN y triggers mínimos de inmutabilidad.
- Ejecutar la suite `04_validacion_rutadoc_v2.md` demostrando:
  - 10 transiciones válidas ejecutadas vía transacciones atómicas.
  - Bloqueo de concurrencia fila por fila sin colisiones globales.
  - Generación correcta de registros en `evento_outbox`.

---

## 6. Cronograma de Trabajo (Sprint de 2 Semanas)

| Hito | Actividad | Responsable | Plazo |
| :---: | :--- | :---: | :---: |
| **H1** | Documentación de Reglas de Dominio y Eventos Outbox | Jacobo | Días 1 - 4 |
| **H2** | Modelo Lógico v2.0 y Diccionario de Datos | Geric | Días 5 - 7 |
| **H3** | Script SQL Particionado y Triggers Ligeros | Jhasy | Días 8 - 10 |
| **H4** | Validación Técnica en PostgreSQL 18 y Pruebas Concurrencia | Jhasy | Días 11 - 12 |
| **H5** | Consolidación en `B_GERIC` y Preparación para `main` | Geric | Días 13 - 14 |

---

## 7. Dependencias y Contratos con Otros Grupos

- **Grupo 2 (TramiCore):** Requiere que `sigd_tra.expediente` provea la clave primaria `id_expediente` (UUID) y el CUT.
- **Grupo 3 (OrganiCore):** Requiere que `sigd_org.area` provea `id_area` para validar origen y destino.
- **Grupo 4 (IdentiCore):** Requiere que `sigd_auth.cuenta_usuario` provea `id_usuario` para el actor del movimiento.
- **Grupo 6 (CoreLink):** Contrato del payload de eventos Outbox para el despachador asíncrono.

---

## 8. LISTA DE VERIFICACIÓN PARA LA ENTREGA DEL LEVANTAMIENTO DE OBSERVACIONES

| Estado | Criterio de Verificación Técnico y Metodológico | Responsable | Evidencia Requerida |
| :---: | :--- | :---: | :--- |
| ☐ | La máquina de estados y las reglas de transición están desacopladas de triggers y modeladas para la Capa de Dominio. | Jacobo | `01_analisis_dominio_transiciones_rutadoc.md` |
| ☐ | Los eventos de dominio Outbox (`ExpedienteDerivado`, `ExpedienteAtendido`, etc.) tienen payloads JSON estandarizados. | Jacobo | Matriz de eventos en `01_analisis...md` |
| ☐ | Se eliminó el uso de `pg_advisory_xact_lock` global en favor de bloqueos de fila corta sobre `expediente`. | Jhasy / Geric | `03_esquema_sigd_rut_particionado.sql` |
| ☐ | La tabla `movimiento_tramite` está particionada por rango anual (`PARTITION BY RANGE`) con particiones creadas. | Jhasy | DDL y verificación en `03_esquema...sql` |
| ☐ | Los triggers en PostgreSQL se limitan a inmutabilidad (`BEFORE UPDATE OR DELETE RAISE EXCEPTION`) y proyecciones. | Jhasy | Trigger `trg_inmutabilidad_movimiento` |
| ☐ | La suite de validación demuestra el registro exitoso de eventos en `sigd_audit.evento_outbox` en la misma transacción. | Jhasy | Consulta de verificación en `04_validacion...md` |
| ☐ | Se ejecutan pruebas de derivaciones concurrentes sin bloqueos mutuos (*Deadlocks*) ni saltos de correlatividad. | Jhasy | Prueba de estrés en `04_validacion...md` |
| ☐ | Las decisiones y alternativas descartadas respecto al desacoplamiento están registradas en el log de decisiones. | Geric | `05_decisiones_levantamiento_rutadoc.md` |
| ☐ | Cada integrante cuenta con commits propios en su rama personal (`B_JACOBO`, `B_JHASY`, `B_GERIC`). | Todos | Historial de Git |
| ☐ | Las correcciones fueron integradas mediante Pull Request formal sin pérdida de autoría individual. | Geric | PRs en GitHub |

---

## 9. Resultado Esperado

Al finalizar este plan, el Grupo 1 entregará un subdominio de trazabilidad de alto rendimiento, libre de cuellos de botella por triggers masivos, listo para ser consumido por los casos de uso en TypeScript y compatible con el estándar Outbox del SIGD.

| Líder General Backend | Sublíder / Integrador | Fecha de Conformidad |
| :---: | :---: | :---: |
| **Geric** · `B_GERIC` | **Geric** · `B_GERIC` | Pendiente de Revisión |
