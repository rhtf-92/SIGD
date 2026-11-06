-- Migración correctiva de seguridad para la cuenta inicial de superadministración.
-- No modifica 15_sigd_superadmin.sql, que es histórica.
--
-- Garantía anti-bloqueo operativo:
--   1. Antes de deshabilitar la cuenta semilla (superadmin / superadmin@sigd.local),
--      verifica que exista al menos OTRA cuenta administrativa funcional activa
--      (c.activo = TRUE, no bloqueada, con credencial válida, asignación vigente
--      al rol ADMINISTRADOR activo y permisos efectivos en sigd_org.rol_permiso).
--   2. Si ya existe otro ADMINISTRADOR funcional, deshabilita inmediatamente
--      superadmin, revoca sus sesiones activas y cierra sus filas en usuario_rol,
--      preservando intactos todos los permisos del rol ADMINISTRADOR y a los
--      demás administradores.
--   3. Si superadmin es todavía la única cuenta ADMINISTRADOR funcional en la base,
--      la conserva operativa temporalmente para no perder el acceso administrativo
--      al sistema y deja armado un disparador automático que endurece y deshabilita
--      superadmin en cuanto se habilite o asigne un relevo nominal ADMINISTRADOR.
DO $$
BEGIN
  IF to_regnamespace('sigd_org') IS NULL OR to_regnamespace('sigd_auth') IS NULL THEN
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION sigd_org.fn_endurecer_superadmin_si_hay_relevo()
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, sigd_org, sigd_auth
  AS $fn$
  DECLARE
    v_seed_user uuid;
    v_has_bloqueado boolean;
    v_has_intentos boolean;
    v_admins_alternativos integer := 0;
  BEGIN
    IF to_regclass('sigd_auth.cuenta_usuario') IS NULL
       OR to_regclass('sigd_org.usuario_rol') IS NULL
       OR to_regclass('sigd_org.rol_sistema') IS NULL THEN
      RETURN FALSE;
    END IF;

    -- Fast-path idempotente: si superadmin no existe o ya quedó completamente deshabilitado, sin rol vigente ni sesión activa, terminar sin trabajo adicional.
    IF NOT EXISTS (
      SELECT 1
        FROM sigd_auth.cuenta_usuario AS s
       WHERE (s.usuario = 'superadmin' OR s.correo = 'superadmin@sigd.local')
         AND (
           s.activo IS DISTINCT FROM FALSE
           OR EXISTS (
             SELECT 1
               FROM sigd_org.usuario_rol AS ur
              WHERE ur.id_usuario = s.id_usuario
                AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
           )
           OR (
             to_regclass('sigd_auth.sesion_usuario') IS NOT NULL
             AND EXISTS (
               SELECT 1
                 FROM sigd_auth.sesion_usuario AS su
                WHERE su.id_usuario = s.id_usuario
                  AND su.revocado_en IS NULL
             )
           )
         )
    ) THEN
      RETURN FALSE;
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

    IF v_has_bloqueado THEN
      SELECT COUNT(DISTINCT c.id_usuario)::integer
        INTO v_admins_alternativos
        FROM sigd_auth.cuenta_usuario AS c
        JOIN sigd_org.usuario_rol AS ur
          ON ur.id_usuario = c.id_usuario
        JOIN sigd_org.rol_sistema AS r
          ON r.rol_id = ur.rol_id
       WHERE c.usuario IS DISTINCT FROM 'superadmin'
         AND COALESCE(c.correo, '') IS DISTINCT FROM 'superadmin@sigd.local'
         AND c.activo IS TRUE
         AND c.password_hash IS NOT NULL
         AND btrim(c.password_hash) <> ''
         AND (c.bloqueado_hasta IS NULL OR c.bloqueado_hasta <= now())
         AND r.codigo = 'ADMINISTRADOR'
         AND r.vigente IS TRUE
         AND ur.vigente_desde <= now()
         AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
         AND (
           to_regclass('sigd_org.rol_permiso') IS NULL
           OR EXISTS (
             SELECT 1
               FROM sigd_org.rol_permiso AS rp
              WHERE rp.rol_id = r.rol_id
           )
         );
    ELSE
      SELECT COUNT(DISTINCT c.id_usuario)::integer
        INTO v_admins_alternativos
        FROM sigd_auth.cuenta_usuario AS c
        JOIN sigd_org.usuario_rol AS ur
          ON ur.id_usuario = c.id_usuario
        JOIN sigd_org.rol_sistema AS r
          ON r.rol_id = ur.rol_id
       WHERE c.usuario IS DISTINCT FROM 'superadmin'
         AND COALESCE(c.correo, '') IS DISTINCT FROM 'superadmin@sigd.local'
         AND c.activo IS TRUE
         AND c.password_hash IS NOT NULL
         AND btrim(c.password_hash) <> ''
         AND r.codigo = 'ADMINISTRADOR'
         AND r.vigente IS TRUE
         AND ur.vigente_desde <= now()
         AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
         AND (
           to_regclass('sigd_org.rol_permiso') IS NULL
           OR EXISTS (
             SELECT 1
               FROM sigd_org.rol_permiso AS rp
              WHERE rp.rol_id = r.rol_id
           )
         );
    END IF;

    IF v_admins_alternativos < 1 THEN
      RAISE NOTICE 'HARDENING[superadmin]: diferido — no existe otra cuenta ADMINISTRADOR funcional activa; se preserva acceso administrativo al sistema hasta registrar un relevo nominal';
      RETURN FALSE;
    END IF;

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
    END LOOP;

    RAISE NOTICE 'HARDENING[superadmin]: cuenta inicial deshabilitada tras confirmar % cuenta(s) ADMINISTRADOR funcional(es) alternativa(s); permisos de ADMINISTRADOR preservados', v_admins_alternativos;
    RETURN TRUE;
  END;
  $fn$;

  REVOKE ALL ON FUNCTION sigd_org.fn_endurecer_superadmin_si_hay_relevo() FROM PUBLIC;

  CREATE OR REPLACE FUNCTION sigd_org.trg_auto_endurecer_superadmin()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, sigd_org, sigd_auth
  AS $trg$
  BEGIN
    IF pg_trigger_depth() > 1 THEN
      RETURN NEW;
    END IF;
    PERFORM sigd_org.fn_endurecer_superadmin_si_hay_relevo();
    RETURN NEW;
  END;
  $trg$;

  REVOKE ALL ON FUNCTION sigd_org.trg_auto_endurecer_superadmin() FROM PUBLIC;

  IF to_regclass('sigd_org.usuario_rol') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS tr_auto_hardening_superadmin ON sigd_org.usuario_rol;
    CREATE TRIGGER tr_auto_hardening_superadmin
      AFTER INSERT OR UPDATE ON sigd_org.usuario_rol
      FOR EACH ROW
      EXECUTE FUNCTION sigd_org.trg_auto_endurecer_superadmin();
  END IF;

  IF to_regclass('sigd_auth.cuenta_usuario') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS tr_auto_hardening_superadmin_cuenta ON sigd_auth.cuenta_usuario;
    CREATE TRIGGER tr_auto_hardening_superadmin_cuenta
      AFTER INSERT OR UPDATE ON sigd_auth.cuenta_usuario
      FOR EACH ROW
      EXECUTE FUNCTION sigd_org.trg_auto_endurecer_superadmin();
  END IF;

  PERFORM sigd_org.fn_endurecer_superadmin_si_hay_relevo();
END $$ LANGUAGE plpgsql;
