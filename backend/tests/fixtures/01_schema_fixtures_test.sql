-- Fixtures mínimos de la suite E2E (entregable 03).
-- Garantizan la reproducibilidad del entorno sin depender de que los DDL de los
-- grupos 1 al 5 estén presentes. Si ya existen (migraciones reales), CREATE IF NOT
-- EXISTS los respeta. Las tablas de `sigd_audit` provienen del entregable DDL 06.

CREATE SCHEMA IF NOT EXISTS sigd_auth;

CREATE TABLE IF NOT EXISTS sigd_auth.cuenta_usuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE SCHEMA IF NOT EXISTS sigd_org;

CREATE TABLE IF NOT EXISTS sigd_org.area (
    area_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre  TEXT NOT NULL,
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