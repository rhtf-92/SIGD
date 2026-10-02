-- ============================================================================
-- 05_esquema_sigd_doc_jsonb.sql
-- Sistema Integral de Gestión Documentaria (SIGD)
-- Módulo: DocuCore — Documentos, Requisitos y Formularios
-- Esquema: sigd_doc
-- Versión: 6.1 — versión consolidada y corregida según el modelo y diccionario
--            DocuCore v2.0
-- Motor objetivo: PostgreSQL 18+
-- Fecha: 2026-09-09
--
-- Criterios consolidados:
--   * TIPO_TRAMITE_TUPA y TIPO_DOCUMENTO son entidades separadas.
--   * TIPO_TRAMITE_TUPA <-> TIPO_DOCUMENTO se mantiene 1:1.
--   * USUARIO pertenece a sigd_auth; sus UUID se manejan como referencias
--     externas, sin tabla ni FK local en DocuCore.
--   * FORMULARIO_VERSION almacena JSON Schema Draft 2020-12 en JSONB.
--   * EXPEDIENTE almacena payload_respuestas JSONB y conserva la versión exacta
--     del formulario utilizada para iniciar el trámite.
--   * CAMPO_FORMULARIO / VALOR_CAMPO no existen: se elimina el antipatrón EAV.
--   * DOCUMENTO_ADJUNTO almacena solo metadatos; el archivo físico vive en
--     MinIO/S3 y se carga mediante URLs prefirmadas.
--   * Magic Bytes y SHA-256 se calculan en aplicación/servicio de almacenamiento.
--   * El expediente NO se radica automáticamente por cargar requisitos.
--   * BORRADOR permanece separado de la radicación administrativa.
--   * El estado de EXPEDIENTE_REQUISITO se deriva de los documentos vigentes.
--   * El estado administrativo del EXPEDIENTE solo se actualiza mediante
--     operaciones controladas y nunca por completar automáticamente un requisito
--     de un borrador.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS sigd_doc;

SET LOCAL TIME ZONE 'America/Lima';

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

DO $$
BEGIN
    CREATE TYPE sigd_doc.calificacion_administrativa_enum AS ENUM (
        'APROBACION_AUTOMATICA',
        'EVALUACION_PREVIA_SAP',
        'EVALUACION_PREVIA_SAN'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE sigd_doc.tipo_obligatoriedad_enum AS ENUM (
        'OBLIGATORIO',
        'OPCIONAL',
        'CONDICIONAL'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE sigd_doc.estado_expediente_enum AS ENUM (
        'BORRADOR',
        'EN_REVISION',
        'OBSERVADO',
        'SUBSANACION',
        'APROBADO',
        'RECHAZADO_POR_CADUCIDAD',
        'INACTIVO'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE sigd_doc.estado_expediente_requisito_enum AS ENUM (
        'PENDIENTE',
        'OBSERVADO',
        'SUBSANADO',
        'APROBADO'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE sigd_doc.estado_documento_enum AS ENUM (
        'CARGADO',
        'OBSERVADO',
        'APROBADO',
        'REEMPLAZADO',
        'ELIMINADO'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

-- ============================================================================
-- 2. TIPO_TRAMITE_TUPA
-- Catálogo legal/administrativo.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sigd_doc.tipo_tramite_tupa (
    id_tipo_tramite_tupa UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_tupa VARCHAR(30),
    denominacion VARCHAR(200) NOT NULL,
    es_tupa BOOLEAN NOT NULL,
    calificacion_administrativa sigd_doc.calificacion_administrativa_enum,
    plazo_max_dias_habiles INTEGER,
    costo NUMERIC(8,2),
    unidad_organica_responsable VARCHAR(150),
    base_legal TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_tupa_codigo UNIQUE (codigo_tupa),
    CONSTRAINT ck_tupa_codigo_no_vacio CHECK (
        codigo_tupa IS NULL OR btrim(codigo_tupa) <> ''
    ),
    CONSTRAINT ck_tupa_denominacion_no_vacia CHECK (
        btrim(denominacion) <> ''
    ),
    CONSTRAINT ck_tupa_plazo_no_negativo CHECK (
        plazo_max_dias_habiles IS NULL OR plazo_max_dias_habiles >= 0
    ),
    CONSTRAINT ck_tupa_costo_no_negativo CHECK (
        costo IS NULL OR costo >= 0
    ),
    CONSTRAINT ck_tupa_calificacion_coherente CHECK (
        es_tupa = FALSE OR calificacion_administrativa IS NOT NULL
    )
);

-- ============================================================================
-- 3. TIPO_DOCUMENTO
-- Configuración técnica del trámite/documento.
-- Un TIPO_DOCUMENTO puede estar en borrador sin TUPA; para activarse debe tener
-- clasificación TUPA. La relación con TIPO_TRAMITE_TUPA es 1:1.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sigd_doc.tipo_documento (
    id_tipo_documento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_tipo_tramite_tupa UUID,
    codigo_tipo VARCHAR(30) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT FALSE,
    id_usuario_creador UUID,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_tipo_documento_codigo UNIQUE (codigo_tipo),
    CONSTRAINT uq_tipo_documento_tupa UNIQUE (id_tipo_tramite_tupa),

    CONSTRAINT fk_tipo_documento_tupa
        FOREIGN KEY (id_tipo_tramite_tupa)
        REFERENCES sigd_doc.tipo_tramite_tupa(id_tipo_tramite_tupa)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT ck_tipo_documento_codigo_no_vacio CHECK (
        btrim(codigo_tipo) <> ''
    ),
    CONSTRAINT ck_tipo_documento_nombre_no_vacio CHECK (
        btrim(nombre) <> ''
    )
);

-- ============================================================================
-- 4. FORMULARIO_VERSION
-- Una fila representa una versión completa e inmutable del formulario.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sigd_doc.formulario_version (
    id_formulario_version UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_tipo_documento UUID NOT NULL,
    version SMALLINT NOT NULL,
    schema_definicion JSONB NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_formulario_version_tipo_documento
        FOREIGN KEY (id_tipo_documento)
        REFERENCES sigd_doc.tipo_documento(id_tipo_documento)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT uq_formulario_version UNIQUE (id_tipo_documento, version),

    CONSTRAINT ck_formulario_version_mayor_cero CHECK (version > 0),

    CONSTRAINT ck_formulario_version_schema_objeto CHECK (
        jsonb_typeof(schema_definicion) = 'object'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_formulario_version_activa
ON sigd_doc.formulario_version(id_tipo_documento)
WHERE activo = TRUE;

-- ============================================================================
-- 5. EXPEDIENTE
-- Instancia concreta del trámite.
--
-- IMPORTANTE:
--   BORRADOR = preparación. No tiene codigo_oficial ni fecha_radicacion.
--   La radicación es explícita y administrativa.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sigd_doc.expediente (
    id_expediente UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_oficial VARCHAR(30),
    id_formulario_version UUID NOT NULL,
    id_usuario_solicitante UUID NOT NULL,
    payload_respuestas JSONB NOT NULL,
    estado sigd_doc.estado_expediente_enum NOT NULL DEFAULT 'BORRADOR',
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_radicacion TIMESTAMPTZ,

    CONSTRAINT fk_expediente_formulario_version
        FOREIGN KEY (id_formulario_version)
        REFERENCES sigd_doc.formulario_version(id_formulario_version)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT uq_expediente_codigo_oficial UNIQUE (codigo_oficial),

    CONSTRAINT ck_expediente_payload_objeto CHECK (
        jsonb_typeof(payload_respuestas) = 'object'
    ),

    CONSTRAINT ck_expediente_codigo_oficial CHECK (
        (estado = 'BORRADOR' AND codigo_oficial IS NULL)
        OR
        (estado <> 'BORRADOR' AND codigo_oficial IS NOT NULL)
    ),

    CONSTRAINT ck_expediente_radicacion CHECK (
        (estado = 'BORRADOR' AND fecha_radicacion IS NULL)
        OR
        (estado <> 'BORRADOR' AND fecha_radicacion IS NOT NULL)
    )
);

-- ============================================================================
-- 6. REQUISITO
-- ============================================================================

CREATE TABLE IF NOT EXISTS sigd_doc.requisito (
    id_requisito UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_requisito VARCHAR(20) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion_guia TEXT,
    tipo_obligatoriedad sigd_doc.tipo_obligatoriedad_enum NOT NULL,
    orden_presentacion SMALLINT NOT NULL,
    requiere_vigencia BOOLEAN NOT NULL DEFAULT FALSE,
    dias_vigencia_max INTEGER,
    permite_multiples BOOLEAN NOT NULL DEFAULT FALSE,
    cantidad_max_archivos SMALLINT NOT NULL DEFAULT 1,
    peso_maximo_mb NUMERIC(5,2) NOT NULL,
    formatos_permitidos VARCHAR(100) NOT NULL,

    CONSTRAINT uq_requisito_codigo UNIQUE (codigo_requisito),

    CONSTRAINT ck_requisito_codigo_no_vacio CHECK (
        btrim(codigo_requisito) <> ''
    ),
    CONSTRAINT ck_requisito_nombre_no_vacio CHECK (
        btrim(nombre) <> ''
    ),
    CONSTRAINT ck_requisito_orden CHECK (
        orden_presentacion > 0
    ),
    CONSTRAINT ck_requisito_vigencia CHECK (
        (
            requiere_vigencia = TRUE
            AND dias_vigencia_max IS NOT NULL
            AND dias_vigencia_max > 0
        )
        OR
        (
            requiere_vigencia = FALSE
            AND dias_vigencia_max IS NULL
        )
    ),
    CONSTRAINT ck_requisito_cantidad_archivos CHECK (
        cantidad_max_archivos > 0
    ),
    CONSTRAINT ck_requisito_peso_maximo CHECK (
        peso_maximo_mb > 0 AND peso_maximo_mb <= 25
    ),
    CONSTRAINT ck_requisito_formatos_no_vacios CHECK (
        btrim(formatos_permitidos) <> ''
    )
);

-- ============================================================================
-- 7. TIPO_DOCUMENTO_REQUISITO
-- M:N entre tipo documental y requisito.
-- La condición apunta a una ruta JSON Pointer, no a una tabla de campos.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sigd_doc.tipo_documento_requisito (
    id_tipo_documento_requisito UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_tipo_documento UUID NOT NULL,
    id_requisito UUID NOT NULL,
    obligatoriedad_override sigd_doc.tipo_obligatoriedad_enum,
    campo_condicionante_path TEXT,
    valor_condicionante VARCHAR(100),

    CONSTRAINT fk_tdr_tipo_documento
        FOREIGN KEY (id_tipo_documento)
        REFERENCES sigd_doc.tipo_documento(id_tipo_documento)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_tdr_requisito
        FOREIGN KEY (id_requisito)
        REFERENCES sigd_doc.requisito(id_requisito)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT uq_tipo_documento_requisito
        UNIQUE (id_tipo_documento, id_requisito),

    CONSTRAINT ck_tdr_condicion_completa CHECK (
        (
            campo_condicionante_path IS NULL
            AND valor_condicionante IS NULL
        )
        OR
        (
            campo_condicionante_path IS NOT NULL
            AND btrim(campo_condicionante_path) <> ''
            AND valor_condicionante IS NOT NULL
            AND btrim(valor_condicionante) <> ''
        )
    )
);

-- ============================================================================
-- 8. EXPEDIENTE_REQUISITO
-- El estado se deriva de DOCUMENTO_ADJUNTO.
-- id_evaluador/fecha_evaluacion son metadatos de la actuación del evaluador.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sigd_doc.expediente_requisito (
    id_expediente_requisito UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_expediente UUID NOT NULL,
    id_tipo_documento_requisito UUID NOT NULL,
    estado sigd_doc.estado_expediente_requisito_enum NOT NULL DEFAULT 'PENDIENTE',
    id_evaluador UUID,
    fecha_evaluacion TIMESTAMPTZ,
    fecha_activacion TIMESTAMPTZ,

    CONSTRAINT fk_expediente_requisito_expediente
        FOREIGN KEY (id_expediente)
        REFERENCES sigd_doc.expediente(id_expediente)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_expediente_requisito_tdr
        FOREIGN KEY (id_tipo_documento_requisito)
        REFERENCES sigd_doc.tipo_documento_requisito(id_tipo_documento_requisito)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT uq_expediente_requisito
        UNIQUE (id_expediente, id_tipo_documento_requisito),

    CONSTRAINT ck_expediente_requisito_evaluacion CHECK (
        (
            id_evaluador IS NULL
            AND fecha_evaluacion IS NULL
        )
        OR
        (
            id_evaluador IS NOT NULL
            AND fecha_evaluacion IS NOT NULL
        )
    )
);

-- ============================================================================
-- 9. DOCUMENTO_ADJUNTO
-- Solo metadatos. El objeto físico está en MinIO/S3.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sigd_doc.documento_adjunto (
    id_documento_adjunto UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_expediente_requisito UUID NOT NULL,
    id_usuario_subida UUID NOT NULL,
    nombre_original VARCHAR(255) NOT NULL,
    s3_bucket VARCHAR(100) NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    formato_extension VARCHAR(10) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    tamanio_bytes BIGINT NOT NULL,
    sha256_hash CHAR(64) NOT NULL,
    magic_bytes_validado BOOLEAN NOT NULL DEFAULT FALSE,
    version_num SMALLINT NOT NULL DEFAULT 1,
    id_documento_anterior UUID,
    estado_documento sigd_doc.estado_documento_enum NOT NULL DEFAULT 'CARGADO',
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_documento_expediente_requisito
        FOREIGN KEY (id_expediente_requisito)
        REFERENCES sigd_doc.expediente_requisito(id_expediente_requisito)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_documento_anterior
        FOREIGN KEY (id_documento_anterior)
        REFERENCES sigd_doc.documento_adjunto(id_documento_adjunto)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT uq_documento_s3_key UNIQUE (s3_key),
    CONSTRAINT uq_documento_anterior UNIQUE (id_documento_anterior),

    CONSTRAINT ck_documento_nombre_no_vacio CHECK (btrim(nombre_original) <> ''),
    CONSTRAINT ck_documento_bucket_no_vacio CHECK (btrim(s3_bucket) <> ''),
    CONSTRAINT ck_documento_s3_key_no_vacio CHECK (btrim(s3_key) <> ''),
    CONSTRAINT ck_documento_extension CHECK (
        formato_extension ~ '^[A-Za-z0-9]{1,10}$'
    ),
    CONSTRAINT ck_documento_mime_no_vacio CHECK (btrim(mime_type) <> ''),
    CONSTRAINT ck_documento_tamanio CHECK (tamanio_bytes > 0),
    CONSTRAINT ck_documento_hash CHECK (
        sha256_hash ~ '^[0-9a-fA-F]{64}$'
    ),
    CONSTRAINT ck_documento_version CHECK (version_num > 0),
    CONSTRAINT ck_documento_no_autorreferencia CHECK (
        id_documento_anterior IS NULL
        OR id_documento_anterior <> id_documento_adjunto
    ),

    -- Un documento nuevo nace como CARGADO. Los demás estados se obtienen por
    -- evaluación/reemplazo y no se inyectan arbitrariamente en el alta.
    CONSTRAINT ck_documento_alta_cargado CHECK (
        estado_documento = 'CARGADO'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_documento_sha256
ON sigd_doc.documento_adjunto(sha256_hash);

-- ============================================================================
-- 10. ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_formulario_version_schema_gin
ON sigd_doc.formulario_version
USING GIN (schema_definicion);

CREATE INDEX IF NOT EXISTS idx_expediente_payload_gin
ON sigd_doc.expediente
USING GIN (payload_respuestas jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_formulario_version_tipo_documento
ON sigd_doc.formulario_version(id_tipo_documento);

CREATE INDEX IF NOT EXISTS idx_expediente_formulario_version
ON sigd_doc.expediente(id_formulario_version);

CREATE INDEX IF NOT EXISTS idx_expediente_usuario_solicitante
ON sigd_doc.expediente(id_usuario_solicitante);

CREATE INDEX IF NOT EXISTS idx_expediente_estado
ON sigd_doc.expediente(estado);

CREATE INDEX IF NOT EXISTS idx_tdr_tipo_documento
ON sigd_doc.tipo_documento_requisito(id_tipo_documento);

CREATE INDEX IF NOT EXISTS idx_tdr_requisito
ON sigd_doc.tipo_documento_requisito(id_requisito);

CREATE INDEX IF NOT EXISTS idx_expediente_requisito_expediente
ON sigd_doc.expediente_requisito(id_expediente);

CREATE INDEX IF NOT EXISTS idx_expediente_requisito_tdr
ON sigd_doc.expediente_requisito(id_tipo_documento_requisito);

CREATE INDEX IF NOT EXISTS idx_expediente_requisito_evaluador
ON sigd_doc.expediente_requisito(id_evaluador);

CREATE INDEX IF NOT EXISTS idx_documento_expediente_requisito
ON sigd_doc.documento_adjunto(id_expediente_requisito);

CREATE INDEX IF NOT EXISTS idx_documento_estado
ON sigd_doc.documento_adjunto(estado_documento);

-- ============================================================================
-- 11. COMENTARIOS
-- ============================================================================

COMMENT ON SCHEMA sigd_doc IS
'Esquema del módulo DocuCore del Sistema Integral de Gestión Documentaria (SIGD).';

COMMENT ON TABLE sigd_doc.tipo_tramite_tupa IS
'Catálogo legal y administrativo de trámites TUPA y no TUPA.';

COMMENT ON TABLE sigd_doc.tipo_documento IS
'Configuración técnica del trámite/documento. Puede permanecer en borrador sin clasificación TUPA.';

COMMENT ON TABLE sigd_doc.formulario_version IS
'Versión completa e inmutable de un formulario mediante JSON Schema Draft 2020-12.';

COMMENT ON COLUMN sigd_doc.formulario_version.schema_definicion IS
'Definición del formulario almacenada como JSONB. La validación completa del JSON Schema corresponde a la capa de aplicación.';

COMMENT ON TABLE sigd_doc.expediente IS
'Instancia concreta del trámite. BORRADOR no equivale a radicación administrativa.';

COMMENT ON COLUMN sigd_doc.expediente.payload_respuestas IS
'Respuestas del solicitante en JSONB, validadas en aplicación contra la versión exacta de FORMULARIO_VERSION.';

COMMENT ON TABLE sigd_doc.requisito IS
'Catálogo general y reutilizable de requisitos documentales.';

COMMENT ON TABLE sigd_doc.tipo_documento_requisito IS
'Relación M:N entre TIPO_DOCUMENTO y REQUISITO, con reglas de obligatoriedad y condición.';

COMMENT ON TABLE sigd_doc.expediente_requisito IS
'Instancia de un requisito dentro de un expediente. Su estado se deriva de los documentos vigentes.';

COMMENT ON TABLE sigd_doc.documento_adjunto IS
'Metadatos de documentos cuyo contenido físico se almacena externamente en MinIO/S3.';

COMMENT ON COLUMN sigd_doc.documento_adjunto.s3_bucket IS
'Bucket de MinIO/S3 donde se almacena el objeto físico.';

COMMENT ON COLUMN sigd_doc.documento_adjunto.s3_key IS
'Clave única del objeto físico dentro del bucket.';

COMMENT ON COLUMN sigd_doc.documento_adjunto.sha256_hash IS
'Hash SHA-256 del contenido binario real; se calcula en la capa de aplicación y queda inmutable.';

COMMENT ON COLUMN sigd_doc.documento_adjunto.magic_bytes_validado IS
'Resultado de la validación física Magic Bytes/MIME realizada por la aplicación/servicio de almacenamiento. PostgreSQL no inspecciona el objeto S3/MinIO.';

-- ============================================================================
-- 12. VALIDACIÓN DE JSON POINTER
-- ============================================================================

CREATE OR REPLACE FUNCTION sigd_doc.fn_validar_campo_condicionante()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.campo_condicionante_path IS NOT NULL
       AND NEW.campo_condicionante_path !~
           '^/(?:([^~/]|~[01])*(?:/([^~/]|~[01])*)*)?$'
    THEN
        RAISE EXCEPTION
            'El campo_condicionante_path "%" no es un JSON Pointer válido.',
            NEW.campo_condicionante_path;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validar_campo_condicionante
ON sigd_doc.tipo_documento_requisito;

CREATE TRIGGER tr_validar_campo_condicionante
BEFORE INSERT OR UPDATE
ON sigd_doc.tipo_documento_requisito
FOR EACH ROW
EXECUTE FUNCTION sigd_doc.fn_validar_campo_condicionante();

-- ============================================================================
-- 13. VALIDACIÓN DE ACTIVACIÓN TIPO_DOCUMENTO
-- ============================================================================

CREATE OR REPLACE FUNCTION sigd_doc.fn_validar_activacion_tipo_documento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.activo = TRUE
       AND NEW.id_tipo_tramite_tupa IS NULL
    THEN
        RAISE EXCEPTION
            'No se puede activar el tipo_documento % sin clasificación TUPA.',
            NEW.id_tipo_documento;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validar_activacion_tipo_documento
ON sigd_doc.tipo_documento;

CREATE TRIGGER tr_validar_activacion_tipo_documento
BEFORE INSERT OR UPDATE
ON sigd_doc.tipo_documento
FOR EACH ROW
EXECUTE FUNCTION sigd_doc.fn_validar_activacion_tipo_documento();

-- ============================================================================
-- 14. VALIDACIÓN DE FORMULARIO VERSIONADO
-- ============================================================================

CREATE OR REPLACE FUNCTION sigd_doc.fn_proteger_formulario_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.schema_definicion IS DISTINCT FROM NEW.schema_definicion
           OR OLD.version IS DISTINCT FROM NEW.version
           OR OLD.id_tipo_documento IS DISTINCT FROM NEW.id_tipo_documento
        THEN
            RAISE EXCEPTION
                'Las versiones de formularios son inmutables. Cree una nueva versión.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_proteger_formulario_version
ON sigd_doc.formulario_version;

CREATE TRIGGER tr_proteger_formulario_version
BEFORE UPDATE
ON sigd_doc.formulario_version
FOR EACH ROW
EXECUTE FUNCTION sigd_doc.fn_proteger_formulario_version();

-- ============================================================================
-- 15. VALIDACIÓN DE EXPEDIENTE CONTRA FORMULARIO Y TIPO ACTIVO
-- ============================================================================

CREATE OR REPLACE FUNCTION sigd_doc.fn_validar_expediente_activo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tipo_activo BOOLEAN;
    v_formulario_activo BOOLEAN;
BEGIN
    SELECT fv.activo, td.activo
      INTO v_formulario_activo, v_tipo_activo
      FROM sigd_doc.formulario_version fv
      JOIN sigd_doc.tipo_documento td
        ON td.id_tipo_documento = fv.id_tipo_documento
     WHERE fv.id_formulario_version = NEW.id_formulario_version;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El formulario_version % no existe.',
            NEW.id_formulario_version;
    END IF;

    IF v_formulario_activo IS NOT TRUE THEN
        RAISE EXCEPTION
            'No se puede crear o actualizar un expediente con un formulario_version inactivo.';
    END IF;

    IF v_tipo_activo IS NOT TRUE THEN
        RAISE EXCEPTION
            'No se puede crear o actualizar un expediente con un tipo_documento inactivo.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validar_expediente_activo
ON sigd_doc.expediente;

CREATE TRIGGER tr_validar_expediente_activo
BEFORE INSERT OR UPDATE OF id_formulario_version
ON sigd_doc.expediente
FOR EACH ROW
EXECUTE FUNCTION sigd_doc.fn_validar_expediente_activo();

-- ============================================================================
-- 16. VALIDACIÓN DE EXPEDIENTE_REQUISITO
-- Debe corresponder al mismo TIPO_DOCUMENTO de la versión de formulario.
-- ============================================================================

CREATE OR REPLACE FUNCTION sigd_doc.fn_validar_expediente_requisito()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tipo_documento_expediente UUID;
    v_tipo_documento_requisito UUID;
BEGIN
    SELECT fv.id_tipo_documento
      INTO v_tipo_documento_expediente
      FROM sigd_doc.expediente e
      JOIN sigd_doc.formulario_version fv
        ON fv.id_formulario_version = e.id_formulario_version
     WHERE e.id_expediente = NEW.id_expediente;

    SELECT tdr.id_tipo_documento
      INTO v_tipo_documento_requisito
      FROM sigd_doc.tipo_documento_requisito tdr
     WHERE tdr.id_tipo_documento_requisito =
           NEW.id_tipo_documento_requisito;

    IF v_tipo_documento_expediente IS NULL THEN
        RAISE EXCEPTION
            'El expediente % no existe o no tiene una versión de formulario válida.',
            NEW.id_expediente;
    END IF;

    IF v_tipo_documento_requisito IS NULL THEN
        RAISE EXCEPTION
            'El tipo_documento_requisito % no existe.',
            NEW.id_tipo_documento_requisito;
    END IF;

    IF v_tipo_documento_expediente <> v_tipo_documento_requisito THEN
        RAISE EXCEPTION
            'El requisito % no pertenece al tipo de documento del expediente %.',
            NEW.id_tipo_documento_requisito,
            NEW.id_expediente;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validar_expediente_requisito
ON sigd_doc.expediente_requisito;

CREATE TRIGGER tr_validar_expediente_requisito
BEFORE INSERT OR UPDATE
ON sigd_doc.expediente_requisito
FOR EACH ROW
EXECUTE FUNCTION sigd_doc.fn_validar_expediente_requisito();

-- ============================================================================
-- 17. PROTECCIÓN DEL ESTADO DERIVADO DE EXPEDIENTE_REQUISITO
--
-- RN-REQ-005: el estado no lo asigna directamente el evaluador; se deriva de
-- los documentos vigentes.
--
-- Las actualizaciones internas realizadas por fn_recalcular_estado_requisito
-- se ejecutan con mayor profundidad de trigger y quedan permitidas.
-- ============================================================================

CREATE OR REPLACE FUNCTION sigd_doc.fn_proteger_estado_expediente_requisito()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.estado IS DISTINCT FROM NEW.estado
       AND pg_trigger_depth() = 1
    THEN
        RAISE EXCEPTION
            'El estado de expediente_requisito es derivado y no puede modificarse directamente. '
            'Debe cambiar como consecuencia de la evaluación de sus documentos.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_proteger_estado_expediente_requisito
ON sigd_doc.expediente_requisito;

CREATE TRIGGER tr_proteger_estado_expediente_requisito
BEFORE UPDATE OF estado
ON sigd_doc.expediente_requisito
FOR EACH ROW
EXECUTE FUNCTION sigd_doc.fn_proteger_estado_expediente_requisito();

-- ============================================================================
-- 18. VALIDACIÓN DE ADJUNTOS
-- Tamaño y cantidad máxima por requisito.
-- ============================================================================

CREATE OR REPLACE FUNCTION sigd_doc.fn_validar_adjunto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_peso_maximo_mb NUMERIC(5,2);
    v_cantidad_max_archivos SMALLINT;
    v_permite_multiples BOOLEAN;
    v_tamanio_maximo_bytes BIGINT;
    v_cantidad_actual INTEGER;
BEGIN
    SELECT
        r.peso_maximo_mb,
        r.cantidad_max_archivos,
        r.permite_multiples
    INTO
        v_peso_maximo_mb,
        v_cantidad_max_archivos,
        v_permite_multiples
    FROM sigd_doc.expediente_requisito er
    JOIN sigd_doc.tipo_documento_requisito tdr
      ON tdr.id_tipo_documento_requisito = er.id_tipo_documento_requisito
    JOIN sigd_doc.requisito r
      ON r.id_requisito = tdr.id_requisito
    WHERE er.id_expediente_requisito = NEW.id_expediente_requisito
    FOR UPDATE OF er;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El expediente_requisito % no existe.',
            NEW.id_expediente_requisito;
    END IF;

    v_tamanio_maximo_bytes :=
        CEIL(v_peso_maximo_mb * 1024 * 1024)::BIGINT;

    IF NEW.tamanio_bytes > v_tamanio_maximo_bytes THEN
        RAISE EXCEPTION
            'El archivo excede el peso máximo permitido de % MB.',
            v_peso_maximo_mb;
    END IF;

    SELECT COUNT(*)
      INTO v_cantidad_actual
      FROM sigd_doc.documento_adjunto da
     WHERE da.id_expediente_requisito = NEW.id_expediente_requisito
       AND da.id_documento_adjunto <> NEW.id_documento_adjunto
       AND da.estado_documento NOT IN ('REEMPLAZADO', 'ELIMINADO')
       AND (
           NEW.id_documento_anterior IS NULL
           OR da.id_documento_adjunto <> NEW.id_documento_anterior
       );

    IF v_permite_multiples IS FALSE AND v_cantidad_actual >= 1 THEN
        RAISE EXCEPTION
            'El requisito no permite múltiples archivos.';
    END IF;

    IF v_cantidad_actual >= v_cantidad_max_archivos THEN
        RAISE EXCEPTION
            'Se alcanzó la cantidad máxima de % archivos para el requisito.',
            v_cantidad_max_archivos;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validar_adjunto
ON sigd_doc.documento_adjunto;

CREATE TRIGGER tr_validar_adjunto
BEFORE INSERT OR UPDATE
ON sigd_doc.documento_adjunto
FOR EACH ROW
EXECUTE FUNCTION sigd_doc.fn_validar_adjunto();

-- ============================================================================
-- 19. DOCUMENTOS: MAGIC BYTES, APROBACIÓN, ELIMINACIÓN Y SHA-256
-- ============================================================================

CREATE OR REPLACE FUNCTION sigd_doc.fn_proteger_documento_aprobado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'No se permite eliminar físicamente un documento. Utilice estado ELIMINADO.';
    END IF;

    IF TG_OP = 'INSERT' AND NEW.estado_documento <> 'CARGADO' THEN
        RAISE EXCEPTION
            'Un documento nuevo debe registrarse inicialmente en estado CARGADO.';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.estado_documento = 'APROBADO'
           AND NEW IS DISTINCT FROM OLD
        THEN
            RAISE EXCEPTION
                'Un documento aprobado es inmutable.';
        END IF;

        IF OLD.estado_documento IN ('REEMPLAZADO', 'ELIMINADO')
           AND NEW.estado_documento <> OLD.estado_documento
        THEN
            RAISE EXCEPTION
                'Un documento % no puede volver a un estado activo.',
                OLD.estado_documento;
        END IF;

        IF NEW.id_documento_anterior IS DISTINCT FROM OLD.id_documento_anterior
           AND NEW.id_documento_anterior IS NOT NULL
        THEN
            RAISE EXCEPTION
                'La cadena de reemplazo se establece al insertar una nueva versión.';
        END IF;
    END IF;

    IF NEW.estado_documento = 'APROBADO'
       AND NEW.magic_bytes_validado IS NOT TRUE
    THEN
        RAISE EXCEPTION
            'Un documento no puede aprobarse hasta validar sus Magic Bytes.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_proteger_documento
ON sigd_doc.documento_adjunto;

CREATE TRIGGER tr_proteger_documento
BEFORE INSERT OR UPDATE OR DELETE
ON sigd_doc.documento_adjunto
FOR EACH ROW
EXECUTE FUNCTION sigd_doc.fn_proteger_documento_aprobado();

CREATE OR REPLACE FUNCTION sigd_doc.fn_validar_sha256_duplicado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sigd_doc.documento_adjunto
        WHERE sha256_hash = NEW.sha256_hash
    )
    THEN
        RAISE EXCEPTION
            'No se permite registrar un documento duplicado. Ya existe un documento con el SHA-256 %.',
            NEW.sha256_hash
            USING ERRCODE = '23505';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validar_sha256_duplicado
ON sigd_doc.documento_adjunto;

CREATE TRIGGER tr_validar_sha256_duplicado
BEFORE INSERT
ON sigd_doc.documento_adjunto
FOR EACH ROW
EXECUTE FUNCTION sigd_doc.fn_validar_sha256_duplicado();

CREATE OR REPLACE FUNCTION sigd_doc.fn_proteger_sha256()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.sha256_hash IS DISTINCT FROM NEW.sha256_hash
    THEN
        RAISE EXCEPTION
            'El sha256_hash es inmutable y no puede modificarse después de insertar el documento.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_proteger_sha256
ON sigd_doc.documento_adjunto;

CREATE TRIGGER tr_proteger_sha256
BEFORE UPDATE
ON sigd_doc.documento_adjunto
FOR EACH ROW
EXECUTE FUNCTION sigd_doc.fn_proteger_sha256();

-- ============================================================================
-- 20. VERSIONADO DE DOCUMENTOS
-- ============================================================================

CREATE OR REPLACE FUNCTION sigd_doc.fn_validar_version_documento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_expediente_requisito UUID;
    v_version_anterior SMALLINT;
    v_estado_anterior sigd_doc.estado_documento_enum;
BEGIN
    IF NEW.id_documento_anterior IS NULL THEN
        IF NEW.version_num <> 1 THEN
            RAISE EXCEPTION
                'El primer documento de una cadena debe tener version_num = 1.';
        END IF;
    ELSE
        SELECT
            id_expediente_requisito,
            version_num,
            estado_documento
        INTO
            v_expediente_requisito,
            v_version_anterior,
            v_estado_anterior
        FROM sigd_doc.documento_adjunto
        WHERE id_documento_adjunto = NEW.id_documento_anterior
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'El documento anterior % no existe.',
                NEW.id_documento_anterior;
        END IF;

        IF v_expediente_requisito <> NEW.id_expediente_requisito THEN
            RAISE EXCEPTION
                'El documento anterior debe pertenecer al mismo requisito del expediente.';
        END IF;

        IF v_estado_anterior <> 'OBSERVADO' THEN
            RAISE EXCEPTION
                'Solo un documento observado puede ser reemplazado.';
        END IF;

        IF NEW.version_num <> v_version_anterior + 1 THEN
            RAISE EXCEPTION
                'La versión del documento debe ser consecutiva.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validar_version_documento
ON sigd_doc.documento_adjunto;

CREATE TRIGGER tr_validar_version_documento
BEFORE INSERT
ON sigd_doc.documento_adjunto
FOR EACH ROW
EXECUTE FUNCTION sigd_doc.fn_validar_version_documento();

CREATE OR REPLACE FUNCTION sigd_doc.fn_postprocesar_documento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT'
       AND NEW.id_documento_anterior IS NOT NULL
    THEN
        UPDATE sigd_doc.documento_adjunto
           SET estado_documento = 'REEMPLAZADO'
         WHERE id_documento_adjunto = NEW.id_documento_anterior
           AND estado_documento = 'OBSERVADO';

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'El documento anterior % ya no se encuentra en estado OBSERVADO.',
                NEW.id_documento_anterior;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_postprocesar_documento
ON sigd_doc.documento_adjunto;

CREATE TRIGGER tr_postprocesar_documento
AFTER INSERT
ON sigd_doc.documento_adjunto
FOR EACH ROW
EXECUTE FUNCTION sigd_doc.fn_postprocesar_documento();

-- ============================================================================
-- 21. ELIMINACIÓN LÓGICA
-- ============================================================================

CREATE OR REPLACE FUNCTION sigd_doc.fn_eliminar_logicamente_documento(
    p_id_documento UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE sigd_doc.documento_adjunto
       SET estado_documento = 'ELIMINADO'
     WHERE id_documento_adjunto = p_id_documento
       AND estado_documento <> 'APROBADO';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El documento % no existe o ya fue aprobado.',
            p_id_documento;
    END IF;
END;
$$;

-- ============================================================================
-- 22. DERIVACIÓN DEL ESTADO DEL REQUISITO
--
-- PENDIENTE  : no existe documento vigente.
-- OBSERVADO  : el documento vigente está observado.
-- SUBSANADO  : existe una nueva versión CARGADO que reemplazó a un documento
--              OBSERVADO.
-- APROBADO   : el documento vigente está aprobado.
--
-- Un CARGADO inicial NO es SUBSANADO.
-- ============================================================================

CREATE OR REPLACE FUNCTION sigd_doc.fn_recalcular_estado_requisito(
    p_id_expediente_requisito UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado sigd_doc.estado_expediente_requisito_enum;
BEGIN
    SELECT CASE
        WHEN EXISTS (
            SELECT 1
            FROM sigd_doc.documento_adjunto da
            WHERE da.id_expediente_requisito = p_id_expediente_requisito
              AND da.estado_documento = 'APROBADO'
              AND NOT EXISTS (
                  SELECT 1
                  FROM sigd_doc.documento_adjunto newer
                  WHERE newer.id_documento_anterior = da.id_documento_adjunto
                    AND newer.estado_documento NOT IN ('REEMPLAZADO', 'ELIMINADO')
              )
        ) THEN 'APROBADO'::sigd_doc.estado_expediente_requisito_enum

        WHEN EXISTS (
            SELECT 1
            FROM sigd_doc.documento_adjunto da
            WHERE da.id_expediente_requisito = p_id_expediente_requisito
              AND da.estado_documento = 'OBSERVADO'
              AND NOT EXISTS (
                  SELECT 1
                  FROM sigd_doc.documento_adjunto newer
                  WHERE newer.id_documento_anterior = da.id_documento_adjunto
                    AND newer.estado_documento NOT IN ('REEMPLAZADO', 'ELIMINADO')
              )
        ) THEN 'OBSERVADO'::sigd_doc.estado_expediente_requisito_enum

        WHEN EXISTS (
            SELECT 1
            FROM sigd_doc.documento_adjunto da
            JOIN sigd_doc.documento_adjunto prev
              ON prev.id_documento_adjunto = da.id_documento_anterior
            WHERE da.id_expediente_requisito = p_id_expediente_requisito
              AND da.estado_documento = 'CARGADO'
              AND prev.estado_documento IN ('OBSERVADO', 'REEMPLAZADO')
              AND NOT EXISTS (
                  SELECT 1
                  FROM sigd_doc.documento_adjunto newer
                  WHERE newer.id_documento_anterior = da.id_documento_adjunto
                    AND newer.estado_documento NOT IN ('REEMPLAZADO', 'ELIMINADO')
              )
        ) THEN 'SUBSANADO'::sigd_doc.estado_expediente_requisito_enum

        ELSE 'PENDIENTE'::sigd_doc.estado_expediente_requisito_enum
    END
    INTO v_estado;

    UPDATE sigd_doc.expediente_requisito
       SET estado = v_estado
     WHERE id_expediente_requisito = p_id_expediente_requisito;
END;
$$;

CREATE OR REPLACE FUNCTION sigd_doc.fn_postprocesar_estado_requisito()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.id_expediente_requisito IS DISTINCT FROM NEW.id_expediente_requisito
    THEN
        PERFORM sigd_doc.fn_recalcular_estado_requisito(
            OLD.id_expediente_requisito
        );
    END IF;

    PERFORM sigd_doc.fn_recalcular_estado_requisito(
        COALESCE(NEW.id_expediente_requisito, OLD.id_expediente_requisito)
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_recalcular_estado_requisito
ON sigd_doc.documento_adjunto;

CREATE TRIGGER tr_recalcular_estado_requisito
AFTER INSERT OR UPDATE OR DELETE
ON sigd_doc.documento_adjunto
FOR EACH ROW
EXECUTE FUNCTION sigd_doc.fn_postprocesar_estado_requisito();

-- ============================================================================
-- 23. REGLAS DE ESTADO ADMINISTRATIVO DEL EXPEDIENTE
--
-- No existe trigger automático que convierta BORRADOR en EN_REVISION,
-- OBSERVADO, SUBSANACION o APROBADO.
--
-- La función fn_calcular_estado_documental_expediente calcula una sugerencia
-- documental y NO modifica EXPEDIENTE.
--
-- La función fn_radicacion_expediente representa la operación administrativa
-- explícita que convierte un BORRADOR en EN_REVISION y asigna código/fecha.
--
-- Después de la radicación, fn_actualizar_estado_expediente puede ser llamada
-- por la aplicación para propagar el resultado documental sin romper las
-- invariantes de radicación.
-- ============================================================================

CREATE OR REPLACE FUNCTION sigd_doc.fn_json_pointer_tokens(
    p_pointer TEXT
)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_tokens TEXT[];
    v_i INTEGER;
BEGIN
    IF p_pointer IS NULL OR p_pointer = '' THEN
        RETURN ARRAY[]::TEXT[];
    END IF;

    IF p_pointer = '/' THEN
        RETURN ARRAY[''];
    END IF;

    v_tokens := string_to_array(substr(p_pointer, 2), '/');

    FOR v_i IN 1 .. COALESCE(array_length(v_tokens, 1), 0) LOOP
        v_tokens[v_i] :=
            replace(
                replace(v_tokens[v_i], '~1', '/'),
                '~0', '~'
            );
    END LOOP;

    RETURN v_tokens;
END;
$$;

CREATE OR REPLACE FUNCTION sigd_doc.fn_tdr_es_aplicable(
    p_id_expediente_requisito UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_tipo sigd_doc.tipo_obligatoriedad_enum;
    v_path TEXT;
    v_valor VARCHAR(100);
    v_payload JSONB;
    v_actual JSONB;
    v_tokens TEXT[];
BEGIN
    SELECT
        COALESCE(tdr.obligatoriedad_override, r.tipo_obligatoriedad),
        tdr.campo_condicionante_path,
        tdr.valor_condicionante,
        e.payload_respuestas
    INTO
        v_tipo,
        v_path,
        v_valor,
        v_payload
    FROM sigd_doc.expediente_requisito er
    JOIN sigd_doc.tipo_documento_requisito tdr
      ON tdr.id_tipo_documento_requisito = er.id_tipo_documento_requisito
    JOIN sigd_doc.requisito r
      ON r.id_requisito = tdr.id_requisito
    JOIN sigd_doc.expediente e
      ON e.id_expediente = er.id_expediente
    WHERE er.id_expediente_requisito = p_id_expediente_requisito;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe expediente_requisito %.',
            p_id_expediente_requisito;
    END IF;

    IF v_tipo <> 'CONDICIONAL' THEN
        RETURN TRUE;
    END IF;

    IF v_path IS NULL OR v_valor IS NULL THEN
        RETURN FALSE;
    END IF;

    v_tokens := sigd_doc.fn_json_pointer_tokens(v_path);
    v_actual := v_payload #> v_tokens;

    IF v_actual IS NULL THEN
        RETURN FALSE;
    END IF;

    -- La regla almacenada compara el valor lógico de la propiedad.
    -- La validación semántica completa del formulario sigue en aplicación.
    RETURN trim(both '"' from v_actual::TEXT) = v_valor;
END;
$$;

CREATE OR REPLACE FUNCTION sigd_doc.fn_calcular_estado_documental_expediente(
    p_id_expediente UUID
)
RETURNS sigd_doc.estado_expediente_enum
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_aplicables INTEGER;
    v_aprobados INTEGER;
    v_observados INTEGER;
    v_subsanados INTEGER;
BEGIN
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE er.estado = 'APROBADO'),
        COUNT(*) FILTER (WHERE er.estado = 'OBSERVADO'),
        COUNT(*) FILTER (WHERE er.estado = 'SUBSANADO')
    INTO
        v_total_aplicables,
        v_aprobados,
        v_observados,
        v_subsanados
    FROM sigd_doc.expediente_requisito er
    JOIN sigd_doc.tipo_documento_requisito tdr
      ON tdr.id_tipo_documento_requisito = er.id_tipo_documento_requisito
    JOIN sigd_doc.requisito r
      ON r.id_requisito = tdr.id_requisito
    WHERE er.id_expediente = p_id_expediente
      AND COALESCE(tdr.obligatoriedad_override, r.tipo_obligatoriedad)
          <> 'OPCIONAL'
      AND sigd_doc.fn_tdr_es_aplicable(er.id_expediente_requisito);

    IF v_observados > 0 THEN
        RETURN 'SUBSANACION';
    ELSIF v_subsanados > 0 THEN
        RETURN 'EN_REVISION';
    ELSIF v_total_aplicables > 0
          AND v_aprobados = v_total_aplicables
    THEN
        RETURN 'APROBADO';
    ELSE
        RETURN 'EN_REVISION';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION sigd_doc.fn_radicacion_expediente(
    p_id_expediente UUID,
    p_codigo_oficial VARCHAR(30),
    p_fecha_radicacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado sigd_doc.estado_expediente_enum;
BEGIN
    SELECT estado
      INTO v_estado
      FROM sigd_doc.expediente
     WHERE id_expediente = p_id_expediente
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El expediente % no existe.',
            p_id_expediente;
    END IF;

    IF v_estado <> 'BORRADOR' THEN
        RAISE EXCEPTION
            'Solo un expediente BORRADOR puede ser radicado.';
    END IF;

    IF p_codigo_oficial IS NULL OR btrim(p_codigo_oficial) = '' THEN
        RAISE EXCEPTION
            'La radicación requiere un codigo_oficial.';
    END IF;

    IF p_fecha_radicacion IS NULL THEN
        RAISE EXCEPTION
            'La radicación requiere fecha_radicacion.';
    END IF;

    UPDATE sigd_doc.expediente
       SET codigo_oficial = p_codigo_oficial,
           fecha_radicacion = p_fecha_radicacion,
           estado = 'EN_REVISION'
     WHERE id_expediente = p_id_expediente;
END;
$$;

CREATE OR REPLACE FUNCTION sigd_doc.fn_actualizar_estado_expediente(
    p_id_expediente UUID
)
RETURNS sigd_doc.estado_expediente_enum
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_actual sigd_doc.estado_expediente_enum;
    v_nuevo_estado sigd_doc.estado_expediente_enum;
BEGIN
    SELECT estado
      INTO v_estado_actual
      FROM sigd_doc.expediente
     WHERE id_expediente = p_id_expediente
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El expediente % no existe.',
            p_id_expediente;
    END IF;

    -- Nunca se modifica automáticamente un BORRADOR.
    IF v_estado_actual = 'BORRADOR' THEN
        RETURN 'BORRADOR';
    END IF;

    -- Estados terminales/administrativos que no deben ser pisados por la
    -- derivación documental.
    IF v_estado_actual IN ('RECHAZADO_POR_CADUCIDAD', 'INACTIVO') THEN
        RETURN v_estado_actual;
    END IF;

    v_nuevo_estado :=
        sigd_doc.fn_calcular_estado_documental_expediente(p_id_expediente);

    UPDATE sigd_doc.expediente
       SET estado = v_nuevo_estado
     WHERE id_expediente = p_id_expediente;

    RETURN v_nuevo_estado;
END;
$$;

-- ============================================================================
-- 24. VERIFICACIONES ESTÁTICAS
-- ============================================================================

SELECT 'tablas_principales' AS prueba,
       COUNT(*) = 8 AS ok
FROM information_schema.tables
WHERE table_schema = 'sigd_doc'
  AND table_name IN (
      'tipo_tramite_tupa',
      'tipo_documento',
      'formulario_version',
      'expediente',
      'requisito',
      'tipo_documento_requisito',
      'expediente_requisito',
      'documento_adjunto'
  );

SELECT 'indices_gin_jsonb' AS prueba,
       EXISTS (
           SELECT 1
           FROM pg_indexes
           WHERE schemaname = 'sigd_doc'
             AND indexname = 'idx_formulario_version_schema_gin'
             AND indexdef ILIKE '%USING gin%'
       )
       AND EXISTS (
           SELECT 1
           FROM pg_indexes
           WHERE schemaname = 'sigd_doc'
             AND indexname = 'idx_expediente_payload_gin'
             AND indexdef ILIKE '%jsonb_path_ops%'
       ) AS ok;

SELECT 'version_activa_unica' AS prueba,
       EXISTS (
           SELECT 1
           FROM pg_indexes
           WHERE schemaname = 'sigd_doc'
             AND indexname = 'uq_formulario_version_activa'
       ) AS ok;

SELECT 'constraint_radicacion' AS prueba,
       EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'sigd_doc.expediente'::regclass
             AND conname = 'ck_expediente_radicacion'
       ) AS ok;

SELECT 'constraint_codigo_oficial' AS prueba,
       EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'sigd_doc.expediente'::regclass
             AND conname = 'ck_expediente_codigo_oficial'
       ) AS ok;

SELECT 'constraint_tamanio_positivo' AS prueba,
       EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'sigd_doc.documento_adjunto'::regclass
             AND conname = 'ck_documento_tamanio'
       ) AS ok;

SELECT 'sha256_check' AS prueba,
       EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'sigd_doc.documento_adjunto'::regclass
             AND conname = 'ck_documento_hash'
       ) AS ok;

SELECT 'sha256_inmutable' AS prueba,
       EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'sigd_doc.documento_adjunto'::regclass
             AND NOT tgisinternal
             AND tgname = 'tr_proteger_sha256'
       ) AS ok;

SELECT 'sha256_deduplicacion' AS prueba,
       EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'sigd_doc.documento_adjunto'::regclass
             AND NOT tgisinternal
             AND tgname = 'tr_validar_sha256_duplicado'
       )
       AND EXISTS (
           SELECT 1
           FROM pg_indexes
           WHERE schemaname = 'sigd_doc'
             AND indexname = 'uq_documento_sha256'
       ) AS ok;

SELECT 'magic_bytes_delimitado' AS prueba,
       EXISTS (
           SELECT 1
           FROM pg_description d
           JOIN pg_attribute a
             ON a.attrelid = d.objoid
            AND a.attnum = d.objsubid
           WHERE d.objoid = 'sigd_doc.documento_adjunto'::regclass
             AND a.attname = 'magic_bytes_validado'
             AND d.description ILIKE '%capa de aplicación%'
       ) AS ok;

SELECT 'tupa_calificacion_condicionada' AS prueba,
       EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'sigd_doc.tipo_tramite_tupa'::regclass
             AND conname = 'ck_tupa_calificacion_coherente'
       ) AS ok;

SELECT 'tupa_tipo_documento_1_a_1' AS prueba,
       EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'sigd_doc.tipo_documento'::regclass
             AND conname = 'uq_tipo_documento_tupa'
       ) AS ok;

SELECT 'estado_requisito_derivado' AS prueba,
       EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'sigd_doc.expediente_requisito'::regclass
             AND NOT tgisinternal
             AND tgname = 'tr_proteger_estado_expediente_requisito'
       )
       AND EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'sigd_doc.documento_adjunto'::regclass
             AND NOT tgisinternal
             AND tgname = 'tr_recalcular_estado_requisito'
       ) AS ok;

SELECT 'sin_trigger_automatico_radicacion' AS prueba,
       NOT EXISTS (
           SELECT 1
           FROM pg_trigger t
           JOIN pg_proc p ON p.oid = t.tgfoid
           WHERE t.tgrelid = 'sigd_doc.expediente_requisito'::regclass
             AND NOT t.tgisinternal
             AND p.proname IN (
                 'fn_recalcular_estado_expediente',
                 'fn_postprocesar_estado_expediente'
             )
       ) AS ok;

SELECT 'sin_indice_redundante_expediente_requisito' AS prueba,
       NOT EXISTS (
           SELECT 1
           FROM pg_indexes
           WHERE schemaname = 'sigd_doc'
             AND indexname = 'idx_expediente_requisito_integridad'
       ) AS ok;

SELECT 'funcion_radicacion_explicita' AS prueba,
       EXISTS (
           SELECT 1
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'sigd_doc'
             AND p.proname = 'fn_radicacion_expediente'
       ) AS ok;

SELECT 'funcion_estado_documental' AS prueba,
       EXISTS (
           SELECT 1
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'sigd_doc'
             AND p.proname = 'fn_calcular_estado_documental_expediente'
       ) AS ok;

COMMIT;

-- ============================================================================
-- FIN
-- 05_esquema_sigd_doc_jsonb.sql
-- ============================================================================