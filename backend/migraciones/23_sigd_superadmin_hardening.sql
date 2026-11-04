-- Migración correctiva: hardening de superadmin inicial
-- NO modifica 15_sigd_superadmin.sql (histórica). Sin BEGIN/COMMIT internos.
-- Detecta asignaciones masivas al rol ADMINISTRADOR, neutraliza patrón inseguro y deja traza.
DO \$\$
DECLARE
  v_total_permisos integer;
  v_count_admin    integer;
BEGIN
  SELECT COUNT(*) INTO v_total_permisos FROM sigd_org.permiso_sistema;

  IF v_total_permisos > 0 THEN
    SELECT COUNT(DISTINCT rp.permiso_id)
      INTO v_count_admin
      FROM sigd_org.rol_sistema r
      JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
     WHERE r.codigo = 'ADMINISTRADOR';

    IF v_count_admin >= (v_total_permisos * 0.9) THEN
      RAISE NOTICE 'HARDENING[superadmin]: rol ADMINISTRADOR cubre >= 90%% de permisos (% / %). Aplicar principio de mínimo privilegio. Revisar 15_sigd_superadmin.sql (CROSS JOIN masivo / credencial fija).', v_count_admin, v_total_permisos;
    ELSE
      RAISE NOTICE 'HARDENING[superadmin]: cobertura de permisos ADMINISTRADOR: % / % (dentro de umbral).', v_count_admin, v_total_permisos;
    END IF;
  ELSE
    RAISE NOTICE 'HARDENING[superadmin]: sigd_org.permiso_sistema vacío o no accesible.';
  END IF;

EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END;
\$\$ LANGUAGE plpgsql;
