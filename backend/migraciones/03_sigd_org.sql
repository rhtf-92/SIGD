-- =============================================================================
-- Migración 03 · Esquema sigd_org
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Ricardo Arévalo Villacorta (B_AREVALO) · Grupo 6 CoreLink
-- Marco     : Ley N° 27269 (firmas), TUO Ley 27444 Art. 143 (delegación)
-- Depende de: 02_sigd_auth.sql
-- Contenido : organigrama ltree, roles canónicos, RBAC y facultades de despacho
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA IF NOT EXISTS sigd_org;

-- -----------------------------------------------------------------------------
-- 3.1 area — jerarquía orgánica con extensión ltree
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_org.area (
    area_id        UUID         NOT NULL DEFAULT gen_random_uuid()
                               CONSTRAINT pk_area PRIMARY KEY,
    codigo         VARCHAR(20)  NOT NULL UNIQUE,
    nombre         VARCHAR(160) NOT NULL,
    area_padre_id  UUID         NULL
                               REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT,
    path           LTREE        NOT NULL,
    nivel          SMALLINT     NOT NULL DEFAULT 1,
    vigente        BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_area_path UNIQUE (path),
    CONSTRAINT chk_area_nivel CHECK (nivel >= 1)
);

COMMENT ON COLUMN sigd_org.area.path IS
    'Ruta jerárquica calculada automáticamente por sigd_org.fn_area_set_path() a partir de area_padre_id.';

-- Cálculo automático de la ruta en árbol y del nivel.
CREATE OR REPLACE FUNCTION sigd_org.fn_area_set_path()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_path  LTREE;
    v_nivel SMALLINT;
BEGIN
    IF NEW.area_padre_id IS NULL THEN
        SELECT text2ltree('a.' || replace(NEW.codigo, '.', '_')) INTO v_path;
        v_nivel := 1;
    ELSE
        SELECT path, nivel + 1 INTO v_path, v_nivel
        FROM sigd_org.area
        WHERE area_id = NEW.area_padre_id;

        IF v_path IS NULL THEN
            RAISE EXCEPTION 'El área padre % no existe o no tiene ruta calculada', NEW.area_padre_id
                USING ERRCODE = '23503';
        END IF;

        v_path := v_path || text2ltree('a.' || replace(NEW.codigo, '.', '_'));
    END IF;

    NEW.path := v_path;
    NEW.nivel := v_nivel;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_area_set_path ON sigd_org.area;
CREATE TRIGGER tr_area_set_path
    BEFORE INSERT OR UPDATE OF area_padre_id, codigo ON sigd_org.area
    FOR EACH ROW EXECUTE FUNCTION sigd_org.fn_area_set_path();

-- El path y el nivel los calcula siempre el trigger: no existe ruta huérfana.
-- No se requiere backfill porque sigd_org.area es de creación exclusiva de esta
-- migración y la columna `path` es NOT NULL.

CREATE INDEX IF NOT EXISTS idx_area_path ON sigd_org.area USING GIST (path);
CREATE INDEX IF NOT EXISTS idx_area_padre ON sigd_org.area (area_padre_id);
CREATE INDEX IF NOT EXISTS idx_area_vigente ON sigd_org.area (vigente) WHERE vigente = TRUE;

-- -----------------------------------------------------------------------------
-- 3.2 cargo y roles canónicos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_org.cargo (
    cargo_id    UUID        NOT NULL DEFAULT gen_random_uuid()
                            CONSTRAINT pk_cargo PRIMARY KEY,
    codigo      VARCHAR(30) NOT NULL UNIQUE,
    nombre      VARCHAR(160) NOT NULL,
    descripcion TEXT        NULL,
    vigente     BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sigd_org.rol_sistema (
    rol_id       UUID         NOT NULL DEFAULT gen_random_uuid()
                             CONSTRAINT pk_rol_sistema PRIMARY KEY,
    codigo       VARCHAR(30)  NOT NULL UNIQUE,
    nombre       VARCHAR(120) NOT NULL,
    descripcion  TEXT         NULL,
    vigente      BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_rol_codigo CHECK (codigo IN (
        'ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'MESA_PARTES', 'CIUDADANO'
    ))
);

CREATE TABLE IF NOT EXISTS sigd_org.permiso_sistema (
    permiso_id  UUID         NOT NULL DEFAULT gen_random_uuid()
                            CONSTRAINT pk_permiso_sistema PRIMARY KEY,
    codigo      VARCHAR(60)  NOT NULL UNIQUE,
    nombre      VARCHAR(160) NOT NULL,
    ambito      VARCHAR(10)  NOT NULL DEFAULT 'GLOBAL',
    CONSTRAINT chk_permiso_ambito CHECK (ambito IN ('AREA', 'GLOBAL'))
);

CREATE TABLE IF NOT EXISTS sigd_org.rol_permiso (
    rol_id      UUID NOT NULL REFERENCES sigd_org.rol_sistema (rol_id) ON DELETE CASCADE,
    permiso_id  UUID NOT NULL REFERENCES sigd_org.permiso_sistema (permiso_id) ON DELETE CASCADE,
    CONSTRAINT pk_rol_permiso PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE IF NOT EXISTS sigd_org.usuario_rol (
    id_usuario_rol UUID        NOT NULL DEFAULT gen_random_uuid()
                              CONSTRAINT pk_usuario_rol PRIMARY KEY,
    id_usuario     UUID        NOT NULL
                              REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE CASCADE,
    rol_id         UUID        NOT NULL
                              REFERENCES sigd_org.rol_sistema (rol_id) ON DELETE RESTRICT,
    area_id        UUID        NULL
                              REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT,
    vigente_desde  TIMESTAMPTZ NOT NULL DEFAULT now(),
    vigente_hasta  TIMESTAMPTZ NULL,
    CONSTRAINT chk_usuario_rol_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde)
);

-- Exclusión temporal: un usuario no puede tener el mismo rol en el mismo ámbito
-- durante periodos de vigencia solapados.
ALTER TABLE sigd_org.usuario_rol
    DROP CONSTRAINT IF EXISTS ex_usuario_rol_vigencia;
ALTER TABLE sigd_org.usuario_rol
    ADD CONSTRAINT ex_usuario_rol_vigencia
    EXCLUDE USING gist (
        id_usuario WITH =,
        rol_id WITH =,
        COALESCE(area_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
        tstzrange(vigente_desde, COALESCE(vigente_hasta, 'infinity'::timestamptz), '[)') WITH &&
    );

-- -----------------------------------------------------------------------------
-- 3.3 asignación_personal y encargatura (exclusión temporal GiST)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_org.asignacion_personal (
    id_asignacion UUID        NOT NULL DEFAULT gen_random_uuid()
                             CONSTRAINT pk_asignacion_personal PRIMARY KEY,
    id_usuario    UUID        NOT NULL
                             REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE CASCADE,
    cargo_id      UUID        NOT NULL
                             REFERENCES sigd_org.cargo (cargo_id) ON DELETE RESTRICT,
    area_id       UUID        NOT NULL
                             REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT,
    vigente_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
    vigente_hasta TIMESTAMPTZ NULL
);

ALTER TABLE sigd_org.asignacion_personal
    DROP CONSTRAINT IF EXISTS ex_asignacion_personal_vigencia;
ALTER TABLE sigd_org.asignacion_personal
    ADD CONSTRAINT ex_asignacion_personal_vigencia
    EXCLUDE USING gist (
        id_usuario WITH =,
        cargo_id WITH =,
        tstzrange(vigente_desde, COALESCE(vigente_hasta, 'infinity'::timestamptz), '[)') WITH &&
    );

CREATE TABLE IF NOT EXISTS sigd_org.facultad_despacho (
    facultad_id      UUID        NOT NULL DEFAULT gen_random_uuid()
                                   CONSTRAINT pk_facultad_despacho PRIMARY KEY,
    usuario_id       UUID        NOT NULL
                                   REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE CASCADE,
    cargo_id         UUID        NOT NULL
                                   REFERENCES sigd_org.cargo (cargo_id) ON DELETE RESTRICT,
    tipo_resolucion  VARCHAR(40) NULL,
    vigente          BOOLEAN     NOT NULL DEFAULT TRUE,
    motivo_no_habilitado TEXT    NULL,
    emitido_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_facultad_tipo CHECK (tipo_resolucion IS NULL OR tipo_resolucion IN (
        'DIRECTORAL_TITULACION', 'DIRECTORAL_CONVALIDACION', 'DIRECTORAL_ADMINISTRATIVA'
    ))
);

CREATE TABLE IF NOT EXISTS sigd_org.encargatura_despacho (
    encargatura_id   UUID        NOT NULL DEFAULT gen_random_uuid()
                                   CONSTRAINT pk_encargatura_despacho PRIMARY KEY,
    usuario_id       UUID        NOT NULL
                                   REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE CASCADE,
    titular_usuario_id UUID      NOT NULL
                                   REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE RESTRICT,
    cargo_id         UUID        NOT NULL
                                   REFERENCES sigd_org.cargo (cargo_id) ON DELETE RESTRICT,
    tipo_resolucion  VARCHAR(40) NULL,
    vigente          BOOLEAN     NOT NULL DEFAULT TRUE,
    motivo_no_habilitado TEXT    NULL,
    inicio           TIMESTAMPTZ NOT NULL DEFAULT now(),
    fin              TIMESTAMPTZ NULL,
    CONSTRAINT chk_encargatura_rango CHECK (fin IS NULL OR fin > inicio),
    CONSTRAINT chk_encargatura_no_auto CHECK (usuario_id <> titular_usuario_id)
);

ALTER TABLE sigd_org.encargatura_despacho
    DROP CONSTRAINT IF EXISTS ex_encargatura_vigencia;
ALTER TABLE sigd_org.encargatura_despacho
    ADD CONSTRAINT ex_encargatura_vigencia
    EXCLUDE USING gist (
        usuario_id WITH =,
        cargo_id WITH =,
        tstzrange(inicio, COALESCE(fin, 'infinity'::timestamptz), '[)') WITH &&
    );

CREATE INDEX IF NOT EXISTS idx_facultad_usuario ON sigd_org.facultad_despacho (usuario_id) WHERE vigente = TRUE;
CREATE INDEX IF NOT EXISTS idx_encargatura_usuario ON sigd_org.encargatura_despacho (usuario_id) WHERE vigente = TRUE;
CREATE INDEX IF NOT EXISTS idx_usuario_rol_usuario ON sigd_org.usuario_rol (id_usuario);
CREATE INDEX IF NOT EXISTS idx_rol_permiso_rol ON sigd_org.rol_permiso (rol_id);

-- -----------------------------------------------------------------------------
-- 3.6 Semilla de los 5 roles canónicos + permisos base
-- -----------------------------------------------------------------------------
INSERT INTO sigd_org.rol_sistema (codigo, nombre, descripcion)
VALUES
    ('ADMINISTRADOR', 'Administrador del Sistema', 'Administración técnica total de la plataforma SIGD'),
    ('DIRECTOR', 'Director', 'Emisión de resoluciones directorales y firma digital'),
    ('SECRETARIO', 'Secretario Académico', 'Proyección y preparación de resoluciones y expedientes de titulación'),
    ('ESPECIALISTA', 'Especialista', 'Análisis técnico y emisión de dictámenes'),
    ('MESA_PARTES', 'Mesa de Partes', 'Recepción, radicación y registro de documentos'),
    ('CIUDADANO', 'Ciudadano', 'Acceso restringido a la Casilla Electrónica del administrado')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO sigd_org.permiso_sistema (codigo, nombre, ambito)
VALUES
    ('EXPEDIENTE_LEER', 'Leer expedientes', 'GLOBAL'),
    ('EXPEDIENTE_DERIVAR', 'Derivar expedientes', 'AREA'),
    ('EXPEDIENTE_RESOLVER', 'Resolver expedientes', 'AREA'),
    ('FIRMA_FIRMAR', 'Firmar documentos oficiales', 'GLOBAL'),
    ('ADMIN_USUARIOS', 'Administrar usuarios y roles', 'GLOBAL'),
    ('REPORTE_LEER', 'Consultar reportes MGD', 'GLOBAL')
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3.7 calendario_laboral (Feriados Nacionales, Regionales Ucayali y Duelo)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_org.calendario_laboral (
    id_calendario       UUID         NOT NULL DEFAULT gen_random_uuid()
                                     CONSTRAINT pk_calendario_laboral PRIMARY KEY,
    fecha               DATE         NOT NULL,
    anio                INT          GENERATED ALWAYS AS (EXTRACT(YEAR FROM fecha)::INT) STORED,
    tipo_feriado        VARCHAR(30)  NULL,
    descripcion         VARCHAR(255) NOT NULL,
    unidad_territorial  VARCHAR(30)  NOT NULL DEFAULT 'NACIONAL',
    es_laborable        BOOLEAN      NOT NULL DEFAULT FALSE,
    es_feriado          BOOLEAN      GENERATED ALWAYS AS (NOT es_laborable) STORED,
    base_legal          VARCHAR(255) NULL,
    registrado_por      UUID         NULL,
    activo              BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_calendario_fecha_unidad UNIQUE (fecha, unidad_territorial)
);

CREATE INDEX IF NOT EXISTS idx_calendario_fecha
    ON sigd_org.calendario_laboral (fecha);
CREATE INDEX IF NOT EXISTS idx_calendario_anio
    ON sigd_org.calendario_laboral (anio);

-- Feriados Regionales Ucayali 2026 (San Juan y Creación de Ucayali)
INSERT INTO sigd_org.calendario_laboral (
    fecha, tipo_feriado, descripcion, unidad_territorial, es_laborable, base_legal
) VALUES
('2026-06-24', 'REGIONAL_UCAYALI', 'Fiesta Patronal de San Juan Bautista', 'REGIONAL_UCAYALI', FALSE, 'Ley N° 29001'),
('2026-10-13', 'REGIONAL_UCAYALI', 'Aniversario de Creación de Ucayali', 'REGIONAL_UCAYALI', FALSE, 'Ley N° 29001')
ON CONFLICT (fecha, unidad_territorial) DO NOTHING;

