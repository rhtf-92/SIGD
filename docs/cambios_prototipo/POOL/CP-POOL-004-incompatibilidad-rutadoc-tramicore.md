# CP-POOL-004 — Diagnóstico en solo lectura del error PostgreSQL 42703 en RutaDoc

**Clasificación:** Infraestructura / Integración de BD (solo lectura; sin corrección aplicada)
**Estado:** Diagnóstico confirmado; sin modificar `06_sigd_rut.sql`
**Fecha:** 2026-10-08
**Autor:** Pool Angelo Carranza Pereyra (B_POOL)
**Etiqueta documento:** CP-POOL-004

---

## Objeto
Diagnosticar el error `42703` (`column e.id_expediente does not exist`) que bloquea `06_sigd_rut.sql` en línea 435.

## Problema (solo lectura)
- `06_sigd_rut.sql` referencia `ON p.expediente_id = e.id_expediente` (línea 435, alias `e` = `sigd_tra.expediente`).
- Según `05_sigd_tra.sql` / evidencia de Codex: `sigd_tra.expediente` tiene `expediente_id` (UUID), NO `id_expediente`.
- `sigd_rut.estado_actual_expediente.expediente_id` = UUID.
- El SQL parece usar una referencia cruzada de versión de modelo (posiblemente `id_expediente` como BIGINT en versión anterior vs `expediente_id` UUID en esta versión).

## Evidencia de runtime
- Log backend: `error: column e.id_expediente does not exist` (`code: 42703`, `file: 3854`, `routine: errorMissingColumn`).
- Migraciones previas (`01`–`05`) pasaron; `06` falla en bloque `UPDATE` / `WITH`.
- No se aplicó corrección; archivo `06_sigd_rut.sql` sin modificar.

## Impacto
Afecta módulo `sigd_rut` / RutaDoc / OE3 (Trámites / Expedientes). No afecta autenticación (`02_sigd_auth` OK).

---
## Opciones mínimas propuestas (sin aplicar)
A. Corregir referencia SQL en línea 435 (`e.id_expediente` → `e.expediente_id` o según modelo oficial).
B. Ajustar orden si hay divergencia de versión de DDL entre `05_sigd_tra` y `06_sigd_rut`.
C. Consultar al profesor si es error de versión o referencia intencional.

## Estado final (solo lectura)
Diagnóstico completo; sin cambios en SQL. Se recomienda autorización para corrección mínima de referencia en `06_sigd_rut.sql`.
