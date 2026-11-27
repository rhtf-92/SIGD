ALTER TABLE sigd_auth.cuenta_usuario
    ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE;
