-- =============================================================================
-- Rollback de Migración 47: Reversión de SUPERADMINISTRADOR y Gobierno Técnico
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor : Geric (B_GERIC)
-- Marco : Reversión segura, idempotente y atómica de la Migración 47
-- =============================================================================

BEGIN;

-- 1. Eliminar asociaciones en sigd_org.rol_permiso para SUPERADMINISTRADOR
DELETE FROM sigd_org.rol_permiso
WHERE rol_id IN (
  SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'SUPERADMINISTRADOR'
);

-- 2. Eliminar permisos técnicos creados en Migración 47
DELETE FROM sigd_org.permiso_sistema
WHERE codigo IN (
  'ROLES_GESTIONAR',
  'PERMISOS_GESTIONAR',
  'PERFILES_GESTIONAR',
  'CONFIGURACION_GLOBAL_GESTIONAR',
  'AUDITORIA_GLOBAL_VER',
  'TUPA_PUBLICAR'
);

-- 3. Limpiar asignaciones de rol en sigd_org.usuario_rol si existieran
DELETE FROM sigd_org.usuario_rol
WHERE rol_id IN (
  SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'SUPERADMINISTRADOR'
);

-- 4. Eliminar el rol SUPERADMINISTRADOR de sigd_org.rol_sistema
DELETE FROM sigd_org.rol_sistema
WHERE codigo = 'SUPERADMINISTRADOR';

-- 5. Restaurar la restricción original de 7 roles canónicos
ALTER TABLE sigd_org.rol_sistema DROP CONSTRAINT IF EXISTS chk_rol_codigo;
ALTER TABLE sigd_org.rol_sistema ADD CONSTRAINT chk_rol_codigo CHECK (
  codigo::text = ANY (ARRAY[
    'ADMINISTRADOR'::text,
    'DIRECTOR'::text,
    'SECRETARIO'::text,
    'ESPECIALISTA'::text,
    'MESA_PARTES'::text,
    'CIUDADANO'::text,
    'TESORERIA'::text
  ])
);

COMMIT;
