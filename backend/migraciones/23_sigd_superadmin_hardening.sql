-- Migración correctiva de seguridad para la cuenta inicial de superadministración.
-- No modifica 15_sigd_superadmin.sql, que es histórica.
-- La cuenta conocida queda deshabilitada y las asignaciones masivas se retiran
-- solo cuando no hay otro administrador activo; si lo hay, falla de forma segura.
DO $$
DECLARE
  v_seed_user uuid;
  v_admin_role uuid;
  v_active_admins integer;
  v_removed_permissions integer;
BEGIN
  IF to_regclass('sigd_auth.cuenta_usuario') IS NULL
     OR to_regclass('sigd_org.rol_sistema') IS NULL THEN
    RETURN;
  END IF;

  SELECT id_usuario INTO v_seed_user
    FROM sigd_auth.cuenta_usuario
   WHERE usuario = 'superadmin' OR correo = 'superadmin@sigd.local'
   ORDER BY (usuario = 'superadmin') DESC LIMIT 1;

  SELECT rol_id INTO v_admin_role
    FROM sigd_org.rol_sistema WHERE codigo = 'ADMINISTRADOR';

  IF v_seed_user IS NOT NULL THEN
    IF to_regclass('sigd_auth.sesion_usuario') IS NOT NULL THEN
      UPDATE sigd_auth.sesion_usuario
         SET revocado_en = COALESCE(revocado_en, now())
       WHERE id_usuario = v_seed_user AND revocado_en IS NULL;
    END IF;

    UPDATE sigd_auth.cuenta_usuario
       SET activo = FALSE,
           bloqueado_hasta = 'infinity'::timestamptz,
           intentos_fallidos = 0
     WHERE id_usuario = v_seed_user;

    IF v_admin_role IS NOT NULL AND to_regclass('sigd_org.usuario_rol') IS NOT NULL THEN
      UPDATE sigd_org.usuario_rol
         SET vigente_hasta = COALESCE(vigente_hasta, now())
       WHERE id_usuario = v_seed_user AND rol_id = v_admin_role
         AND vigente_desde <= now()
         AND (vigente_hasta IS NULL OR vigente_hasta > now());
    END IF;
  END IF;

  IF v_admin_role IS NOT NULL AND to_regclass('sigd_org.usuario_rol') IS NOT NULL THEN
    SELECT COUNT(*)::integer INTO v_active_admins
      FROM sigd_org.usuario_rol ur
      JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = ur.id_usuario
     WHERE ur.rol_id = v_admin_role AND cu.activo = TRUE
       AND ur.vigente_desde <= now()
       AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now());

    IF v_active_admins > 0 THEN
      RAISE EXCEPTION
        'HARDENING detenido: existen % administrador(es) activo(s); revisar permisos de ADMINISTRADOR explícitamente antes de retirar asignaciones masivas',
        v_active_admins;
    END IF;

    IF to_regclass('sigd_org.rol_permiso') IS NOT NULL THEN
      DELETE FROM sigd_org.rol_permiso WHERE rol_id = v_admin_role;
      GET DIAGNOSTICS v_removed_permissions = ROW_COUNT;
      RAISE NOTICE 'HARDENING[superadmin]: cuenta inicial deshabilitada y % asignación(es) masiva(s) de permiso retiradas', v_removed_permissions;
    END IF;
  END IF;
END $$ LANGUAGE plpgsql;
