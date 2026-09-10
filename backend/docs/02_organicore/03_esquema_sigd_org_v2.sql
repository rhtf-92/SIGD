/*
 * OrganiCore v2 - DDL PostgreSQL 18+
 * Responsable: B_POOL
 * Grupo: Grupo 3 — OrganiCore
 * Rama: B_POOL
 * Fecha: 2026-09-09
 * Descripción: Esquema oficial v2 con UUID id_area, ltree path y validación ABAC por p_momento.
 */

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA IF NOT EXISTS sigd_org;

CREATE TABLE IF NOT EXISTS sigd_org.area (
    id_area UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    sigla VARCHAR(20) NOT NULL UNIQUE,
    parent_id UUID,
    path ltree NOT NULL,
    nivel_organizacional INTEGER NOT NULL DEFAULT 1,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_area_parent
        FOREIGN KEY (parent_id) REFERENCES sigd_org.area(id_area) ON DELETE RESTRICT,
    CONSTRAINT ck_area_no_self_parent
        CHECK (parent_id IS NULL OR parent_id <> id_area),
    CONSTRAINT ck_area_nivel
        CHECK (nivel_organizacional > 0)
);

CREATE INDEX IF NOT EXISTS idx_area_parent_id ON sigd_org.area(parent_id);
CREATE INDEX IF NOT EXISTS idx_area_path_gist ON sigd_org.area USING gist(path);

CREATE OR REPLACE FUNCTION sigd_org.fn_area_set_path()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_parent_path ltree;
    v_parent_level INTEGER;
    v_label TEXT;
BEGIN
    v_label := replace(NEW.id_area::text, '-', '_');

    IF NEW.parent_id IS NULL THEN
        NEW.path := v_label::ltree;
        NEW.nivel_organizacional := 1;
    ELSE
        IF NEW.parent_id = NEW.id_area THEN
            RAISE EXCEPTION 'Un área no puede ser hija de sí misma'
                USING ERRCODE = '23514';
        END IF;

        SELECT a.path, a.nivel_organizacional
          INTO v_parent_path, v_parent_level
          FROM sigd_org.area AS a
         WHERE a.id_area = NEW.parent_id
         FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El área padre % no existe', NEW.parent_id
                USING ERRCODE = '23503';
        END IF;

        IF TG_OP = 'UPDATE'
           AND NEW.parent_id IS DISTINCT FROM OLD.parent_id
           AND v_parent_path @> OLD.path THEN
            RAISE EXCEPTION
                'Movimiento inválido: el área % no puede depender de su descendiente %',
                NEW.id_area, NEW.parent_id
                USING ERRCODE = '23514';
        END IF;

        NEW.path := (v_parent_path::text || '.' || v_label)::ltree;
        NEW.nivel_organizacional := v_parent_level + 1;
    END IF;

    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sigd_org.fn_area_rebuild_descendants()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_old_prefix TEXT;
    v_new_prefix TEXT;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
        v_old_prefix := OLD.path::text;
        v_new_prefix := NEW.path::text;

        UPDATE sigd_org.area AS a
           SET path = (v_new_prefix || regexp_replace(a.path::text, '^' || v_old_prefix || '(\.)?', '', 'i'))::ltree,
               nivel_organizacional = NEW.nivel_organizacional + (nlevel(a.path) - nlevel(OLD.path)),
               actualizado_en = now()
         WHERE a.id_area <> OLD.id_area
           AND a.path <@ OLD.path;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_area_set_path ON sigd_org.area;
CREATE TRIGGER trg_area_set_path
BEFORE INSERT OR UPDATE OF parent_id ON sigd_org.area
FOR EACH ROW
EXECUTE FUNCTION sigd_org.fn_area_set_path();

DROP TRIGGER IF EXISTS trg_area_rebuild_descendants ON sigd_org.area;
CREATE TRIGGER trg_area_rebuild_descendants
AFTER UPDATE OF parent_id ON sigd_org.area
FOR EACH ROW
EXECUTE FUNCTION sigd_org.fn_area_rebuild_descendants();

CREATE TABLE IF NOT EXISTS sigd_org.cargo (
    cargo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sigd_org.rol_sistema (
    rol_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sigd_org.permiso_sistema (
    permiso_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    alcance_predeterminado VARCHAR(20) NOT NULL DEFAULT 'AREA',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_permiso_alcance
        CHECK (alcance_predeterminado IN ('AREA', 'SUBAREAS', 'GLOBAL'))
);

CREATE TABLE IF NOT EXISTS sigd_org.rol_permiso (
    rol_id UUID NOT NULL REFERENCES sigd_org.rol_sistema(rol_id) ON DELETE CASCADE,
    permiso_id UUID NOT NULL REFERENCES sigd_org.permiso_sistema(permiso_id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE IF NOT EXISTS sigd_org.usuario_rol (
    cuenta_id UUID NOT NULL,
    rol_id UUID NOT NULL REFERENCES sigd_org.rol_sistema(rol_id) ON DELETE CASCADE,
    vigencia TSTZRANGE NOT NULL DEFAULT tstzrange(now(), NULL, '[)'),
    PRIMARY KEY (cuenta_id, rol_id),
    CONSTRAINT chk_usuario_rol_vigencia_no_vacia
        CHECK (NOT isempty(vigencia))
);

CREATE TABLE IF NOT EXISTS sigd_org.asignacion_personal (
    asignacion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_id UUID NOT NULL,
    id_area UUID NOT NULL REFERENCES sigd_org.area(id_area),
    cargo_id UUID NOT NULL REFERENCES sigd_org.cargo(cargo_id),
    es_titular BOOLEAN NOT NULL DEFAULT TRUE,
    vigencia TSTZRANGE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_asignacion_vigencia_no_vacia
        CHECK (NOT isempty(vigencia)),
    CONSTRAINT excl_asignacion_personal_vigencia
        EXCLUDE USING gist (id_area WITH =, cargo_id WITH =, vigencia WITH &&)
);

CREATE INDEX IF NOT EXISTS idx_asignacion_personal_cuenta ON sigd_org.asignacion_personal(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_asignacion_personal_vigencia ON sigd_org.asignacion_personal USING gist(vigencia);

CREATE TABLE IF NOT EXISTS sigd_org.facultad_despacho (
    facultad_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(60) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    cargo_id UUID NOT NULL REFERENCES sigd_org.cargo(cargo_id),
    puede_firmar BOOLEAN NOT NULL DEFAULT FALSE,
    vigente_desde DATE NOT NULL,
    vigente_hasta DATE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_facultad_vigencia
        CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

CREATE TABLE IF NOT EXISTS sigd_org.encargatura_despacho (
    encargatura_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_area UUID NOT NULL REFERENCES sigd_org.area(id_area),
    cargo_id UUID NOT NULL REFERENCES sigd_org.cargo(cargo_id),
    facultad_despacho_id UUID NOT NULL REFERENCES sigd_org.facultad_despacho(facultad_id),
    usuario_titular_id UUID NOT NULL,
    usuario_suplente_id UUID NOT NULL,
    tipo_delegacion VARCHAR(40) NOT NULL,
    resolucion_ref VARCHAR(120) NOT NULL,
    periodo_vigencia TSTZRANGE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_encargatura_usuarios_distintos
        CHECK (usuario_titular_id <> usuario_suplente_id),
    CONSTRAINT chk_encargatura_periodo_no_vacio
        CHECK (NOT isempty(periodo_vigencia)),
    CONSTRAINT excl_encargatura_despacho_vigencia
        EXCLUDE USING gist (id_area WITH =, cargo_id WITH =, periodo_vigencia WITH &&)
);

CREATE INDEX IF NOT EXISTS idx_encargatura_despacho_vigencia
    ON sigd_org.encargatura_despacho USING gist(periodo_vigencia);

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
          JOIN sigd_org.facultad_despacho AS f ON f.facultad_id = e.facultad_despacho_id
         WHERE e.usuario_suplente_id = p_cuenta_id
           AND e.id_area = p_area_id
           AND e.cargo_id = p_cargo_id
           AND e.activo = TRUE
           AND f.activo = TRUE
           AND f.puede_firmar = TRUE
           AND e.periodo_vigencia @> p_momento
           AND p_momento::date >= f.vigente_desde
           AND (f.vigente_hasta IS NULL OR p_momento::date <= f.vigente_hasta)
    ) OR EXISTS (
        SELECT 1
          FROM sigd_org.asignacion_personal AS a
          JOIN sigd_org.facultad_despacho AS f ON f.cargo_id = a.cargo_id
         WHERE a.cuenta_id = p_cuenta_id
           AND a.id_area = p_area_id
           AND a.cargo_id = p_cargo_id
           AND a.activo = TRUE
           AND f.activo = TRUE
           AND f.puede_firmar = TRUE
           AND a.vigencia @> p_momento
           AND p_momento::date >= f.vigente_desde
           AND (f.vigente_hasta IS NULL OR p_momento::date <= f.vigente_hasta)
    );
$$;

COMMENT ON COLUMN sigd_org.area.path IS
    'Ruta jerárquica ltree para consultas de ancestros y descendientes';
COMMENT ON TABLE sigd_org.encargatura_despacho IS
    'Delegaciones temporales; la vigencia se evalúa con periodo_vigencia @> p_momento';
COMMENT ON TABLE sigd_org.asignacion_personal IS
    'Asignación de usuarios a áreas y cargos con vigencia temporal';
COMMENT ON TABLE sigd_org.facultad_despacho IS
    'Facultad legal de despacho asociada a un cargo';
