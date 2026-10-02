/*
 * OrganiCore v2 - Catálogo de Sedes y Puestos Laborales
 * Responsable: Leonardo
 * Grupo: Grupo 3 — OrganiCore
 * Rama: B_LEONARDO
 * Tarea: T-BE-OC-05
 *
 * Objetivo:
 * Normalizar las sedes físicas y los puestos laborales institucionales,
 * evitando valores libres o duplicados como "Sede Central", "CENTRAL"
 * o "Sede Pucallpa".
 *
 * Este script complementa:
 * backend/docs/02_organicore/03_esquema_sigd_org_v2.sql
 */

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS sigd_org;

-- =========================================================
-- 1. CATÁLOGO DE SEDES INSTITUCIONALES
-- =========================================================

CREATE TABLE IF NOT EXISTS sigd_org.sede (
    sede_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    codigo VARCHAR(30) NOT NULL UNIQUE,

    nombre VARCHAR(150) NOT NULL,

    direccion VARCHAR(250),

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_sede_codigo_no_vacio
        CHECK (btrim(codigo) <> ''),

    CONSTRAINT ck_sede_nombre_no_vacio
        CHECK (btrim(nombre) <> '')
);

CREATE INDEX IF NOT EXISTS idx_sede_activo
    ON sigd_org.sede(activo);

CREATE INDEX IF NOT EXISTS idx_sede_nombre
    ON sigd_org.sede(nombre);


-- =========================================================
-- 2. CATÁLOGO DE PUESTOS LABORALES
-- =========================================================

CREATE TABLE IF NOT EXISTS sigd_org.puesto_laboral (
    puesto_laboral_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    codigo VARCHAR(50) NOT NULL UNIQUE,

    nombre VARCHAR(150) NOT NULL,

    sede_id UUID NOT NULL,

    id_area UUID NOT NULL,

    cargo_id UUID NOT NULL,

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_puesto_laboral_sede
        FOREIGN KEY (sede_id)
        REFERENCES sigd_org.sede(sede_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_puesto_laboral_area
        FOREIGN KEY (id_area)
        REFERENCES sigd_org.area(id_area)
        ON DELETE RESTRICT,

    CONSTRAINT fk_puesto_laboral_cargo
        FOREIGN KEY (cargo_id)
        REFERENCES sigd_org.cargo(cargo_id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_puesto_laboral_codigo_no_vacio
        CHECK (btrim(codigo) <> ''),

    CONSTRAINT ck_puesto_laboral_nombre_no_vacio
        CHECK (btrim(nombre) <> '')
);

CREATE INDEX IF NOT EXISTS idx_puesto_laboral_sede
    ON sigd_org.puesto_laboral(sede_id);

CREATE INDEX IF NOT EXISTS idx_puesto_laboral_area
    ON sigd_org.puesto_laboral(id_area);

CREATE INDEX IF NOT EXISTS idx_puesto_laboral_cargo
    ON sigd_org.puesto_laboral(cargo_id);

CREATE INDEX IF NOT EXISTS idx_puesto_laboral_activo
    ON sigd_org.puesto_laboral(activo);


-- =========================================================
-- 3. VINCULACIÓN CON ASIGNACION_PERSONAL
-- =========================================================

ALTER TABLE sigd_org.asignacion_personal
ADD COLUMN IF NOT EXISTS puesto_laboral_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_asignacion_puesto_laboral'
          AND conrelid = 'sigd_org.asignacion_personal'::regclass
    ) THEN
        ALTER TABLE sigd_org.asignacion_personal
        ADD CONSTRAINT fk_asignacion_puesto_laboral
        FOREIGN KEY (puesto_laboral_id)
        REFERENCES sigd_org.puesto_laboral(puesto_laboral_id)
        ON DELETE RESTRICT;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_asignacion_personal_puesto
    ON sigd_org.asignacion_personal(puesto_laboral_id);


-- =========================================================
-- 4. ACTUALIZACIÓN AUTOMÁTICA DE TIMESTAMP
-- =========================================================

CREATE OR REPLACE FUNCTION sigd_org.fn_actualizar_timestamp_catalogo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_sede_actualizado_en
ON sigd_org.sede;

CREATE TRIGGER trg_sede_actualizado_en
BEFORE UPDATE
ON sigd_org.sede
FOR EACH ROW
EXECUTE FUNCTION sigd_org.fn_actualizar_timestamp_catalogo();


DROP TRIGGER IF EXISTS trg_puesto_laboral_actualizado_en
ON sigd_org.puesto_laboral;

CREATE TRIGGER trg_puesto_laboral_actualizado_en
BEFORE UPDATE
ON sigd_org.puesto_laboral
FOR EACH ROW
EXECUTE FUNCTION sigd_org.fn_actualizar_timestamp_catalogo();


-- =========================================================
-- 5. DATOS DE PRUEBA INSTITUCIONALES
-- =========================================================

INSERT INTO sigd_org.sede (
    codigo,
    nombre,
    direccion
)
VALUES (
    'SEDE-PRINCIPAL',
    'Sede Principal',
    'Pucallpa - Ucayali'
)
ON CONFLICT (codigo) DO NOTHING;


-- =========================================================
-- 6. COMENTARIOS DOCUMENTALES
-- =========================================================

COMMENT ON TABLE sigd_org.sede IS
    'Catálogo normalizado de sedes físicas institucionales del SIGD';

COMMENT ON COLUMN sigd_org.sede.codigo IS
    'Código único de identificación de la sede institucional';

COMMENT ON COLUMN sigd_org.sede.activo IS
    'Estado lógico de la sede; FALSE representa inactivación sin eliminación física';


COMMENT ON TABLE sigd_org.puesto_laboral IS
    'Catálogo de puestos laborales vinculados a sede, área y cargo';

COMMENT ON COLUMN sigd_org.puesto_laboral.codigo IS
    'Código único institucional del puesto laboral';

COMMENT ON COLUMN sigd_org.puesto_laboral.sede_id IS
    'Sede física donde se encuentra el puesto laboral';

COMMENT ON COLUMN sigd_org.puesto_laboral.id_area IS
    'Área organizacional a la que pertenece el puesto laboral';

COMMENT ON COLUMN sigd_org.puesto_laboral.cargo_id IS
    'Cargo funcional asociado al puesto laboral';

COMMENT ON COLUMN sigd_org.puesto_laboral.activo IS
    'Estado lógico del puesto; un puesto inactivo no debe aceptar nuevas asignaciones';


COMMENT ON COLUMN sigd_org.asignacion_personal.puesto_laboral_id IS
    'Puesto laboral institucional asignado al usuario';


-- =========================================================
-- 7. CONSULTAS DE VERIFICACIÓN
-- =========================================================

-- Verificar sedes
SELECT
    sede_id,
    codigo,
    nombre,
    direccion,
    activo
FROM sigd_org.sede
ORDER BY nombre;


-- Verificar estructura de puestos laborales
SELECT
    p.puesto_laboral_id,
    p.codigo,
    p.nombre AS puesto,
    s.nombre AS sede,
    a.nombre AS area,
    c.nombre AS cargo,
    p.activo
FROM sigd_org.puesto_laboral AS p
INNER JOIN sigd_org.sede AS s
    ON s.sede_id = p.sede_id
INNER JOIN sigd_org.area AS a
    ON a.id_area = p.id_area
INNER JOIN sigd_org.cargo AS c
    ON c.cargo_id = p.cargo_id
ORDER BY
    s.nombre,
    a.nombre,
    p.nombre;

-- 8. FULL-TEXT SEARCH DEL DIRECTORIO INSTITUCIONAL
-- Responsable: Leonardo
-- Rama: B_LEONARDO
-- Tarea: T-BE-OC-06
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_persona_directorio_fts
ON sigd_auth.persona
USING GIN (
    to_tsvector(
        'spanish',
        COALESCE(nombres, '') || ' ' ||
        COALESCE(apellido_paterno, '') || ' ' ||
        COALESCE(apellido_materno, '') || ' ' ||
        COALESCE(numero_documento, '')
    )
);

COMMENT ON INDEX sigd_auth.idx_persona_directorio_fts IS
    'Índice GIN para búsqueda Full-Text Search del directorio institucional por nombres, apellidos y documento';