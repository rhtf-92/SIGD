-- =============================================================================
-- Migración 47: Incorporación Aditiva de SUPERADMINISTRADOR y Gobierno Técnico
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor : Geric (B_GERIC)
-- Marco : Separación Canónica de Poderes: SUPERADMINISTRADOR ≠ ADMINISTRADOR ≠ DIRECTOR
-- Transaccional, Idempotente y Fail-Closed.
-- =============================================================================

BEGIN;

-- 1. Actualizar restricción de códigos de rol permitidos en sigd_org.rol_sistema
ALTER TABLE sigd_org.rol_sistema DROP CONSTRAINT IF EXISTS chk_rol_codigo;
ALTER TABLE sigd_org.rol_sistema ADD CONSTRAINT chk_rol_codigo CHECK (
  codigo::text = ANY (ARRAY[
    'ADMINISTRADOR'::text,
    'DIRECTOR'::text,
    'SECRETARIO'::text,
    'ESPECIALISTA'::text,
    'MESA_PARTES'::text,
    'CIUDADANO'::text,
    'TESORERIA'::text,
    'SUPERADMINISTRADOR'::text
  ])
);

-- 2. Registrar el rol canónico SUPERADMINISTRADOR (aditivo, preservando los 7 roles previos)
INSERT INTO sigd_org.rol_sistema (rol_id, codigo, nombre, descripcion, vigente)
VALUES (
  'c1111111-1111-1111-1111-111111111111'::uuid,
  'SUPERADMINISTRADOR',
  'Superadministrador del Sistema',
  'Gobierno técnico global, seguridad, roles, permisos, auditoría técnica y publicación controlada de TUPA',
  true
)
ON CONFLICT (codigo) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      descripcion = EXCLUDED.descripcion,
      vigente = true;

-- 3. Registrar permisos técnicos de gobierno en sigd_org.permiso_sistema
INSERT INTO sigd_org.permiso_sistema (permiso_id, codigo, nombre, ambito)
VALUES
  ('d1111111-1111-1111-1111-111111111101'::uuid, 'ROLES_GESTIONAR', 'Administración y gobierno de roles del sistema', 'GLOBAL'),
  ('d1111111-1111-1111-1111-111111111102'::uuid, 'PERMISOS_GESTIONAR', 'Administración y auditoría de permisos del sistema', 'GLOBAL'),
  ('d1111111-1111-1111-1111-111111111103'::uuid, 'PERFILES_GESTIONAR', 'Gestión de perfiles operativos institucionales', 'GLOBAL'),
  ('d1111111-1111-1111-1111-111111111104'::uuid, 'CONFIGURACION_GLOBAL_GESTIONAR', 'Gestión de configuración técnica global del sistema', 'GLOBAL'),
  ('d1111111-1111-1111-1111-111111111105'::uuid, 'AUDITORIA_GLOBAL_VER', 'Consulta y supervisión de bitácora de auditoría global', 'GLOBAL'),
  ('d1111111-1111-1111-1111-111111111106'::uuid, 'TUPA_PUBLICAR', 'Publicación técnica y activación de versiones TUPA', 'GLOBAL')
ON CONFLICT (codigo) DO NOTHING;

-- 4. Asignar matriz técnica a SUPERADMINISTRADOR en sigd_org.rol_permiso
-- Incluye permisos técnicos nuevos y permisos transversales necesarios (sin facultades operativas de expediente)
INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM sigd_org.rol_sistema r
CROSS JOIN sigd_org.permiso_sistema p
WHERE r.codigo = 'SUPERADMINISTRADOR'
  AND p.codigo IN (
    'ROLES_GESTIONAR',
    'PERMISOS_GESTIONAR',
    'PERFILES_GESTIONAR',
    'CONFIGURACION_GLOBAL_GESTIONAR',
    'AUDITORIA_GLOBAL_VER',
    'TUPA_PUBLICAR',
    'ADMIN_USUARIOS',
    'CUENTA_GESTIONAR',
    'ORGANIZACION_GESTIONAR',
    'REPORTE_LEER',
    'TUPA_GESTIONAR'
  )
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

COMMIT;
