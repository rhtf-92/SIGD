-- 08_sigd_tupa_version.sql | Gestión de versiones del TUPA | PostgreSQL 18
-- Grupo 2 · Matías Zumaeta (rama F_MATIAS).
--
-- Solo CREA objetos nuevos en el esquema sigd_tupa. No modifica ni borra nada de
-- sigd_doc.tipo_tramite_tupa ni de ninguna otra tabla existente.
--
-- Importante para el runner (src/db/migrate.ts): aplica todos los .sql en UNA sola
-- transacción y guarda el checksum de cada archivo. Este archivo NO lleva BEGIN/COMMIT
-- y NO debe editarse después de haberse aplicado con éxito en una base compartida;
-- los cambios posteriores van en un archivo nuevo (09_...).

CREATE SCHEMA IF NOT EXISTS sigd_tupa;

-- -----------------------------------------------------------------------------
-- 8.1 version: una fila por versión del TUPA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_tupa.version (
    version_id            UUID         NOT NULL DEFAULT gen_random_uuid()
                                       CONSTRAINT pk_tupa_version PRIMARY KEY,
    codigo                VARCHAR(30)  NOT NULL UNIQUE,
    nombre                VARCHAR(200) NOT NULL,
    fecha_vigencia        DATE         NULL,
    uit_vigente           NUMERIC(10,2) NULL,
    resolucion_numero     VARCHAR(100) NULL,
    resolucion_fecha      DATE         NULL,
    resolucion_pdf_ref    VARCHAR(500) NULL,
    resolucion_pdf_sha256 CHAR(64)     NULL,
    estado                VARCHAR(20)  NOT NULL DEFAULT 'BORRADOR',
    version_anterior_id   UUID         NULL
                                       REFERENCES sigd_tupa.version (version_id) ON DELETE RESTRICT,
    creado_en             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_tupa_version_estado CHECK (estado IN ('BORRADOR', 'VIGENTE', 'SUPERSEDIDA')),
    CONSTRAINT chk_tupa_version_uit CHECK (uit_vigente IS NULL OR uit_vigente > 0)
);

-- A lo sumo una versión VIGENTE a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tupa_version_unica_vigente
    ON sigd_tupa.version ((estado)) WHERE estado = 'VIGENTE';

COMMENT ON TABLE sigd_tupa.version IS
    'Versiones del TUPA. Una versión publicada no se modifica: se crea otra versión y la anterior queda SUPERSEDIDA.';
COMMENT ON COLUMN sigd_tupa.version.resolucion_pdf_ref IS
    'Referencia (ruta u objeto S3) al PDF de la resolución aprobatoria; el archivo no se guarda en la base.';

-- -----------------------------------------------------------------------------
-- 8.2 tramite_version: trámites de cada versión (una ficha del TUPA por fila)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_tupa.tramite_version (
    tramite_version_id      UUID         NOT NULL DEFAULT gen_random_uuid()
                                         CONSTRAINT pk_tupa_tramite_version PRIMARY KEY,
    version_id              UUID         NOT NULL
                                         REFERENCES sigd_tupa.version (version_id) ON DELETE RESTRICT,
    codigo                  VARCHAR(30)  NOT NULL,
    denominacion            VARCHAR(300) NOT NULL,
    descripcion             TEXT         NULL,
    rubro                   VARCHAR(200) NOT NULL,
    derecho_monto           NUMERIC(10,2) NULL,
    derecho_porcentaje_uit  NUMERIC(6,2) NULL,
    derecho_texto           VARCHAR(100) NULL,
    cuenta_pago             VARCHAR(60)  NULL,
    plazo_texto             VARCHAR(300) NOT NULL,
    plazo_dias_habiles      SMALLINT     NULL,
    calificacion            VARCHAR(30)  NOT NULL,
    silencio_administrativo VARCHAR(20)  NOT NULL,
    unidad_recibe           VARCHAR(200) NULL,
    autoridad_resuelve      VARCHAR(200) NULL,
    recursos                TEXT         NULL,
    base_legal              TEXT         NULL,
    observaciones           TEXT         NULL,
    CONSTRAINT uq_tupa_tramite_version_codigo UNIQUE (version_id, codigo),
    CONSTRAINT chk_tupa_tramite_monto CHECK (derecho_monto IS NULL OR derecho_monto >= 0),
    CONSTRAINT chk_tupa_tramite_porcentaje CHECK (derecho_porcentaje_uit IS NULL OR derecho_porcentaje_uit >= 0),
    CONSTRAINT chk_tupa_tramite_plazo CHECK (plazo_dias_habiles IS NULL OR plazo_dias_habiles > 0),
    CONSTRAINT chk_tupa_tramite_calificacion CHECK (
        calificacion IN ('EVALUACION_PREVIA', 'APROBACION_AUTOMATICA', 'NO_APLICA')),
    CONSTRAINT chk_tupa_tramite_silencio CHECK (
        silencio_administrativo IN ('POSITIVO', 'NEGATIVO', 'NO_APLICA'))
);

CREATE INDEX IF NOT EXISTS ix_tupa_tramite_version_codigo
    ON sigd_tupa.tramite_version (codigo);

COMMENT ON COLUMN sigd_tupa.tramite_version.derecho_texto IS
    'Texto libre cuando el monto no es un único número (por ejemplo "de acuerdo al mercado").';
COMMENT ON COLUMN sigd_tupa.tramite_version.observaciones IS
    'Marcas de transcripción como [REVISAR] o [VALIDAR].';

-- -----------------------------------------------------------------------------
-- 8.3 tramite_requisito: requisitos ordenados de cada trámite
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_tupa.tramite_requisito (
    requisito_id       UUID     NOT NULL DEFAULT gen_random_uuid()
                                CONSTRAINT pk_tupa_tramite_requisito PRIMARY KEY,
    tramite_version_id UUID     NOT NULL
                                REFERENCES sigd_tupa.tramite_version (tramite_version_id) ON DELETE RESTRICT,
    orden              SMALLINT NOT NULL,
    texto              TEXT     NOT NULL,
    CONSTRAINT chk_tupa_requisito_orden CHECK (orden > 0),
    CONSTRAINT uq_tupa_requisito_orden UNIQUE (tramite_version_id, orden)
);

-- -----------------------------------------------------------------------------
-- 8.4 bitacora: registro de solo altas de la vida de cada versión
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_tupa.bitacora (
    bitacora_id     BIGINT      GENERATED ALWAYS AS IDENTITY
                                CONSTRAINT pk_tupa_bitacora PRIMARY KEY,
    version_id      UUID        NOT NULL
                                REFERENCES sigd_tupa.version (version_id) ON DELETE RESTRICT,
    accion          VARCHAR(20) NOT NULL,
    estado_anterior VARCHAR(20) NULL,
    estado_nuevo    VARCHAR(20) NOT NULL,
    usuario_id      UUID        NULL,
    detalle         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    fecha_hora      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_tupa_bitacora_accion CHECK (accion IN ('CREADA', 'PUBLICADA', 'SUPERSEDIDA')),
    CONSTRAINT chk_tupa_bitacora_detalle CHECK (jsonb_typeof(detalle) = 'object')
);

CREATE INDEX IF NOT EXISTS ix_tupa_bitacora_version_fecha
    ON sigd_tupa.bitacora (version_id, fecha_hora DESC);

COMMENT ON COLUMN sigd_tupa.bitacora.usuario_id IS
    'Se toma de la variable de sesión sigd_tupa.usuario_id (SET LOCAL) si es un UUID válido; si no, queda NULL.';

-- -----------------------------------------------------------------------------
-- 8.5 Protección de la versión: solo BORRADOR se edita o elimina
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_tupa.fn_proteger_version()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, sigd_tupa AS $func$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.estado <> 'BORRADOR' THEN
            RAISE EXCEPTION 'Una versión del TUPA nace como BORRADOR (recibido: %)', NEW.estado
                USING ERRCODE = '23001';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.estado <> 'BORRADOR' THEN
            RAISE EXCEPTION 'La versión % del TUPA está % y no se puede eliminar; solo los borradores',
                OLD.codigo, OLD.estado USING ERRCODE = '23001';
        END IF;
        RETURN OLD;
    END IF;

    -- UPDATE
    IF OLD.estado = 'BORRADOR' THEN
        IF NEW.estado = 'SUPERSEDIDA' THEN
            RAISE EXCEPTION 'La versión % debe publicarse antes de quedar supersedida', OLD.codigo
                USING ERRCODE = '23001';
        END IF;
        RETURN NEW;
    END IF;

    IF OLD.estado = 'VIGENTE' THEN
        IF NEW.estado <> 'SUPERSEDIDA' THEN
            RAISE EXCEPTION 'La versión % está VIGENTE y solo puede pasar a SUPERSEDIDA', OLD.codigo
                USING ERRCODE = '23001';
        END IF;
        IF ROW(NEW.version_id, NEW.codigo, NEW.nombre, NEW.fecha_vigencia, NEW.uit_vigente,
               NEW.resolucion_numero, NEW.resolucion_fecha, NEW.resolucion_pdf_ref,
               NEW.resolucion_pdf_sha256, NEW.version_anterior_id, NEW.creado_en)
           IS DISTINCT FROM
           ROW(OLD.version_id, OLD.codigo, OLD.nombre, OLD.fecha_vigencia, OLD.uit_vigente,
               OLD.resolucion_numero, OLD.resolucion_fecha, OLD.resolucion_pdf_ref,
               OLD.resolucion_pdf_sha256, OLD.version_anterior_id, OLD.creado_en) THEN
            RAISE EXCEPTION 'La versión % ya fue publicada: solo se permite cambiar su estado', OLD.codigo
                USING ERRCODE = '23001';
        END IF;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'La versión % está SUPERSEDIDA y es inmutable', OLD.codigo
        USING ERRCODE = '23001';
END;
$func$;

DROP TRIGGER IF EXISTS tr_tupa_proteger_version ON sigd_tupa.version;
CREATE TRIGGER tr_tupa_proteger_version
    BEFORE INSERT OR UPDATE OR DELETE ON sigd_tupa.version
    FOR EACH ROW EXECUTE FUNCTION sigd_tupa.fn_proteger_version();

-- -----------------------------------------------------------------------------
-- 8.6 Protección de trámites y requisitos: solo se tocan en versiones BORRADOR
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_tupa.fn_proteger_tramite_version()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, sigd_tupa AS $func$
DECLARE
    v_version UUID;
    v_estado  VARCHAR(20);
BEGIN
    v_version := CASE WHEN TG_OP = 'DELETE' THEN OLD.version_id ELSE NEW.version_id END;
    SELECT estado INTO v_estado FROM sigd_tupa.version WHERE version_id = v_version;
    IF v_estado IS DISTINCT FROM 'BORRADOR' THEN
        RAISE EXCEPTION 'Los trámites de una versión % del TUPA no se pueden % (solo en BORRADOR)',
            COALESCE(v_estado, 'inexistente'), TG_OP USING ERRCODE = '23001';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.version_id <> OLD.version_id THEN
        RAISE EXCEPTION 'Un trámite no puede cambiar de versión' USING ERRCODE = '23001';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$func$;

DROP TRIGGER IF EXISTS tr_tupa_proteger_tramite_version ON sigd_tupa.tramite_version;
CREATE TRIGGER tr_tupa_proteger_tramite_version
    BEFORE INSERT OR UPDATE OR DELETE ON sigd_tupa.tramite_version
    FOR EACH ROW EXECUTE FUNCTION sigd_tupa.fn_proteger_tramite_version();

CREATE OR REPLACE FUNCTION sigd_tupa.fn_proteger_tramite_requisito()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, sigd_tupa AS $func$
DECLARE
    v_tramite UUID;
    v_estado  VARCHAR(20);
BEGIN
    v_tramite := CASE WHEN TG_OP = 'DELETE' THEN OLD.tramite_version_id ELSE NEW.tramite_version_id END;
    SELECT v.estado INTO v_estado
      FROM sigd_tupa.tramite_version t
      JOIN sigd_tupa.version v ON v.version_id = t.version_id
     WHERE t.tramite_version_id = v_tramite;
    IF v_estado IS DISTINCT FROM 'BORRADOR' THEN
        RAISE EXCEPTION 'Los requisitos de una versión % del TUPA no se pueden % (solo en BORRADOR)',
            COALESCE(v_estado, 'inexistente'), TG_OP USING ERRCODE = '23001';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.tramite_version_id <> OLD.tramite_version_id THEN
        RAISE EXCEPTION 'Un requisito no puede cambiar de trámite' USING ERRCODE = '23001';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$func$;

DROP TRIGGER IF EXISTS tr_tupa_proteger_tramite_requisito ON sigd_tupa.tramite_requisito;
CREATE TRIGGER tr_tupa_proteger_tramite_requisito
    BEFORE INSERT OR UPDATE OR DELETE ON sigd_tupa.tramite_requisito
    FOR EACH ROW EXECUTE FUNCTION sigd_tupa.fn_proteger_tramite_requisito();

-- -----------------------------------------------------------------------------
-- 8.7 Bitácora automática de altas y cambios de estado de la versión
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_tupa.fn_bitacora_version()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, sigd_tupa AS $func$
DECLARE
    v_crudo   TEXT;
    v_usuario UUID;
BEGIN
    v_crudo := current_setting('sigd_tupa.usuario_id', true);
    IF v_crudo ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_usuario := v_crudo::uuid;
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO sigd_tupa.bitacora (version_id, accion, estado_anterior, estado_nuevo, usuario_id, detalle)
        VALUES (NEW.version_id, 'CREADA', NULL, NEW.estado, v_usuario,
                jsonb_build_object('codigo', NEW.codigo, 'nombre', NEW.nombre));
    ELSIF NEW.estado <> OLD.estado THEN
        INSERT INTO sigd_tupa.bitacora (version_id, accion, estado_anterior, estado_nuevo, usuario_id, detalle)
        VALUES (NEW.version_id,
                CASE NEW.estado WHEN 'VIGENTE' THEN 'PUBLICADA' ELSE 'SUPERSEDIDA' END,
                OLD.estado, NEW.estado, v_usuario,
                jsonb_build_object('codigo', NEW.codigo));
    END IF;
    RETURN NULL;
END;
$func$;

DROP TRIGGER IF EXISTS tr_tupa_bitacora_version ON sigd_tupa.version;
CREATE TRIGGER tr_tupa_bitacora_version
    AFTER INSERT OR UPDATE ON sigd_tupa.version
    FOR EACH ROW EXECUTE FUNCTION sigd_tupa.fn_bitacora_version();

-- -----------------------------------------------------------------------------
-- 8.8 La bitácora es de solo altas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_tupa.fn_bitacora_inmutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog AS $func$
BEGIN
    RAISE EXCEPTION 'La bitácora del TUPA es inmutable: % rechazado', TG_OP
        USING ERRCODE = '23001';
END;
$func$;

DROP TRIGGER IF EXISTS tr_tupa_bitacora_inmutable ON sigd_tupa.bitacora;
CREATE TRIGGER tr_tupa_bitacora_inmutable
    BEFORE UPDATE OR DELETE ON sigd_tupa.bitacora
    FOR EACH ROW EXECUTE FUNCTION sigd_tupa.fn_bitacora_inmutable();

DROP TRIGGER IF EXISTS tr_tupa_bitacora_no_truncar ON sigd_tupa.bitacora;
CREATE TRIGGER tr_tupa_bitacora_no_truncar
    BEFORE TRUNCATE ON sigd_tupa.bitacora
    FOR EACH STATEMENT EXECUTE FUNCTION sigd_tupa.fn_bitacora_inmutable();
