-- =============================================================================
-- Rollback 33 · Esquema sigd_org · Estructura Orgánica y Responsabilidades Temporales (Fase 5C)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS sigd_org.responsabilidad_temporal CASCADE;

DROP INDEX IF EXISTS sigd_org.idx_asig_personal_anulado_por;

ALTER TABLE sigd_org.asignacion_personal
    DROP CONSTRAINT IF EXISTS chk_asignacion_anulacion,
    DROP CONSTRAINT IF EXISTS chk_asignacion_vigencia,
    DROP CONSTRAINT IF EXISTS chk_asignacion_estado,
    DROP COLUMN IF EXISTS actualizado_en,
    DROP COLUMN IF EXISTS creado_en,
    DROP COLUMN IF EXISTS anulado_por,
    DROP COLUMN IF EXISTS anulado_en,
    DROP COLUMN IF EXISTS motivo_anulacion,
    DROP COLUMN IF EXISTS motivo_finalizacion,
    DROP COLUMN IF EXISTS fecha_documento_sustento,
    DROP COLUMN IF EXISTS numero_documento_sustento,
    DROP COLUMN IF EXISTS tipo_documento_sustento,
    DROP COLUMN IF EXISTS estado;

ALTER TABLE sigd_org.area
    DROP CONSTRAINT IF EXISTS chk_area_tipo_unidad,
    DROP COLUMN IF EXISTS tipo_unidad;

COMMIT;
