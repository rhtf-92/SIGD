/*
 * OrganiCore v2 - DDL PostgreSQL 18+
 * Responsable: B_PANAIFO
 *
 * Las columnas cuenta_id son UUID y representan el contrato con
 * sigd_auth.cuenta_usuario. La FK física se añadirá en la migración de
 * integración cuando ambos módulos compartan el mismo tipo de identidad.
 */

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA IF NOT EXISTS sigd_org;

CREATE TABLE IF NOT EXISTS sigd_org.area (
    area_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    sigla VARCHAR(20) NOT NULL UNIQUE,
    parent_id UUID REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
    path VARCHAR(255) NOT NULL,
    nivel_organizacional INTEGER NOT NULL DEFAULT 1,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_area_nivel CHECK (nivel_organizacional > 0),
    CONSTRAINT ck_area_path_format CHECK (path LIKE '/%/')
);

CREATE INDEX IF NOT EXISTS idx_area_parent_id ON sigd_org.area(parent_id);
CREATE INDEX IF NOT EXISTS idx_area_path_pattern
    ON sigd_org.area (path varchar_pattern_ops);

CREATE OR REPLACE FUNCTION sigd_org.fn_area_set_path()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    parent_path VARCHAR(255);
    parent_level INTEGER;
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.path := '/' || NEW.area_id::text || '/';
        NEW.nivel_organizacional := 1;
    ELSE
        IF NEW.parent_id = NEW.area_id THEN
            RAISE EXCEPTION 'Un área no puede ser hija de sí misma'
                USING ERRCODE = '23514';
        END IF;

        SELECT a.path, a.nivel_organizacional
          INTO parent_path, parent_level
          FROM sigd_org.area AS a
         WHERE a.area_id = NEW.parent_id
         FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El área padre % no existe', NEW.parent_id
                USING ERRCODE = '23503';
        END IF;

        IF TG_OP = 'UPDATE'
           AND NEW.parent_id IS DISTINCT FROM OLD.parent_id
           AND parent_path LIKE OLD.path || '%' THEN
            RAISE EXCEPTION
                'Movimiento inválido: el área % no puede depender de su descendiente %',
                NEW.area_id, NEW.parent_id
                USING ERRCODE = '23514';
        END IF;

        NEW.path := parent_path || NEW.area_id::text || '/';
        NEW.nivel_organizacional := parent_level + 1;
    END IF;

    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_area_set_path ON sigd_org.area;
CREATE TRIGGER trg_area_set_path
BEFORE INSERT OR UPDATE OF parent_id ON sigd_org.area
FOR EACH ROW
EXECUTE FUNCTION sigd_org.fn_area_set_path();

CREATE OR REPLACE FUNCTION sigd_org.fn_area_propagate_path()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Actualizar solo hijos directos; cada hijo propaga el cambio a su vez.
    UPDATE sigd_org.area
       SET parent_id = parent_id
     WHERE parent_id = NEW.area_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_area_propagate_path ON sigd_org.area;
CREATE TRIGGER trg_area_propagate_path
AFTER UPDATE OF parent_id ON sigd_org.area
FOR EACH ROW
WHEN (OLD.path IS DISTINCT FROM NEW.path)
EXECUTE FUNCTION sigd_org.fn_area_propagate_path();

CREATE TABLE IF NOT EXISTS sigd_org.cargo (
    cargo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    es_titular_despacho BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sigd_org.asignacion_personal (
    asignacion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_id UUID NOT NULL,
    area_id UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
    cargo_id UUID NOT NULL REFERENCES sigd_org.cargo(cargo_id) ON DELETE RESTRICT,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    es_principal BOOLEAN NOT NULL DEFAULT TRUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_asignacion_fechas
        CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_asignacion_personal_cuenta
    ON sigd_org.asignacion_personal(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_asignacion_personal_area
    ON sigd_org.asignacion_personal(area_id);
CREATE INDEX IF NOT EXISTS idx_asignacion_personal_cargo
    ON sigd_org.asignacion_personal(cargo_id);

CREATE TABLE IF NOT EXISTS sigd_org.facultad_despacho (
    facultad_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cargo_id UUID NOT NULL REFERENCES sigd_org.cargo(cargo_id) ON DELETE RESTRICT,
    codigo VARCHAR(60) NOT NULL,
    puede_firmar BOOLEAN NOT NULL DEFAULT FALSE,
    puede_derivar BOOLEAN NOT NULL DEFAULT FALSE,
    vigente_desde DATE NOT NULL DEFAULT CURRENT_DATE,
    vigente_hasta DATE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_facultad_cargo_codigo UNIQUE (cargo_id, codigo),
    CONSTRAINT ck_facultad_vigencia
        CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

CREATE TABLE IF NOT EXISTS sigd_org.encargatura_despacho (
    encargatura_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_titular_id UUID NOT NULL,
    cuenta_suplente_id UUID NOT NULL,
    area_id UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT,
    cargo_id UUID NOT NULL REFERENCES sigd_org.cargo(cargo_id) ON DELETE RESTRICT,
    tipo_encargatura VARCHAR(30) NOT NULL,
    documento_sustento VARCHAR(120) NOT NULL,
    periodo_vigencia TSTZRANGE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_encargatura_tipo CHECK
        (tipo_encargatura IN ('INTERINO', 'SUPLENTE', 'DELEGADO', 'ACCIDENTAL')),
    CONSTRAINT ck_encargatura_cuentas
        CHECK (cuenta_titular_id <> cuenta_suplente_id),
    CONSTRAINT ck_encargatura_periodo
        CHECK (NOT isempty(periodo_vigencia))
);

CREATE INDEX IF NOT EXISTS idx_encargatura_area_cargo
    ON sigd_org.encargatura_despacho(area_id, cargo_id);
CREATE INDEX IF NOT EXISTS idx_encargatura_periodo
    ON sigd_org.encargatura_despacho USING GIST(periodo_vigencia);

ALTER TABLE sigd_org.encargatura_despacho
    DROP CONSTRAINT IF EXISTS ex_encargatura_cargo_periodo;
ALTER TABLE sigd_org.encargatura_despacho
    ADD CONSTRAINT ex_encargatura_cargo_periodo
    EXCLUDE USING GIST (
        cargo_id WITH =,
        periodo_vigencia WITH &&
    ) WHERE (activo);

CREATE TABLE IF NOT EXISTS sigd_org.rol (
    rol_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sigd_org.permiso (
    permiso_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(80) NOT NULL UNIQUE,
    modulo VARCHAR(50) NOT NULL,
    descripcion TEXT,
    alcance_predeterminado VARCHAR(20) NOT NULL DEFAULT 'AREA',
    CONSTRAINT ck_permiso_alcance CHECK
        (alcance_predeterminado IN ('AREA', 'SUBAREAS', 'GLOBAL'))
);

CREATE TABLE IF NOT EXISTS sigd_org.rol_permiso (
    rol_id UUID NOT NULL REFERENCES sigd_org.rol(rol_id) ON DELETE CASCADE,
    permiso_id UUID NOT NULL REFERENCES sigd_org.permiso(permiso_id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE IF NOT EXISTS sigd_org.usuario_rol (
    cuenta_id UUID NOT NULL,
    rol_id UUID NOT NULL REFERENCES sigd_org.rol(rol_id) ON DELETE CASCADE,
    asignado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (cuenta_id, rol_id)
);

CREATE OR REPLACE FUNCTION sigd_org.usuario_tiene_facultad_despacho(
    p_cuenta_id UUID,
    p_area_id UUID,
    p_cargo_id UUID,
    p_momento TIMESTAMPTZ DEFAULT now()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM sigd_org.encargatura_despacho AS e
          JOIN sigd_org.facultad_despacho AS f ON f.cargo_id = e.cargo_id
         WHERE e.cuenta_suplente_id = p_cuenta_id
           AND e.area_id = p_area_id
           AND e.cargo_id = p_cargo_id
           AND e.activo
           AND f.activo
           AND f.puede_firmar
           AND e.periodo_vigencia @> p_momento
           AND CURRENT_DATE >= f.vigente_desde
           AND (f.vigente_hasta IS NULL OR CURRENT_DATE <= f.vigente_hasta)
    ) OR EXISTS (
        SELECT 1
          FROM sigd_org.asignacion_personal AS a
          JOIN sigd_org.facultad_despacho AS f ON f.cargo_id = a.cargo_id
         WHERE a.cuenta_id = p_cuenta_id
           AND a.area_id = p_area_id
           AND a.cargo_id = p_cargo_id
           AND a.activo
           AND f.activo
           AND f.puede_firmar
           AND a.fecha_inicio <= p_momento::date
           AND (a.fecha_fin IS NULL OR a.fecha_fin >= p_momento::date)
           AND CURRENT_DATE >= f.vigente_desde
           AND (f.vigente_hasta IS NULL OR CURRENT_DATE <= f.vigente_hasta)
    );
$$;

COMMENT ON COLUMN sigd_org.area.path IS
    'Materialized path con segmentos UUID y separador final; consultar con LIKE path || %';
COMMENT ON TABLE sigd_org.encargatura_despacho IS
    'Delegaciones temporales; la vigencia se evalúa con periodo_vigencia @> timestamptz';
