-- T-BE-CL-01 | CoreLink / Reportes | DESHABILITADA — Decisión Arquitectónica
-- ============================================================================
--
-- ESTADO: DESHABILITADA TEMPORALMENTE
-- RAZÓN:  Las vistas materializadas en 07_sigd_reportes.sql dependen de:
--         1. sigd_rut.estado_actual_tramite (no existe en 06 deshabilitado)
--         2. sigd_rut.movimiento_tramite (no existe en 06 deshabilitado)
--         3. Alias de columnas (m.fecha_movimiento, m.estado_destino) que dependen de 06
--
--         Hasta que se resuelva el contrato y la integración de TramiCore ↔ RutaDoc,
--         estas vistas no pueden ejecutarse sin violaciones de tipo (bigint = uuid).
--
-- ARTEFACTO:
--   - El archivo original 07_sigd_reportes.sql se conserva íntegramente en el repositorio.
--   - Este archivo (07_sigd_reportes_DISABLED.sql) es placeholder que documenta
--     que la migración 07 está deliberadamente deshabilitada por dependencia de 06.
--
-- REFERENCIAS:
--   - backend/docs/05_rutadoc/05_decisiones_levantamiento_rutadoc.md, RUT-DEC-006B (PENDIENTE)
--   - PLAN_CONMUTACION_Y_CERTIFICACION_SINCRONIZACION_FULLSTACK_100.md, Sección 3, M06

BEGIN;
  -- No-op: Este archivo es meramente un placeholder de decisión y no ejecuta DDL.
COMMIT;
