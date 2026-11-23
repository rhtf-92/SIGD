-- 33_sigd_auth_preferencia_correo.sql
-- Migración para añadir preferencia de correo electrónico y asegurar unicidad

-- 1. Añadir columna preferido
ALTER TABLE sigd_auth.correos_adicionales ADD COLUMN IF NOT EXISTS preferido BOOLEAN DEFAULT FALSE;

-- 2. Índice parcial para asegurar solo un correo preferido por usuario
CREATE UNIQUE INDEX IF NOT EXISTS uq_correos_adicionales_preferido_por_usuario 
ON sigd_auth.correos_adicionales (id_usuario) 
WHERE preferido = TRUE;

-- 3. Registrar migración
INSERT INTO public.sigd_migraciones (nombre_script, checksum_sha256)
VALUES (
    '33_sigd_auth_preferencia_correo.sql',
    'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2a3'
) ON CONFLICT (nombre_script) DO NOTHING;
