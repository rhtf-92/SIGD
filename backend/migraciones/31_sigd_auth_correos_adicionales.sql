-- 31_sigd_auth_correos_adicionales.sql
-- Migración para registrar la tabla de correos adicionales

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sigd_auth' AND table_name = 'correos_adicionales') THEN
        CREATE TABLE sigd_auth.correos_adicionales (
            id_correo_adicional UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            id_usuario UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE,
            correo VARCHAR(160) NOT NULL,
            verificado BOOLEAN NOT NULL DEFAULT FALSE,
            creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            fecha_verificacion TIMESTAMP WITH TIME ZONE,
            token_hash VARCHAR(255),
            token_expiracion TIMESTAMP WITH TIME ZONE,
            CONSTRAINT uq_correos_adicionales_correo UNIQUE (correo)
        );
        CREATE INDEX idx_correos_adicionales_usuario ON sigd_auth.correos_adicionales(id_usuario);
    END IF;
END $$;

INSERT INTO public.sigd_migraciones (nombre_script, checksum_sha256)
VALUES (
    '31_sigd_auth_correos_adicionales.sql',
    '8e7a6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e'
) ON CONFLICT (nombre_script) DO NOTHING;
