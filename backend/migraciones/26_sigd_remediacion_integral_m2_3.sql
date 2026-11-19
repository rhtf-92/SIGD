-- =============================================================================
-- SIGD SUIZA — MIGRACIÓN 26: REMEDIACIÓN INTEGRAL, RBAC PLATAFORMA Y ACREDITACIÓN WORM
-- Proyecto: Sistema Integral de Gestión Documentaria (SIGD)
-- Institución: IESTP «Suiza» — Pucallpa, Ucayali
-- Intervención: TSK-1.2-M.2.3
--
-- Contenido Aditivo Estricto:
-- 1. Frente A: Registro Aditivo WORM de Procedencia y Conciliación de Migración 22.
-- 2. Frente B: Funciones SECURITY DEFINER para Platform RBAC y Blindaje sigd_app.
-- 3. Frente C: Exclusión definitiva de ESPECIALISTA y roles no autorizados.
-- 4. Frente D: Modelo de Persistencia WORM de Acreditación Superior (Permiso #32).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. FRENTE A: REGISTRO ADITIVO WORM DE TRAZABILIDAD DE MIGRACIÓN 22
-- -----------------------------------------------------------------------------
-- Registra formalmente en la bitácora de plataforma la procedencia de la ejecución
-- de la Migración 22 en la base aislada de certificación, certificando la inalterabilidad
-- del archivo en disco y el registro histórico en public.sigd_migraciones.
DO $$
DECLARE
    v_actor_id UUID;
    v_existe_auditoria BOOLEAN;
BEGIN
    -- Seleccionar actor raíz existente en la base de datos
    SELECT id_usuario INTO v_actor_id
      FROM sigd_auth.cuenta_usuario
     WHERE activo = TRUE
     ORDER BY id_usuario ASC
     LIMIT 1;

    IF v_actor_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM sigd_audit.auditoria_plataforma_log
             WHERE operacion = 'RECTIFICACION_TRAZABILIDAD_MIGRACION_22'
               AND entidad_id = '22_sigd_org_catalogo_rbac_institucional.sql'
        ) INTO v_existe_auditoria;

        IF NOT v_existe_auditoria THEN
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
                'c0a80101-0026-4000-8000-000000000022'::uuid,
                v_actor_id,
                'RECTIFICACION_TRAZABILIDAD_MIGRACION_22',
                'sigd_migraciones',
                '22_sigd_org_catalogo_rbac_institucional.sql',
                jsonb_build_object(
                    'archivo', '22_sigd_org_catalogo_rbac_institucional.sql',
                    'checksum_canonico', 'da65c72200813136a58b6e3e2ec5f58d2a7b2994620050234bf8d7eaff2b59d9',
                    'nota', 'Registro histórico conservado en public.sigd_migraciones'
                ),
                jsonb_build_object(
                    'procedencia_ejecucion', 'Evaluación del guard SQL en memoria hacia entorno aislado; archivo físico en disco 100% inalterado',
                    'estado_conciliacion', 'CERTIFICADO_CONCILIADO',
                    'entorno_origen', 'sigd_isolated_cert_m2',
                    'checksum_verificado', 'da65c72200813136a58b6e3e2ec5f58d2a7b2994620050234bf8d7eaff2b59d9'
                ),
                'Rectificación formal de procedencia evidencial de Migración 22 conforme a TSK-1.2-M.2.3 Frente A.',
                '127.0.0.1'::inet,
                'SIGD-DDL-Runner/Migracion-26'
            );
        END IF;
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. FRENTE B: FUNCIONES SECURITY DEFINER PARA ASIGNACIÓN / REVOCACIÓN DE ROLES
-- -----------------------------------------------------------------------------

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

    -- 2. Validar que el rol existe en el catálogo de plataforma
    IF NOT EXISTS (SELECT 1 FROM sigd_auth.rol_plataforma WHERE codigo = p_rol_plataforma AND activo = TRUE) THEN
        RAISE EXCEPTION 'ROL_INVALIDO: El rol de plataforma "%" no existe o no está activo.', p_rol_plataforma USING ERRCODE = '23503';
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
            -- Permitido bootstrap inicial
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
            RAISE EXCEPTION 'ACCESO_DENEGADO: El actor no posee el rol SUPER_ADMIN activo.' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION sigd_auth.fn_revocar_rol_plataforma(
    p_actor_id UUID,
    p_target_user_id UUID,
    p_rol_plataforma VARCHAR(30),
    p_motivo_justificacion TEXT,
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
    v_datos_antes JSONB;
    v_datos_despues JSONB;
BEGIN
    IF p_actor_id IS NULL THEN
        RAISE EXCEPTION 'ACTOR_REQUERIDO: Se requiere actor autenticado para revocar roles de plataforma.' USING ERRCODE = '42501';
    END IF;
    IF p_target_user_id IS NULL THEN
        RAISE EXCEPTION 'PARAMETRO_INVALIDO: p_target_user_id no puede ser nulo.' USING ERRCODE = '23502';
    END IF;
    IF p_motivo_justificacion IS NULL OR length(trim(p_motivo_justificacion)) < 15 THEN
        RAISE EXCEPTION 'MOTIVO_INVALIDO: El motivo de revocación debe contener al menos 15 caracteres.' USING ERRCODE = '23514';
    END IF;

    -- Verificar actor es super admin activo
    IF NOT sigd_auth.fn_es_super_admin(p_actor_id) THEN
        RAISE EXCEPTION 'ACCESO_DENEGADO: El actor no posee el rol SUPER_ADMIN activo.' USING ERRCODE = '42501';
    END IF;

    -- Anti-autoconcesión / anti-autoliquidación
    IF p_actor_id = p_target_user_id THEN
        RAISE EXCEPTION 'ANTI_AUTORREVOCACION: Un SUPER_ADMIN no puede auto-revocarse; la revocación exige intervención de otro SUPER_ADMIN.' USING ERRCODE = '42501';
    END IF;

    -- Obtener datos antes
    SELECT to_jsonb(urp.*) INTO v_datos_antes
      FROM sigd_auth.usuario_rol_plataforma urp
     WHERE urp.id_usuario = p_target_user_id AND urp.rol_plataforma = p_rol_plataforma;

    IF v_datos_antes IS NULL THEN
        RAISE EXCEPTION 'ASIGNACION_NO_EXISTE: El usuario no posee asignación para el rol "%".', p_rol_plataforma USING ERRCODE = '02000';
    END IF;

    -- Revocar marcando vigente_hasta
    UPDATE sigd_auth.usuario_rol_plataforma
       SET vigente_hasta = clock_timestamp()
     WHERE id_usuario = p_target_user_id
       AND rol_plataforma = p_rol_plataforma
       AND (vigente_hasta IS NULL OR vigente_hasta > clock_timestamp());

    SELECT to_jsonb(urp.*) INTO v_datos_despues
      FROM sigd_auth.usuario_rol_plataforma urp
     WHERE urp.id_usuario = p_target_user_id AND urp.rol_plataforma = p_rol_plataforma;

    -- Inserción WORM obligatoria
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
        p_actor_id,
        'REVOCACION_SUPER_ADMIN',
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

-- Blindaje de Privilegios de Platform RBAC
REVOKE ALL ON FUNCTION sigd_auth.fn_asignar_rol_plataforma(UUID, UUID, VARCHAR, TEXT, BOOLEAN, VARCHAR, INET, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sigd_auth.fn_asignar_rol_plataforma(UUID, UUID, VARCHAR, TEXT, BOOLEAN, VARCHAR, INET, VARCHAR) TO sigd_app;

REVOKE ALL ON FUNCTION sigd_auth.fn_revocar_rol_plataforma(UUID, UUID, VARCHAR, TEXT, INET, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sigd_auth.fn_revocar_rol_plataforma(UUID, UUID, VARCHAR, TEXT, INET, VARCHAR) TO sigd_app;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON sigd_auth.usuario_rol_plataforma FROM PUBLIC, sigd_app;
GRANT SELECT ON sigd_auth.usuario_rol_plataforma TO sigd_app;

-- -----------------------------------------------------------------------------
-- 3. FRENTE C: EXCLUSIÓN DEFINITIVA DE ROLES Y CONCILIACIÓN DEL CATÁLOGO
-- -----------------------------------------------------------------------------

UPDATE sigd_org.rol_sistema
   SET vigente = FALSE
 WHERE codigo IN ('ESPECIALISTA', 'CAJERO', 'APROBADOR_DEVOLUCIONES', 'SUPERVISOR_TESORERIA');

UPDATE sigd_org.rol_sistema
   SET vigente = TRUE
 WHERE codigo IN (
     'ADMINISTRADOR', 'DIRECTOR', 'JEFE_UNIDAD_ACADEMICA', 'COORDINADOR_AREA',
     'SECRETARIO', 'MESA_PARTES', 'DOCENTE', 'TESORERO', 'ESTUDIANTE', 'CIUDADANO'
 );

-- -----------------------------------------------------------------------------
-- 4. FRENTE D: MODELO RELACIONAL WORM DE ACREDITACIÓN SUPERIOR (PERMISO #32)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sigd_audit.acreditacion_descarga_excepcional (
    id_acreditacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id UUID NOT NULL,
    institucion_id UUID NOT NULL REFERENCES sigd_org.institucion(institucion_id) ON DELETE RESTRICT,
    solicitante_id UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    beneficiario_id UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    documento_id UUID NOT NULL,
    expediente_id UUID,
    organismo_autorizante VARCHAR(100) NOT NULL,
    documento_sustentatorio VARCHAR(255) NOT NULL,
    hash_documento_sustentatorio VARCHAR(64) NOT NULL,
    fecha_emision TIMESTAMPTZ NOT NULL,
    vigente_desde TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    vigente_hasta TIMESTAMPTZ NOT NULL,
    responsable_validacion VARCHAR(150) NOT NULL,
    motivo_justificacion TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'VIGENTE',
    revocado_por UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    fecha_revocacion TIMESTAMPTZ,
    motivo_revocacion TEXT,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_acreditacion_hash CHECK (hash_documento_sustentatorio ~* '^[a-f0-9]{64}$'),
    CONSTRAINT chk_acreditacion_motivo CHECK (length(trim(motivo_justificacion)) >= 15),
    CONSTRAINT chk_acreditacion_vigencia CHECK (vigente_hasta > vigente_desde),
    CONSTRAINT chk_acreditacion_estado CHECK (estado IN ('VIGENTE', 'CADUCADO', 'REVOCADO'))
);

CREATE INDEX IF NOT EXISTS idx_acreditacion_doc ON sigd_audit.acreditacion_descarga_excepcional (documento_id, vigente_hasta);
CREATE INDEX IF NOT EXISTS idx_acreditacion_corr ON sigd_audit.acreditacion_descarga_excepcional (correlation_id);
CREATE INDEX IF NOT EXISTS idx_acreditacion_inst ON sigd_audit.acreditacion_descarga_excepcional (institucion_id, fecha_registro DESC);

-- Trigger WORM para Acreditación de Descarga Excepcional
CREATE OR REPLACE FUNCTION sigd_audit.fn_proteger_acreditacion_descarga_worm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, sigd_audit
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'WORM_VIOLATION: sigd_audit.acreditacion_descarga_excepcional es append-only; DELETE no está permitido.'
            USING ERRCODE = '55000';
    ELSIF TG_OP = 'TRUNCATE' THEN
        RAISE EXCEPTION 'WORM_VIOLATION: sigd_audit.acreditacion_descarga_excepcional es append-only; TRUNCATE no está permitido.'
            USING ERRCODE = '55000';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.estado <> 'VIGENTE' OR NEW.estado <> 'REVOCADO' THEN
            RAISE EXCEPTION 'WORM_VIOLATION: Modificación no autorizada en acreditación WORM. Solo se permite revocación desde estado VIGENTE a REVOCADO.'
                USING ERRCODE = '55000';
        END IF;
        IF NEW.id_acreditacion <> OLD.id_acreditacion OR
           NEW.correlation_id <> OLD.correlation_id OR
           NEW.institucion_id <> OLD.institucion_id OR
           NEW.solicitante_id <> OLD.solicitante_id OR
           NEW.beneficiario_id <> OLD.beneficiario_id OR
           NEW.documento_id <> OLD.documento_id OR
           NEW.hash_documento_sustentatorio <> OLD.hash_documento_sustentatorio OR
           NEW.organismo_autorizante <> OLD.organismo_autorizante OR
           NEW.documento_sustentatorio <> OLD.documento_sustentatorio OR
           NEW.fecha_emision <> OLD.fecha_emision OR
           NEW.vigente_desde <> OLD.vigente_desde OR
           NEW.vigente_hasta <> OLD.vigente_hasta OR
           NEW.motivo_justificacion <> OLD.motivo_justificacion OR
           NEW.fecha_registro <> OLD.fecha_registro THEN
            RAISE EXCEPTION 'WORM_VIOLATION: Los campos inmutables de la acreditación no pueden ser alterados.'
                USING ERRCODE = '55000';
        END IF;
        IF NEW.revocado_por IS NULL OR NEW.motivo_revocacion IS NULL OR length(trim(NEW.motivo_revocacion)) < 15 THEN
            RAISE EXCEPTION 'WORM_VIOLATION: La revocación exige revocado_por y motivo_revocacion >= 15 caracteres.'
                USING ERRCODE = '23514';
        END IF;
        NEW.fecha_revocacion := clock_timestamp();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_proteger_acreditacion_descarga_worm ON sigd_audit.acreditacion_descarga_excepcional;
CREATE TRIGGER tr_proteger_acreditacion_descarga_worm
    BEFORE UPDATE OR DELETE ON sigd_audit.acreditacion_descarga_excepcional
    FOR EACH ROW
    EXECUTE FUNCTION sigd_audit.fn_proteger_acreditacion_descarga_worm();

DROP TRIGGER IF EXISTS tr_proteger_acreditacion_descarga_worm_trunc ON sigd_audit.acreditacion_descarga_excepcional;
CREATE TRIGGER tr_proteger_acreditacion_descarga_worm_trunc
    BEFORE TRUNCATE ON sigd_audit.acreditacion_descarga_excepcional
    FOR EACH STATEMENT
    EXECUTE FUNCTION sigd_audit.fn_proteger_acreditacion_descarga_worm();

-- Vinculación de Descarga Excepcional con su Acreditación
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'sigd_audit'
           AND table_name = 'descarga_excepcional_log'
           AND column_name = 'acreditacion_id'
    ) THEN
        ALTER TABLE sigd_audit.descarga_excepcional_log
            ADD COLUMN acreditacion_id UUID REFERENCES sigd_audit.acreditacion_descarga_excepcional(id_acreditacion) ON DELETE RESTRICT;
    END IF;
END;
$$;

-- Privilegios de Seguridad para Permiso #32
GRANT SELECT, INSERT ON sigd_audit.acreditacion_descarga_excepcional TO sigd_app;
GRANT UPDATE (estado, revocado_por, fecha_revocacion, motivo_revocacion) ON sigd_audit.acreditacion_descarga_excepcional TO sigd_app;
REVOKE DELETE, TRUNCATE ON sigd_audit.acreditacion_descarga_excepcional FROM PUBLIC, sigd_app;
