-- =============================================================================
-- MIGRACIÓN 27: CONCILIACIÓN DE SEGURIDAD PLATFORM RBAC Y ALINEACIÓN DE ESQUEMA
-- PROYECTO: SIGD — Sistema Integral de Gestión Documentaria
-- INSTITUCIÓN: IESTP «Suiza» — Pucallpa, Ucayali
-- INTERVENCIÓN: TSK-1.2-M.2.3.1 (Frente B y Compatibilidad Arquitectónica)
-- OBJETIVO:
--   1. Corrección del predicado en sigd_auth.fn_asignar_rol_plataforma (vigente = TRUE).
--   2. Columna generada de compatibilidad 'activo' en sigd_auth.rol_plataforma.
--   3. Re-afirmación de privilegios SECURITY DEFINER y aislamiento WORM.
-- =============================================================================

-- 1. Compatibilidad de columnas en catálogo de roles de plataforma
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'sigd_auth'
           AND table_name = 'rol_plataforma'
           AND column_name = 'activo'
    ) THEN
        ALTER TABLE sigd_auth.rol_plataforma
            ADD COLUMN activo BOOLEAN GENERATED ALWAYS AS (vigente) STORED;
    END IF;
END;
$$;

-- 2. Corrección canónica de función SECURITY DEFINER para asignación de roles
CREATE OR REPLACE FUNCTION sigd_auth.fn_asignar_rol_plataforma(
    p_actor_id UUID,
    p_target_user_id UUID,
    p_rol_plataforma VARCHAR(30),
    p_motivo_justificacion TEXT,
    p_es_break_glass BOOLEAN DEFAULT FALSE,
    p_break_glass_hash VARCHAR(64) DEFAULT NULL,
    p_ip_origen INET DEFAULT NULL,
    p_user_agent VARCHAR(512) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, sigd_auth, sigd_audit, public
AS $$
DECLARE
    v_correlation_id UUID := gen_random_uuid();
    v_count_super_admins INT;
    v_target_activo BOOLEAN;
    v_datos_antes JSONB;
    v_datos_despues JSONB;
BEGIN
    -- 1. Validar parámetros básicos
    IF p_target_user_id IS NULL THEN
        RAISE EXCEPTION 'PARAMETRO_INVALIDO: p_target_user_id no puede ser nulo.' USING ERRCODE = '23502';
    END IF;
    IF p_motivo_justificacion IS NULL OR length(trim(p_motivo_justificacion)) < 15 THEN
        RAISE EXCEPTION 'MOTIVO_INVALIDO: El motivo de justificación debe contener al menos 15 caracteres para auditoría WORM.' USING ERRCODE = '23514';
    END IF;

    -- 2. Validar que el rol existe en el catálogo de plataforma (usando vigente)
    IF NOT EXISTS (SELECT 1 FROM sigd_auth.rol_plataforma WHERE codigo = p_rol_plataforma AND vigente = TRUE) THEN
        RAISE EXCEPTION 'ROL_INVALIDO: El rol de plataforma "%" no existe o no está vigente.', p_rol_plataforma USING ERRCODE = '23503';
    END IF;

    -- 3. Validar existencia y estado de la cuenta objetivo
    SELECT activo INTO v_target_activo FROM sigd_auth.cuenta_usuario WHERE id_usuario = p_target_user_id;
    IF v_target_activo IS NULL THEN
        RAISE EXCEPTION 'USUARIO_NO_EXISTE: El usuario objetivo no existe en sigd_auth.cuenta_usuario.' USING ERRCODE = '23503';
    END IF;
    IF v_target_activo IS FALSE THEN
        RAISE EXCEPTION 'USUARIO_INACTIVO: No se puede asignar rol de plataforma a una cuenta inactiva.' USING ERRCODE = '23514';
    END IF;

    -- 4. Contar super admins actualmente vigentes
    SELECT COUNT(*) INTO v_count_super_admins
      FROM sigd_auth.usuario_rol_plataforma urp
      JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = urp.id_usuario
     WHERE urp.rol_plataforma = 'SUPER_ADMIN'
       AND cu.activo = TRUE
       AND urp.vigente_desde <= clock_timestamp()
       AND (urp.vigente_hasta IS NULL OR urp.vigente_hasta > clock_timestamp());

    -- 5. Control de Autorización y Segregación
    IF p_es_break_glass THEN
        -- Caso A: Primer aprovisionamiento (bootstrap inicial donde total vigentes es 0)
        IF v_count_super_admins = 0 THEN
            NULL;
        ELSE
            -- Caso B: Recuperación de emergencia con token/hash maestro
            IF p_break_glass_hash IS NULL OR length(trim(p_break_glass_hash)) < 10 THEN
                RAISE EXCEPTION 'BREAK_GLASS_RECHAZADO: Se requiere clave o hash válido para activar el procedimiento de emergencia.' USING ERRCODE = '42501';
            END IF;
        END IF;
    ELSE
        -- Modo Ordinario: Requiere actor autenticado con rol SUPER_ADMIN activo
        IF p_actor_id IS NULL THEN
            RAISE EXCEPTION 'ACTOR_REQUERIDO: Las operaciones ordinarias de Platform RBAC exigen identificación del actor.' USING ERRCODE = '42501';
        END IF;
        IF NOT sigd_auth.fn_es_super_admin(p_actor_id) THEN
            RAISE EXCEPTION 'AUTORIZACION_DENEGADA: El actor no posee el rol SUPER_ADMIN activo.' USING ERRCODE = '42501';
        END IF;
        -- Control Anti-Autoconcesión estricto
        IF p_actor_id = p_target_user_id THEN
            RAISE EXCEPTION 'ANTI_AUTOCONCESION: Prohibición estricta de auto-atribución de privilegios de plataforma.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 6. Obtener datos antes
    SELECT to_jsonb(urp.*) INTO v_datos_antes
      FROM sigd_auth.usuario_rol_plataforma urp
     WHERE urp.id_usuario = p_target_user_id AND urp.rol_plataforma = p_rol_plataforma;

    -- 7. Insertar o Reactivar asignación de forma atómica
    INSERT INTO sigd_auth.usuario_rol_plataforma (
        id_usuario,
        rol_plataforma,
        asignado_por,
        vigente_desde,
        vigente_hasta
    ) VALUES (
        p_target_user_id,
        p_rol_plataforma,
        COALESCE(p_actor_id, p_target_user_id),
        clock_timestamp(),
        NULL
    )
    ON CONFLICT (id_usuario, rol_plataforma) DO UPDATE SET
        vigente_desde = clock_timestamp(),
        vigente_hasta = NULL,
        asignado_por = COALESCE(p_actor_id, p_target_user_id);

    -- 8. Obtener datos después
    SELECT to_jsonb(urp.*) INTO v_datos_despues
      FROM sigd_auth.usuario_rol_plataforma urp
     WHERE urp.id_usuario = p_target_user_id AND urp.rol_plataforma = p_rol_plataforma;

    -- 9. Inserción WORM obligatoria
    INSERT INTO sigd_audit.auditoria_plataforma_log (
        correlation_id,
        actor_id,
        operacion,
        entidad_tipo,
        entidad_id,
        datos_antes,
        datos_despues,
        motivo_justificacion,
        ip_origen,
        user_agent
    ) VALUES (
        v_correlation_id,
        COALESCE(p_actor_id, p_target_user_id),
        CASE WHEN p_es_break_glass THEN 'ASIGNACION_SUPER_ADMIN_BREAK_GLASS' ELSE 'ASIGNACION_SUPER_ADMIN' END,
        'usuario_rol_plataforma',
        p_target_user_id::text,
        v_datos_antes,
        v_datos_despues,
        trim(p_motivo_justificacion),
        p_ip_origen,
        COALESCE(p_user_agent, 'SIGD-Platform/PostgreSQL-SecurityDefiner')
    );

    RETURN v_correlation_id;
END;
$$;

-- 3. Privilegios de ejecución
REVOKE ALL ON FUNCTION sigd_auth.fn_asignar_rol_plataforma(UUID, UUID, VARCHAR, TEXT, BOOLEAN, VARCHAR, INET, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sigd_auth.fn_asignar_rol_plataforma(UUID, UUID, VARCHAR, TEXT, BOOLEAN, VARCHAR, INET, VARCHAR) TO sigd_app;

-- 4. Registro de auditoría WORM para la migración
DO $$
DECLARE
    v_root_user UUID;
BEGIN
    SELECT id_usuario INTO v_root_user FROM sigd_auth.cuenta_usuario WHERE activo = TRUE ORDER BY id_usuario ASC LIMIT 1;
    IF v_root_user IS NOT NULL THEN
        INSERT INTO sigd_audit.auditoria_plataforma_log (
            correlation_id,
            actor_id,
            operacion,
            entidad_tipo,
            entidad_id,
            datos_antes,
            datos_despues,
            motivo_justificacion,
            ip_origen,
            user_agent
        ) VALUES (
            'c0a80101-0027-4000-8000-000000000027'::uuid,
            v_root_user,
            'REMEDIACION_SECURITY_DEFINER_PLATFORM_RBAC',
            'funciones_plataforma',
            'sigd_auth.fn_asignar_rol_plataforma',
            jsonb_build_object('estado_anterior', 'predicado_activo_incompatible'),
            jsonb_build_object('estado_nuevo', 'predicado_vigente_con_columna_generada_activo', 'migracion', '27_sigd_conciliacion_seguridad_platform_rbac.sql'),
            'Remediación canónica de función SECURITY DEFINER para asignación de roles de plataforma bajo TSK-1.2-M.2.3.1.',
            '127.0.0.1'::inet,
            'SIGD-DDL-Runner/Migracion-27'
        );
    END IF;
END;
$$;
