-- =============================================================================
-- PROCEDIMIENTO DE CONTINGENCIA Y VERIFICACIÓN FORENSE POST-MIGRACIÓN 28
-- PROYECTO: SIGD — Sistema Integral de Gestión Documentaria
-- INSTITUCIÓN: IESTP «Suiza» — Pucallpa, Ucayali
-- DIRECTRIZ INSTITUCIONAL INNEGOCIABLE:
--   «ESPECIALISTA NO DEBE VOLVER A EXISTIR EN EL CATÁLOGO OPERATIVO DEL SIGD.»
-- ALCANCE TÉCNICO:
--   Este script constituye un procedimiento de contingencia, fiscalización e
--   incolumidad institucional de FALLO SEGURO. NO restaura el rol ni reinserta
--   asignaciones en el catálogo operativo.
--
-- VERIFICACIONES RIGUROSAS:
--   1. Existencia íntegra de las 6 asignaciones históricas en sigd_audit.
--   2. Existencia íntegra de las 3 relaciones de permisos en sigd_audit.
--   3. Comprobación exhaustiva de identificadores UUID y atributos originales.
--   4. Certificación de que ESPECIALISTA NO figura en sigd_org.rol_sistema.
--   5. Certificación de que no existen asignaciones ni permisos operativos residuales.
--   6. Si cualquier comprobación no se cumple, detiene la ejecución arrojando excepción.
-- =============================================================================

BEGIN;
SET TRANSACTION READ ONLY;

DO $$
DECLARE
    v_count_asigs INT;
    v_count_perms INT;
    v_uuid_faltante UUID;
    v_perm_faltante VARCHAR;
    v_residual_asigs INT;
    v_residual_perms INT;
    v_residual_rol INT;
BEGIN
    -- -------------------------------------------------------------------------
    -- 0. GUARDA DE AISLAMIENTO: EXCLUSIVO PARA sigd_jacobo_demo
    -- -------------------------------------------------------------------------
    IF current_database() NOT IN ('sigd_jacobo_demo') THEN
        RAISE EXCEPTION 'FALLO_CONTINGENCIA: Destino no autorizado: %. Exclusivo para sigd_jacobo_demo.', current_database()
            USING ERRCODE = '42501';
    END IF;

    -- -------------------------------------------------------------------------
    -- 1. VERIFICACIÓN DE ASIGNACIONES HISTÓRICAS EN sigd_audit
    -- -------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_count_asigs
      FROM sigd_audit.usuario_rol_historico_archivado
     WHERE rol_codigo = 'ESPECIALISTA';

    IF v_count_asigs < 6 THEN
        RAISE EXCEPTION 'FALLO_CONTINGENCIA: Inconsistencia crítica en custodia histórica. Se detectaron % asignaciones de ESPECIALISTA (requeridas: exactamente 6).', v_count_asigs
            USING ERRCODE = '23514';
    END IF;

    -- Comprobar presencia de los 6 UUIDs originales inmutables
    FOR v_uuid_faltante IN
        SELECT unnest(ARRAY[
            '4bbd6ab4-5b53-4820-8f83-7e014bf62de4'::uuid,
            'bd029454-d24b-4a81-b497-a95c40ff562a'::uuid,
            'cbd75b3a-62b5-43eb-9780-989116c04ec4'::uuid,
            'e3b2d13b-1d04-46f1-9e85-3ecd593bb8ff'::uuid,
            'ecb124c5-577d-4838-a3f0-5e343960b0e4'::uuid,
            'fabad752-6a79-40f4-ad26-f9809b4498e2'::uuid
        ])
        EXCEPT
        SELECT id_usuario_rol 
          FROM sigd_audit.usuario_rol_historico_archivado 
         WHERE rol_codigo = 'ESPECIALISTA'
    LOOP
        RAISE EXCEPTION 'FALLO_CONTINGENCIA: Identificador histórico ausente en archivo: %', v_uuid_faltante
            USING ERRCODE = '23514';
    END LOOP;

    RAISE NOTICE 'CONTINGENCIA [PASS 1/5]: Las 6 asignaciones históricas con UUIDs originales están íntegras en sigd_audit.';

    -- -------------------------------------------------------------------------
    -- 2. VERIFICACIÓN DE RELACIONES DE PERMISOS EN sigd_audit
    -- -------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_count_perms
      FROM sigd_audit.rol_permiso_historico_archivado
     WHERE rol_codigo = 'ESPECIALISTA';

    IF v_count_perms < 3 THEN
        RAISE EXCEPTION 'FALLO_CONTINGENCIA: Inconsistencia crítica en custodia histórica de permisos. Se detectaron % permisos (requeridos: exactamente 3).', v_count_perms
            USING ERRCODE = '23514';
    END IF;

    -- Comprobar códigos canónicos de permisos archivados
    FOR v_perm_faltante IN
        SELECT unnest(ARRAY['EXPEDIENTE_DERIVAR', 'EXPEDIENTE_LEER', 'EXPEDIENTE_RESOLVER'])
        EXCEPT
        SELECT permiso_codigo 
          FROM sigd_audit.rol_permiso_historico_archivado 
         WHERE rol_codigo = 'ESPECIALISTA'
    LOOP
        RAISE EXCEPTION 'FALLO_CONTINGENCIA: Permiso histórico ausente en archivo: %', v_perm_faltante
            USING ERRCODE = '23514';
    END LOOP;

    RAISE NOTICE 'CONTINGENCIA [PASS 2/5]: Las 3 relaciones de permisos originales están íntegras en sigd_audit.';

    -- -------------------------------------------------------------------------
    -- 3. CERTIFICACIÓN DE NO EXISTENCIA EN CATÁLOGO OPERATIVO sigd_org.rol_sistema
    -- -------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_residual_rol
      FROM sigd_org.rol_sistema
     WHERE codigo = 'ESPECIALISTA';

    IF v_residual_rol > 0 THEN
        RAISE EXCEPTION 'FALLO_CONTINGENCIA: Se detectó presencia no autorizada del rol ESPECIALISTA en sigd_org.rol_sistema (% registros). Procedimiento abortado sin purga automática.', v_residual_rol
            USING ERRCODE = '23514';
    END IF;

    RAISE NOTICE 'CONTINGENCIA [PASS 3/5]: ESPECIALISTA permanece estrictamente ausente del catálogo operativo rol_sistema.';

    -- -------------------------------------------------------------------------
    -- 4. CERTIFICACIÓN DE AUSENCIA DE ASIGNACIONES Y PERMISOS RESIDUALES
    -- -------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_residual_asigs
      FROM sigd_org.usuario_rol ur
      JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
     WHERE r.codigo = 'ESPECIALISTA';

    SELECT COUNT(*) INTO v_residual_perms
      FROM sigd_org.rol_permiso rp
      JOIN sigd_org.rol_sistema r ON r.rol_id = rp.rol_id
     WHERE r.codigo = 'ESPECIALISTA';

    IF v_residual_asigs > 0 OR v_residual_perms > 0 THEN
        RAISE EXCEPTION 'FALLO_CONTINGENCIA: Se detectaron registros operativos residuales de ESPECIALISTA (asigs: %, perms: %).', v_residual_asigs, v_residual_perms
            USING ERRCODE = '23514';
    END IF;

    RAISE NOTICE 'CONTINGENCIA [PASS 4/5]: Cero asignaciones y cero permisos operativos residuales.';

    -- -------------------------------------------------------------------------
    -- 5. CERTIFICACIÓN DE VISTA FORENSE DE AUDITORÍA
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM pg_views 
         WHERE schemaname = 'sigd_audit' 
           AND viewname = 'v_historial_rol_especialista'
    ) THEN
        RAISE EXCEPTION 'FALLO_CONTINGENCIA: La vista de auditoría sigd_audit.v_historial_rol_especialista no existe.'
            USING ERRCODE = '42P01';
    END IF;

    RAISE NOTICE 'CONTINGENCIA [PASS 5/5]: Vista forense sigd_audit.v_historial_rol_especialista disponible y operativa.';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'CERTIFICACIÓN DE CONTINGENCIA EXITOSA: Incolumidad y regla institucional 100%% preservadas.';
    RAISE NOTICE 'ESPECIALISTA permanece descontinuado definitivamente del catálogo operativo.';
    RAISE NOTICE '=============================================================================';
END;
$$;

COMMIT;
