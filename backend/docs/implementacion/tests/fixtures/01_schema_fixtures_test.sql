-- Fixtures PROVISIONALES de la suite E2E (entregable 03).
-- Cubren SOLO los 5 esquemas de módulos que el prototipo ejercita mediante stubs:
--   sigd_auth, sigd_org, sigd_tra, sigd_rut y docucore.
-- El esquema sigd_audit NO se crea aquí: proviene EXCLUSIVAMENTE del DDL real
-- integracion/06_sigd_audit_esquema_ddl.sql (el global-setup falla si no lo carga).
--
-- IMPORTANTE (separación fixtures vs migraciones reales):
--   - Estos stubs NO representan las migraciones oficiales de cada grupo.
--   - Las migraciones reales viven en identicore/, organicore/, tramicore/,
--     rutadoc/ y docucore/ y son PROPIEDAD de sus ramas (B_SEGUNDO, B_PANAIFO,
--     B_RAMIREZ, B_JHASY, B_CHRISTIAN). El prototipo NO las carga.
--   - Los identificadores usan la convención id_<agregado> (D-15, CONFIRMADO):
--     id_usuario, id_area, id_expediente, id_movimiento, id_tipo_documental,
--     id_solicitante, id_area_destino.

-- =============================================================================
-- 1. sigd_auth (IdentiCore — Grupo 4)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS sigd_auth;

CREATE TABLE IF NOT EXISTS sigd_auth.cuenta_usuario (
    id_usuario UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- =============================================================================
-- 2. sigd_org (OrganiCore — Grupo 3)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS sigd_org;

CREATE TABLE IF NOT EXISTS sigd_org.area (
    id_area UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre  TEXT NOT NULL,
    vigente BOOLEAN NOT NULL DEFAULT true
);

-- =============================================================================
-- 3. sigd_tra (TramiCore — Grupo 2)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS sigd_tra;

CREATE TABLE IF NOT EXISTS sigd_tra.expediente (
    id_expediente       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero              TEXT NOT NULL UNIQUE,
    dni_solicitante     CHAR(8),
    id_tipo_documental  UUID NOT NULL,
    id_solicitante      UUID NOT NULL,
    id_area_destino     UUID NOT NULL,
    fecha_radicacion    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4. sigd_rut (RutaDoc — Grupo 1)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS sigd_rut;

CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_tramite (
    id_movimiento   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_expediente   UUID NOT NULL REFERENCES sigd_tra.expediente (id_expediente),
    id_area_destino UUID NOT NULL,
    fecha_movimiento TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 5. docucore (DocuCore — Grupo 5)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS docucore;

CREATE TABLE IF NOT EXISTS docucore.tipo_documento (
    id_tipo_documento  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo             VARCHAR(30) NOT NULL UNIQUE,
    nombre             VARCHAR(150) NOT NULL,
    activo             BOOLEAN NOT NULL DEFAULT TRUE,
    id_usuario_creador BIGINT NOT NULL,
    fecha_creacion     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS docucore.formulario (
    id_formulario     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_tipo_documento BIGINT NOT NULL REFERENCES docucore.tipo_documento(id_tipo_documento),
    version           SMALLINT NOT NULL DEFAULT 1,
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT now()
);