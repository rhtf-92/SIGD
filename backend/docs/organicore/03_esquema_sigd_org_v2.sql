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
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    parent_path VARCHAR(255);
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
    END IF;

    RETURN NEW;
END;
$$;

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
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sigd_org.permiso_sistema (
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
    CONSTRAINT excl_asignacion_area_vigencia
        EXCLUDE USING gist (area_id WITH =, cargo_id WITH =, vigencia WITH &&)
);

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
    CONSTRAINT chk_encargatura_usuarios_distintos
        CHECK (usuario_titular_id <> usuario_suplente_id),
    CONSTRAINT chk_encargatura_periodo_no_vacio
        CHECK (NOT isempty(periodo_vigencia)),
    CONSTRAINT excl_encargatura_despacho_vigencia
        EXCLUDE USING gist (area_id WITH =, cargo_id WITH =, periodo_vigencia WITH &&)
);

CREATE INDEX IF NOT EXISTS idx_encargatura_despacho_vigencia
    ON sigd_org.encargatura_despacho USING gist(periodo_vigencia);

COMMIT;
