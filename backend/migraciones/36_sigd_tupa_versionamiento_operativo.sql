-- =============================================================================
-- Migración 36 · Esquema sigd_doc / sigd_org · TUPA Versionamiento Operativo (Fase 5E)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Versionamiento operativo, vigencia temporal e inmutabilidad histórica TUPA
-- Depende de: 35_sigd_autorizador_devolucion_perfil.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Ampliación de sigd_doc.tupa_version para revisiones y vigencia temporal
-- -----------------------------------------------------------------------------

ALTER TABLE sigd_doc.tupa_version
    ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1
        CONSTRAINT chk_tupa_version_revision CHECK (revision >= 1);

ALTER TABLE sigd_doc.tupa_version
    ADD COLUMN IF NOT EXISTS vigente_desde TIMESTAMPTZ NULL;

ALTER TABLE sigd_doc.tupa_version
    ADD COLUMN IF NOT EXISTS vigente_hasta TIMESTAMPTZ NULL;

ALTER TABLE sigd_doc.tupa_version
    ADD COLUMN IF NOT EXISTS motivo_cambio TEXT NULL;

ALTER TABLE sigd_doc.tupa_version
    ADD COLUMN IF NOT EXISTS version_origen_id UUID NULL
        CONSTRAINT fk_tupa_version_origen REFERENCES sigd_doc.tupa_version (id_version) ON DELETE RESTRICT;

-- Índice obligatorio en llave foránea (Regla 4 del proyecto)
CREATE INDEX IF NOT EXISTS idx_tupa_version_origen
    ON sigd_doc.tupa_version (version_origen_id)
    WHERE version_origen_id IS NOT NULL;

-- Soporte para revisiones intra-anuales (reemplaza unicidad de año por anio + revision)
ALTER TABLE sigd_doc.tupa_version
    DROP CONSTRAINT IF EXISTS uq_tupa_version_anio;

ALTER TABLE sigd_doc.tupa_version
    ADD CONSTRAINT uq_tupa_version_anio_revision UNIQUE (anio, revision);

-- Ampliación de estados canónicos (incluyendo ANULADO y PENDIENTE_VALIDACION)
ALTER TABLE sigd_doc.tupa_version
    DROP CONSTRAINT IF EXISTS chk_tupa_version_estado;

ALTER TABLE sigd_doc.tupa_version
    ADD CONSTRAINT chk_tupa_version_estado
    CHECK (estado IN ('BORRADOR', 'PENDIENTE_VALIDACION', 'VIGENTE', 'HISTORICO', 'ANULADO'));

-- -----------------------------------------------------------------------------
-- 2. Permisos del Sistema para Gestión y Activación de TUPA (5D)
-- -----------------------------------------------------------------------------

INSERT INTO sigd_org.permiso_sistema (codigo, nombre, ambito)
VALUES
    ('TUPA_GESTIONAR', 'Gestión y edición de borradores y procedimientos TUPA', 'GLOBAL'),
    ('TUPA_ACTIVAR', 'Aprobación y activación de versión normativa vigente TUPA', 'GLOBAL')
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Perfiles Operativos Funcionales TUPA (DISEÑO_SIGD)
-- -----------------------------------------------------------------------------

INSERT INTO sigd_org.perfil_operativo (codigo, nombre, descripcion)
VALUES
    ('GESTOR_TUPA', 'Gestor de TUPA', 'Perfil funcional para preparar borradores, procedimientos, tarifas y procedencia TUPA'),
    ('APROBADOR_TUPA', 'Aprobador de TUPA', 'Perfil funcional institucional con competencia para publicar y poner en vigencia versiones del TUPA')
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Asociación de Permisos a Perfiles Operativos TUPA
-- -----------------------------------------------------------------------------

-- GESTOR_TUPA -> TUPA_GESTIONAR
INSERT INTO sigd_org.perfil_permiso (perfil_id, permiso_id)
SELECT p.perfil_id, perm.permiso_id
FROM sigd_org.perfil_operativo p, sigd_org.permiso_sistema perm
WHERE p.codigo = 'GESTOR_TUPA' AND perm.codigo = 'TUPA_GESTIONAR'
ON CONFLICT DO NOTHING;

-- APROBADOR_TUPA -> TUPA_ACTIVAR
INSERT INTO sigd_org.perfil_permiso (perfil_id, permiso_id)
SELECT p.perfil_id, perm.permiso_id
FROM sigd_org.perfil_operativo p, sigd_org.permiso_sistema perm
WHERE p.codigo = 'APROBADOR_TUPA' AND perm.codigo = 'TUPA_ACTIVAR'
ON CONFLICT DO NOTHING;

-- COMENTARIOS INFORMATIVOS
COMMENT ON COLUMN sigd_doc.tupa_version.revision IS
    'Número de revisión dentro de la edición anual (1, 2, ...).';

COMMENT ON COLUMN sigd_doc.tupa_version.vigente_desde IS
    'Fecha/hora efectiva desde la cual rige esta versión normativa.';

COMMENT ON COLUMN sigd_doc.tupa_version.vigente_hasta IS
    'Fecha/hora efectiva hasta la cual rigió esta versión antes de ser sustituida.';

COMMENT ON COLUMN sigd_doc.tupa_version.version_origen_id IS
    'Referencia a la versión origen desde la cual fue clonado este borrador.';

COMMIT;
