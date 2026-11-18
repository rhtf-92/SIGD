-- Fixtures mínimos de la suite E2E (entregable 03).
-- Garantizan la reproducibilidad del entorno sin depender de que los DDL de los
-- grupos 1 al 5 estén presentes. Si ya existen (migraciones reales), CREATE IF NOT
-- EXISTS los respeta. Las tablas de `sigd_audit` provienen del entregable DDL 06.

CREATE EXTENSION IF NOT EXISTS ltree;
CREATE SCHEMA IF NOT EXISTS sigd_auth;

CREATE TABLE IF NOT EXISTS sigd_auth.cuenta_usuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS sigd_auth.persona (
    id_persona UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo VARCHAR(20) NOT NULL,
    id_documento VARCHAR(20) NOT NULL UNIQUE
);

CREATE SCHEMA IF NOT EXISTS sigd_org;

CREATE TABLE IF NOT EXISTS sigd_org.area (
    area_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo  TEXT NOT NULL UNIQUE,
    nombre  TEXT NOT NULL,
    path    LTREE NOT NULL,
    vigente BOOLEAN NOT NULL DEFAULT true
);

CREATE SCHEMA IF NOT EXISTS sigd_tra;

CREATE TABLE IF NOT EXISTS sigd_tra.expediente (
    expediente_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero             TEXT NOT NULL UNIQUE,
    dni_solicitante    CHAR(8),
    tipo_documental_id UUID NOT NULL,
    solicitante_id     UUID NOT NULL,
    area_destino_id    UUID NOT NULL,
    fecha_radicacion   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SCHEMA IF NOT EXISTS sigd_rut;

CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_tramite (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id   UUID NOT NULL REFERENCES sigd_tra.expediente (expediente_id),
    area_destino_id UUID NOT NULL,
    fecha_movimiento TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
VALUES ('00000000-0000-4000-8000-000000000001', 'NATURAL', '00000001')
ON CONFLICT (id_persona) DO NOTHING;

INSERT INTO sigd_org.area (area_id, codigo, nombre, path)
VALUES ('00000000-0000-4000-8000-000000000002', 'E2EBASE', 'Área base E2E', 'a.E2EBASE')
ON CONFLICT (area_id) DO NOTHING;