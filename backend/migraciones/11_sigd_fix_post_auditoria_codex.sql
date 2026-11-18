-- =============================================================================
-- MIGRACIÓN 11: Corrección Post-Auditoría Codex — Sincronización FSM Legacy
-- SIGD 2026 — Despliegue Incremental Seguro
-- =============================================================================

-- Sincronizar expedientes heredados donde sigd_tra.expediente tiene estado='EN_TRAMITE'
-- pero sigd_rut.estado_actual_expediente tiene 'EN_REVISION'.
-- Evita bloqueo exclusivo innecesario: update condicional directo por clave primaria.
UPDATE sigd_tra.expediente e
   SET estado = 'EN_REVISION'
  FROM sigd_rut.estado_actual_expediente u
 WHERE e.expediente_id = u.expediente_id
   AND e.estado = 'EN_TRAMITE'
   AND u.estado_nuevo = 'EN_REVISION';
