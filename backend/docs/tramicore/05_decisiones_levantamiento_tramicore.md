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
| DEC-01 | CUT con formato `EXP-YYYY-XXXXXX` y función `generar_cut_expediente` | CONFIRMADO | Exigido por la R.S. N° 001-2017-PCM/SEGDI para interoperabilidad del MGD |
| DEC-02 | Prohibición absoluta de `MAX()+1` | CONFIRMADO | La R.S. N° 001-2017-PCM/SEGDI exige generación atómica segura ante concurrencia |
| DEC-03 | Uso de secuencias nativas de PostgreSQL (`nextval()`) para CUT | CONFIRMADO | Garantiza unicidad atómica sin riesgo de colisiones concurrentes |
| DEC-04 | La función `generar_cut_expediente` se ejecuta en el esquema `sigd_tra` | PROPUESTO | Alineación con el esquema del módulo de tramitación |

### 2.2 Directivas TUO Ley N° 27444 (Art. 160 LPAG)

| # | Decisión | Categoría | Justificación |
|---|----------|-----------|---------------|
| DEC-05 | Entidad `expediente_acumulacion` con FK compuesta | CONFIRMADO | Art. 160 LPAG establece la acumulación de procedimientos conexos |
| DEC-06 | Acumulación requiere acto resolutivo justificado | CONFIRMADO | La acumulación debe estar fundamentada en un proveído o resolución |
| DEC-07 | El expediente accesorio cambia a estado `ACUMULADO` | CONFIRMADO | El accesorio pierde autonomía y se fusiona al principal |
| DEC-08 | Desacumulación requiere nuevo acto resolutivo | CONFIRMADO | Si desaparece la conexidad, se ordena separación mediante nuevo acto |
| DEC-09 | Clave foránea compuesta `(id_expediente_principal, id_expediente_accesorio)` | CONFIRMADO | Modela correctamente la relación N:M entre expedientes conexos |

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
| DEC-16 | Relación trámite→expediente es 1:N (no 1:1) | CONFIRMADO | Subsanación de observación arquitectónica: un trámite genera múltiples expedientes |
| DEC-17 | `fk_tramite` en `expediente` pierde restricción UNIQUE | CONFIRMADO | Permite la flexibilidad requerida por el Art. 160 y el MGD |
| DEC-18 | El CUT es el identificador visible público | CONFIRMADO | Las relaciones internas de BD usan llaves primarias técnicas UUID |

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
| 2026-09-08 | Elmer Ramírez | Pruebas de estrés de 500 CUTs concurrentes ejecutadas (500/500 únicos) | RESUELTO |

---

## 5. Registro de cambios del documento

| Versión | Fecha | Cambios | Responsable |
|---------|-------|---------|-------------|
| 1.0 | 2026-08-30 | Documento inicial con decisiones de la Fase 2 | Elmer Ramírez |
| 2.0 | 2026-08-30 | Consolidación completa con fundamentación MGD-PCM, LPAG y AGN | Elmer Ramírez |
