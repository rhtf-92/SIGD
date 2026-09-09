# 08 · Coordinación de Entregables y Contratos Intermodulares — TramiCore

**Proyecto:** SIGD — Grupo 2 "TramiCore"
**Autor:** Elmer Ramírez (B_RAMIREZ)
**Fecha:** 2026-09-08
**Motivo:** Auditoría del líder (revisión H4). Este documento registra las acciones de
coordinación pendientes con los integrantes del grupo y el contrato bilateral con RutaDoc
que deben cerrarse ANTES del PR hacia `B_GERIC`.

---

## 1. Estado de la rama B_RAMIREZ (evidencia reproducida)

| Bloque | Estado | Evidencia |
|--------|--------|-----------|
| DDL corregido (CUT anual, acumulación, foliado, inmutabilidad) | ✅ Ejecutado en PostgreSQL 18.3 | `03_esquema_sigd_tra_cut_foliado.sql` |
| Laboratorio determinista | ✅ 21/21 OK con ROLLBACK final | `06_pruebas_laboratorio_tramicore.sql` |
| Concurrencia real | ✅ 500/500 CUTs únicos, sin deadlocks | `07_lanzador_pruebas_tramicore.ps1` → `logs_pruebas/` |
| Carrera de año nuevo (2028) | ✅ 3 CUTs únicos, 1 sola fila anual | mismo lanzador |
| Validación documentada | ✅ Reproducible en un solo comando | `04_validacion_tramicore_v2.md` |
| Decisiones reclasificadas | ✅ PROPUESTO/PENDIENTE según evidencia | `05_decisiones_levantamiento_tramicore.md` (v2.1) |
| Alineación con B_GERIC | ✅ Merge de `origin/B_GERIC` aplicado (sin conflictos) | B_RAMIREZ en `d9f372c` |

> Nota de infraestructura: las ramas `B_RIQUELMER` y `B_SANDY` fueron forzadas al punto
> `71c3a15` (main) en el remoto. Sus entregables históricos siguen integrados en
> `B_RAMIREZ` (merge del PR #74), por lo que el PR final de TramiCore se realizará desde
> `B_RAMIREZ`. Si deben reanudar trabajo sobre sus ramas, deberán re-exportar/copiar desde
> `B_RAMIREZ`.

---

## 2. Acciones para Riquelmer (`B_RIQUELMER`) — H1 / sustento normativo CUT

El `01_analisis_cut_acumulacion_foliado.md` debe confirmar y citar con precisión:

| Pendiente | Estado actual | Acción requerida |
|-----------|---------------|------------------|
| P01 · Formato oficial exacto del CUT según R.S. N° 001-2017-PCM/SEGDI | En el DDL se implementó `EXP-YYYY-XXXXXX` como PROPUESTO | Confirmar con fuente oficial el formato; si difiere, actualizar CHECK y documentar |
| P02 · Guiones en el CUT | PROPUESTO `EXP-YYYY-XXXXXX` | Confirmar presencia/ausencia de guiones |
| P03 · Reinicio de correlativo por año fiscal | Implementado anual (`secuencia_anual_cut`), PROPUESTO | Confirmar si el correlativo es anual o continuo |
| Revisión de la redacción del análisis | Documento actual coincide con lo histórico | Revisar citas normativas y eliminar afirmaciones sin fuente |

---

## 3. Acciones para Sandy (`B_SANDY`) — H2 / modelo, diccionario y diagramas

Los entregables de modelo (`02_modelo_datos_tramicore_v2.md`, `02_diccionario_datos_tramicore_v2.md`,
`02_modelo_datos_gestion_documental_diagrama.drawio/.png`) deben alinearse con el DDL ejecutado:

| Tema | DDL actual (verdad de referencia) | Acción requerida |
|------|-----------------------------------|------------------|
| `estado_expediente` | Columna existente: `ACTIVO / ACUMULADO / ANULADO` | Verificar que el modelo lo incluya; la taxonomía oficial (¿`REABIERTO` al expediente?) sigue PENDIENTE (P08) |
| `actualizado_en` (trámite) | `TIMESTAMPTZ NULL` + trigger `trg_tramite_touch_actualizado_en` | Confirmar que el diccionario lo declare NULLable |
| `codigo_tramite` | `VARCHAR(30) NULL`, sin UNIQUE (PENDIENTE de formato institucional) | Reflejar como opcional y sin unicidad en el modelo |
| Relación trámite→expediente | 1:N (sin UNIQUE en `fk_tramite`) | Actualizar diagrama si aún lo muestra 1:1 |
| Acumulación | `id_acumulacion` PK + DOS FK simples + índice único parcial `uq_acumulacion_vigente` | Corregir cualquier mención de "FK compuesta" o clave natural del par |
| CUT | Por AÑO fiscal (`secuencia_anual_cut`), no secuencia global | Actualizar diccionario/plan de `secuencia_anual_cut` |
| Claves internas | `BIGINT GENERATED ALWAYS AS IDENTITY` (UUID PENDIENTE, DEC-UUID) | NO cambiar a UUID unilateralmente: requiere contrato con RutaDoc (sección 5) |

---

## 4. Contrato bilateral TramiCore ↔ RutaDoc (Grupo 1) — con Geric

Pendiente común con RutaDoc antes de cerrar el diseño físico:

| Decisión | TramiCore | RutaDoc | Responsable de cerrar |
|----------|-----------|---------|-----------------------|
| DEC-UUID · Tipo de `id_expediente` | Hoy BIGINT; migración a UUID solo si ambos lados la adoptan | El evento de creación de expediente (`id_expediente` + CUT para el primer movimiento `REGISTRADO`) debe declarar el tipo esperado en su contrato | Geric (líder) + Elmer, con sustento de Sandy |
| Formato del CUT en mensajería | `EXP-YYYY-XXXXXX` | Consumo del CUT como identificador de negocio en trazabilidad | Riquelmer (fuente normativa) + RutaDoc |

> Compromiso del grupo: **no se modifica el tipo de clave sin un acuerdo firmado**
> (documento 05_decisiones DEC-UUID = PENDIENTE). Cualquier cambio posterior al PR debe
> seguir el registro de decisiones.

---

## 5. Checklist de coordinación previa al PR hacia B_GERIC

| # | Acción | Responsable | Estado |
|---|--------|-------------|--------|
| 0 | Crear el registro de coordinación y contratos (este documento) | Elmer | ✅ DOCUMENTADO |
| 1 | Revisar y corregir `01_analisis` citando la fuente normativa del CUT | Riquelmer | PENDIENTE |
| 2 | Alinear modelo/diccionario/diagrama con el DDL corregido | Sandy | PENDIENTE |
| 3 | Cerrar contrato del tipo de clave (UUID o BIGINT) con RutaDoc/Geric | Geric + Elmer | PENDIENTE |
| 4 | Confirmar al profesor las preguntas abiertas P01–P10 | Elmer (recopila) | PENDIENTE |
| 5 | Documentar conflictos de autoría (commits en `B_SANDY` y `B_RIQUELMER` tras el force-push) | Elmer | PENDIENTE |
| 6 | PR final de B_RAMIREZ hacia B_GERIC (la rama ya está alineada con origin/B_GERIC) | Elmer | PENDIENTE |