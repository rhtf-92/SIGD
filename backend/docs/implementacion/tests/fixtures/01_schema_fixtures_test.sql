-- Fixtures de la suite E2E (entregable 03).
-- Cubre los 6 esquemas del SIGD para garantizar reproducibilidad.
-- Estos fixtures son PROVISIONALES: los contratos externos aún no están aprobados.
-- Si ya existen tablas reales (migraciones), CREATE IF NOT EXISTS las respeta.

-- =============================================================================
-- 1. sigd_auth (IdentiCore — Grupo 4)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS sigd_auth;

CREATE TABLE IF NOT EXISTS sigd_auth.cuenta_usuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- =============================================================================
-- 2. sigd_org (OrganiCore — Grupo 3)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS sigd_org;

CREATE TABLE IF NOT EXISTS sigd_org.area (
    area_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre  TEXT NOT NULL,
    vigente BOOLEAN NOT NULL DEFAULT true
);

-- =============================================================================
-- 3. sigd_tra (TramiCore — Grupo 2)
-- =============================================================================
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

-- =============================================================================
-- 4. sigd_rut (RutaDoc — Grupo 1)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS sigd_rut;

CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_tramite (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id   UUID NOT NULL REFERENCES sigd_tra.expediente (expediente_id),
    area_destino_id UUID NOT NULL,
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

-- =============================================================================
-- 6. sigd_audit (Integración — Grupo 6)
--    El DDL completo viene de integracion/06_sigd_audit_esquema_ddl.sql.
--    Este stub crea las tablas mínimas para que los tests E2E funcionen
--    si el DDL completo no se carga.
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS sigd_audit;

CREATE TABLE IF NOT EXISTS sigd_audit.bitacora_auditoria (
    id_auditoria   UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    correlation_id UUID NOT NULL,
    usuario_id     UUID NULL,
    ip_origen      INET NULL,
    user_agent     VARCHAR(512) NULL,
    esquema        VARCHAR(64) NOT NULL,
    tabla          VARCHAR(64) NOT NULL,
    operacion      VARCHAR(16) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    datos_antes    JSONB NULL,
    datos_despues  JSONB NOT NULL,
    fecha_hora     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sigd_audit.evento_outbox (
    id_evento      UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    correlation_id UUID NOT NULL,
    agregado       VARCHAR(64) NOT NULL,
    tipo_evento    VARCHAR(64) NOT NULL,
    payload        JSONB NOT NULL,
    estado         VARCHAR(16) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EN_PROCESO', 'PROCESADO', 'FALLIDO')),
    intentos       SMALLINT NOT NULL DEFAULT 0 CHECK (intentos >= 0),
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    procesado_en   TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_estado_fecha
    ON sigd_audit.evento_outbox (estado, creado_en);
