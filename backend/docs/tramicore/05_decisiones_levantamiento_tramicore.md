# 05 · Decisiones y Preguntas Pendientes — Levantamiento TramiCore Fase 2

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)
**Grupo:** Grupo 2 – "TramiCore"
**Autor:** Elmer Ramírez (B_RAMIREZ)
**Versión:** 2.0 — Levantamiento de Observaciones
**Fecha:** 30 de agosto de 2026

---

## 1. Categorías de clasificación

- **CONFIRMADO** — Indicado por el profesor / información institucional verificada
- **PROPUESTO** — Mejora técnica del grupo, con justificación
- **PENDIENTE** — Por preguntar o validar
- **EJEMPLO** — Dato solo de demostración, sin valor oficial

---

## 2. Decisiones adoptadas — Fundamentación normativa

### 2.1 Directrices MGD-PCM (R.S. N° 001-2017-PCM/SEGDI)

| # | Decisión | Categoría | Justificación |
|---|----------|-----------|---------------|
| DEC-01 | CUT con formato `EXP-YYYY-XXXXXX` y función `generar_cut_expediente` | PROPUESTO | La R.S. N° 001-2017-PCM/SEGDI exige un CUT interoperable para el MGD; el formato exacto está PENDIENTE de confirmación oficial (P01/P02) |
| DEC-02 | Prohibición absoluta de `MAX()+1` para el CUT | CONFIRMADO | La R.S. N° 001-2017-PCM/SEGDI exige generación atómica segura ante concurrencia |
| DEC-03 | Correlativo CUT por AÑO FISCAL sobre `secuencia_anual_cut` (`INSERT ... ON CONFLICT` + `SELECT ... FOR UPDATE`) | PROPUESTO | Implementado y validado bajo concurrencia real (07_lanzador_pruebas_tramicore.ps1); el reinicio anual depende de la confirmación institucional (P03) |
| DEC-04 | La función `generar_cut_expediente` se ejecuta en el esquema `sigd_tra` | PROPUESTO | Alineación con el esquema del módulo de tramitación |

### 2.2 Directivas TUO Ley N° 27444 (Art. 160 LPAG)

| # | Decisión | Categoría | Justificación |
|---|----------|-----------|---------------|
| DEC-05 | Entidad `expediente_acumulacion` con identidad propia (`id_acumulacion`) y DOS FK simples | PROPUESTO | Art. 160 LPAG establece la acumulación de procedimientos conexos; el diseño del par (no FK compuesta) es decisión técnica del grupo |
| DEC-06 | Acumulación requiere acto resolutivo justificado | CONFIRMADO | La acumulación debe estar fundamentada en un proveído o resolución |
| DEC-07 | El expediente accesorio cambia a `estado_expediente = 'ACUMULADO'` | PROPUESTO | Refleja la fusión jurídica del accesorio; la taxonomía oficial de estados del expediente sigue PENDIENTE (P08) |
| DEC-08 | Desacumulación requiere nuevo acto resolutivo | CONFIRMADO | Si desaparece la conexidad, se ordena separación mediante nuevo acto |
| DEC-09 | Unicidad del par ACTIVO mediante índice único parcial `uq_acumulacion_vigente` (permite re-acumulación tras desacumular) | PROPUESTO | Corrige la decisión anterior de "FK compuesta": el par no es clave; el índice parcial preserva el historial |

### 2.3 Directivas AGN (R.J. N° 073-2023-AGN/J)

| # | Decisión | Categoría | Justificación |
|---|----------|-----------|---------------|
| DEC-10 | Entidad `expediente_documento_folio` para foliatura digital | CONFIRMADO | Exigido por la directiva de foliación cronológica continua del AGN |
| DEC-11 | Folios con rango continuo `folio_inicio` a `folio_fin` | CONFIRMADO | La foliatura debe ser cronológica y continua sin interrupciones |
| DEC-12 | Prohibición de solapamientos de folios entre documentos | CONFIRMADO | Un folio no puede estar asignado a dos documentos simultáneamente |
| DEC-13 | Prohibición de vacíos en la foliatura | CONFIRMADO | No pueden existir saltos de folios en la foliatura electrónica |
| DEC-14 | Restricción CHECK `folio_fin >= folio_inicio` | CONFIRMADO | Garantiza la validez del rango de folios asignado |
| DEC-15 | `DELETE` prohibido sobre rangos de folios ya emitidos | CONFIRMADO | La inmutabilidad de la foliatura es un principio archivístico |

### 2.4 Separación Trámite vs Expediente

| # | Decisión | Categoría | Justificación |
|---|----------|-----------|---------------|
| DEC-16 | Relación trámite→expediente es 1:N (no 1:1) | PROPUESTO | Subsanación de observación arquitectónica: un trámite puede generar múltiples expedientes (ej. una solicitud y sus ampliatorios) |
| DEC-17 | `fk_tramite` en `expediente` pierde restricción UNIQUE | PROPUESTO | Permite la flexibilidad requerida por el Art. 160 y el MGD |
| DEC-18 | El CUT es el identificador visible público | CONFIRMADO | El formato `EXP-YYYY-XXXXXX` se mantiene como identificador de negocio |
| DEC-UUID | Claves internas: hoy `BIGINT GENERATED ALWAYS AS IDENTITY`; migración a `UUID` | PENDIENTE | Corrige la afirmación anterior de llaves UUID: aún no implementado. Requiere contrato bilateral con RutaDoc (Sandy/Geric) antes de decidir la migración (ver sección 4) |

### 2.5 Inmutabilidad del Libro General de Registros

| # | Decisión | Categoría | Justificación |
|---|----------|-----------|---------------|
| DEC-19 | Los números de `asiento_registro` son inmutables | CONFIRMADO | Art. 153-156 del TUO de la Ley N° 27444 |
| DEC-20 | No se reutilizan números de asiento | CONFIRMADO | La no reutilización preserva la integridad histórica |
| DEC-21 | La anulación es borrado lógico (`anulado = true` + `motivo_anulacion`) | CONFIRMADO | Conserva el historial sin aplicar `DELETE` físico |

---

## 3. Preguntas pendientes para el profesor

| # | Pregunta | Estado |
|---|----------|--------|
| P01 | ¿Qué formato oficial exacto tiene el CUT bajo la R.S. N° 001-2017-PCM/SEGDI? | PENDIENTE |
| P02 | ¿El formato del CUT incluye guiones o solo `EXP-YYYY-XXXXXX`? | PENDIENTE |
| P03 | ¿La secuencia de CUT se reinicia por año fiscal o es continua? | PENDIENTE |
| P04 | ¿Un expediente accesorio puede tener sus propios documentos/folios además de fusionarse al principal? | PENDIENTE |
| P05 | ¿La desacumulación restaura completamente el expediente accesorio o genera uno nuevo? | PENDIENTE |
| P06 | ¿El `id_documento` en `expediente_documento_folio` referencia a qué entidad exactamente del Grupo 5? | PENDIENTE |
| P07 | ¿El `codigo_tramite` y `codigo_expediente` pueden tener formatos diferentes? | PENDIENTE |
| P08 | ¿Los estados oficiales incluyen `REABIERTO` o solo los del TUO? | PENDIENTE |
| P09 | ¿El destinatario inicial es usuario, área, oficina o combinación? | PENDIENTE |
| P10 | ¿Qué ocurre con la foliatura cuando se reabre un trámite cerrado? | PENDIENTE |

---

## 4. Observaciones resueltas / pendientes

| Fecha | Responsable | Observación | Estado |
|-------|-------------|-------------|--------|
| 2026-08-30 | Elmer Ramírez | Observación arquitectónica 1:1 resuelta con modelo 1:N | RESUELTO |
| 2026-08-30 | Elmer Ramírez | Observación de MAX()+1 resuelta con `nextval()` de secuencia | RESUELTO |
| 2026-08-30 | Elmer Ramírez | Observación de ausencia de acumulación resuelta con `expediente_acumulacion` | RESUELTO |
| 2026-08-30 | Elmer Ramírez | Observación de ausencia de foliatura digital resuelta con `expediente_documento_folio` | RESUELTO |
| 2026-09-08 | Elmer Ramírez | Entregable de Sandy (modelo lógico v2.0, diccionario y diagramas) integrado | RESUELTO |
| 2026-09-08 | Elmer Ramírez | Pruebas de concurrencia reproducibles mediante `07_lanzador_pruebas_tramicore.ps1` — PENDIENTE re-ejecución con DDL corregido (SQLSTATE 23514/23001, trigger anti-huecos, trigger acumulación) | EN PROCESO |
| 2026-09-08 | Elmer Ramírez | Corrección H4: clasificaciones CONFIRMADO→PROPUESTO/PENDIENTE en DEC-01/03/05/07/09/16/17/18, DEC-UUID documentado como PENDIENTE, reescritura de DDL/demo/laboratorio con codificación UTF-8 limpia | RESUELTO |

---

## 5. Registro de cambios del documento

| Versión | Fecha | Cambios | Responsable |
|---------|-------|---------|-------------|
| 1.0 | 2026-08-30 | Documento inicial con decisiones de la Fase 2 | Elmer Ramírez |
| 2.0 | 2026-08-30 | Consolidación completa con fundamentación MGD-PCM, LPAG y AGN | Elmer Ramírez |
| 2.1 | 2026-09-08 | Correcciones H4 post-auditoría: reclasificación de decisiones, DEC-UUID, alineación con DDL (secuencia anual, dos FK simples, índice parcial), evidencia reproducible | Elmer Ramírez |
