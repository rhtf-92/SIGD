-- =============================================================================
-- Migración 23 · Esquema sigd_audit: Auditoría Documental y Descargas Excepcionales
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Rama oficial: B_JACOBO | Base de datos: sigd_jacobo_demo (PostgreSQL 18.6)
-- Marco normativo: WORM (TUO Ley 27444), Modelo de Gestión Documental (MGD-PCM)
-- Depende de: 01_sigd_audit.sql, 02_sigd_auth.sql, 04_sigd_doc.sql, 22_sigd_org...
-- Contenido: bitácora forense de descargas excepcionales e inmutabilidad estricta
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabla forense inmutable de descargas excepcionales (WORM)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_audit.descarga_excepcional_log (
    id_descarga               UUID         NOT NULL DEFAULT gen_random_uuid()
                                           CONSTRAINT pk_descarga_excepcional_log PRIMARY KEY,
    correlation_id            UUID         NOT NULL,
    usuario_id                UUID         NOT NULL
                                           REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    institucion_id            UUID         NOT NULL,
    documento_id              UUID         NOT NULL,
    expediente_id             UUID         NULL,
    tipo_documento            VARCHAR(60)  NOT NULL,
    motivo_excepcional        TEXT         NOT NULL
                                           CONSTRAINT chk_descarga_motivo_len CHECK (length(trim(motivo_excepcional)) >= 15),
    ip_origen                 INET         NULL,
    user_agent                VARCHAR(512) NULL,
    hash_documento_descargado VARCHAR(64)  NOT NULL,
    resultado                 VARCHAR(20)  NOT NULL DEFAULT 'EXITOSO'
                                           CONSTRAINT chk_descarga_resultado CHECK (resultado IN ('EXITOSO', 'DENEGADO', 'FALLO_INTEGRIDAD')),
    fecha_descarga            TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_descarga_fecha CHECK (fecha_descarga IS NOT NULL)
) WITH (fillfactor = 100);

-- Índices de auditoría y trazabilidad
CREATE INDEX IF NOT EXISTS idx_descarga_excepcional_usuario 
    ON sigd_audit.descarga_excepcional_log (usuario_id, fecha_descarga DESC);

CREATE INDEX IF NOT EXISTS idx_descarga_excepcional_doc 
    ON sigd_audit.descarga_excepcional_log (documento_id, fecha_descarga DESC);

CREATE INDEX IF NOT EXISTS idx_descarga_excepcional_inst 
    ON sigd_audit.descarga_excepcional_log (institucion_id, fecha_descarga DESC);

CREATE INDEX IF NOT EXISTS idx_descarga_excepcional_corr 
    ON sigd_audit.descarga_excepcional_log (correlation_id);

-- -----------------------------------------------------------------------------
-- 2. Disparadores de Protección WORM (Bloqueo de UPDATE, DELETE, TRUNCATE)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_audit.fn_proteger_descarga_excepcional_log_worm()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'WORM_INTEGRITY_VIOLATION: La bitácora sigd_audit.descarga_excepcional_log es inmutable (operación % prohibida)', TG_OP
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS tr_proteger_descarga_excepcional_log_worm ON sigd_audit.descarga_excepcional_log;
CREATE TRIGGER tr_proteger_descarga_excepcional_log_worm
    BEFORE UPDATE OR DELETE ON sigd_audit.descarga_excepcional_log
    FOR EACH STATEMENT
    EXECUTE FUNCTION sigd_audit.fn_proteger_descarga_excepcional_log_worm();

DROP TRIGGER IF EXISTS tr_proteger_descarga_excepcional_log_worm_trunc ON sigd_audit.descarga_excepcional_log;
CREATE TRIGGER tr_proteger_descarga_excepcional_log_worm_trunc
    BEFORE TRUNCATE ON sigd_audit.descarga_excepcional_log
    FOR EACH STATEMENT
    EXECUTE FUNCTION sigd_audit.fn_proteger_descarga_excepcional_log_worm();

-- -----------------------------------------------------------------------------
-- 3. Privilegios de Seguridad y Principio de Mínimo Privilegio
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT ON sigd_audit.descarga_excepcional_log TO sigd_app;
REVOKE UPDATE, DELETE, TRUNCATE ON sigd_audit.descarga_excepcional_log FROM PUBLIC, sigd_app;
