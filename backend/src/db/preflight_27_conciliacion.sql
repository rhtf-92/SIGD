-- =============================================================================
-- PREFLIGHT 27: VERIFICACIÓN DE CONCILIACIÓN PLATFORM RBAC Y REGLAS DE SEGURIDAD
-- SIGD · IESTP «Suiza» · B_JACOBO
-- =============================================================================

DO $$
DECLARE
    v_count INT;
    v_owner TEXT;
    v_has_public_exec BOOLEAN;
    v_audit_count INT;
    v_col_count INT;
BEGIN
    RAISE NOTICE '--- INICIANDO PREFLIGHT 27: CONCILIACIÓN PLATFORM RBAC ---';

    -- 1. Verificar registro en public.sigd_migraciones
    SELECT COUNT(*) INTO v_count
      FROM public.sigd_migraciones
     WHERE nombre_script = '27_sigd_conciliacion_seguridad_platform_rbac.sql';
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'PREFLIGHT_27_FAIL: Migración 27 no registrada en public.sigd_migraciones (count=%)', v_count;
    END IF;
    RAISE NOTICE '[OK] Criterio 1: Migración 27 debidamente registrada en public.sigd_migraciones';

    -- 2. Verificar columna 'activo' generada en sigd_auth.rol_plataforma
    SELECT COUNT(*) INTO v_col_count
      FROM information_schema.columns
     WHERE table_schema = 'sigd_auth'
       AND table_name = 'rol_plataforma'
       AND column_name = 'activo';
    IF v_col_count <> 1 THEN
        RAISE EXCEPTION 'PREFLIGHT_27_FAIL: Columna activo no encontrada en sigd_auth.rol_plataforma';
    END IF;
    RAISE NOTICE '[OK] Criterio 2: Columna de compatibilidad activo existe en sigd_auth.rol_plataforma';

    -- 3. Verificar propietario de sigd_auth.fn_asignar_rol_plataforma
    SELECT r.rolname INTO v_owner
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      JOIN pg_roles r ON p.proowner = r.oid
     WHERE n.nspname = 'sigd_auth' AND p.proname = 'fn_asignar_rol_plataforma';
    IF v_owner NOT IN ('postgres') THEN
        RAISE EXCEPTION 'PREFLIGHT_27_FAIL: fn_asignar_rol_plataforma debe ser propiedad de postgres, propietario actual: %', v_owner;
    END IF;
    RAISE NOTICE '[OK] Criterio 3: Propietario de fn_asignar_rol_plataforma es postgres (%)', v_owner;

    -- 4. Verificar revocación de EXECUTE a PUBLIC
    SELECT has_function_privilege('public', 'sigd_auth.fn_asignar_rol_plataforma(uuid,uuid,varchar,text,boolean,varchar,inet,varchar)', 'EXECUTE')
      INTO v_has_public_exec;
    IF v_has_public_exec THEN
        RAISE EXCEPTION 'PREFLIGHT_27_FAIL: fn_asignar_rol_plataforma tiene EXECUTE concedido a PUBLIC';
    END IF;
    RAISE NOTICE '[OK] Criterio 4: EXECUTE revocado formalmente de PUBLIC en fn_asignar_rol_plataforma';

    -- 5. Verificar que sigd_app tiene EXECUTE
    IF NOT has_function_privilege('sigd_app', 'sigd_auth.fn_asignar_rol_plataforma(uuid,uuid,varchar,text,boolean,varchar,inet,varchar)', 'EXECUTE') THEN
        RAISE EXCEPTION 'PREFLIGHT_27_FAIL: sigd_app no tiene EXECUTE en fn_asignar_rol_plataforma';
    END IF;
    RAISE NOTICE '[OK] Criterio 5: sigd_app posee EXECUTE autorizado en fn_asignar_rol_plataforma';

    -- 6. Verificar registro en auditoria_plataforma_log
    SELECT COUNT(*) INTO v_audit_count
      FROM sigd_audit.auditoria_plataforma_log
     WHERE correlation_id = 'c0a80101-0027-4000-8000-000000000027'::uuid;
    IF v_audit_count < 1 THEN
        RAISE EXCEPTION 'PREFLIGHT_27_FAIL: No se encontró evidencia de auditoría WORM para migración 27';
    END IF;
    RAISE NOTICE '[OK] Criterio 6: Evidencia WORM para migración 27 registrada en bitácora de plataforma';

    -- 7. Verificar prohibición de DML directo a sigd_app sobre usuario_rol_plataforma
    IF has_table_privilege('sigd_app', 'sigd_auth.usuario_rol_plataforma', 'INSERT') OR
       has_table_privilege('sigd_app', 'sigd_auth.usuario_rol_plataforma', 'UPDATE') OR
       has_table_privilege('sigd_app', 'sigd_auth.usuario_rol_plataforma', 'DELETE') OR
       has_table_privilege('sigd_app', 'sigd_auth.usuario_rol_plataforma', 'TRUNCATE') THEN
        RAISE EXCEPTION 'PREFLIGHT_27_FAIL: sigd_app posee privilegios directos de DML sobre sigd_auth.usuario_rol_plataforma';
    END IF;
    RAISE NOTICE '[OK] Criterio 7: sigd_app tiene estrictamente denegado DML directo en sigd_auth.usuario_rol_plataforma';

    -- 8. Verificar inmutabilidad WORM de acreditacion_descarga_excepcional
    IF has_table_privilege('sigd_app', 'sigd_audit.acreditacion_descarga_excepcional', 'DELETE') OR
       has_table_privilege('sigd_app', 'sigd_audit.acreditacion_descarga_excepcional', 'TRUNCATE') THEN
        RAISE EXCEPTION 'PREFLIGHT_27_FAIL: sigd_app posee DELETE/TRUNCATE sobre acreditacion_descarga_excepcional';
    END IF;
    RAISE NOTICE '[OK] Criterio 8: sigd_app tiene revocado DELETE/TRUNCATE sobre acreditacion_descarga_excepcional';

    RAISE NOTICE '--- PREFLIGHT 27 COMPLETADO SATISFACTORIAMENTE (8/8 CRITERIOS APROBADOS) ---';
END;
$$;
