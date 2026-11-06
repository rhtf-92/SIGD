-- =============================================================================
-- Migración 14 · Tokens de recuperación de contraseña (sigd_auth)
-- SIGD — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Almacena tokens de un solo uso y corto plazo para restablecimiento de
-- contraseña, vinculados a una cuenta de usuario existente.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS sigd_auth;

CREATE TABLE IF NOT EXISTS sigd_auth.token_recuperacion (
    id_token        UUID        NOT NULL DEFAULT gen_random_uuid()
                                 CONSTRAINT pk_token_recuperacion PRIMARY KEY,
    id_usuario      UUID        NOT NULL
                                 REFERENCES sigd_auth.cuenta_usuario (id_usuario)
                                 ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    correo          VARCHAR(160) NOT NULL,
    expira_en       TIMESTAMPTZ NOT NULL,
    usado_en        TIMESTAMPTZ NULL,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_token_recuperacion_vigencia CHECK (expira_en > creado_en)
);

CREATE INDEX IF NOT EXISTS idx_token_recuperacion_usuario
    ON sigd_auth.token_recuperacion (id_usuario);
CREATE INDEX IF NOT EXISTS idx_token_recuperacion_expira
    ON sigd_auth.token_recuperacion (expira_en);

-- Limpieza de tokens expirados (idempotente)
DO $$ BEGIN
  DELETE FROM sigd_auth.token_recuperacion
   WHERE expira_en < now() OR usado_en IS NOT NULL;
END $$;
