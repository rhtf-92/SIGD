-- Migración correctiva de seguridad para la cuenta inicial de superadministración.
-- No modifica 15_sigd_superadmin.sql, que es histórica.
--
-- Deshabilita únicamente la cuenta sembrada de bootstrap (superadmin / superadmin@sigd.local),
-- revoca sus sesiones activas y cierra sus asignaciones de rol activas respetando las
-- restricciones temporales de sigd_org.usuario_rol. No elimina permisos del rol
-- ADMINISTRADOR ni afecta a otros administradores activos del sistema.
DO $$
DECLARE
  v_seed_user uuid;
  v_has_bloqueado boolean;
  v_has_intentos boolean;
BEGIN
  IF to_regclass('sigd_auth.cuenta_usuario') IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'sigd_auth'
       AND table_name = 'cuenta_usuario'
       AND column_name = 'bloqueado_hasta'
  ) INTO v_has_bloqueado;

  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'sigd_auth'
       AND table_name = 'cuenta_usuario'
       AND column_name = 'intentos_fallidos'
  ) INTO v_has_intentos;

  FOR v_seed_user IN
    SELECT id_usuario
      FROM sigd_auth.cuenta_usuario
     WHERE usuario = 'superadmin'
        OR correo = 'superadmin@sigd.local'
  LOOP
    IF to_regclass('sigd_auth.sesion_usuario') IS NOT NULL THEN
      UPDATE sigd_auth.sesion_usuario
         SET revocado_en = now()
       WHERE id_usuario = v_seed_user
         AND revocado_en IS NULL;
    END IF;

    IF v_has_bloqueado AND v_has_intentos THEN
      UPDATE sigd_auth.cuenta_usuario
         SET activo = FALSE,
             bloqueado_hasta = 'infinity'::timestamptz,
             intentos_fallidos = 0
       WHERE id_usuario = v_seed_user
         AND (
           activo IS DISTINCT FROM FALSE
           OR bloqueado_hasta IS DISTINCT FROM 'infinity'::timestamptz
           OR intentos_fallidos IS DISTINCT FROM 0
         );
    ELSIF v_has_bloqueado THEN
      UPDATE sigd_auth.cuenta_usuario
         SET activo = FALSE,
             bloqueado_hasta = 'infinity'::timestamptz
       WHERE id_usuario = v_seed_user
         AND (
           activo IS DISTINCT FROM FALSE
           OR bloqueado_hasta IS DISTINCT FROM 'infinity'::timestamptz
         );
    ELSE
      UPDATE sigd_auth.cuenta_usuario
         SET activo = FALSE
       WHERE id_usuario = v_seed_user
         AND activo IS DISTINCT FROM FALSE;
    END IF;

    IF to_regclass('sigd_org.usuario_rol') IS NOT NULL THEN
      -- 1. Asignaciones iniciadas antes de now(): cierre exacto en now() respetando vigente_hasta > vigente_desde.
      UPDATE sigd_org.usuario_rol
         SET vigente_hasta = now()
       WHERE id_usuario = v_seed_user
         AND vigente_desde < now()
         AND (vigente_hasta IS NULL OR vigente_hasta > now());

      -- 2. Asignaciones creadas en el mismo instante transaccional (vigente_desde = now()) o futuras:
      --    se cierran con intervalo mínimo válido si no solapan historial previo; en caso contrario se retiran.
      UPDATE sigd_org.usuario_rol AS u
         SET vigente_desde = now() - interval '1 microsecond',
             vigente_hasta = now()
       WHERE u.id_usuario = v_seed_user
         AND u.vigente_desde >= now()
         AND (u.vigente_hasta IS NULL OR u.vigente_hasta > now())
         AND NOT EXISTS (
           SELECT 1
             FROM sigd_org.usuario_rol AS prev
            WHERE prev.id_usuario = u.id_usuario
              AND prev.rol_id = u.rol_id
              AND prev.id_usuario_rol <> u.id_usuario_rol
              AND COALESCE(prev.vigente_hasta, 'infinity'::timestamptz) > now() - interval '1 microsecond'
         );

      DELETE FROM sigd_org.usuario_rol
       WHERE id_usuario = v_seed_user
         AND vigente_desde >= now()
         AND (vigente_hasta IS NULL OR vigente_hasta > now());
    END IF;

    RAISE NOTICE 'HARDENING[superadmin]: cuenta inicial deshabilitada; permisos de ADMINISTRADOR preservados';
  END LOOP;
END $$ LANGUAGE plpgsql;
