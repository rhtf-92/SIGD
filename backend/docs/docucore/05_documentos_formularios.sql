-- ============================================================================
-- SIGD / DocuCore - Esquema de documentos, formularios y expedientes
-- Motor objetivo: PostgreSQL 18.6
-- Fecha: 2026-08-29
-- Version: 3 (corrige alineacion con 03_modelo_datos.md v2.0)
--
-- Cambios de esta version:
--   1) USUARIO ya no es tabla propia de DocuCore (pertenece al modulo central
--      de identidad del SIGD). Se elimina la tabla y todas las FK hacia ella;
--      los identificadores de usuario quedan como BIGINT sin REFERENCES.
--      La validacion de existencia del ID la hace la aplicacion.
--   2) FORMULARIO recupera el versionado (se revierte el CAM-01 anterior).
--      EXPEDIENTE ahora referencia id_formulario (version exacta usada) en
--      vez de id_tipo_documento, para no verse afectado si el formulario
--      cambia despues de creado el expediente.
--
-- Este script implementa el modelo funcional suministrado. Los archivos se
-- almacenan fuera de la base de datos; aqui solo se guarda su metadato y ruta.
-- Se puede ejecutar varias veces sin eliminar datos existentes.
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS docucore;
SET search_path TO docucore, public;

DO $$
BEGIN
    CREATE TYPE tipo_dato_campo AS ENUM ('TEXTO', 'NUMERO', 'FECHA', 'SELECCION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
    CREATE TYPE obligatoriedad_requisito AS ENUM ('OBLIGATORIO', 'OPCIONAL', 'CONDICIONAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
    CREATE TYPE estado_expediente AS ENUM
        ('BORRADOR', 'EN_REVISION', 'OBSERVADO', 'SUBSANACION', 'APROBADO', 'RECHAZADO_POR_CADUCIDAD', 'INACTIVO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
    CREATE TYPE estado_expediente_requisito AS ENUM ('PENDIENTE', 'OBSERVADO', 'SUBSANADO', 'APROBADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
    CREATE TYPE estado_adjunto AS ENUM ('CARGADO', 'OBSERVADO', 'APROBADO', 'REEMPLAZADO', 'ELIMINADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TYPE estado_adjunto ADD VALUE IF NOT EXISTS 'ELIMINADO';

-- ----------------------------------------------------------------------------
-- CORRECCION 1: USUARIO es una entidad externa (modulo de identidad del SIGD).
-- Se elimina la tabla propia; CASCADE tambien elimina las FK que otras tablas
-- tenian hacia ella, dejando esas columnas como BIGINT simple.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS usuario CASCADE;

CREATE TABLE IF NOT EXISTS tipo_documento (
    id_tipo_documento       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo                  VARCHAR(30) NOT NULL,
    nombre                  VARCHAR(150) NOT NULL,
    descripcion             TEXT,
    activo                  BOOLEAN NOT NULL DEFAULT TRUE,
    -- Referencia externa al modulo de identidad del SIGD. Sin FK: la
    -- aplicacion valida la existencia del usuario antes de insertar.
    id_usuario_creador      BIGINT NOT NULL,
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tipo_documento_codigo UNIQUE (codigo),
    CONSTRAINT ck_tipo_documento_codigo_no_vacio CHECK (btrim(codigo) <> ''),
    CONSTRAINT ck_tipo_documento_nombre_no_vacio CHECK (btrim(nombre) <> '')
);
-- Migracion: si la tabla ya existia con FK hacia usuario, CASCADE ya la quito;
-- esta linea cubre instalaciones donde el nombre de constraint difiera.
ALTER TABLE tipo_documento DROP CONSTRAINT IF EXISTS tipo_documento_id_usuario_creador_fkey;

-- ----------------------------------------------------------------------------
-- CORRECCION 2: FORMULARIO recupera el versionado.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS formulario (
    id_formulario           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_tipo_documento       BIGINT NOT NULL REFERENCES tipo_documento(id_tipo_documento),
    version                 SMALLINT NOT NULL DEFAULT 1,
    activo                  BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Migracion desde la version anterior (1:1 estricto, sin columna version).
ALTER TABLE formulario DROP CONSTRAINT IF EXISTS uq_formulario_tipo_documento;
ALTER TABLE formulario ADD COLUMN IF NOT EXISTS version SMALLINT NOT NULL DEFAULT 1;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'docucore.formulario'::regclass
           AND conname = 'uq_formulario_tipo_version'
    ) THEN
        ALTER TABLE formulario ADD CONSTRAINT uq_formulario_tipo_version UNIQUE (id_tipo_documento, version);
    END IF;
END $$;

ALTER TABLE formulario DROP CONSTRAINT IF EXISTS ck_formulario_version_positiva;
ALTER TABLE formulario ADD CONSTRAINT ck_formulario_version_positiva CHECK (version > 0);

-- Solo puede haber una version activa del formulario para cada tipo documental.
DROP INDEX IF EXISTS uq_formulario_activo_por_tipo;
CREATE UNIQUE INDEX IF NOT EXISTS uq_formulario_activo_por_tipo
    ON formulario (id_tipo_documento) WHERE activo;

CREATE TABLE IF NOT EXISTS campo_formulario (
    id_campo                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_formulario           BIGINT NOT NULL REFERENCES formulario(id_formulario),
    nombre_campo            VARCHAR(150) NOT NULL,
    tipo_dato               tipo_dato_campo NOT NULL,
    obligatorio             BOOLEAN NOT NULL DEFAULT TRUE,
    orden                   SMALLINT NOT NULL,
    opciones                TEXT,
    CONSTRAINT uq_campo_formulario_orden UNIQUE (id_formulario, orden),
    CONSTRAINT uq_campo_formulario_nombre UNIQUE (id_formulario, nombre_campo),
    CONSTRAINT ck_campo_nombre_no_vacio CHECK (btrim(nombre_campo) <> ''),
    CONSTRAINT ck_campo_orden_positivo CHECK (orden > 0),
    CONSTRAINT ck_campo_opciones CHECK (
        (tipo_dato = 'SELECCION' AND opciones IS NOT NULL AND btrim(opciones) <> '')
        OR (tipo_dato <> 'SELECCION' AND opciones IS NULL)
    )
);

-- ----------------------------------------------------------------------------
-- EXPEDIENTE ahora referencia id_formulario (version exacta usada) en vez de
-- id_tipo_documento. El tipo de documento sigue siendo consultable de forma
-- indirecta: expediente -> formulario -> tipo_documento.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expediente (
    id_expediente           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_oficial          VARCHAR(30),
    id_formulario           BIGINT NOT NULL REFERENCES formulario(id_formulario),
    -- Referencia externa al modulo de identidad del SIGD. Sin FK.
    id_usuario_solicitante  BIGINT NOT NULL,
    estado                  estado_expediente NOT NULL DEFAULT 'BORRADOR',
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_radicacion        TIMESTAMPTZ,
    CONSTRAINT uq_expediente_codigo_oficial UNIQUE (codigo_oficial),
    CONSTRAINT ck_expediente_codigo_radicado CHECK (
        (estado = 'BORRADOR' AND codigo_oficial IS NULL AND fecha_radicacion IS NULL)
        OR (estado <> 'BORRADOR' AND codigo_oficial IS NOT NULL AND fecha_radicacion IS NOT NULL)
    )
);

-- Migracion desde la version anterior (referenciaba id_tipo_documento).
ALTER TABLE expediente DROP CONSTRAINT IF EXISTS expediente_id_tipo_documento_fkey;
ALTER TABLE expediente DROP CONSTRAINT IF EXISTS expediente_id_usuario_solicitante_fkey;
ALTER TABLE expediente ADD COLUMN IF NOT EXISTS id_formulario BIGINT;
-- Backfill best-effort usando la version activa del tipo de documento previo.
UPDATE expediente e
   SET id_formulario = f.id_formulario
  FROM formulario f
 WHERE e.id_formulario IS NULL
   AND e.id_tipo_documento IS NOT NULL
   AND f.id_tipo_documento = e.id_tipo_documento
   AND f.activo;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'docucore.expediente'::regclass
           AND conname = 'expediente_id_formulario_fkey'
    ) THEN
        ALTER TABLE expediente ADD CONSTRAINT expediente_id_formulario_fkey
            FOREIGN KEY (id_formulario) REFERENCES formulario(id_formulario);
    END IF;
END $$;
ALTER TABLE expediente ALTER COLUMN id_formulario SET NOT NULL;
ALTER TABLE expediente DROP COLUMN IF EXISTS id_tipo_documento;

CREATE TABLE IF NOT EXISTS valor_campo (
    id_valor_campo          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_expediente           BIGINT NOT NULL REFERENCES expediente(id_expediente),
    id_campo                BIGINT NOT NULL REFERENCES campo_formulario(id_campo),
    valor                   TEXT NOT NULL,
    CONSTRAINT uq_valor_expediente_campo UNIQUE (id_expediente, id_campo),
    CONSTRAINT ck_valor_no_vacio CHECK (btrim(valor) <> '')
);

CREATE TABLE IF NOT EXISTS requisito (
    id_requisito            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_requisito        VARCHAR(20) NOT NULL,
    nombre                  VARCHAR(150) NOT NULL,
    descripcion_guia        TEXT,
    tipo_obligatoriedad     obligatoriedad_requisito NOT NULL,
    orden_presentacion      SMALLINT NOT NULL,
    requiere_vigencia       BOOLEAN NOT NULL DEFAULT FALSE,
    dias_vigencia_max       INTEGER,
    permite_multiples       BOOLEAN NOT NULL DEFAULT FALSE,
    cantidad_max_archivos   SMALLINT NOT NULL DEFAULT 1,
    peso_maximo_mb          NUMERIC(5,2) NOT NULL,
    formatos_permitidos     VARCHAR(100) NOT NULL,
    CONSTRAINT uq_requisito_codigo UNIQUE (codigo_requisito),
    CONSTRAINT ck_requisito_codigo_no_vacio CHECK (btrim(codigo_requisito) <> ''),
    CONSTRAINT ck_requisito_nombre_no_vacio CHECK (btrim(nombre) <> ''),
    CONSTRAINT ck_requisito_orden_positivo CHECK (orden_presentacion > 0),
    CONSTRAINT ck_requisito_peso_positivo CHECK (peso_maximo_mb > 0),
    CONSTRAINT ck_requisito_cantidad_valida CHECK (
        cantidad_max_archivos > 0 AND (permite_multiples OR cantidad_max_archivos = 1)
    ),
    CONSTRAINT ck_requisito_vigencia_valida CHECK (
        (requiere_vigencia AND dias_vigencia_max IS NOT NULL AND dias_vigencia_max > 0)
        OR (NOT requiere_vigencia AND dias_vigencia_max IS NULL)
    ),
    CONSTRAINT ck_requisito_formatos_no_vacio CHECK (btrim(formatos_permitidos) <> '')
);

CREATE TABLE IF NOT EXISTS tipo_documento_requisito (
    id_tipo_documento_requisito BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_tipo_documento       BIGINT NOT NULL REFERENCES tipo_documento(id_tipo_documento),
    id_requisito            BIGINT NOT NULL REFERENCES requisito(id_requisito),
    obligatoriedad_override obligatoriedad_requisito,
    id_campo_condicionante  BIGINT REFERENCES campo_formulario(id_campo),
    valor_condicionante     VARCHAR(100),
    CONSTRAINT uq_tipo_documento_requisito UNIQUE (id_tipo_documento, id_requisito),
    CONSTRAINT ck_condicion_completa CHECK (
        (id_campo_condicionante IS NULL AND valor_condicionante IS NULL)
        OR (id_campo_condicionante IS NOT NULL AND valor_condicionante IS NOT NULL AND btrim(valor_condicionante) <> '')
    )
);

CREATE TABLE IF NOT EXISTS expediente_requisito (
    id_expediente_requisito BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_expediente           BIGINT NOT NULL REFERENCES expediente(id_expediente),
    id_tipo_documento_requisito BIGINT NOT NULL REFERENCES tipo_documento_requisito(id_tipo_documento_requisito),
    estado                  estado_expediente_requisito NOT NULL DEFAULT 'PENDIENTE',
    -- Referencia externa al modulo de identidad del SIGD. Sin FK.
    id_evaluador            BIGINT,
    fecha_evaluacion        TIMESTAMPTZ,
    fecha_activacion        TIMESTAMPTZ,
    CONSTRAINT uq_expediente_requisito UNIQUE (id_expediente, id_tipo_documento_requisito),
    CONSTRAINT ck_evaluacion_completa CHECK (
        (id_evaluador IS NULL AND fecha_evaluacion IS NULL)
        OR (id_evaluador IS NOT NULL AND fecha_evaluacion IS NOT NULL)
    )
);
ALTER TABLE expediente_requisito DROP CONSTRAINT IF EXISTS expediente_requisito_id_evaluador_fkey;

CREATE TABLE IF NOT EXISTS archivo_adjunto (
    id_adjunto              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_expediente_requisito BIGINT NOT NULL REFERENCES expediente_requisito(id_expediente_requisito),
    nombre_original         VARCHAR(255) NOT NULL,
    nombre_logico           VARCHAR(255) NOT NULL,
    ruta_storage            VARCHAR(500) NOT NULL,
    formato_extension       VARCHAR(10) NOT NULL,
    mime_type               VARCHAR(100) NOT NULL,
    tamanio_bytes           BIGINT NOT NULL,
    hash_sha256             CHAR(64) NOT NULL,
    version_num             SMALLINT NOT NULL DEFAULT 1,
    id_adjunto_anterior     BIGINT REFERENCES archivo_adjunto(id_adjunto),
    estado_adjunto          estado_adjunto NOT NULL DEFAULT 'CARGADO',
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_adjunto_nombre_logico UNIQUE (nombre_logico),
    CONSTRAINT uq_adjunto_version_siguiente UNIQUE (id_adjunto_anterior),
    CONSTRAINT ck_adjunto_nombre_original_no_vacio CHECK (btrim(nombre_original) <> ''),
    CONSTRAINT ck_adjunto_ruta_no_vacia CHECK (btrim(ruta_storage) <> ''),
    CONSTRAINT ck_adjunto_extension_valida CHECK (formato_extension ~ '^[A-Za-z0-9]{1,10}$'),
    CONSTRAINT ck_adjunto_mime_no_vacio CHECK (btrim(mime_type) <> ''),
    CONSTRAINT ck_adjunto_tamanio_positivo CHECK (tamanio_bytes > 0),
    CONSTRAINT ck_adjunto_hash_sha256 CHECK (hash_sha256 ~ '^[0-9A-Fa-f]{64}$'),
    CONSTRAINT ck_adjunto_version_positiva CHECK (version_num > 0),
    CONSTRAINT ck_adjunto_no_autorreferencia CHECK (id_adjunto_anterior IS NULL OR id_adjunto_anterior <> id_adjunto)
);
ALTER TABLE archivo_adjunto DROP CONSTRAINT IF EXISTS uq_adjunto_requisito_version;

DROP INDEX IF EXISTS ix_expediente_tipo;
CREATE INDEX IF NOT EXISTS ix_expediente_formulario ON expediente(id_formulario);
CREATE INDEX IF NOT EXISTS ix_expediente_solicitante ON expediente(id_usuario_solicitante);
CREATE INDEX IF NOT EXISTS ix_expediente_requisito_expediente ON expediente_requisito(id_expediente);
CREATE INDEX IF NOT EXISTS ix_adjunto_requisito_estado ON archivo_adjunto(id_expediente_requisito, estado_adjunto);
CREATE INDEX IF NOT EXISTS ix_adjunto_hash ON archivo_adjunto(hash_sha256);

-- Verifica que un campo usado para condicion pertenezca a la version ACTIVA
-- del formulario del mismo tipo documental configurado.
CREATE OR REPLACE FUNCTION fn_validar_campo_condicionante()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.id_campo_condicionante IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM campo_formulario cf
        JOIN formulario f ON f.id_formulario = cf.id_formulario
        WHERE cf.id_campo = NEW.id_campo_condicionante
          AND f.id_tipo_documento = NEW.id_tipo_documento
          AND f.activo
    ) THEN
        RAISE EXCEPTION 'El campo condicionante debe pertenecer a la version activa del formulario del tipo de documento %', NEW.id_tipo_documento;
    END IF;
    RETURN NEW;
END $$;

-- Impide guardar valores de campos que no pertenezcan a la version exacta de
-- formulario que el expediente referencia (id_formulario).
CREATE OR REPLACE FUNCTION fn_validar_valor_campo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_tipo tipo_dato_campo;
    v_opciones TEXT;
    v_fecha DATE;
BEGIN
    SELECT cf.tipo_dato, cf.opciones
      INTO v_tipo, v_opciones
      FROM expediente e
      JOIN campo_formulario cf ON cf.id_formulario = e.id_formulario
     WHERE e.id_expediente = NEW.id_expediente
       AND cf.id_campo = NEW.id_campo;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El campo % no pertenece a la version de formulario del expediente %', NEW.id_campo, NEW.id_expediente;
    END IF;

    IF v_tipo = 'NUMERO' AND NEW.valor !~ '^[+-]?([0-9]+([.][0-9]+)?|[.][0-9]+)$' THEN
        RAISE EXCEPTION 'El campo % solo admite un numero valido', NEW.id_campo;
    ELSIF v_tipo = 'FECHA' THEN
        IF NEW.valor !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
            RAISE EXCEPTION 'El campo % debe usar el formato AAAA-MM-DD', NEW.id_campo;
        END IF;
        BEGIN
            v_fecha := NEW.valor::DATE;
        EXCEPTION WHEN others THEN
            RAISE EXCEPTION 'El campo % contiene una fecha inexistente', NEW.id_campo;
        END;
    ELSIF v_tipo = 'SELECCION' AND NOT EXISTS (
        SELECT 1
          FROM regexp_split_to_table(v_opciones, ',') AS opcion
         WHERE btrim(opcion) = btrim(NEW.valor)
    ) THEN
        RAISE EXCEPTION 'El valor % no es una opcion permitida para el campo %', NEW.valor, NEW.id_campo;
    END IF;
    RETURN NEW;
END $$;

-- Valida el adjunto contra la configuracion del requisito antes de almacenarlo.
CREATE OR REPLACE FUNCTION fn_validar_adjunto()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_limite_bytes NUMERIC;
    v_max_archivos SMALLINT;
    v_permite_multiples BOOLEAN;
    v_estado estado_expediente;
    v_req_anterior BIGINT;
    v_estado_anterior estado_adjunto;
    v_version_anterior SMALLINT;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.estado_adjunto = 'APROBADO' AND NEW IS DISTINCT FROM OLD THEN
            RAISE EXCEPTION 'Un adjunto aprobado es inmutable';
        END IF;
        RETURN NEW;
    END IF;

    SELECT r.peso_maximo_mb * 1024 * 1024, r.cantidad_max_archivos, r.permite_multiples, e.estado
      INTO v_limite_bytes, v_max_archivos, v_permite_multiples, v_estado
      FROM expediente_requisito er
      JOIN expediente e ON e.id_expediente = er.id_expediente
      JOIN tipo_documento_requisito tdr ON tdr.id_tipo_documento_requisito = er.id_tipo_documento_requisito
      JOIN requisito r ON r.id_requisito = tdr.id_requisito
     WHERE er.id_expediente_requisito = NEW.id_expediente_requisito;

    IF NOT FOUND THEN RAISE EXCEPTION 'El requisito de expediente % no existe', NEW.id_expediente_requisito; END IF;
    IF v_estado NOT IN ('BORRADOR', 'SUBSANACION') THEN
        RAISE EXCEPTION 'El expediente no admite adjuntos en el estado %', v_estado;
    END IF;
    IF NEW.tamanio_bytes > v_limite_bytes THEN
        RAISE EXCEPTION 'El archivo excede el peso maximo configurado para el requisito';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM requisito r
        JOIN tipo_documento_requisito tdr ON tdr.id_requisito = r.id_requisito
        JOIN expediente_requisito er ON er.id_tipo_documento_requisito = tdr.id_tipo_documento_requisito
        WHERE er.id_expediente_requisito = NEW.id_expediente_requisito
          AND upper(r.formatos_permitidos) ~ ('(^|,[[:space:]]*)' || upper(NEW.formato_extension) || '([[:space:]]*,|$)')
    ) THEN RAISE EXCEPTION 'La extension % no esta permitida para este requisito', NEW.formato_extension; END IF;

    IF NEW.id_adjunto_anterior IS NULL THEN
        IF NEW.version_num <> 1 THEN RAISE EXCEPTION 'La primera version de un archivo debe ser 1'; END IF;
        IF EXISTS (
            SELECT 1 FROM archivo_adjunto aa
            WHERE aa.id_expediente_requisito = NEW.id_expediente_requisito
              AND aa.estado_adjunto IN ('CARGADO', 'OBSERVADO', 'APROBADO')
        ) AND NOT v_permite_multiples THEN
            RAISE EXCEPTION 'Este requisito solo permite un archivo activo';
        END IF;
    ELSE
        SELECT id_expediente_requisito, estado_adjunto, version_num
          INTO v_req_anterior, v_estado_anterior, v_version_anterior
          FROM archivo_adjunto WHERE id_adjunto = NEW.id_adjunto_anterior FOR UPDATE;
        IF NOT FOUND OR v_req_anterior <> NEW.id_expediente_requisito THEN
            RAISE EXCEPTION 'La version anterior debe pertenecer al mismo requisito de expediente';
        END IF;
        IF v_estado_anterior <> 'OBSERVADO' THEN
            RAISE EXCEPTION 'Solo un adjunto observado puede ser reemplazado';
        END IF;
        IF NEW.version_num <> v_version_anterior + 1 THEN
            RAISE EXCEPTION 'La version debe ser consecutiva respecto al adjunto anterior';
        END IF;
    END IF;
    IF NEW.id_adjunto_anterior IS NULL AND (
        SELECT count(*) FROM archivo_adjunto aa
        WHERE aa.id_expediente_requisito = NEW.id_expediente_requisito
          AND aa.estado_adjunto IN ('CARGADO', 'OBSERVADO', 'APROBADO')
    ) >= v_max_archivos THEN
        RAISE EXCEPTION 'Se alcanzo la cantidad maxima de archivos del requisito';
    END IF;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION fn_proteger_eliminacion_adjunto()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'No se permite DELETE en archivo_adjunto; use fn_eliminar_logicamente_adjunto(%)', OLD.id_adjunto;
    ELSIF OLD.estado_adjunto = 'APROBADO' AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'Un adjunto aprobado es inmutable';
    END IF;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION fn_eliminar_logicamente_adjunto(p_id_adjunto BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    UPDATE archivo_adjunto
       SET estado_adjunto = 'ELIMINADO'
     WHERE id_adjunto = p_id_adjunto
       AND estado_adjunto <> 'APROBADO';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el adjunto % o ya fue aprobado', p_id_adjunto;
    END IF;
END $$;

-- Deriva el estado del requisito a partir de sus adjuntos activos (RN-REQ-005).
CREATE OR REPLACE FUNCTION fn_recalcular_estado_requisito(p_id_expediente_requisito BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_estado estado_expediente_requisito;
    v_id_expediente BIGINT;
BEGIN
    SELECT CASE
        WHEN EXISTS (SELECT 1 FROM archivo_adjunto WHERE id_expediente_requisito = p_id_expediente_requisito AND estado_adjunto = 'OBSERVADO') THEN 'OBSERVADO'::estado_expediente_requisito
        WHEN EXISTS (SELECT 1 FROM archivo_adjunto WHERE id_expediente_requisito = p_id_expediente_requisito AND estado_adjunto = 'CARGADO')
             AND EXISTS (SELECT 1 FROM archivo_adjunto WHERE id_expediente_requisito = p_id_expediente_requisito AND id_adjunto_anterior IS NOT NULL) THEN 'SUBSANADO'::estado_expediente_requisito
        WHEN EXISTS (SELECT 1 FROM archivo_adjunto WHERE id_expediente_requisito = p_id_expediente_requisito AND estado_adjunto IN ('CARGADO', 'APROBADO'))
             AND NOT EXISTS (
                 SELECT 1 FROM archivo_adjunto
                 WHERE id_expediente_requisito = p_id_expediente_requisito
                   AND estado_adjunto IN ('CARGADO', 'OBSERVADO', 'APROBADO')
                   AND estado_adjunto <> 'APROBADO'
             ) THEN 'APROBADO'::estado_expediente_requisito
        ELSE 'PENDIENTE'::estado_expediente_requisito
    END INTO v_estado;
    UPDATE expediente_requisito
       SET estado = v_estado
     WHERE id_expediente_requisito = p_id_expediente_requisito
     RETURNING id_expediente INTO v_id_expediente;

    IF v_estado = 'OBSERVADO' THEN
        UPDATE expediente
           SET estado = 'SUBSANACION'
         WHERE id_expediente = v_id_expediente
           AND estado IN ('EN_REVISION', 'OBSERVADO', 'SUBSANACION');
    ELSIF NOT EXISTS (
        SELECT 1
          FROM expediente_requisito er
          JOIN tipo_documento_requisito tdr
            ON tdr.id_tipo_documento_requisito = er.id_tipo_documento_requisito
          JOIN requisito r ON r.id_requisito = tdr.id_requisito
         WHERE er.id_expediente = v_id_expediente
           AND COALESCE(tdr.obligatoriedad_override, r.tipo_obligatoriedad) <> 'OPCIONAL'
           AND (COALESCE(tdr.obligatoriedad_override, r.tipo_obligatoriedad) <> 'CONDICIONAL'
                OR er.fecha_activacion IS NOT NULL)
           AND er.estado <> 'APROBADO'
    ) THEN
        UPDATE expediente
           SET estado = 'EN_REVISION'
         WHERE id_expediente = v_id_expediente
           AND estado = 'SUBSANACION';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION fn_postprocesar_adjunto()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.id_adjunto_anterior IS NOT NULL THEN
        UPDATE archivo_adjunto SET estado_adjunto = 'REEMPLAZADO' WHERE id_adjunto = NEW.id_adjunto_anterior;
    END IF;
    PERFORM fn_recalcular_estado_requisito(COALESCE(NEW.id_expediente_requisito, OLD.id_expediente_requisito));
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS tr_validar_campo_condicionante ON tipo_documento_requisito;
CREATE TRIGGER tr_validar_campo_condicionante BEFORE INSERT OR UPDATE ON tipo_documento_requisito
FOR EACH ROW EXECUTE FUNCTION fn_validar_campo_condicionante();
DROP TRIGGER IF EXISTS tr_validar_valor_campo ON valor_campo;
CREATE TRIGGER tr_validar_valor_campo BEFORE INSERT OR UPDATE ON valor_campo
FOR EACH ROW EXECUTE FUNCTION fn_validar_valor_campo();
DROP TRIGGER IF EXISTS tr_validar_adjunto ON archivo_adjunto;
CREATE TRIGGER tr_validar_adjunto BEFORE INSERT ON archivo_adjunto
FOR EACH ROW EXECUTE FUNCTION fn_validar_adjunto();
DROP TRIGGER IF EXISTS tr_proteger_adjunto ON archivo_adjunto;
CREATE TRIGGER tr_proteger_adjunto BEFORE UPDATE OR DELETE ON archivo_adjunto
FOR EACH ROW EXECUTE FUNCTION fn_proteger_eliminacion_adjunto();
DROP TRIGGER IF EXISTS tr_postprocesar_adjunto ON archivo_adjunto;
CREATE TRIGGER tr_postprocesar_adjunto AFTER INSERT OR UPDATE OR DELETE ON archivo_adjunto
FOR EACH ROW EXECUTE FUNCTION fn_postprocesar_adjunto();

COMMIT;