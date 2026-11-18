-- =============================================================================
-- Rollback 17 · Copia Oficial Escaneada del TUPA y Auditoría de Reemplazos
-- =============================================================================

DROP TABLE IF EXISTS sigd_doc.tupa_documento_oficial_historial CASCADE;

ALTER TABLE sigd_doc.tupa_version
    DROP CONSTRAINT IF EXISTS fk_tupa_version_cargado_por,
    DROP COLUMN IF EXISTS documento_oficial_key,
    DROP COLUMN IF EXISTS documento_oficial_nombre,
    DROP COLUMN IF EXISTS documento_oficial_sha256,
    DROP COLUMN IF EXISTS documento_oficial_mime,
    DROP COLUMN IF EXISTS documento_oficial_tamano,
    DROP COLUMN IF EXISTS documento_oficial_fecha_carga,
    DROP COLUMN IF EXISTS documento_oficial_cargado_por;
