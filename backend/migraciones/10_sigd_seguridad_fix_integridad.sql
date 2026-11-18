-- =============================================================================
-- SIGD - Sistema Integrado de Gestión Documental
-- MIGRACIÓN 10: FIX INTEGRIDAD DE SEGURIDAD Y CREDENCIALES DDL (F-07 / F-08)
--
-- Fecha: 2026-10-23
-- Justificación:
--   - F-07: Corrección de columna en sigd_auth.fn_prevenir_borrado_persona_con_evidencia.
--           Se reemplaza la referencia inexistente 'id_persona_representante'
--           por 'id_persona_natural' según el esquema canónico de sigd_auth.representacion_legal.
--   - F-08: Eliminación de contraseñas estáticas por defecto en roles de base de datos
--           (sigd_app y sigd_worker) creados en migración previa.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. F-07: Corrección de salvaguarda de retención en sigd_auth.persona
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sigd_auth.fn_prevenir_borrado_persona_con_evidencia()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- 1.1 Verificación de expedientes en trámite o históricos
    IF EXISTS (
        SELECT 1 FROM sigd_tra.expediente
        WHERE solicitante_id = OLD.id_persona
        LIMIT 1
    ) THEN
        RAISE EXCEPTION 'VIOLACION_RETENCION_DOCUMENTAL: No se puede eliminar fisicamente la persona (%) debido a que posee expedientes sujetos a custodia documental (Art. 19 Ley N° 29733 / MGD). Aplique baja logica (activo = false) en su cuenta_usuario.'
            , OLD.id_persona
            USING ERRCODE = '23000';
    END IF;

    -- 1.2 Verificación de consentimientos de datos personales (Arts. 13 y 18 Ley N° 29733)
    IF EXISTS (
        SELECT 1 FROM sigd_auth.consentimiento_datos
        WHERE id_persona = OLD.id_persona
        LIMIT 1
    ) THEN
        RAISE EXCEPTION 'VIOLACION_LPDP_CONSENTIMIENTO: No se puede eliminar fisicamente la persona (%) debido a que mantiene registros de consentimiento informado de tratamiento de datos personales. Aplique baja logica.'
            , OLD.id_persona
            USING ERRCODE = '23000';
    END IF;

    -- 1.3 Verificación de cuentas institucionales con auditoría
    IF EXISTS (
        SELECT 1 FROM sigd_auth.cuenta_usuario
        WHERE id_persona = OLD.id_persona
        LIMIT 1
    ) THEN
        RAISE EXCEPTION 'VIOLACION_AUDITORIA_CUENTA: No se puede eliminar fisicamente la persona (%) debido a que posee una cuenta institucional asociada. Aplique desactivacion logica (activo = false).'
            , OLD.id_persona
            USING ERRCODE = '23000';
    END IF;

    -- 1.4 Verificación de representación legal vigente o histórica (COLUMNA CANÓNICA id_persona_natural)
    IF EXISTS (
        SELECT 1 FROM sigd_auth.representacion_legal
        WHERE id_persona_natural = OLD.id_persona OR id_persona_juridica = OLD.id_persona
        LIMIT 1
    ) THEN
        RAISE EXCEPTION 'VIOLACION_REPRESENTACION_LEGAL: No se puede eliminar fisicamente la persona (%) vinculada a registros de representacion legal.'
            , OLD.id_persona
            USING ERRCODE = '23000';
    END IF;

    -- 1.5 Verificación de historial de validación de documentos (RENIEC / SUNAT / MANUAL)
    IF EXISTS (
        SELECT 1 FROM sigd_auth.persona_documento_historial
        WHERE id_persona = OLD.id_persona
        LIMIT 1
    ) THEN
        RAISE EXCEPTION 'VIOLACION_HISTORIAL_IDENTIDAD: No se puede eliminar fisicamente la persona (%) debido a que mantiene registros historicos de validacion de identidad (RENIEC/SUNAT). Aplique baja logica.'
            , OLD.id_persona
            USING ERRCODE = '23000';
    END IF;

    RETURN OLD;
END;
$$;

COMMENT ON FUNCTION sigd_auth.fn_prevenir_borrado_persona_con_evidencia() IS
    'Salvaguarda contra borrado físico de personas con expedientes, consentimientos, cuentas o representación legal.';

-- Asegurar trigger activo
DROP TRIGGER IF EXISTS tr_prevenir_borrado_persona_con_evidencia ON sigd_auth.persona;

CREATE TRIGGER tr_prevenir_borrado_persona_con_evidencia
    BEFORE DELETE ON sigd_auth.persona
    FOR EACH ROW EXECUTE FUNCTION sigd_auth.fn_prevenir_borrado_persona_con_evidencia();

-- -----------------------------------------------------------------------------
-- 2. F-08: Mitigación de contraseñas estáticas en DDL
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_app') THEN
        ALTER ROLE sigd_app WITH PASSWORD NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_worker') THEN
        ALTER ROLE sigd_worker WITH PASSWORD NULL;
    END IF;
END $$;
