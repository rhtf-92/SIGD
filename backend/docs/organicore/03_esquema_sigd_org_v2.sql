<<<<<<< HEAD
-- B_PANAIFO - Esquema OrganiCore v2
-- PostgreSQL 18.6+
-- Modelo oficial: esquema sigd_org

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA IF NOT EXISTS sigd_org;

CREATE TABLE IF NOT EXISTS sigd_org.area (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    parent_id UUID,
    path VARCHAR(255) NOT NULL DEFAULT '/',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_area_parent
        FOREIGN KEY (parent_id) REFERENCES sigd_org.area(id),
    CONSTRAINT chk_area_not_self_parent
        CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_area_parent_id ON sigd_org.area(parent_id);
CREATE INDEX IF NOT EXISTS idx_area_path ON sigd_org.area USING btree(path);

CREATE OR REPLACE FUNCTION sigd_org.actualizar_path_area()
=======
/*
 * OrganiCore v2 - DDL PostgreSQL 18+
 * Responsable: Angelo Carranza Pereyra (Pool) - B_POOL
 * Grupo: Grupo 3 — OrganiCore
 * Rama: B_POOL
 * Fecha: 2026-09-09
 * Descripción: Esquema oficial v2 con Materialized Path, ABAC y Encargaturas.
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
>>>>>>> origin/B_POOL
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    parent_path VARCHAR(255);
<<<<<<< HEAD
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.path := '/' || NEW.id::text || '/';
    ELSE
        IF NEW.parent_id = NEW.id THEN
            RAISE EXCEPTION 'Un área no puede ser su propio padre';
        END IF;

        IF EXISTS (
            WITH RECURSIVE descendientes AS (
                SELECT id, parent_id FROM sigd_org.area WHERE id = NEW.id
                UNION ALL
                SELECT a.id, a.parent_id
                FROM sigd_org.area a
                JOIN descendientes d ON a.parent_id = d.id
            )
            SELECT 1 FROM descendientes WHERE id = NEW.parent_id
        ) THEN
            RAISE EXCEPTION 'La reasignación crea un ciclo jerárquico';
        END IF;

        SELECT path INTO parent_path
        FROM sigd_org.area
        WHERE id = NEW.parent_id;

        IF parent_path IS NULL THEN
            RAISE EXCEPTION 'El área padre no existe: %', NEW.parent_id;
        END IF;

        NEW.path := parent_path || NEW.id::text || '/';
=======
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

        NEW.path := parent_path || NEW.area_id::text || '/';
        NEW.nivel_organizacional := parent_level + 1;
>>>>>>> origin/B_POOL
    END IF;

    RETURN NEW;
END;
$$;

<<<<<<< HEAD
DROP TRIGGER IF EXISTS trg_area_path ON sigd_org.area;
CREATE TRIGGER trg_area_path
BEFORE INSERT OR UPDATE OF parent_id ON sigd_org.area
FOR EACH ROW
EXECUTE FUNCTION sigd_org.actualizar_path_area();

CREATE TABLE IF NOT EXISTS sigd_org.cargo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(40) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
    area_id UUID,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_cargo_area
        FOREIGN KEY (area_id) REFERENCES sigd_org.area(id)
);

CREATE INDEX IF NOT EXISTS idx_cargo_area ON sigd_org.cargo(area_id);

CREATE TABLE IF NOT EXISTS sigd_org.rol_sistema (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(60) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
=======
CREATE TRIGGER trigger_set_path
BEFORE INSERT OR UPDATE OF parent_id, area_id ON sigd_org.area
FOR EACH ROW EXECUTE FUNCTION sigd_org.fn_area_set_path();

CREATE TABLE IF NOT EXISTS sigd_org.cargo (
    cargo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sigd_org.rol_sistema (
    rol_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
>>>>>>> origin/B_POOL
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sigd_org.permiso_sistema (
<<<<<<< HEAD
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sigd_org.rol_permiso (
    rol_id UUID NOT NULL REFERENCES sigd_org.rol_sistema(id),
    permiso_id UUID NOT NULL REFERENCES sigd_org.permiso_sistema(id),
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE IF NOT EXISTS sigd_org.usuario_rol (
    usuario_id UUID NOT NULL,
    rol_id UUID NOT NULL REFERENCES sigd_org.rol_sistema(id),
    vigencia TSTZRANGE NOT NULL DEFAULT tstzrange(CURRENT_TIMESTAMP, NULL, '[)'),
    PRIMARY KEY (usuario_id, rol_id),
    CONSTRAINT chk_usuario_rol_vigencia_no_vacia CHECK (NOT isempty(vigencia))
);

CREATE INDEX IF NOT EXISTS idx_usuario_rol_rol ON sigd_org.usuario_rol(rol_id);

CREATE TABLE IF NOT EXISTS sigd_org.asignacion_area (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL,
    area_id UUID NOT NULL REFERENCES sigd_org.area(id),
    cargo_id UUID NOT NULL REFERENCES sigd_org.cargo(id),
    es_titular BOOLEAN NOT NULL DEFAULT TRUE,
    vigencia TSTZRANGE NOT NULL,
    CONSTRAINT chk_asignacion_area_vigencia_no_vacia CHECK (NOT isempty(vigencia)),
=======
    permiso_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    alcance_predeterminado VARCHAR(20) NOT NULL DEFAULT 'AREA',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_permiso_alcance CHECK
        (alcance_predeterminado IN ('AREA', 'SUBAREAS', 'GLOBAL'))
);

CREATE TABLE IF NOT EXISTS sigd_org.rol_permiso (
    rol_id UUID NOT NULL REFERENCES sigd_org.rol_sistema(rol_id) ON DELETE CASCADE,
    permiso_id UUID NOT NULL REFERENCES sigd_org.permiso_sistema(permiso_id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE IF NOT EXISTS sigd_org.asignacion_personal (
    asignacion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_id UUID NOT NULL, -- FK to sigd_auth.cuenta_usuario (to be added in integration)
    area_id UUID NOT NULL REFERENCES sigd_org.area(area_id),
    cargo_id UUID NOT NULL REFERENCES sigd_org.cargo(cargo_id),
    es_titular BOOLEAN NOT NULL DEFAULT TRUE,
    vigencia TSTZRANGE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_asignacion_vigencia_no_vacia CHECK (NOT isempty(vigencia)),
>>>>>>> origin/B_POOL
    CONSTRAINT excl_asignacion_area_vigencia
        EXCLUDE USING gist (area_id WITH =, cargo_id WITH =, vigencia WITH &&)
);

<<<<<<< HEAD
CREATE INDEX IF NOT EXISTS idx_asignacion_area_usuario ON sigd_org.asignacion_area(usuario_id);
CREATE INDEX IF NOT EXISTS idx_asignacion_area_vigencia ON sigd_org.asignacion_area USING gist(vigencia);

CREATE TABLE IF NOT EXISTS sigd_org.facultad_despacho (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(60) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    cargo_id UUID REFERENCES sigd_org.cargo(id),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sigd_org.encargatura_despacho (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID NOT NULL REFERENCES sigd_org.area(id),
    cargo_id UUID NOT NULL REFERENCES sigd_org.cargo(id),
    facultad_despacho_id UUID NOT NULL REFERENCES sigd_org.facultad_despacho(id),
    usuario_titular_id UUID NOT NULL,
    usuario_suplente_id UUID NOT NULL,
    tipo_delegacion VARCHAR(40) NOT NULL,
    resolucion_ref VARCHAR(120) NOT NULL,
    periodo_vigencia TSTZRANGE NOT NULL,
=======
CREATE INDEX IF NOT EXISTS idx_asignacion_personal_usuario ON sigd_org.asignacion_personal(cuenta_id);
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
    CONSTRAINT chk_facultad_vigencia CHECK
        (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

CREATE TABLE IF NOT EXISTS sigd_org.encargatura_despacho (
    encargatura_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID NOT NULL REFERENCES sigd_org.area(area_id),
    cargo_id UUID NOT NULL REFERENCES sigd_org.cargo(cargo_id),
    facultad_despacho_id UUID NOT NULL REFERENCES sigd_org.facultad_despacho(facultad_id),
    usuario_titular_id UUID NOT NULL, -- FK to sigd_auth.cuenta_usuario
    usuario_suplente_id UUID NOT NULL, -- FK to sigd_auth.cuenta_usuario
    tipo_delegacion VARCHAR(40) NOT NULL,
    resolucion_ref VARCHAR(120) NOT NULL,
    periodo_vigencia TSTZRANGE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
>>>>>>> origin/B_POOL
    CONSTRAINT chk_encargatura_usuarios_distintos
        CHECK (usuario_titular_id <> usuario_suplente_id),
    CONSTRAINT chk_encargatura_periodo_no_vacio
        CHECK (NOT isempty(periodo_vigencia)),
    CONSTRAINT excl_encargatura_despacho_vigencia
        EXCLUDE USING gist (area_id WITH =, cargo_id WITH =, periodo_vigencia WITH &&)
);

CREATE INDEX IF NOT EXISTS idx_encargatura_despacho_vigencia
    ON sigd_org.encargatura_despacho USING gist(periodo_vigencia);

<<<<<<< HEAD
COMMIT;
=======
-- Función para evaluar si un usuario tiene facultad de despacho en un área y cargo en un momento dado
CREATE OR REPLACE FUNCTION sigd_org.funcionario_tiene_facultad_despacho(
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
           AND a.vigencia @> p_momento::date
           AND CURRENT_DATE >= f.vigente_desde
           AND (f.vigente_hasta IS NULL OR CURRENT_DATE <= f.vigente_hasta)
    );
$$;

COMMENT ON COLUMN sigd_org.area.path IS
    'Materialized path con segmentos UUID y separador final; consultar con LIKE path || %';
COMMENT ON TABLE sigd_org.encargatura_despacho IS
    'Delegaciones temporales; la vigencia se evalúa con periodo_vigencia @> timestamptz';
COMMENT ON TABLE sigd_org.asignacion_personal IS
    'Asignación de usuarios a áreas y cargos con vigencia temporal';
COMMENT ON TABLE sigd_org.facultad_despacho IS
    'Facultad legal de despacho asociada a un cargo';
>>>>>>> origin/B_POOL
