-- =============================================================================
-- Migración 01 · Esquema sigd_audit
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Ricardo Arévalo Villacorta (B_AREVALO) · Grupo 6 CoreLink
-- Marco     : WORM (TUO Ley 27444), MGD-PCM (R.S. 001-2017-PCM/SEGDI)
-- Depende de: ninguna
-- Contenido : bitacora_auditoria (append-only) y evento_outbox (Outbox)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS sigd_audit;

-- -----------------------------------------------------------------------------
-- 1.1 bitacora_auditoria — bitácora forense inmutable (WORM)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_audit.bitacora_auditoria (
    id_auditoria   UUID          NOT NULL DEFAULT gen_random_uuid()
                                  CONSTRAINT pk_bitacora_auditoria PRIMARY KEY,
    correlation_id UUID          NOT NULL,
    usuario_id     UUID          NULL,
    ip_origen      INET          NULL,
    user_agent     VARCHAR(512)  NULL,
    esquema        VARCHAR(64)   NOT NULL,
    tabla          VARCHAR(64)   NOT NULL,
    operacion      VARCHAR(16)   NOT NULL
                                  CONSTRAINT chk_bitacora_operacion
                                  CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    datos_antes    JSONB         NULL,
    datos_despues  JSONB         NOT NULL,
    fecha_hora     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_bitacora_fecha_horaria CHECK (fecha_hora IS NOT NULL)
) WITH (fillfactor = 100);

COMMENT ON TABLE  sigd_audit.bitacora_auditoria IS
    'Bitácora forense inmutable (append-only). Solo INSERT y SELECT para la cuenta de aplicación.';
COMMENT ON COLUMN sigd_audit.bitacora_auditoria.correlation_id IS
    'UUIDv4 de la solicitud. SIN valor por defecto: debe propagarse SIEMPRE desde el contexto AsyncLocalStorage; la BD no genera un UUID distinto.';
COMMENT ON COLUMN sigd_audit.bitacora_auditoria.datos_antes IS
    'Estado previo de la fila (NULL para INSERT).';
COMMENT ON COLUMN sigd_audit.bitacora_auditoria.datos_despues IS
    'Estado posterior de la fila (para DELETE puede ser el estado previo a la eliminación).';

-- -----------------------------------------------------------------------------
-- 1.2 evento_outbox — Transactional Outbox
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_audit.evento_outbox (
    id_evento      UUID          NOT NULL DEFAULT gen_random_uuid()
                                  CONSTRAINT pk_evento_outbox PRIMARY KEY,
    correlation_id UUID          NOT NULL,
    agregado       VARCHAR(64)   NOT NULL,
    tipo_evento    VARCHAR(64)   NOT NULL,
    payload        JSONB         NOT NULL,
    estado         VARCHAR(16)   NOT NULL DEFAULT 'PENDIENTE'
                                  CONSTRAINT chk_outbox_estado
                                  CHECK (estado IN ('PENDIENTE', 'PROCESADO', 'FALLIDO')),
    intentos       SMALLINT      NOT NULL DEFAULT 0
                                  CONSTRAINT chk_outbox_intentos CHECK (intentos >= 0),
    creado_en      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    procesado_en   TIMESTAMPTZ   NULL,
    CONSTRAINT chk_outbox_procesado_en CHECK (estado = 'PENDIENTE' OR procesado_en IS NOT NULL OR estado = 'FALLIDO')
);

COMMENT ON TABLE  sigd_audit.evento_outbox IS
    'Transactional Outbox: eventos persistidos atómicamente con la mutación de negocio y despachados por el worker.';
COMMENT ON COLUMN sigd_audit.evento_outbox.estado IS
    'PENDIENTE -> PROCESADO (éxito) o FALLIDO (dead-letter tras agotar reintentos). Solo el worker modifica este campo.';

-- -----------------------------------------------------------------------------
-- 1.3 Índices
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bitacora_correlation_id
    ON sigd_audit.bitacora_auditoria (correlation_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_usuario
    ON sigd_audit.bitacora_auditoria (usuario_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_fecha
    ON sigd_audit.bitacora_auditoria (fecha_hora);
CREATE INDEX IF NOT EXISTS idx_bitacora_tabla
    ON sigd_audit.bitacora_auditoria (esquema, tabla);
CREATE INDEX IF NOT EXISTS idx_bitacora_jsonb
    ON sigd_audit.bitacora_auditoria USING GIN (datos_despues);
CREATE INDEX IF NOT EXISTS idx_outbox_estado_fecha
    ON sigd_audit.evento_outbox (estado, creado_en);

-- -----------------------------------------------------------------------------
-- 1.4 Inmutabilidad WORM: SQLSTATE 23001 ante UPDATE/DELETE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_audit.fn_rechazar_mutacion_bitacora()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'sigd_audit.bitacora_auditoria es inmutable (WORM): % rechazado', TG_OP
        USING ERRCODE = '23001',
              HINT = 'Registre un nuevo hecho administrativo en lugar de alterar el previo.';
END;
$$;

DROP TRIGGER IF EXISTS tr_bitacora_append_only ON sigd_audit.bitacora_auditoria;
CREATE TRIGGER tr_bitacora_append_only
    BEFORE UPDATE OR DELETE ON sigd_audit.bitacora_auditoria
    FOR EACH ROW EXECUTE FUNCTION sigd_audit.fn_rechazar_mutacion_bitacora();

-- -----------------------------------------------------------------------------
-- 1.5 Separación de privilegios: sigd_app vs sigd_worker
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_app') THEN
        CREATE ROLE sigd_app;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_worker') THEN
        CREATE ROLE sigd_worker;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA sigd_audit TO sigd_app;
GRANT SELECT, INSERT ON sigd_audit.bitacora_auditoria TO sigd_app;
GRANT SELECT, INSERT ON sigd_audit.evento_outbox TO sigd_app;

GRANT USAGE ON SCHEMA sigd_audit TO sigd_worker;
GRANT SELECT, UPDATE ON sigd_audit.evento_outbox TO sigd_worker;

REVOKE UPDATE, DELETE ON sigd_audit.bitacora_auditoria FROM sigd_app;
REVOKE UPDATE, DELETE ON sigd_audit.bitacora_auditoria FROM sigd_worker;
REVOKE DELETE ON sigd_audit.evento_outbox FROM sigd_worker;
