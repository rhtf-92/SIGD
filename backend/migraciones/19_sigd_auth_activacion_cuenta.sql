-- =============================================================================
-- Migración 19 · Activación de Cuentas Ciudadanas y Tokens de Verificación
-- Esquema: sigd_auth
-- Rama: B_JACOBO
-- =============================================================================
-- Justificación institucional:
-- Implementación del flujo de verificación de correo electrónico y activación
-- de cuentas de usuarios externos (Ley N° 27444 y Ley N° 29733).
-- Almacena hashes criptográficos SHA-256 de tokens con fecha de expiración y un
-- único uso garantizado a nivel de base de datos.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sigd_auth.token_verificacion_correo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE,
    correo VARCHAR(160) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    tipo VARCHAR(30) NOT NULL DEFAULT 'ACTIVACION_CUENTA',
    expira_en TIMESTAMPTZ NOT NULL,
    usado_en TIMESTAMPTZ NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_token_tipo CHECK (tipo IN ('ACTIVACION_CUENTA', 'RECUPERACION_PASSWORD', 'VERIFICACION_CONTACTO'))
);

CREATE INDEX IF NOT EXISTS idx_token_verif_usuario
    ON sigd_auth.token_verificacion_correo(id_usuario);

CREATE INDEX IF NOT EXISTS idx_token_verif_hash
    ON sigd_auth.token_verificacion_correo(token_hash);

CREATE INDEX IF NOT EXISTS idx_token_verif_expira
    ON sigd_auth.token_verificacion_correo(expira_en);
