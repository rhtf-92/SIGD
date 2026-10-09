-- =============================================================================
-- Migración 08 · Seed MVP: Administrador del Sistema y catálogos base
-- =============================================================================
-- Objetivo      : habilitar el login real (POST /api/v1/auth/login) tras el
--                 pipeline DDL, en un entorno limpio. Crea el usuario
--                 'admin' con rol ADMINISTRADOR y un área raíz.
-- Credenciales  : usuario admin / contraseña Admin2026
-- Hash          : formato $argon2id$v=19$m=65536,t=3,p=4$<salt>$<scrypt>
--                 (fallback documentado de Argon2Service; verifica con
--                 Argon2Service.verify vía verifyFallback y cumple el CHECK
--                 chk_cuenta_usuario_algoritmo de la migración 02).
-- Idempotente   : usa IDs UUID fijos y ON CONFLICT / guardas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 8.1 Persona natural (tipo NATURAL, id_documento placeholder institucional)
-- -----------------------------------------------------------------------------
INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
VALUES ('00000000-0000-0000-0000-000000000001', 'NATURAL', '00000000')
ON CONFLICT (tipo, id_documento) DO NOTHING;

INSERT INTO sigd_auth.persona_natural (
    id_persona, nombres, apellidos, nombre_completo, correo
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Administrador',
    'SIGD',
    'Administrador del Sistema SIGD',
    'admin@iestp-suiza.edu.pe'
)
ON CONFLICT (id_persona) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8.2 Cuenta de administrador
-- -----------------------------------------------------------------------------
INSERT INTO sigd_auth.cuenta_usuario (
    id_usuario, id_persona, usuario, correo, password_hash
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin',
    'admin@iestp-suiza.edu.pe',
    '$argon2id$v=19$m=65536,t=3,p=4$eb61bfc077deb7628711e2968838a351$d36240363331fc658d6da9d7bb2c64fd19dbaa43926f1fba51d2780e7b69453c410a6166ae31e4f9bfd0760ed7d32160135d4e54febf95c4039345be1cadd0dc'
)
ON CONFLICT (usuario) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8.3 Áreas raíz y perfil del administrador
-- -----------------------------------------------------------------------------
INSERT INTO sigd_org.area (area_id, codigo, nombre)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'DIRECCION_GENERAL', 'Dirección General'),
    ('00000000-0000-0000-0000-000000000002', 'MESA_DE_PARTES', 'Mesa de Partes')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO sigd_auth.perfil_usuario (id_usuario, area_id)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id_usuario) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8.4 Rol ADMINISTRADOR sobre la cuenta
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM sigd_org.usuario_rol
         WHERE id_usuario  = '00000000-0000-0000-0000-000000000001'
           AND rol_id      = (SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'ADMINISTRADOR')
           AND area_id     = '00000000-0000-0000-0000-000000000001'
    ) THEN
        INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id, area_id)
        SELECT
            '00000000-0000-0000-0000-000000000001',
            r.rol_id,
            '00000000-0000-0000-0000-000000000001'
          FROM sigd_org.rol_sistema r
         WHERE r.codigo = 'ADMINISTRADOR';
    END IF;
END;
$$;