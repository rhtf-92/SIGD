-- =============================================================================
-- Rollback Migración 36 · TUPA Versionamiento Operativo (Fase 5E)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- =============================================================================

BEGIN;

-- 1. Eliminar asignación de permisos
DELETE FROM sigd_org.perfil_permiso
WHERE permiso_id IN (
    SELECT permiso_id FROM sigd_org.permiso_sistema WHERE codigo IN ('TUPA_GESTIONAR', 'TUPA_ACTIVAR')
);

-- 2. Eliminar perfiles operativos funcionales
DELETE FROM sigd_org.perfil_operativo
WHERE codigo IN ('GESTOR_TUPA', 'APROBADOR_TUPA');

-- 3. Eliminar permisos de sistema
DELETE FROM sigd_org.permiso_sistema
WHERE codigo IN ('TUPA_GESTIONAR', 'TUPA_ACTIVAR');

-- 4. Revertir cambios en sigd_doc.tupa_version
DROP INDEX IF EXISTS sigd_doc.idx_tupa_version_origen;

ALTER TABLE sigd_doc.tupa_version
    DROP CONSTRAINT IF EXISTS fk_tupa_version_origen;

ALTER TABLE sigd_doc.tupa_version
    DROP CONSTRAINT IF EXISTS uq_tupa_version_anio_revision;

ALTER TABLE sigd_doc.tupa_version
    DROP CONSTRAINT IF EXISTS chk_tupa_version_estado;

ALTER TABLE sigd_doc.tupa_version
    ADD CONSTRAINT chk_tupa_version_estado
    CHECK (estado IN ('BORRADOR', 'VIGENTE', 'HISTORICO'));

ALTER TABLE sigd_doc.tupa_version
    ADD CONSTRAINT uq_tupa_version_anio UNIQUE (anio);

ALTER TABLE sigd_doc.tupa_version
    DROP COLUMN IF EXISTS version_origen_id,
    DROP COLUMN IF EXISTS motivo_cambio,
    DROP COLUMN IF EXISTS vigente_hasta,
    DROP COLUMN IF EXISTS vigente_desde,
    DROP COLUMN IF EXISTS revision;

COMMIT;
