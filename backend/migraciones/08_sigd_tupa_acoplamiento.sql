-- Base aditiva de Geric para contrastar el TUPA 2026 con expedientes reales.
-- No publica tarifas ni altera el catálogo legado sigd_doc.tipo_tramite_tupa.
-- Se instala después de 04_sigd_doc.sql y 05_sigd_tra.sql. El runner general
-- sigue requiriendo resolver por separado las incompatibilidades de 06/07.

CREATE TABLE IF NOT EXISTS sigd_doc.tupa_registro_version (
    registro_version_id UUID NOT NULL DEFAULT gen_random_uuid()
        CONSTRAINT pk_tupa_registro_version PRIMARY KEY,
    documento_sha256 CHAR(64) NOT NULL,
    fuente_nombre TEXT NOT NULL,
    pagina INTEGER NOT NULL,
    referencia_fila TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    codigo_externo TEXT NULL,
    denominacion_original TEXT NOT NULL,
    monto_original TEXT NULL,
    requisitos_original JSONB NULL,
    referencia_normativa_original TEXT NULL,
    version_fuente TEXT NULL,
    vigencia_desde DATE NULL,
    vigencia_hasta DATE NULL,
    estado_validacion TEXT NOT NULL DEFAULT 'PENDIENTE_VALIDACION',
    referencia_aprobacion TEXT NULL,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tupa_registro_procedencia
        UNIQUE (documento_sha256, pagina, referencia_fila, revision),
    CONSTRAINT chk_tupa_documento_sha256
        CHECK (documento_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_tupa_fuente_nombre CHECK (btrim(fuente_nombre) <> ''),
    CONSTRAINT chk_tupa_pagina CHECK (pagina > 0),
    CONSTRAINT chk_tupa_referencia_fila CHECK (btrim(referencia_fila) <> ''),
    CONSTRAINT chk_tupa_revision CHECK (revision > 0),
    CONSTRAINT chk_tupa_denominacion CHECK (btrim(denominacion_original) <> ''),
    CONSTRAINT chk_tupa_vigencia CHECK (vigencia_hasta IS NULL
        OR (vigencia_desde IS NOT NULL AND vigencia_hasta >= vigencia_desde)),
    CONSTRAINT chk_tupa_estado_validacion CHECK (estado_validacion IN
        ('PENDIENTE_VALIDACION', 'APROBADO', 'RECHAZADO')),
    CONSTRAINT chk_tupa_aprobacion CHECK (estado_validacion <> 'APROBADO'
        OR (referencia_aprobacion IS NOT NULL AND btrim(referencia_aprobacion) <> ''))
);

COMMENT ON TABLE sigd_doc.tupa_registro_version IS
    'Registro inmutable de procedencia TUPA. No sustituye el catálogo activo ni publica montos.';
COMMENT ON COLUMN sigd_doc.tupa_registro_version.codigo_externo IS
    'Código tal como aparece en la fuente; no se supone único entre versiones o documentos.';

CREATE TABLE IF NOT EXISTS sigd_doc.expediente_tupa_vinculo (
    vinculo_id UUID NOT NULL DEFAULT gen_random_uuid()
        CONSTRAINT pk_expediente_tupa_vinculo PRIMARY KEY,
    expediente_id UUID NOT NULL
        CONSTRAINT fk_vinculo_tupa_expediente REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    registro_version_id UUID NOT NULL
        CONSTRAINT fk_vinculo_tupa_version REFERENCES sigd_doc.tupa_registro_version (registro_version_id) ON DELETE RESTRICT,
    vinculado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    reemplaza_vinculo_id UUID NULL
        CONSTRAINT fk_vinculo_tupa_anterior REFERENCES sigd_doc.expediente_tupa_vinculo (vinculo_id) ON DELETE RESTRICT,
    motivo TEXT NULL,
    CONSTRAINT uq_vinculo_tupa_sucesor UNIQUE (reemplaza_vinculo_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vinculo_tupa_raiz_expediente
    ON sigd_doc.expediente_tupa_vinculo (expediente_id)
    WHERE reemplaza_vinculo_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_vinculo_tupa_expediente_fecha
    ON sigd_doc.expediente_tupa_vinculo (expediente_id, vinculado_en DESC, vinculo_id DESC);
CREATE INDEX IF NOT EXISTS idx_vinculo_tupa_version
    ON sigd_doc.expediente_tupa_vinculo (registro_version_id);

CREATE OR REPLACE FUNCTION sigd_doc.fn_tupa_registro_inmutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'El registro de procedencia TUPA es inmutable'
        USING ERRCODE = '23001';
END;
$$;

DROP TRIGGER IF EXISTS tr_tupa_registro_inmutable ON sigd_doc.tupa_registro_version;
CREATE TRIGGER tr_tupa_registro_inmutable
    BEFORE UPDATE OR DELETE ON sigd_doc.tupa_registro_version
    FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_tupa_registro_inmutable();

DROP TRIGGER IF EXISTS tr_tupa_registro_no_truncar ON sigd_doc.tupa_registro_version;
CREATE TRIGGER tr_tupa_registro_no_truncar
    BEFORE TRUNCATE ON sigd_doc.tupa_registro_version
    FOR EACH STATEMENT EXECUTE FUNCTION sigd_doc.fn_tupa_registro_inmutable();

CREATE OR REPLACE FUNCTION sigd_doc.fn_tupa_vinculo_validar()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_estado TEXT;
    v_expediente_anterior UUID;
BEGIN
    SELECT estado_validacion INTO v_estado
      FROM sigd_doc.tupa_registro_version
     WHERE registro_version_id = NEW.registro_version_id;
    IF v_estado IS DISTINCT FROM 'APROBADO' THEN
        RAISE EXCEPTION 'Solo se puede vincular una versión TUPA aprobada'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.reemplaza_vinculo_id IS NOT NULL THEN
        SELECT expediente_id INTO v_expediente_anterior
          FROM sigd_doc.expediente_tupa_vinculo
         WHERE vinculo_id = NEW.reemplaza_vinculo_id;
        IF v_expediente_anterior IS DISTINCT FROM NEW.expediente_id THEN
            RAISE EXCEPTION 'El vínculo anterior debe pertenecer al mismo expediente'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_tupa_vinculo_validar ON sigd_doc.expediente_tupa_vinculo;
CREATE TRIGGER tr_tupa_vinculo_validar
    BEFORE INSERT ON sigd_doc.expediente_tupa_vinculo
    FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_tupa_vinculo_validar();

CREATE OR REPLACE FUNCTION sigd_doc.fn_tupa_vinculo_inmutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'El vínculo TUPA es inmutable; registre un sucesor'
        USING ERRCODE = '23001';
END;
$$;

DROP TRIGGER IF EXISTS tr_tupa_vinculo_inmutable ON sigd_doc.expediente_tupa_vinculo;
CREATE TRIGGER tr_tupa_vinculo_inmutable
    BEFORE UPDATE OR DELETE ON sigd_doc.expediente_tupa_vinculo
    FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_tupa_vinculo_inmutable();

DROP TRIGGER IF EXISTS tr_tupa_vinculo_no_truncar ON sigd_doc.expediente_tupa_vinculo;
CREATE TRIGGER tr_tupa_vinculo_no_truncar
    BEFORE TRUNCATE ON sigd_doc.expediente_tupa_vinculo
    FOR EACH STATEMENT EXECUTE FUNCTION sigd_doc.fn_tupa_vinculo_inmutable();
