-- ============================================================================
-- SIGD - Migración 10: Depuración y Saneamiento de Cuentas Sin Rol
-- Propósito: Eliminar cuentas huérfanas que carecen de rol institucional asignado,
--            garantizando integridad referencial y atomicidad.
-- ============================================================================

DO $$
BEGIN
  -- 1. Tabla temporal con usuarios que no poseen ningún rol activo
  CREATE TEMP TABLE IF NOT EXISTS tmp_usuarios_sin_rol ON COMMIT DROP AS
  SELECT cu.id_usuario, cu.id_persona
  FROM sigd_auth.cuenta_usuario cu
  WHERE NOT EXISTS (
    SELECT 1 
    FROM sigd_org.usuario_rol ur 
    WHERE ur.id_usuario = cu.id_usuario 
      AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
  );

  -- 2. Eliminar sesiones de usuario vinculadas
  DELETE FROM sigd_auth.sesion_usuario
  WHERE id_usuario IN (SELECT id_usuario FROM tmp_usuarios_sin_rol);

  -- 3. Eliminar notificaciones de casilla si existieran
  DELETE FROM sigd_auth.notificacion_casilla
  WHERE usuario_id IN (SELECT id_usuario FROM tmp_usuarios_sin_rol);

  -- 4. Eliminar perfiles de usuario si existieran
  DELETE FROM sigd_auth.perfil_usuario
  WHERE id_usuario IN (SELECT id_usuario FROM tmp_usuarios_sin_rol);

  -- 5. Eliminar asignaciones de personal sin rol si existieran
  DELETE FROM sigd_org.asignacion_personal
  WHERE id_usuario IN (SELECT id_usuario FROM tmp_usuarios_sin_rol);

  -- 6. Eliminar cuentas de usuario
  DELETE FROM sigd_auth.cuenta_usuario
  WHERE id_usuario IN (SELECT id_usuario FROM tmp_usuarios_sin_rol);

  -- 7. Identificar personas huérfanas (sin otra cuenta ni trámites asociados)
  CREATE TEMP TABLE IF NOT EXISTS tmp_personas_eliminar ON COMMIT DROP AS
  SELECT DISTINCT t.id_persona
  FROM tmp_usuarios_sin_rol t
  WHERE NOT EXISTS (
    SELECT 1 FROM sigd_auth.cuenta_usuario cu WHERE cu.id_persona = t.id_persona
  )
  AND NOT EXISTS (
    SELECT 1 FROM sigd_tra.expediente e WHERE e.solicitante_id = t.id_persona
  );

  -- 8. Eliminar consentimientos de datos
  DELETE FROM sigd_auth.consentimiento_datos
  WHERE id_persona IN (SELECT id_persona FROM tmp_personas_eliminar);

  -- 9. Eliminar historial de documentos
  DELETE FROM sigd_auth.persona_documento_historial
  WHERE id_persona IN (SELECT id_persona FROM tmp_personas_eliminar);

  -- 10. Eliminar registros de persona natural
  DELETE FROM sigd_auth.persona_natural
  WHERE id_persona IN (SELECT id_persona FROM tmp_personas_eliminar);

  -- 11. Eliminar persona base
  DELETE FROM sigd_auth.persona
  WHERE id_persona IN (SELECT id_persona FROM tmp_personas_eliminar);

END $$;
