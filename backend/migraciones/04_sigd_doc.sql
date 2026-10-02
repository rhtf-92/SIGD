-- =============================================================================
-- Migración 04 · Esquema sigd_doc
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Ricardo Arévalo Villacorta (B_AREVALO) · Grupo 6 CoreLink
-- Marco     : TUO Ley 27444 (silencio administrativo), Ley N° 27269
-- Depende de: 02_sigd_auth.sql, 03_sigd_org.sql
-- Contenido : TUPA, formularios JSON Schema 2020-12, expedientes y adjuntos S3
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS sigd_doc;

-- -----------------------------------------------------------------------------
-- 4.1 tipo_tramite_tupa (Ley del Procedimiento Administrativo General)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.tipo_tramite_tupa (
    tipo_tramite_id UUID        NOT NULL DEFAULT gen_random_uuid()
                              CONSTRAINT pk_tipo_tramite_tupa PRIMARY KEY,
    codigo          VARCHAR(30) NOT NULL UNIQUE,
    denominacion    VARCHAR(300) NOT NULL,
    descripcion     TEXT        NULL,
    unidad_organica VARCHAR(160) NOT NULL,
    plazo_dias      SMALLINT    NOT NULL DEFAULT 30,
    silencio_administrativo VARCHAR(30) NOT NULL DEFAULT 'POSITIVO',
    base_legal      VARCHAR(500) NULL,
    vigente         BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_tupa_silencio CHECK (silencio_administrativo IN ('POSITIVO', 'NEGATIVO')),
    CONSTRAINT chk_tupa_plazo CHECK (plazo_dias > 0)
);

COMMENT ON COLUMN sigd_doc.tipo_tramite_tupa.plazo_dias IS
    'Plazo máximo legal supletorio de 30 días hábiles (TUO Ley N° 27444, Art. 143).';

-- -----------------------------------------------------------------------------
-- 4.2 tipo_documento (tipos documentales oficiales)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.tipo_documento (
    tipo_documental_id UUID        NOT NULL DEFAULT gen_random_uuid()
                                CONSTRAINT pk_tipo_documento PRIMARY KEY,
    codigo             VARCHAR(30) NOT NULL UNIQUE,
    nombre             VARCHAR(160) NOT NULL,
    extension          VARCHAR(10) NOT NULL DEFAULT 'pdf',
    mime_type          VARCHAR(120) NOT NULL DEFAULT 'application/pdf',
    tamano_maximo_mb   SMALLINT    NOT NULL DEFAULT 25,
    exige_firma        BOOLEAN     NOT NULL DEFAULT FALSE,
    vigente            BOOLEAN     NOT NULL DEFAULT TRUE
);

-- -----------------------------------------------------------------------------
-- 4.3 formulario_version (JSON Schema 2020-12, inmutable)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.formulario_version (
    formulario_version_id UUID        NOT NULL DEFAULT gen_random_uuid()
                                    CONSTRAINT pk_formulario_version PRIMARY KEY,
    tipo_tramite_id       UUID        NOT NULL
                                    REFERENCES sigd_doc.tipo_tramite_tupa (tipo_tramite_id) ON DELETE RESTRICT,
    version              SMALLINT    NOT NULL,
    json_schema          JSONB       NOT NULL,
    vigente_desde        DATE        NOT NULL DEFAULT CURRENT_DATE,
    vigente_hasta        DATE        NULL,
    publicado_por        UUID        NULL,
    CONSTRAINT uq_formulario_version UNIQUE (tipo_tramite_id, version),
    CONSTRAINT chk_formulario_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

CREATE OR REPLACE FUNCTION sigd_doc.fn_proteger_formulario_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'sigd_doc.formulario_version es inmutable: % rechazado sobre la versión %',
        TG_OP, OLD.version
        USING ERRCODE = '23001',
              HINT = 'Cree una nueva versión del formulario en lugar de alterar una publicada.';
END;
$$;

DROP TRIGGER IF EXISTS tr_proteger_formulario_version ON sigd_doc.formulario_version;
CREATE TRIGGER tr_proteger_formulario_version
    BEFORE UPDATE OR DELETE ON sigd_doc.formulario_version
    FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_proteger_formulario_version();

-- -----------------------------------------------------------------------------
-- 4.4 expediente (instancia documental con ciclo de vida)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.expediente (
    expediente_id      UUID        NOT NULL DEFAULT gen_random_uuid()
                                 CONSTRAINT pk_doc_expediente PRIMARY KEY,
    tipo_tramite_id    UUID        NOT NULL
                                 REFERENCES sigd_doc.tipo_tramite_tupa (tipo_tramite_id) ON DELETE RESTRICT,
    formulario_version_id UUID    NULL
                                 REFERENCES sigd_doc.formulario_version (formulario_version_id) ON DELETE RESTRICT,
    codigo_expediente  VARCHAR(20) NOT NULL UNIQUE,
    asunto             VARCHAR(500) NOT NULL,
    area_actual_id     UUID        NULL
                                 REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT,
    solicitante_id     UUID        NOT NULL
                                 REFERENCES sigd_auth.persona (id_persona) ON DELETE RESTRICT,
    estado             VARCHAR(30) NOT NULL DEFAULT 'REGISTRADO',
    fecha_registro     TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_limite       TIMESTAMPTZ NULL,
    CONSTRAINT chk_doc_expediente_estado CHECK (estado IN (
        'REGISTRADO', 'EN_TRAMITE', 'OBSERVADO', 'RESUELTO', 'ANULADO'
    )),
    CONSTRAINT chk_doc_expediente_cut CHECK (codigo_expediente ~ '^EXP-[0-9]{4}-[0-9]{6}$')
);

CREATE INDEX IF NOT EXISTS idx_doc_expediente_tramite ON sigd_doc.expediente (tipo_tramite_id);
CREATE INDEX IF NOT EXISTS idx_doc_expediente_area ON sigd_doc.expediente (area_actual_id);
CREATE INDEX IF NOT EXISTS idx_doc_expediente_solicitante ON sigd_doc.expediente (solicitante_id);

-- -----------------------------------------------------------------------------
-- 4.5 expediente_formulario_respuesta (payloads JSONB)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.expediente_formulario_respuesta (
    id_respuesta        UUID        NOT NULL DEFAULT gen_random_uuid()
                                   CONSTRAINT pk_expediente_formulario_respuesta PRIMARY KEY,
    expediente_id       UUID        NOT NULL
                                   REFERENCES sigd_doc.expediente (expediente_id) ON DELETE CASCADE,
    formulario_version_id UUID      NOT NULL
                                   REFERENCES sigd_doc.formulario_version (formulario_version_id) ON DELETE RESTRICT,
    datos               JSONB       NOT NULL,
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_expediente_formulario UNIQUE (expediente_id, formulario_version_id)
);

-- -----------------------------------------------------------------------------
-- 4.6 requisito y su relación con el tipo documental
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.requisito (
    requisito_id  UUID        NOT NULL DEFAULT gen_random_uuid()
                             CONSTRAINT pk_requisito PRIMARY KEY,
    tipo_tramite_id UUID      NOT NULL
                             REFERENCES sigd_doc.tipo_tramite_tupa (tipo_tramite_id) ON DELETE CASCADE,
    codigo        VARCHAR(30) NOT NULL,
    denominacion  VARCHAR(300) NOT NULL,
    obligatorio   BOOLEAN     NOT NULL DEFAULT TRUE,
    orden         SMALLINT    NOT NULL DEFAULT 0,
    CONSTRAINT uq_requisito_tramite_codigo UNIQUE (tipo_tramite_id, codigo)
);

CREATE TABLE IF NOT EXISTS sigd_doc.tipo_documento_requisito (
    id_relacion       UUID        NOT NULL DEFAULT gen_random_uuid()
                                   CONSTRAINT pk_tipo_documento_requisito PRIMARY KEY,
    requisito_id      UUID        NOT NULL
                                   REFERENCES sigd_doc.requisito (requisito_id) ON DELETE CASCADE,
    tipo_documental_id UUID       NOT NULL
                                   REFERENCES sigd_doc.tipo_documento (tipo_documental_id) ON DELETE RESTRICT,
    condicion_json_pointer VARCHAR(200) NULL,
    CONSTRAINT uq_tipo_documento_requisito UNIQUE (requisito_id, tipo_documental_id)
);

CREATE TABLE IF NOT EXISTS sigd_doc.expediente_requisito (
    id_expediente_requisito UUID        NOT NULL DEFAULT gen_random_uuid()
                                         CONSTRAINT pk_expediente_requisito PRIMARY KEY,
    expediente_id  UUID        NOT NULL
                             REFERENCES sigd_doc.expediente (expediente_id) ON DELETE CASCADE,
    requisito_id   UUID        NOT NULL
                             REFERENCES sigd_doc.requisito (requisito_id) ON DELETE RESTRICT,
    cumplido       BOOLEAN     NOT NULL DEFAULT FALSE,
    documento_adjunto_id UUID NULL,
    verificado_en  TIMESTAMPTZ NULL,
    CONSTRAINT uq_expediente_requisito UNIQUE (expediente_id, requisito_id)
);

-- -----------------------------------------------------------------------------
-- 4.7 documento_adjunto (metadatos MinIO S3 + SHA-256)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.documento_adjunto (
    documento_adjunto_id UUID        NOT NULL DEFAULT gen_random_uuid()
                                   CONSTRAINT pk_documento_adjunto PRIMARY KEY,
    expediente_id  UUID        NOT NULL
                             REFERENCES sigd_doc.expediente (expediente_id) ON DELETE CASCADE,
    tipo_documental_id UUID    NOT NULL
                             REFERENCES sigd_doc.tipo_documento (tipo_documental_id) ON DELETE RESTRICT,
    nombre_archivo VARCHAR(255) NOT NULL,
    s3_bucket      VARCHAR(120) NOT NULL,
    s3_key         VARCHAR(500) NOT NULL,
    sha256         CHAR(64)    NOT NULL,
    tamano_bytes   BIGINT      NOT NULL,
    mime_type      VARCHAR(120) NOT NULL,
    magic_bytes    VARCHAR(16) NULL,
    subido_por     UUID        NULL,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_documento_adjunto_s3 UNIQUE (s3_bucket, s3_key),
    CONSTRAINT uq_documento_adjunto_sha UNIQUE (s3_bucket, sha256),
    CONSTRAINT chk_documento_adjunto_tamano CHECK (tamano_bytes > 0)
);

COMMENT ON COLUMN sigd_doc.documento_adjunto.sha256 IS
    'SHA-256 del binario. La restricción de unicidad por bucket habilita la deduplicación de objetos idénticos.';
COMMENT ON COLUMN sigd_doc.documento_adjunto.magic_bytes IS
    'Prefijo hexadecimal de los Magic Bytes (PDF = 25504446) verificados en la carga presignada.';

CREATE INDEX IF NOT EXISTS idx_documento_adjunto_expediente ON sigd_doc.documento_adjunto (expediente_id);
CREATE INDEX IF NOT EXISTS idx_documento_adjunto_sha ON sigd_doc.documento_adjunto (sha256);

-- -----------------------------------------------------------------------------
-- 4.8 resolucion (borradores y actos administrativos firmados)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.resolucion (
    resolucion_id  UUID        NOT NULL DEFAULT gen_random_uuid()
                              CONSTRAINT pk_resolucion PRIMARY KEY,
    expediente_id  UUID        NOT NULL
                              REFERENCES sigd_doc.expediente (expediente_id) ON DELETE RESTRICT,
    numero_borrador VARCHAR(40) NOT NULL,
    numero_resolucion VARCHAR(40) NULL,
    tipo_resolucion VARCHAR(40) NOT NULL,
    asunto         VARCHAR(500) NOT NULL,
    estado         VARCHAR(40) NOT NULL DEFAULT 'BORRADOR_PENDIENTE_FIRMA',
    fecha_proyeccion DATE      NOT NULL,
    proyectado_por UUID        NULL,
    firmado_por    UUID        NULL,
    firmado_en     TIMESTAMPTZ NULL,
    hash_pades     VARCHAR(128) NULL,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_resolucion_borrador UNIQUE (expediente_id, numero_borrador),
    CONSTRAINT chk_resolucion_tipo CHECK (tipo_resolucion IN (
        'DIRECTORAL_TITULACION', 'DIRECTORAL_CONVALIDACION', 'DIRECTORAL_ADMINISTRATIVA'
    )),
    CONSTRAINT chk_resolucion_estado CHECK (estado IN (
        'BORRADOR_PENDIENTE_FIRMA', 'EN_FIRMA', 'FIRMADA', 'NOTIFICADA', 'ANULADA'
    )),
    CONSTRAINT chk_resolucion_firma CHECK (estado NOT IN ('FIRMADA', 'NOTIFICADA') OR firmado_en IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_resolucion_estado ON sigd_doc.resolucion (estado);
CREATE INDEX IF NOT EXISTS idx_resolucion_proyeccion ON sigd_doc.resolucion (fecha_proyeccion);
