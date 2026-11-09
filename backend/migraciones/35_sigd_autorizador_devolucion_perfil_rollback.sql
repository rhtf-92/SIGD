-- =============================================================================
-- Rollback de Migración 35 · Esquema sigd_org (Fase 5D)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Reversión controlada e idempotente de la migración 35
-- =============================================================================

BEGIN;

-- 1. Re-asociar DEVOLUCION_AUTORIZAR a GESTOR_RECEPCION_DOCUMENTAL si hiciera falta
INSERT INTO sigd_org.perfil_permiso (perfil_id, permiso_id)
SELECT p.perfil_id, perm.permiso_id
FROM sigd_org.perfil_operativo p, sigd_org.permiso_sistema perm
WHERE p.codigo = 'GESTOR_RECEPCION_DOCUMENTAL'
  AND perm.codigo = 'DEVOLUCION_AUTORIZAR'
ON CONFLICT DO NOTHING;

-- 2. Eliminar permisos asignados a AUTORIZADOR_DEVOLUCION
DELETE FROM sigd_org.perfil_permiso
WHERE perfil_id = (SELECT perfil_id FROM sigd_org.perfil_operativo WHERE codigo = 'AUTORIZADOR_DEVOLUCION');

-- 3. Eliminar asignaciones activas de este perfil si existiesen
DELETE FROM sigd_org.asignacion_perfil_operativo
WHERE perfil_id = (SELECT perfil_id FROM sigd_org.perfil_operativo WHERE codigo = 'AUTORIZADOR_DEVOLUCION');

-- 4. Eliminar el perfil AUTORIZADOR_DEVOLUCION
DELETE FROM sigd_org.perfil_operativo WHERE codigo = 'AUTORIZADOR_DEVOLUCION';

COMMIT;
