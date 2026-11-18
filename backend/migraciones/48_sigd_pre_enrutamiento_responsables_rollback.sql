-- ==============================================================================
-- ROLLBACK MIGRACIÓN 48: Pre-enrutamiento TUPA, Perfil Responsable y Asignación Operativa
-- ==============================================================================

BEGIN;

-- 1. Eliminar índices
DROP INDEX IF EXISTS sigd_doc.idx_exp_tupa_vinc_perfil_responsable;
DROP INDEX IF EXISTS sigd_doc.idx_tupa_proc_perfil_responsable;

-- 2. Eliminar columnas agregadas
ALTER TABLE sigd_doc.expediente_tupa_vinculo
  DROP COLUMN IF EXISTS perfil_responsable_id;

ALTER TABLE sigd_doc.tupa_procedimiento
  DROP COLUMN IF EXISTS perfil_responsable_id;

COMMIT;
