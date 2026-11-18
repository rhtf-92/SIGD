# 08 · Coordinación de Entregables y Contratos Intermodulares — TramiCore

**Proyecto:** SIGD — Grupo 2 "TramiCore"
**Autor:** Elmer Ramírez (B_RAMIREZ)
**Fecha:** 2026-09-08
**Revisión H4b-bis:** 2026-09-09 (protección de foliado concurrente, evidencia, autoría)
**Motivo:** Auditoría del líder (revisión H4). Este documento registra las acciones de
coordinación pendientes con los integrantes del grupo y el contrato bilateral con RutaDoc
que deben cerrarse ANTES del PR hacia `B_GERIC`.

---

## 1. Estado de la rama B_RAMIREZ (evidencia reproducida)

| Bloque | Estado | Evidencia |
|--------|--------|-----------|
| DDL corregido (CUT anual, acumulación, foliado, inmutabilidad) | ✅ En DDL | `03_esquema_sigd_tra_cut_foliado.sql` |
| Laboratorio determinista | ✅ EJECUTADO 26/26 (2026-09-09) | `06_pruebas_laboratorio_tramicore.sql` |
| Concurrencia real | ✅ EJECUTADO 500/500 (2026-09-09) | `07_lanzador_pruebas_tramicore.ps1` → `logs_pruebas/` |
| Carrera de año nuevo (2028) | ✅ EJECUTADO — 3 CUTs exactos, 1 fila anual (2026-09-09) | mismo lanzador |
| Foliado · solapamiento rechazado (prueba negativa SECUENCIAL) | ✅ EJECUTADO — exit 0/3, `[23514]` (2026-09-09) | `logs_pruebas/folio_negativo_*.{sql,log,err}` |
| Foliado · concurrente función canónica (2 sesiones) | ✅ EJECUTADO — exit 0/0, rangos `1-5, 6-10` (2026-09-09) | `logs_pruebas/folio_concurrente_*.{sql,log,err}` |
| Foliado · concurrente INSERT directo (2 sesiones, mismo rango 1-5) | ✅ EJECUTADO — exit 0/3, rechazo `[23514]`, solo `1|5` confirmado (2026-09-09) | `logs_pruebas/folio_concurrente_directo_*.{sql,log,err}` |
| Validación documentada | ✅ Reproducible en un solo comando | `04_validacion_tramicore_v2.md` |
| Decisiones reclasificadas | ✅ PROPUESTO/PENDIENTE según evidencia | `05_decisiones_levantamiento_tramicore.md` (v2.2) |
| Alineación con B_GERIC | ✅ Merge de `origin/B_GERIC` aplicado (sin conflictos) | B_RAMIREZ en `d9f372c` |
| Evidencia `evidencia_h4.json` | ✅ GENERADA — resultado global PASS (2026-09-09) | `logs_pruebas/evidencia_h4.json` |

> Nota de infraestructura: las ramas `B_RIQUELMER` y `B_SANDY` fueron forzadas al punto
> `71c3a15` (main) en el remoto. Sus entregables históricos siguen integrados en
> `B_RAMIREZ` (merge del PR #74), por lo que el PR final de TramiCore se realizará desde
> `B_RAMIREZ`. Si deben reanudar trabajo sobre sus ramas, deberán re-exportar/copiar desde
> `B_RAMIREZ`.
>
> **Incorporación del trabajo H2 de Sandy:** Sandy trabajó en el modelo de datos original
> (`02_modelo_datos_gestion_documental.md`, `02_diccionario_datos_gestion_documental.md`,
> `03_tramite_expediente_registro.sql`) en la rama `B_SANDY`. Estos entregables fueron
> integrados al PR #74 (merge de `B_RIQUELMER` → `B_RAMIREZ`), que consolidó el trabajo
> previo de ambos colaboradores. Posteriormente, en el commit `08860ff` (Fase 2 completa),
> los archivos v1 de Sandy fueron reemplazados por las versiones v2 que incorporan CUT,
> acumulación y foliado. Los archivos originales de Sandy se conservan en
> `backend/docs/tramicore/historico/` como respaldo. Los commits de Sandy no aparecen
> en la historia de `B_RAMIREZ` porque su rama fue forzada al punto de main tras la
> integración; el trabajo está presente a través del merge del PR #74.

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
| G3/G4/G5 como CONFIRMADO | Referencias externas sin contratos aprobados | Marcadas como PENDIENTE, no CONFIRMADO |

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
| 2 | Alinear modelo/diccionario/diagrama con el DDL corregido | Sandy (Elmer integró en H4b) | ✅ CORREGIDO (H4b) |
| 3 | Cerrar contrato del tipo de clave (UUID o BIGINT) con RutaDoc/Geric | Geric + Elmer | PENDIENTE (DEC-UUID) |
| 4 | Confirmar al profesor las preguntas abiertas P01–P10 | Elmer (recopila) | PENDIENTE |
| 5 | Documentar conflictos de autoría (commits en `B_SANDY` y `B_RIQUELMER` tras el force-push) | Elmer | ✅ DOCUMENTADO (este archivo) |
| 6 | Corregir whitespace (6 errores trailing spaces) | Elmer | ✅ CORREGIDO (H4b) |
| 7 | Restaurar documentos históricos a carpeta `historico/` | Elmer | ✅ RESTAURADO (H4b) |
| 8 | Agregar pruebas de ciclos 3/4+ nodos y foliado; reescribir P19 (ciclo 4-nodos) y foliado como prueba negativa real | Elmer | ✅ AGREGADO Y EJECUTADO (2026-09-09) |
| 9 | Verificar ExitCode de procesos concurrentes en lanzador | Elmer | ✅ CORREGIDO (H4b) |
| 10 | Generar evidencia consolidada `evidencia_h4.json` | Elmer | ✅ GENERADA — resultado global PASS (2026-09-09) |
| 11 | Restaurar documentos históricos a carpeta `historico/` sin mojibake | Elmer | ✅ CORREGIDO (2026-09-09) |
| 12 | G3/G4/G5 como PENDIENTE sin contratos aprobados | Elmer | ✅ CORREGIDO (2026-09-09) |
| 13 | SQLSTATE corregido (42301 → 23514/23001) e índice redundante eliminado | Elmer | ✅ CORREGIDO (2026-09-09) |
| 14 | Trigger anti-huecos y trigger de validación en acumulación | Elmer | ✅ AGREGADO (2026-09-09) |
| 15 | Lanzador: conteo corregido a 26 pruebas (antes 21) y comparación exacta 000001, 000002, 000003 | Elmer | ✅ CORREGIDO (2026-09-09) |
| 16 | H4b-bis: proteger la vía directa de foliado (bloqueo de fila del expediente en el trigger; descartado el GUC inefectivo) + 3 pruebas de foliación (negativa secuencial + 2 concurrentes reales) con `ON_ERROR_STOP=1` | Elmer | ✅ CORREGIDO Y EJECUTADO (2026-09-09) |
| 17 | Documentar el mecanismo CUT exacto (`secuencia_anual_cut` / `ON CONFLICT` / `FOR UPDATE`; sin `nextval()` para CUT) en 01/02_modelo/02_diccionario/05 | Elmer | ✅ CORREGIDO (2026-09-09) |
| 18 | Restaurar el plan rector a su contenido original (21 pruebas deterministas + requisito textual del UUID) y reconciliar 21/26 en `04_validacion`/`05_decisiones` | Elmer | ✅ RESTAURADO (2026-09-09) |
| 19 | Transparencia de autoría: confirmar identidad Git de B_RAMIREZ y participación de Riquelmer/Sandy; documentar aquí | Elmer | ✅ DOCUMENTADO (sección 6) |
| 20 | PR final de B_RAMIREZ hacia B_GERIC (la rama ya está alineada con origin/B_GERIC) | Elmer | PENDIENTE (tras nueva revisión) |

---

## 6. Transparencia de autoría y participación (verificación 2026-09-09)

Verificación ejecutada a petición del revisor sobre **toda la historia de commits
de la serie de correcciones H4** (`8e811ba` → `0e975cd`):

| Aspecto | Verificado |
|---------|-----------|
| Identidad Git configurada en B_RAMIREZ | `user.name = ReyNorD23`, `user.email = zlkarozr3@gmail.com` (`git config`) |
| Alias histórico en la rama | El commit inicial del repositorio y varios de la Fase 2 aparecen como `ElmerRC <zlkarozr3@gmail.com>` — **mismo correo** que `ReyNorD23`, por lo que se trata de la misma persona |
| Autoría de las correcciones H4 | 100 % de los commits `8e811ba` → `0e975cd` son de `ReyNorD23 <zlkarozr3@gmail.com>` |
| Participación de Riquelmer | `riquelmerfachin <riquelmerrojas@gmail.com>` — contribuyó en hitos previos (H1/análisis normativo, PR #74); **sin commits** en la serie de correcciones H4 |
| Participación de Sandy | `sandymargarita08-cloud <sandymargarita08@gmail.com>` — contribuyó en H2 (modelo/diccionario v1, PR #74); **sin commits** en la serie de correcciones H4 |
| Ramas de colaboradores | `origin/B_RIQUELMER` y `origin/B_SANDY` están forzadas en `71c3a15` (main); sus entregables históricos están integrados vía merge del PR #74 en B_RAMIREZ |

**Conclusión:** los commits de la revisión H4/H4b/H4b-bis fueron redactados y
publicados por una sola persona (ReyNorD23, alias Git del mismo autor Elmer
Ramírez). Riquelmer y Sandy **no participaron** en esta iteración de
correcciones; sus entregables normativos (H1) y de modelado (H2) sí quedaron
integrados y son verificables en los documentos históricos de `B_RAMIREZ`.

**Plan rector / aprobación del profesor:** el commit `3caa94a` había modificado
el plan rector (contó 26 pruebas en lugar de 21 y retiró la mención textual del
UUID en el evento a RutaDoc). **No existe evidencia de aprobación** por el
profesor de una nueva versión del plan, por lo que el plan fue **restaurado a su
contenido original** (21 pruebas deterministas + requisito textual del UUID) y
la equivalencia 21/26 quedó documentada en `04_validacion_tramicore_v2.md` y
`05_decisiones_levantamiento_tramicore.md` (v2.2). Si el profesor aprueba una
nueva versión del plan, debe registrarse aquí con su evidencia.