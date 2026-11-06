-- =============================================================================
-- Migración 09 · Perfil activo por sesión
-- Depende de: 02_sigd_auth.sql y 03_sigd_org.sql
-- =============================================================================

ALTER TABLE sigd_auth.sesion_usuario
    ADD COLUMN IF NOT EXISTS rol_activo_id UUID NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'fk_sesion_usuario_rol_activo'
           AND conrelid = 'sigd_auth.sesion_usuario'::regclass
    ) THEN
        ALTER TABLE sigd_auth.sesion_usuario
            ADD CONSTRAINT fk_sesion_usuario_rol_activo
            FOREIGN KEY (rol_activo_id)
            REFERENCES sigd_org.rol_sistema (rol_id)
            ON DELETE RESTRICT;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_sesion_usuario_rol_activo
    ON sigd_auth.sesion_usuario (id_usuario, rol_activo_id)
    WHERE revocado_en IS NULL;

COMMENT ON COLUMN sigd_auth.sesion_usuario.rol_activo_id IS
    'Único perfil RBAC autorizado por el JWT de acceso asociado a esta sesión.';
