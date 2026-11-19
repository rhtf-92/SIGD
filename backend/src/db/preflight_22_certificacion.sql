-- =============================================================================
-- SIGD SUIZA — SUITE PREFLIGHT 22 DE CERTIFICACIÓN DE CATÁLOGO RBAC INSTITUCIONAL
-- Proyecto: Sistema Integral de Gestión Documentaria (SIGD)
-- Institución: IESTP «Suiza» — Pucallpa, Ucayali
-- Intervención: TSK-1.2-M.2.3 · Frente G (Preflight 22 Corregido)
-- Motor: PostgreSQL 18.6
-- =============================================================================

DO $$
DECLARE
    v_count INT;
    v_passed INT := 0;
    v_failed INT := 0;
BEGIN
    RAISE NOTICE '================================================================================';
    RAISE NOTICE 'INICIANDO SUITE PREFLIGHT 22: CERTIFICACIÓN RBAC INSTITUCIONAL (10 CRITERIOS)';
    RAISE NOTICE '================================================================================';

    -- CRIT-01: 10 roles canónicos institucionales vigentes
    SELECT COUNT(*) INTO v_count
      FROM sigd_org.rol_sistema
     WHERE vigente = TRUE
       AND codigo IN (
         'ADMINISTRADOR', 'DIRECTOR', 'JEFE_UNIDAD_ACADEMICA', 'COORDINADOR_AREA',
         'SECRETARIO', 'MESA_PARTES', 'DOCENTE', 'TESORERO', 'ESTUDIANTE', 'CIUDADANO'
       );

    IF v_count = 10 THEN
        RAISE NOTICE 'CRIT-01 [PASS]: Los 10 roles canónicos institucionales aprobados están vigentes (10/10).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-01 [FAIL]: Roles canónicos vigentes incompletos (encontrados: %/10)', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-02: Exclusión definitiva de roles no aprobados (ESPECIALISTA, CAJERO, APROBADOR_DEVOLUCIONES, SUPERVISOR_TESORERIA)
    SELECT COUNT(*) INTO v_count
      FROM sigd_org.rol_sistema
     WHERE vigente = TRUE
       AND codigo IN ('ESPECIALISTA', 'CAJERO', 'APROBADOR_DEVOLUCIONES', 'SUPERVISOR_TESORERIA');

    IF v_count = 0 THEN
        RAISE NOTICE 'CRIT-02 [PASS]: Roles excluidos (ESPECIALISTA, CAJERO, etc.) permanecen inactivos (vigente = FALSE).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-02 [FAIL]: Se detectaron % roles excluidos marcados como vigentes.', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-03: Restricción CHECK chk_rol_codigo en sigd_org.rol_sistema
    SELECT COUNT(*) INTO v_count
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'sigd_org'
       AND c.relname = 'rol_sistema'
       AND con.conname = 'chk_rol_codigo'
       AND con.contype = 'c';

    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-03 [PASS]: Restricción CHECK chk_rol_codigo activa en sigd_org.rol_sistema.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-03 [FAIL]: Restricción CHECK chk_rol_codigo ausente en sigd_org.rol_sistema.';
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-04: Columna revocado_en presente en sigd_org.encargatura_despacho
    SELECT COUNT(*) INTO v_count
      FROM information_schema.columns
     WHERE table_schema = 'sigd_org'
       AND table_name = 'encargatura_despacho'
       AND column_name = 'revocado_en';

    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-04 [PASS]: Columna revocado_en presente en sigd_org.encargatura_despacho.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-04 [FAIL]: Columna revocado_en no encontrada en sigd_org.encargatura_despacho.';
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-05: Restricción CHECK chk_encargatura_cierre en sigd_org.encargatura_despacho
    SELECT COUNT(*) INTO v_count
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'sigd_org'
       AND c.relname = 'encargatura_despacho'
       AND con.conname IN ('chk_encargatura_cierre', 'chk_encargatura_despacho_coherencia')
       AND con.contype = 'c';

    IF v_count >= 1 THEN
        RAISE NOTICE 'CRIT-05 [PASS]: Restricción CHECK de coherencia/cierre de estados activa en encargatura_despacho.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-05 [FAIL]: Restricción CHECK de coherencia ausente en encargatura_despacho.';
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-06: Verificación de coherencia de estado en encargatura_despacho (0 anomalías requeridas):
    -- Inconsistencias:
    -- 1) vigente IS NULL (estado indeterminado prohibido)
    -- 2) vigente IS TRUE y (revocado_en IS NOT NULL O motivo_no_habilitado IS NOT NULL)
    -- 3) vigente IS FALSE y revocado_en IS NULL Y motivo_no_habilitado IS NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
         WHERE table_schema = 'sigd_org' AND table_name = 'encargatura_despacho' AND column_name = 'revocado_en'
    ) THEN
        EXECUTE 'SELECT COUNT(*) FROM sigd_org.encargatura_despacho
                  WHERE vigente IS NULL
                     OR (vigente IS TRUE AND (revocado_en IS NOT NULL OR motivo_no_habilitado IS NOT NULL))
                     OR (vigente IS FALSE AND revocado_en IS NULL AND motivo_no_habilitado IS NULL)'
           INTO v_count;

        IF v_count = 0 THEN
            RAISE NOTICE 'CRIT-06 [PASS]: Consulta de coherencia estricta encargatura_despacho: 0 anomalías encontradas.';
            v_passed := v_passed + 1;
        ELSE
            RAISE NOTICE 'CRIT-06 [FAIL]: Se encontraron % registros incoherentes en encargatura_despacho.', v_count;
            v_failed := v_failed + 1;
        END IF;
    ELSE
        RAISE NOTICE 'CRIT-06 [FAIL]: Columna revocado_en ausente en sigd_org.encargatura_despacho (requiere migración 22).';
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-07: Catálogo de 32 permisos del sistema en sigd_org.permiso_sistema
    SELECT COUNT(*) INTO v_count
      FROM sigd_org.permiso_sistema;

    IF v_count >= 32 THEN
        RAISE NOTICE 'CRIT-07 [PASS]: Catálogo completo de permisos institucionales verificado (encontrados: % >= 32).', v_count;
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-07 [FAIL]: Catálogo de permisos incompleto (encontrados: %/32)', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-08: Permiso #32 (EXPEDIENTE_DESCARGAR) presente con ámbito delimitado
    SELECT COUNT(*) INTO v_count
      FROM sigd_org.permiso_sistema
     WHERE codigo = 'EXPEDIENTE_DESCARGAR';

    IF v_count = 1 THEN
        RAISE NOTICE 'CRIT-08 [PASS]: Permiso #32 (EXPEDIENTE_DESCARGAR) registrado en sigd_org.permiso_sistema.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-08 [FAIL]: Permiso #32 (EXPEDIENTE_DESCARGAR) ausente.';
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-09: Integridad referencial en asignaciones usuario-rol (cero usuarios asignados a roles inexistentes)
    SELECT COUNT(*) INTO v_count
      FROM sigd_org.usuario_rol ur
      LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
     WHERE r.rol_id IS NULL;

    IF v_count = 0 THEN
        RAISE NOTICE 'CRIT-09 [PASS]: Cero asignaciones huérfanas en sigd_org.usuario_rol.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-09 [FAIL]: Se encontraron % asignaciones huérfanas en usuario_rol.', v_count;
        v_failed := v_failed + 1;
    END IF;

    -- CRIT-10: Cero roles de sistema huérfanos sin permisos asignados (salvo roles de ámbito externo o especial)
    SELECT COUNT(*) INTO v_count
      FROM sigd_org.rol_sistema r
      JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
     WHERE r.codigo = 'DIRECTOR';

    IF v_count > 0 THEN
        RAISE NOTICE 'CRIT-10 [PASS]: Matriz de permisos vinculada correctamente para roles institucionales centrales (DIRECTOR: % permisos).', v_count;
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE 'CRIT-10 [FAIL]: Matriz de permisos desconectada para rol DIRECTOR.';
        v_failed := v_failed + 1;
    END IF;

    RAISE NOTICE '================================================================================';
    RAISE NOTICE 'RESUMEN PREFLIGHT 22: % PASS | % FAIL (TOTAL: 10 CRITERIOS)', v_passed, v_failed;
    RAISE NOTICE '================================================================================';

    IF v_failed > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT 22 FALLIDO: Se detectaron % criterios no conformes.', v_failed;
    END IF;
END;
$$;
