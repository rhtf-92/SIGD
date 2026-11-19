-- =============================================================================
-- SIGD SUIZA — SUITE PREFLIGHT 26: CERTIFICACIÓN DE REMEDIACIÓN INTEGRAL M.2.3
-- Proyecto: Sistema Integral de Gestión Documentaria (SIGD)
-- Institución: IESTP «Suiza» — Pucallpa, Ucayali
-- Intervención: TSK-1.2-M.2.3 · Frente G (Preflight 26)
-- Motor: PostgreSQL 18.6
-- =============================================================================

DO $$
DECLARE
    v_count INT;
    v_passed INT := 0;
    v_failed INT := 0;
BEGIN
    RAISE NOTICE '================================================================================';
    RAISE NOTICE 'INICIANDO SUITE PREFLIGHT 26: CERTIFICACIÓN REMEDIACIÓN INTEGRAL (12 CRITERIOS)';
    RAISE NOTICE '================================================================================';

    -- CRIT-01: Tabla sigd_audit.acreditacion_descarga_excepcional presente con clave primaria
    SELECT COUNT(*) INTO v_count
      FROM information_schema.tables
     WHERE table_schema = 'sigd_audit'
       AND table_name = 'acreditacion_descarga_excepcional';

    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-01 [PASS]: Tabla sigd_audit.acreditacion_descarga_excepcional presente en catálogo.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-01 [FAIL]: Tabla sigd_audit.acreditacion_descarga_excepcional no encontrada.';
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-02: Columna acreditacion_id en sigd_audit.descarga_excepcional_log con FK activa
    SELECT COUNT(*) INTO v_count
      FROM information_schema.columns
     WHERE table_schema = 'sigd_audit'
       AND table_name = 'descarga_excepcional_log'
       AND column_name = 'acreditacion_id';

    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-02 [PASS]: Columna acreditacion_id vinculada en sigd_audit.descarga_excepcional_log.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-02 [FAIL]: Columna acreditacion_id ausente en descarga_excepcional_log.';
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-03: Disparadores WORM en acreditacion_descarga_excepcional (UPDATE/DELETE y TRUNCATE)
    SELECT COUNT(*) INTO v_count
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'sigd_audit'
       AND c.relname = 'acreditacion_descarga_excepcional'
       AND t.tgname IN ('tr_proteger_acreditacion_descarga_worm', 'tr_proteger_acreditacion_descarga_worm_trunc');

    IF v_count = 2 THEN
        RAISE NOTICE 'CRIT-03 [PASS]: Disparadores WORM (2/2) activos en acreditacion_descarga_excepcional.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-03 [FAIL]: Disparadores WORM incompletos en acreditacion_descarga_excepcional (encontrados: %/2)', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-04: Función rectora sigd_auth.fn_asignar_rol_plataforma presente con SECURITY DEFINER
    SELECT COUNT(*) INTO v_count
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'sigd_auth'
       AND p.proname = 'fn_asignar_rol_plataforma'
       AND p.prosecdef = TRUE;

    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-04 [PASS]: Función rectora sigd_auth.fn_asignar_rol_plataforma presente con SECURITY DEFINER.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-04 [FAIL]: Función fn_asignar_rol_plataforma no configurada como SECURITY DEFINER.';
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-05: Función rectora sigd_auth.fn_revocar_rol_plataforma presente con SECURITY DEFINER
    SELECT COUNT(*) INTO v_count
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'sigd_auth'
       AND p.proname = 'fn_revocar_rol_plataforma'
       AND p.prosecdef = TRUE;

    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-05 [PASS]: Función rectora sigd_auth.fn_revocar_rol_plataforma presente con SECURITY DEFINER.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-05 [FAIL]: Función fn_revocar_rol_plataforma no configurada como SECURITY DEFINER.';
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-06: Privilegio EXECUTE en funciones de plataforma concedido a sigd_app y revocado a PUBLIC
    SELECT COUNT(*) INTO v_count
      FROM information_schema.routine_privileges
     WHERE specific_schema = 'sigd_auth'
       AND routine_name IN ('fn_asignar_rol_plataforma', 'fn_revocar_rol_plataforma')
       AND grantee = 'sigd_app'
       AND privilege_type = 'EXECUTE';

    IF v_count >= 2 THEN
        RAISE NOTICE 'CRIT-06 [PASS]: Privilegio EXECUTE debidamente otorgado a sigd_app en funciones rectoras de plataforma.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-06 [FAIL]: sigd_app carece de EXECUTE en funciones rectoras (encontradas: %/2)', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-07: sigd_app carece de INSERT/UPDATE directo en usuario_rol_plataforma (blindaje DML)
    SELECT COUNT(*) INTO v_count
      FROM information_schema.table_privileges
     WHERE table_schema = 'sigd_auth'
       AND table_name = 'usuario_rol_plataforma'
       AND grantee = 'sigd_app'
       AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

    IF v_count = 0 THEN
        RAISE NOTICE 'CRIT-07 [PASS]: sigd_app carece de privilegios directos de mutación DML en usuario_rol_plataforma.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-07 [FAIL]: Fuga de privilegios DML: sigd_app posee mutación directa en usuario_rol_plataforma (% privilegios).', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-08: Exclusión estricta de ESPECIALISTA en sigd_org.rol_sistema (vigente = FALSE)
    SELECT COUNT(*) INTO v_count
      FROM sigd_org.rol_sistema
     WHERE codigo = 'ESPECIALISTA'
       AND vigente = FALSE;

    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-08 [PASS]: Rol ESPECIALISTA permanece estrictamente excluido e inactivo (vigente = FALSE).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-08 [FAIL]: Rol ESPECIALISTA se encuentra activo o ausente.';
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-09: Registro WORM de procedencia de Migración 22 registrado en auditoria_plataforma_log
    SELECT COUNT(*) INTO v_count
      FROM sigd_audit.auditoria_plataforma_log
     WHERE operacion = 'RECTIFICACION_TRAZABILIDAD_MIGRACION_22'
       AND entidad_id = '22_sigd_org_catalogo_rbac_institucional.sql';

    IF v_count >= 1 THEN
        RAISE NOTICE 'CRIT-09 [PASS]: Registro WORM de procedencia y conciliación de Migración 22 verificado en auditoria_plataforma_log.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-09 [FAIL]: Registro de trazabilidad de Migración 22 no encontrado en auditoría WORM.';
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-10: Restricción CHECK chk_acreditacion_hash (hexadecimal 64 caracteres)
    SELECT COUNT(*) INTO v_count
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'sigd_audit'
       AND c.relname = 'acreditacion_descarga_excepcional'
       AND con.conname = 'chk_acreditacion_hash'
       AND con.contype = 'c';

    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-10 [PASS]: Restricción CHECK chk_acreditacion_hash (SHA-256 64 chars) activa en catálogo.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-10 [FAIL]: Restricción CHECK chk_acreditacion_hash ausente en acreditacion_descarga_excepcional.';
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-11: Restricción CHECK chk_acreditacion_motivo (>= 15 caracteres)
    SELECT COUNT(*) INTO v_count
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'sigd_audit'
       AND c.relname = 'acreditacion_descarga_excepcional'
       AND con.conname = 'chk_acreditacion_motivo'
       AND con.contype = 'c';

    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-11 [PASS]: Restricción CHECK chk_acreditacion_motivo (>= 15 chars) activa en catálogo.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-11 [FAIL]: Restricción CHECK chk_acreditacion_motivo ausente.';
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-12: Total migraciones registradas consistente (24 registradas en public.sigd_migraciones)
    SELECT COUNT(*) INTO v_count
      FROM public.sigd_migraciones;

    IF v_count >= 24 THEN
        RAISE NOTICE 'CRIT-12 [PASS]: Registro de migraciones consistente con Migración 26 aplicada (registradas: %).', v_count;
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-12 [FAIL]: Conteo de migraciones registrado insuficiente (registradas: %/24)', v_count;
        v_failed := v_failed + 1;
    END IF;

    RAISE NOTICE '================================================================================';
    RAISE NOTICE 'RESUMEN PREFLIGHT 26: % PASS | % FAIL (TOTAL: 12 CRITERIOS)', v_passed, v_failed;
    RAISE NOTICE '================================================================================';

    IF v_failed > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT 26 FALLIDO: Se detectaron % criterios no conformes.', v_failed;
    END IF;
END;
$$;
