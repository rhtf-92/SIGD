-- =============================================================================
-- ROLLBACK MIGRACIÓN 11: Corrección Post-Auditoría Codex
-- SIGD 2026
-- =============================================================================

-- Revertir expedientes sincronizados por la migración 11 a su estado previo EN_TRAMITE
UPDATE sigd_tra.expediente e
   SET estado = 'EN_TRAMITE'
  FROM sigd_rut.estado_actual_expediente u
 WHERE e.expediente_id = u.expediente_id
   AND e.estado = 'EN_REVISION'
   AND u.estado_nuevo = 'EN_REVISION'
   AND e.codigo_expediente = 'EXP-2026-000001';
