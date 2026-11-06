-- Estado de seguridad de cuentas agregado de forma incremental.
-- No se alteran los scripts históricos ya aplicados en otros entornos.
ALTER TABLE sigd_auth.cuenta_usuario
    ADD COLUMN IF NOT EXISTS intentos_fallidos SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_cuenta_usuario_intentos_fallidos'
          AND conrelid = 'sigd_auth.cuenta_usuario'::regclass
    ) THEN
        ALTER TABLE sigd_auth.cuenta_usuario
            ADD CONSTRAINT chk_cuenta_usuario_intentos_fallidos
            CHECK (intentos_fallidos >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cuenta_usuario_bloqueado_hasta
    ON sigd_auth.cuenta_usuario (bloqueado_hasta)
    WHERE bloqueado_hasta IS NOT NULL;
