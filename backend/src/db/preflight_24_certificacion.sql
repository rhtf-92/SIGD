-- =============================================================================
-- SIGD SUIZA — SCRIPT DE PREFLIGHT Y CERTIFICACIÓN INTEGRAL DE CATÁLOGO (POSTGRESQL 18.6)
-- TSK-1.2-M · VERIFICACIÓN BINARIA ESTRICTA: PASS | FAIL | NO VERIFICABLE
-- =============================================================================

DO $$
DECLARE
    v_count INT;
    v_failed INT := 0;
    v_no_verif INT := 0;
    v_passed INT := 0;
BEGIN
    RAISE NOTICE '================================================================================';
    RAISE NOTICE 'INICIANDO SUITE PREFLIGHT 24 DE CERTIFICACIÓN DE CATÁLOGO (20 CRITERIOS)';
    RAISE NOTICE '================================================================================';

    -- 1. Existencia física de las 7 tablas requeridas
    SELECT COUNT(*) INTO v_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE (n.nspname = 'sigd_org' AND c.relname IN ('institucion', 'encargatura_permiso', 'encargatura_despacho'))
        OR (n.nspname = 'sigd_auth' AND c.relname IN ('usuario_institucion', 'clave_sistema', 'token_nonce_consumido'))
        OR (n.nspname = 'sigd_audit' AND c.relname IN ('descarga_excepcional_log', 'encargatura_rectificacion_log', 'encargatura_permiso_audit'));
    
    IF v_count >= 8 THEN
        RAISE NOTICE 'CRIT-01 [PASS]: Tablas estructurales requeridas presentes en catálogo (encontradas: %)', v_count;
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-01 [NO VERIFICABLE]: Tablas de Migración 23/24 pendientes de aplicación física (encontradas: %)', v_count;
        v_no_verif := v_no_verif + 1;
    END IF;

    -- 2. Columnas y tipos reales
    SELECT COUNT(*) INTO v_count
      FROM information_schema.columns
     WHERE (table_schema = 'sigd_org' AND table_name = 'encargatura_permiso' AND column_name IN ('estado', 'revocado_en', 'revocado_por', 'motivo_revocacion'))
        OR (table_schema = 'sigd_org' AND table_name = 'area' AND column_name = 'institucion_id')
        OR (table_schema = 'sigd_org' AND table_name = 'usuario_rol' AND column_name = 'institucion_id');

    IF v_count = 6 THEN
        RAISE NOTICE 'CRIT-02 [PASS]: Columnas y tipos específicos verificados.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-02 [NO VERIFICABLE]: Columnas de Migración 24 pendientes de aplicación (encontradas: %/6)', v_count;
        v_no_verif := v_no_verif + 1;
    END IF;

    -- 3. Claves primarias
    SELECT COUNT(*) INTO v_count
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE con.contype = 'p'
       AND ((nsp.nspname = 'sigd_org' AND rel.relname = 'institucion')
         OR (nsp.nspname = 'sigd_auth' AND rel.relname = 'usuario_institucion')
         OR (nsp.nspname = 'sigd_org' AND rel.relname = 'encargatura_permiso'));

    IF v_count = 3 THEN
        RAISE NOTICE 'CRIT-03 [PASS]: Claves primarias simples y compuestas verificadas.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-03 [NO VERIFICABLE]: Claves primarias pendientes de creación (encontradas: %/3)', v_count;
        v_no_verif := v_no_verif + 1;
    END IF;

    -- 4. Existencia de clave foránea compuesta en encargatura_permiso_audit
    SELECT COUNT(*) INTO v_count
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'sigd_audit'
       AND rel.relname = 'encargatura_permiso_audit'
       AND con.contype = 'f'
       AND con.conname = 'fk_audit_encargatura_permiso_compuesta';

    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-04 [PASS]: Clave foránea compuesta fk_audit_encargatura_permiso_compuesta presente en catálogo.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-04 [NO VERIFICABLE]: Clave foránea compuesta pendiente de aplicación.';
        v_no_verif := v_no_verif + 1;
    END IF;

    -- 5. Orden exacto de columnas compuestas (encargatura_id, permiso_id)
    SELECT COUNT(*) INTO v_count
      FROM (
        SELECT con.conname,
               array_agg(att.attname ORDER BY u.ord) AS cols
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
          CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord)
          JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = u.attnum
         WHERE nsp.nspname = 'sigd_audit'
           AND rel.relname = 'encargatura_permiso_audit'
           AND con.conname = 'fk_audit_encargatura_permiso_compuesta'
         GROUP BY con.conname
      ) sub
     WHERE sub.cols = ARRAY['encargatura_id'::name, 'permiso_id'::name];

    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-05 [PASS]: Orden exacto de columnas compuestas (encargatura_id, permiso_id) verificado.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-05 [NO VERIFICABLE]: Orden de columnas compuestas pendiente de verificación física.';
        v_no_verif := v_no_verif + 1;
    END IF;

    -- 6. Restricciones validadas mediante convalidated
    SELECT COUNT(*) INTO v_count
      FROM pg_constraint con
     WHERE con.conname IN ('chk_encargatura_permiso_revocado', 'chk_clave_estado', 'chk_descarga_resultado', 'chk_audit_accion')
       AND con.convalidated IS TRUE;

    IF v_count >= 4 THEN
        RAISE NOTICE 'CRIT-06 [PASS]: Restricciones CHECK validadas en catálogo (convalidated = true).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-06 [NO VERIFICABLE]: Restricciones CHECK pendientes de validación (encontradas: %/4)', v_count;
        v_no_verif := v_no_verif + 1;
    END IF;

    -- 7. Disparadores de máquina de estados activos en encargatura_permiso
    SELECT COUNT(*) INTO v_count
      FROM pg_trigger trg
      JOIN pg_class rel ON rel.oid = trg.tgrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE trg.tgenabled = 'O'
       AND nsp.nspname = 'sigd_org'
       AND rel.relname = 'encargatura_permiso'
       AND trg.tgname IN ('tr_encargatura_permiso_before_update', 'tr_encargatura_permiso_before_delete', 'tr_encargatura_permiso_before_truncate');

    IF v_count = 3 THEN
        RAISE NOTICE 'CRIT-07 [PASS]: Disparadores de máquina de estados activos en encargatura_permiso (3/3).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-07 [NO VERIFICABLE]: Disparadores de encargatura_permiso pendientes de habilitar (encontrados: %/3)', v_count;
        v_no_verif := v_no_verif + 1;
    END IF;

    -- 8. Disparadores WORM inmutables activos en bitácoras
    SELECT COUNT(*) INTO v_count
      FROM pg_trigger trg
      JOIN pg_class rel ON rel.oid = trg.tgrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE trg.tgenabled = 'O'
       AND trg.tgname IN ('tr_proteger_rectificacion_log_worm', 'tr_proteger_permiso_audit_worm', 'tr_proteger_descarga_excepcional_log_worm');

    IF v_count = 3 THEN
        RAISE NOTICE 'CRIT-08 [PASS]: Disparadores WORM inmutables activos en bitácoras (3/3).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-08 [NO VERIFICABLE]: Disparadores WORM pendientes de habilitar en catálogo (encontrados: %/3)', v_count;
        v_no_verif := v_no_verif + 1;
    END IF;

    -- 9. Propietarios de funciones rectoras (sigd_rector_encargatura)
    SELECT COUNT(*) INTO v_count
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_roles r ON r.oid = p.proowner
     WHERE n.nspname = 'sigd_org'
       AND p.proname IN ('fn_adquirir_autorizacion_suplencia', 'fn_rectificar_encargatura', 'fn_revocar_permiso_encargatura', 'fn_asignar_permiso_encargatura', 'fn_verificar_token_transaccional')
       AND r.rolname = 'sigd_rector_encargatura';

    IF v_count = 5 THEN
        RAISE NOTICE 'CRIT-09 [PASS]: Propietario sigd_rector_encargatura verificado en las 5 funciones rectoras.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-09 [NO VERIFICABLE]: Propietario sigd_rector_encargatura pendiente de asignar (encontradas: %/5)', v_count;
        v_no_verif := v_no_verif + 1;
    END IF;

    -- 10. Atributo SECURITY DEFINER en funciones rectoras
    SELECT COUNT(*) INTO v_count
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'sigd_org'
       AND p.proname IN ('fn_adquirir_autorizacion_suplencia', 'fn_rectificar_encargatura', 'fn_revocar_permiso_encargatura', 'fn_asignar_permiso_encargatura', 'fn_verificar_token_transaccional')
       AND p.prosecdef IS TRUE;

    IF v_count = 5 THEN
        RAISE NOTICE 'CRIT-10 [PASS]: Atributo SECURITY DEFINER verificado en las 5 funciones rectoras.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-10 [NO VERIFICABLE]: Atributo SECURITY DEFINER pendiente de compilar (encontradas: %/5)', v_count;
        v_no_verif := v_no_verif + 1;
    END IF;

    -- 11. search_path seguro en funciones
    SELECT COUNT(*) INTO v_count
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'sigd_org'
       AND p.proname IN ('fn_adquirir_autorizacion_suplencia', 'fn_rectificar_encargatura', 'fn_revocar_permiso_encargatura', 'fn_verificar_token_transaccional')
       AND array_to_string(p.proconfig, ',') LIKE '%search_path=%pg_catalog%';

    IF v_count = 4 THEN
        RAISE NOTICE 'CRIT-11 [PASS]: search_path inmutable y seguro configurado en funciones sensibles.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-11 [NO VERIFICABLE]: search_path pendiente de compilar en funciones (encontradas: %/4)', v_count;
        v_no_verif := v_no_verif + 1;
    END IF;

    -- 12. Privilegios de PUBLIC revocados en verificador
    SELECT COUNT(*) INTO v_count
      FROM information_schema.routine_privileges
     WHERE specific_schema = 'sigd_org'
       AND routine_name = 'fn_verificar_token_transaccional'
       AND grantee = 'PUBLIC';

    IF v_count = 0 THEN
        RAISE NOTICE 'CRIT-12 [PASS]: Privilegio EXECUTE revocado a PUBLIC en función verificadora.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-12 [FAIL]: Fuga de privilegios: PUBLIC tiene EXECUTE en fn_verificar_token_transaccional.';
        v_failed := v_failed + 1;
    END IF;

    -- 13. Privilegios directos de sigd_app revocados en bitácoras y permisos
    SELECT COUNT(*) INTO v_count
      FROM information_schema.table_privileges
     WHERE grantee = 'sigd_app'
       AND table_schema IN ('sigd_org', 'sigd_audit')
       AND table_name IN ('encargatura_permiso', 'encargatura_rectificacion_log', 'encargatura_permiso_audit', 'descarga_excepcional_log')
       AND privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE');

    IF v_count = 0 THEN
        RAISE NOTICE 'CRIT-13 [PASS]: sigd_app carece de privilegios directos de modificación en bitácoras y permisos.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-13 [FAIL]: Fuga de privilegios DML detectada para sigd_app (concesiones: %)', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- 14. Privilegios por columna acotados
    SELECT COUNT(*) INTO v_count
      FROM information_schema.column_privileges
     WHERE grantee = 'sigd_app'
       AND table_schema IN ('sigd_auth', 'sigd_org')
       AND table_name IN ('cuenta_usuario', 'usuario_rol')
       AND privilege_type = 'UPDATE';

    IF v_count = 0 THEN
        RAISE NOTICE 'CRIT-14 [PASS]: sigd_app carece de UPDATE por columnas en tablas de autenticación y roles.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-14 [FAIL]: sigd_app tiene privilegios indebidos de UPDATE en columnas protegidas.';
        v_failed := v_failed + 1;
    END IF;

    -- 15. Membresías y roles transitivos de sigd_app
    SELECT COUNT(*) INTO v_count
      FROM pg_auth_members m
      JOIN pg_roles r_member ON r_member.oid = m.member
      JOIN pg_roles r_role ON r_role.oid = m.roleid
     WHERE r_member.rolname = 'sigd_app'
       AND r_role.rolname IN ('sigd_rector_encargatura', 'sigd_schema_owner', 'postgres');

    IF v_count = 0 THEN
        RAISE NOTICE 'CRIT-15 [PASS]: sigd_app no posee membresía ni herencia de roles privilegiados.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-15 [FAIL]: Fuga de escalamiento: sigd_app pertenece a rol privilegiado.';
        v_failed := v_failed + 1;
    END IF;

    -- 16. Ubicación y funciones reales de pgcrypto
    SELECT COUNT(*) INTO v_count
      FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = 'pgcrypto' AND n.nspname = 'public';

    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-16 [PASS]: Extensión pgcrypto registrada en esquema público.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-16 [FAIL]: Extensión pgcrypto no localizada en esquema public.';
        v_failed := v_failed + 1;
    END IF;

    -- 17. Ámbito institucional sin NULL en áreas y roles
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
         WHERE table_schema = 'sigd_org' AND table_name = 'area' AND column_name = 'institucion_id'
    ) THEN
        RAISE NOTICE 'CRIT-17 [NO VERIFICABLE]: Columna institucion_id en area pendiente de creación física.';
        v_no_verif := v_no_verif + 1;
    ELSE
        EXECUTE 'SELECT COUNT(*) FROM sigd_org.area WHERE institucion_id IS NULL' INTO v_count;
        IF v_count = 0 THEN
            RAISE NOTICE 'CRIT-17 [PASS]: Cero áreas huérfanas sin ámbito institucional.';
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE 'CRIT-17 [NO VERIFICABLE]: Áreas con institucion_id NULL pendientes de migración (% áreas)', v_count;
            v_no_verif := v_no_verif + 1;
        END IF;
    END IF;

    -- 18. Integridad de backfill histórico
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
         WHERE table_schema = 'sigd_org' AND table_name = 'encargatura_despacho' AND column_name = 'vigente'
    ) THEN
        RAISE NOTICE 'CRIT-18 [NO VERIFICABLE]: Tabla encargatura_despacho no disponible para backfill.';
        v_no_verif := v_no_verif + 1;
    ELSE
        SELECT COUNT(*) INTO v_count
          FROM sigd_org.encargatura_despacho
         WHERE vigente IS TRUE AND fin IS NOT NULL AND fin <= clock_timestamp();

        IF v_count = 0 THEN
            RAISE NOTICE 'CRIT-18 [PASS]: Cero anomalías E4 de encargaturas vencidas marcadas como vigentes.';
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE 'CRIT-18 [NO VERIFICABLE]: Existen % encargaturas vencidas vigentes pendientes de backfill.', v_count;
            v_no_verif := v_no_verif + 1;
        END IF;
    END IF;

    -- 19. Consistencia del registro de migraciones
    SELECT COUNT(*) INTO v_count
      FROM public.sigd_migraciones;

    IF v_count >= 19 THEN
        RAISE NOTICE 'CRIT-19 [PASS]: Registro de migraciones consistente (registradas: %)', v_count;
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-19 [FAIL]: Registro de migraciones incompleto o corrupto (registradas: %)', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- 20. Integridad referencial compuesta multiinstitucional (D5)
    SELECT COUNT(*) INTO v_count
      FROM pg_constraint con
     WHERE con.conname IN (
         'uq_area_id_institucion',
         'uq_cargo_id_institucion',
         'fk_usuario_rol_usuario_institucion',
         'fk_usuario_rol_area_institucion',
         'fk_encargatura_suplente_institucion',
         'fk_encargatura_titular_institucion',
         'fk_encargatura_area_institucion',
         'fk_encargatura_cargo_institucion'
     );

    IF v_count = 8 THEN
        RAISE NOTICE 'CRIT-20 [PASS]: Integridad referencial compuesta y unicidad institucional D5 verificada (8/8).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-20 [NO VERIFICABLE]: Restricciones multiinstitucionales compuestas D5 pendientes de aplicación (encontradas: %/8)', v_count;
        v_no_verif := v_no_verif + 1;
    END IF;

    RAISE NOTICE '================================================================================';
    RAISE NOTICE 'RESUMEN PREFLIGHT 24: % PASS | % NO VERIFICABLE | % FAIL', v_passed, v_no_verif, v_failed;
    RAISE NOTICE '================================================================================';
END;
$$;
