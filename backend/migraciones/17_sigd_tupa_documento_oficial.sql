-- =============================================================================
-- Migración 17 · Copia Oficial Escaneada del TUPA y Auditoría de Reemplazos
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)
-- =============================================================================

-- 1. Agregar columnas a sigd_doc.tupa_version de forma aditiva y segura
ALTER TABLE sigd_doc.tupa_version
    ADD COLUMN IF NOT EXISTS documento_oficial_key VARCHAR(500) NULL,
    ADD COLUMN IF NOT EXISTS documento_oficial_nombre VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS documento_oficial_sha256 VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS documento_oficial_mime VARCHAR(100) NULL DEFAULT 'application/pdf',
    ADD COLUMN IF NOT EXISTS documento_oficial_tamano BIGINT NULL,
    ADD COLUMN IF NOT EXISTS documento_oficial_fecha_carga TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS documento_oficial_cargado_por UUID NULL
        CONSTRAINT fk_tupa_version_cargado_por
        REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tupa_version_doc_key
    ON sigd_doc.tupa_version (documento_oficial_key)
    WHERE documento_oficial_key IS NOT NULL;

-- 2. Tabla de auditoría histórica de reemplazos de la copia oficial
CREATE TABLE IF NOT EXISTS sigd_doc.tupa_documento_oficial_historial (
    id_historial         UUID NOT NULL DEFAULT gen_random_uuid()
                         CONSTRAINT pk_tupa_doc_historial PRIMARY KEY,
    id_version           UUID NOT NULL
                         CONSTRAINT fk_tupa_doc_historial_version
                         REFERENCES sigd_doc.tupa_version (id_version) ON DELETE CASCADE,
    storage_key          VARCHAR(500) NOT NULL,
    nombre_archivo       VARCHAR(255) NOT NULL,
    sha256               VARCHAR(64) NOT NULL,
    mime_type            VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    tamano_bytes         BIGINT NOT NULL,
    cargado_por          UUID NULL
                         CONSTRAINT fk_tupa_doc_historial_cargado_por
                         REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE SET NULL,
    motivo_cambio        TEXT NULL,
    creado_en            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tupa_doc_historial_version
    ON sigd_doc.tupa_documento_oficial_historial (id_version, creado_en DESC);

-- 3. Vincular documento oficial TUPA 2026 inicial si existe la versión TUPA-2026
DO $$
DECLARE
    v_id_version UUID;
    v_id_admin   UUID;
BEGIN
    SELECT id_version INTO v_id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026';
    SELECT id_usuario INTO v_id_admin FROM sigd_auth.cuenta_usuario WHERE usuario = 'administrador_demo' LIMIT 1;

    IF v_id_version IS NOT NULL THEN
        UPDATE sigd_doc.tupa_version
           SET documento_oficial_key = 'tupa/2026/TUPA_2026_OFICIAL.pdf',
               documento_oficial_nombre = 'TUPA_2026_OFICIAL.pdf',
               documento_oficial_sha256 = '4642d10722bd0b027f41215c2f5f4a05c9ef6992cd0d987e44c6edc1f4d6560f',
               documento_oficial_mime = 'application/pdf',
               documento_oficial_tamano = 1375801,
               documento_oficial_fecha_carga = now(),
               documento_oficial_cargado_por = v_id_admin,
               actualizado_en = now()
         WHERE id_version = v_id_version;

        INSERT INTO sigd_doc.tupa_documento_oficial_historial (
            id_version, storage_key, nombre_archivo, sha256, mime_type, tamano_bytes, cargado_por, motivo_cambio
        ) VALUES (
            v_id_version,
            'tupa/2026/TUPA_2026_OFICIAL.pdf',
            'TUPA_2026_OFICIAL.pdf',
            '4642d10722bd0b027f41215c2f5f4a05c9ef6992cd0d987e44c6edc1f4d6560f',
            'application/pdf',
            1375801,
            v_id_admin,
            'Carga inicial del documento escaneado oficial TUPA 2026'
        );
    END IF;
END $$;
