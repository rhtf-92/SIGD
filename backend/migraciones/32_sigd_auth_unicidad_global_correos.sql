-- 32_sigd_auth_unicidad_global_correos.sql
-- Implementación de unicidad global de correos (principal + adicional)

-- 1. Crear tabla central de identidades
CREATE TABLE IF NOT EXISTS sigd_auth.identidades_correo (
    correo_normalizado VARCHAR(160) PRIMARY KEY,
    id_usuario UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE
);

-- 2. Migrar datos existentes (normalizando)
INSERT INTO sigd_auth.identidades_correo (correo_normalizado, id_usuario)
SELECT LOWER(TRIM(correo)), id_usuario 
FROM sigd_auth.cuenta_usuario 
WHERE correo IS NOT NULL
ON CONFLICT (correo_normalizado) DO NOTHING;

INSERT INTO sigd_auth.identidades_correo (correo_normalizado, id_usuario)
SELECT LOWER(TRIM(correo)), id_usuario 
FROM sigd_auth.correos_adicionales
ON CONFLICT (correo_normalizado) DO NOTHING;

-- 3. Triggers para mantener integridad
CREATE OR REPLACE FUNCTION sigd_auth.fn_sync_identidades_correo()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO sigd_auth.identidades_correo (correo_normalizado, id_usuario)
        VALUES (LOWER(TRIM(NEW.correo)), NEW.id_usuario);
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (NEW.correo <> OLD.correo) THEN
            DELETE FROM sigd_auth.identidades_correo WHERE correo_normalizado = LOWER(TRIM(OLD.correo));
            INSERT INTO sigd_auth.identidades_correo (correo_normalizado, id_usuario)
            VALUES (LOWER(TRIM(NEW.correo)), NEW.id_usuario);
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM sigd_auth.identidades_correo WHERE correo_normalizado = LOWER(TRIM(OLD.correo));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_cuenta_usuario_correo
AFTER INSERT OR UPDATE OF correo ON sigd_auth.cuenta_usuario
FOR EACH ROW WHEN (NEW.correo IS NOT NULL)
EXECUTE FUNCTION sigd_auth.fn_sync_identidades_correo();

CREATE TRIGGER trg_sync_correos_adicionales
AFTER INSERT OR UPDATE OR DELETE ON sigd_auth.correos_adicionales
FOR EACH ROW
EXECUTE FUNCTION sigd_auth.fn_sync_identidades_correo();

-- 4. Registrar migración
INSERT INTO public.sigd_migraciones (nombre_script, checksum_sha256)
VALUES (
    '32_sigd_auth_unicidad_global_correos.sql',
    'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2'
) ON CONFLICT (nombre_script) DO NOTHING;
