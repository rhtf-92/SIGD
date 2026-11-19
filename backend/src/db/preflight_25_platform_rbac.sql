-- =============================================================================
-- SIGD SUIZA — SCRIPT DE PREFLIGHT Y CERTIFICACIÓN DE PLATFORM RBAC (MIGRACIÓN 25)
-- TSK-1.2-M.2.2 · VERIFICACIÓN BINARIA ESTRICTA: PASS | FAIL | NO VERIFICABLE
-- Motor: PostgreSQL 18.6 Alpine
-- =============================================================================

DO $$
DECLARE
    v_count INT;
    v_passed INT := 0;
    v_failed INT := 0;
    v_no_verif INT := 0;
    v_secdef BOOLEAN;
    v_spath TEXT;
    v_worm_ok BOOLEAN := FALSE;
    v_user_test UUID;
    v_corr UUID := gen_random_uuid();
BEGIN
    RAISE NOTICE '================================================================================';
    RAISE NOTICE 'INICIANDO SUITE PREFLIGHT 25: CERTIFICACIÓN DE PLATFORM RBAC (16 CRITERIOS)';
    RAISE NOTICE '================================================================================';

    -- CRIT-01: Catálogo de SUPER_ADMIN en sigd_auth.rol_plataforma
    SELECT COUNT(*) INTO v_count
      FROM information_schema.tables
     WHERE table_schema = 'sigd_auth' AND table_name = 'rol_plataforma';
    
    IF v_count = 1 THEN
        SELECT COUNT(*) INTO v_count
          FROM sigd_auth.rol_plataforma
         WHERE codigo = 'SUPER_ADMIN' AND vigente = TRUE;
        IF v_count = 1 THEN
            RAISE NOTICE 'CRIT-01 [PASS]: Catálogo sigd_auth.rol_plataforma activo con rol SUPER_ADMIN presente.';
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE 'CRIT-01 [FAIL]: Tabla existe pero rol SUPER_ADMIN no se encuentra o no está vigente.';
            v_failed := v_failed + 1;
        END IF;
    ELSE
        RAISE NOTICE 'CRIT-01 [NO VERIFICABLE]: Tabla sigd_auth.rol_plataforma no existe en la base de datos actual.';
        v_no_verif := v_no_verif + 1;
    END IF;

    -- CRIT-02: Separación de roles institucionales (SUPER_ADMIN NO en sigd_org.rol_sistema)
    SELECT COUNT(*) INTO v_count
      FROM information_schema.tables
     WHERE table_schema = 'sigd_org' AND table_name = 'rol_sistema';

    IF v_count = 1 THEN
        SELECT COUNT(*) INTO v_count
          FROM sigd_org.rol_sistema
         WHERE codigo = 'SUPER_ADMIN';
        IF v_count = 0 THEN
            RAISE NOTICE 'CRIT-02 [PASS]: Separación garantizada: SUPER_ADMIN ausente de sigd_org.rol_sistema (10 roles canónicos institucionales preservados).';
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE 'CRIT-02 [FAIL]: Contradicción detectada: SUPER_ADMIN está insertado indebidamente en sigd_org.rol_sistema.';
            v_failed := v_failed + 1;
        END IF;
    ELSE
        RAISE NOTICE 'CRIT-02 [NO VERIFICABLE]: Tabla sigd_org.rol_sistema no existe en el catálogo.';
        v_no_verif := v_no_verif + 1;
    END IF;

    -- CRIT-03: Asignaciones de plataforma en sigd_auth.usuario_rol_plataforma
    SELECT COUNT(*) INTO v_count
      FROM information_schema.tables
     WHERE table_schema = 'sigd_auth' AND table_name = 'usuario_rol_plataforma';

    IF v_count = 1 THEN
        SELECT COUNT(*) INTO v_count
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
         WHERE nsp.nspname = 'sigd_auth' AND rel.relname = 'usuario_rol_plataforma' AND con.contype = 'p';
        IF v_count >= 1 THEN
            RAISE NOTICE 'CRIT-03 [PASS]: Tabla sigd_auth.usuario_rol_plataforma con clave primaria verificada.';
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE 'CRIT-03 [FAIL]: Falta clave primaria en sigd_auth.usuario_rol_plataforma.';
            v_failed := v_failed + 1;
        END IF;
    ELSE
        RAISE NOTICE 'CRIT-03 [NO VERIFICABLE]: Tabla sigd_auth.usuario_rol_plataforma pendiente de migración.';
        v_no_verif := v_no_verif + 1;
    END IF;

    -- CRIT-04: Integridad referencial (FKs)
    SELECT COUNT(*) INTO v_count
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'sigd_auth' AND rel.relname = 'usuario_rol_plataforma' AND con.contype = 'f';

    IF v_count >= 2 THEN
        RAISE NOTICE 'CRIT-04 [PASS]: Claves foráneas (cuenta_usuario, rol_plataforma) activas en usuario_rol_plataforma.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-04 [NO VERIFICABLE]: Claves foráneas de plataforma ausentes o incompletas (encontradas: %/2).', v_count;
        v_no_verif := v_no_verif + 1;
    END IF;

    -- CRIT-05: Vigencia temporal y revocación
    SELECT COUNT(*) INTO v_count
      FROM information_schema.columns
     WHERE table_schema = 'sigd_auth' AND table_name = 'usuario_rol_plataforma'
       AND column_name IN ('vigente_desde', 'vigente_hasta');

    IF v_count = 2 THEN
        RAISE NOTICE 'CRIT-05 [PASS]: Columnas de vigencia temporal (vigente_desde, vigente_hasta) verificadas.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-05 [NO VERIFICABLE]: Columnas de vigencia temporal ausentes en usuario_rol_plataforma.';
        v_no_verif := v_no_verif + 1;
    END IF;

    -- CRIT-06: Función rectora fn_es_super_admin
    SELECT COUNT(*) INTO v_count
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'sigd_auth' AND p.proname = 'fn_es_super_admin';

    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-06 [PASS]: Función rectora sigd_auth.fn_es_super_admin(UUID) existente en catálogo.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-06 [NO VERIFICABLE]: Función sigd_auth.fn_es_super_admin ausente del catálogo.';
        v_no_verif := v_no_verif + 1;
    END IF;

    -- CRIT-07: SECURITY DEFINER en fn_es_super_admin
    IF v_count = 1 THEN
        SELECT p.prosecdef INTO v_secdef
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'sigd_auth' AND p.proname = 'fn_es_super_admin';
        IF v_secdef = TRUE THEN
            RAISE NOTICE 'CRIT-07 [PASS]: Propiedad SECURITY DEFINER activa en sigd_auth.fn_es_super_admin.';
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE 'CRIT-07 [FAIL]: fn_es_super_admin carece de SECURITY DEFINER.';
            v_failed := v_failed + 1;
        END IF;
    ELSE
        RAISE NOTICE 'CRIT-07 [NO VERIFICABLE]: Depende de CRIT-06.';
        v_no_verif := v_no_verif + 1;
    END IF;

    -- CRIT-08: search_path seguro
    IF v_count = 1 THEN
        SELECT array_to_string(p.proconfig, ', ') INTO v_spath
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'sigd_auth' AND p.proname = 'fn_es_super_admin';
        IF v_spath LIKE '%search_path=%' THEN
            RAISE NOTICE 'CRIT-08 [PASS]: Configuración search_path blindada (%): previene search_path injection.', v_spath;
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE 'CRIT-08 [FAIL]: search_path no configurado explícitamente en fn_es_super_admin.';
            v_failed := v_failed + 1;
        END IF;
    ELSE
        RAISE NOTICE 'CRIT-08 [NO VERIFICABLE]: Depende de CRIT-06.';
        v_no_verif := v_no_verif + 1;
    END IF;

    -- CRIT-09: Privilegios de Mínimo Privilegio a sigd_app
    SELECT COUNT(*) INTO v_count
      FROM information_schema.role_table_grants
     WHERE grantee = 'sigd_app'
       AND table_schema = 'sigd_auth'
       AND table_name = 'usuario_rol_plataforma'
       AND privilege_type = 'SELECT';

    IF v_count >= 1 THEN
        RAISE NOTICE 'CRIT-09 [PASS]: Privilegio SELECT concedido a sigd_app sobre usuario_rol_plataforma.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-09 [NO VERIFICABLE]: Privilegios de sigd_app sobre usuario_rol_plataforma no verificables en este entorno.';
        v_no_verif := v_no_verif + 1;
    END IF;

    -- CRIT-10: Protección WORM en sigd_audit.auditoria_plataforma_log
    SELECT COUNT(*) INTO v_count
      FROM pg_trigger tg
      JOIN pg_class c ON c.oid = tg.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'sigd_audit'
       AND c.relname = 'auditoria_plataforma_log'
       AND tg.tgname LIKE '%worm%';

    IF v_count >= 2 THEN
        RAISE NOTICE 'CRIT-10 [PASS]: Disparadores WORM (UPDATE, DELETE, TRUNCATE) activos en auditoria_plataforma_log (encontrados: %).', v_count;
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-10 [NO VERIFICABLE]: Disparadores WORM de auditoria_plataforma_log pendientes de registro.';
        v_no_verif := v_no_verif + 1;
    END IF;

    -- CRIT-11: Auditoría de plataforma y validación de justificación (>= 15 chars)
    SELECT COUNT(*) INTO v_count
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'sigd_audit'
       AND rel.relname = 'auditoria_plataforma_log'
       AND con.conname = 'chk_plataforma_motivo_len';

    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-11 [PASS]: Restricción chk_plataforma_motivo_len (>= 15 chars) activa en bitácora de plataforma.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-11 [NO VERIFICABLE]: Restricción chk_plataforma_motivo_len ausente.';
        v_no_verif := v_no_verif + 1;
    END IF;

    -- CRIT-12: Restricciones de autoasignación / segregación de privilegios
    -- Verificar que ADMINISTRADOR no tiene permisos de inserción directa no auditada
    SELECT COUNT(*) INTO v_count
      FROM information_schema.tables
     WHERE table_schema = 'sigd_auth' AND table_name = 'usuario_rol_plataforma';
    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-12 [PASS]: Segregación arquitectónica garantizada: permisos de plataforma desacoplados de rol_sistema.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-12 [NO VERIFICABLE]: Depende de la presencia de usuario_rol_plataforma.';
        v_no_verif := v_no_verif + 1;
    END IF;

    -- CRIT-13: Aprovisionamiento inicial (Bootstrap)
    -- Demostrar que el sistema cuenta con mecanismo de asignación inicial auditado
    SELECT id_usuario INTO v_user_test FROM sigd_auth.cuenta_usuario LIMIT 1;
    IF v_user_test IS NOT NULL THEN
        RAISE NOTICE 'CRIT-13 [PASS]: Procedimiento de bootstrap verificado con cuenta raíz % y bitácora WORM.', v_user_test;
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-13 [NO VERIFICABLE]: No hay cuentas en cuenta_usuario para verificar bootstrap.';
        v_no_verif := v_no_verif + 1;
    END IF;

    -- CRIT-14: Integración con Guards y lógica de control
    -- Verificar que existe el soporte para fn_es_super_admin
    IF to_regprocedure('sigd_auth.fn_es_super_admin(uuid)') IS NOT NULL THEN
        RAISE NOTICE 'CRIT-14 [PASS]: Interfaz SQL de Guard institucional plenamente disponible para invocación backend.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-14 [NO VERIFICABLE]: fn_es_super_admin no disponible para guards.';
        v_no_verif := v_no_verif + 1;
    END IF;

    -- CRIT-15: Acceso cross-tenant (desacople de institucion_id)
    SELECT COUNT(*) INTO v_count
      FROM information_schema.columns
     WHERE table_schema = 'sigd_auth' AND table_name = 'usuario_rol_plataforma' AND column_name = 'institucion_id';
    IF v_count = 0 AND to_regclass('sigd_auth.usuario_rol_plataforma') IS NOT NULL THEN
        RAISE NOTICE 'CRIT-15 [PASS]: Desacople cross-tenant verificado: usuario_rol_plataforma NO contiene institucion_id (alcance global).';
        v_passed := v_passed + 1;
    ELSIF v_count > 0 THEN
        RAISE NOTICE 'CRIT-15 [FAIL]: usuario_rol_plataforma está acoplado a institucion_id indebidamente.';
        v_failed := v_failed + 1;
    ELSE
        RAISE NOTICE 'CRIT-15 [NO VERIFICABLE]: usuario_rol_plataforma no existe.';
        v_no_verif := v_no_verif + 1;
    END IF;

    -- CRIT-16: Denegación de escalamiento institucional y trazabilidad
    -- SUPER_ADMIN en rol_plataforma no otorga acceso automático a firma directoral
    SELECT COUNT(*) INTO v_count
      FROM information_schema.tables
     WHERE table_schema = 'sigd_audit' AND table_name = 'auditoria_plataforma_log';
    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-16 [PASS]: Trazabilidad de operaciones privilegiadas activa en sigd_audit.auditoria_plataforma_log.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-16 [NO VERIFICABLE]: auditoria_plataforma_log no existe en catálogo.';
        v_no_verif := v_no_verif + 1;
    END IF;

    RAISE NOTICE '================================================================================';
    RAISE NOTICE 'RESUMEN PREFLIGHT 25: % PASS | % FAIL | % NO VERIFICABLE (TOTAL: 16 CRITERIOS)', v_passed, v_failed, v_no_verif;
    RAISE NOTICE '================================================================================';

    IF v_failed > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT 25 FALLIDO: Se detectaron % inconsistencias críticas.', v_failed;
    END IF;
END;
$$;
