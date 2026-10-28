-- =============================================================================
-- SIGD 2026 — MIGRACIÓN INCREMENTAL DE SEGURIDAD Y CONTROL FORENSE (FASE 5)
-- Archivo: 09_sigd_seguridad_remediacion.sql
-- Propósito:
--   1. DAT-01: Inmutabilidad WORM física estricta en sigd_rut.movimiento_tramite
--              (bloquea UPDATE, DELETE y TRUNCATE).
--   2. SEC-06: Privilegios mínimos granulares para roles sigd_app y sigd_worker
--              (DML controlado, secuencias, funciones requeridas, sin DELETE en auditoría).
--   3. SEC-08: Preservación de evidencia y protección frente a borrado en cascada
--              (expedientes, consentimientos LPDP, cuentas y representación legal).
-- Idempotente: Sí (IF EXISTS / IF NOT EXISTS / OR REPLACE).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. DAT-01: Control WORM (Write-Once Read-Many) en RutaDoc
-- -----------------------------------------------------------------------------

-- 1.1 Bloqueo de mutaciones individuales (UPDATE y DELETE)
CREATE OR REPLACE FUNCTION sigd_rut.fn_rechazar_mutacion_movimiento()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'VIOLACION_WORM: La tabla sigd_rut.movimiento_tramite es inmutable (WORM). No se permiten modificaciones (UPDATE) ni eliminaciones (DELETE) en la trazabilidad documental.'
        USING ERRCODE = '55000';
END;
$$;

COMMENT ON FUNCTION sigd_rut.fn_rechazar_mutacion_movimiento() IS
    'Función guardián WORM: rechaza irrevocablemente cualquier UPDATE o DELETE en movimiento_tramite y sus particiones.';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_trigger
        WHERE tgrelid = 'sigd_rut.movimiento_tramite'::regclass
          AND tgname = 'tr_bloquear_mutacion_movimiento'
          AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER tr_bloquear_mutacion_movimiento
            BEFORE UPDATE OR DELETE ON sigd_rut.movimiento_tramite
            FOR EACH ROW EXECUTE FUNCTION sigd_rut.fn_rechazar_mutacion_movimiento();
    END IF;
END $$;

-- 1.2 Bloqueo de vaciado masivo (TRUNCATE)
CREATE OR REPLACE FUNCTION sigd_rut.fn_rechazar_truncate_movimiento()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'VIOLACION_WORM: Operacion TRUNCATE prohibida en sigd_rut.movimiento_tramite. La trazabilidad documental es inmutable (WORM).'
        USING ERRCODE = '55000';
END;
$$;

COMMENT ON FUNCTION sigd_rut.fn_rechazar_truncate_movimiento() IS
    'Función guardián WORM: rechaza irrevocablemente la instrucción TRUNCATE en movimiento_tramite y sus particiones.';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_trigger
        WHERE tgrelid = 'sigd_rut.movimiento_tramite'::regclass
          AND tgname = 'tr_bloquear_truncate_movimiento'
          AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER tr_bloquear_truncate_movimiento
            BEFORE TRUNCATE ON sigd_rut.movimiento_tramite
            FOR EACH STATEMENT EXECUTE FUNCTION sigd_rut.fn_rechazar_truncate_movimiento();
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. SEC-08: Salvaguarda de Retención y Preservación de Evidencias (Ley N° 29733 / MGD)
-- Impide el borrado físico de personas con registros regulatorios o documentales
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sigd_auth.fn_prevenir_borrado_persona_con_evidencia()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- 2.1 Verificación de expedientes en trámite o históricos
    IF EXISTS (
        SELECT 1 FROM sigd_tra.expediente
        WHERE solicitante_id = OLD.id_persona
        LIMIT 1
    ) THEN
        RAISE EXCEPTION 'VIOLACION_RETENCION_DOCUMENTAL: No se puede eliminar fisicamente la persona (%) debido a que posee expedientes sujetos a custodia documental (Art. 19 Ley N° 29733 / MGD). Aplique baja logica (activo = false) en su cuenta_usuario.'
            , OLD.id_persona
            USING ERRCODE = '23000';
    END IF;

    -- 2.2 Verificación de consentimientos de datos personales (Arts. 13 y 18 Ley N° 29733)
    IF EXISTS (
        SELECT 1 FROM sigd_auth.consentimiento_datos
        WHERE id_persona = OLD.id_persona
        LIMIT 1
    ) THEN
        RAISE EXCEPTION 'VIOLACION_LPDP_CONSENTIMIENTO: No se puede eliminar fisicamente la persona (%) debido a que mantiene registros de consentimiento informado de tratamiento de datos personales. Aplique baja logica.'
            , OLD.id_persona
            USING ERRCODE = '23000';
    END IF;

    -- 2.3 Verificación de cuentas institucionales con auditoría
    IF EXISTS (
        SELECT 1 FROM sigd_auth.cuenta_usuario
        WHERE id_persona = OLD.id_persona
        LIMIT 1
    ) THEN
        RAISE EXCEPTION 'VIOLACION_AUDITORIA_CUENTA: No se puede eliminar fisicamente la persona (%) debido a que posee una cuenta institucional asociada. Aplique desactivacion logica (activo = false).'
            , OLD.id_persona
            USING ERRCODE = '23000';
    END IF;

    -- 2.4 Verificación de representación legal vigente o histórica
    IF EXISTS (
        SELECT 1 FROM sigd_auth.representacion_legal
        WHERE id_persona_representante = OLD.id_persona OR id_persona_juridica = OLD.id_persona
        LIMIT 1
    ) THEN
        RAISE EXCEPTION 'VIOLACION_REPRESENTACION_LEGAL: No se puede eliminar fisicamente la persona (%) vinculada a registros de representacion legal.'
            , OLD.id_persona
            USING ERRCODE = '23000';
    END IF;

    -- 2.5 Verificación de historial de validación de documentos (RENIEC / SUNAT / MANUAL)
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
    'Salvaguarda contra borrado físico de personas con expedientes, consentimientos o cuentas institucionales.';

-- Reemplazar trigger previo si existiera
DROP TRIGGER IF EXISTS tr_prevenir_borrado_persona_con_expedientes ON sigd_auth.persona;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_trigger
        WHERE tgrelid = 'sigd_auth.persona'::regclass
          AND tgname = 'tr_prevenir_borrado_persona_con_evidencia'
          AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER tr_prevenir_borrado_persona_con_evidencia
            BEFORE DELETE ON sigd_auth.persona
            FOR EACH ROW EXECUTE FUNCTION sigd_auth.fn_prevenir_borrado_persona_con_evidencia();
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. SEC-06: Segregación y Privilegios Mínimos Granulares (sigd_app vs sigd_worker)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_app') THEN
        CREATE ROLE sigd_app WITH LOGIN PASSWORD 'sigd_app_pass_placeholder';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_worker') THEN
        CREATE ROLE sigd_worker WITH LOGIN PASSWORD 'sigd_worker_pass_placeholder';
    END IF;
END $$;

-- Concesión de esquemas operativos
GRANT USAGE ON SCHEMA sigd_auth, sigd_org, sigd_doc, sigd_tra, sigd_rut, sigd_audit TO sigd_app;
GRANT USAGE ON SCHEMA sigd_audit TO sigd_worker;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sigd_reportes') THEN
        EXECUTE 'GRANT USAGE ON SCHEMA sigd_reportes TO sigd_app';
        EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA sigd_reportes TO sigd_app';
    END IF;
END $$;

-- Privilegios sigd_app: DML en tablas de negocio sin DELETE en trazabilidad ni bitácora
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sigd_auth, sigd_org, sigd_doc, sigd_tra TO sigd_app;

-- Secuencias requeridas para inserciones con SERIAL o IDENTITY
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sigd_auth, sigd_org, sigd_doc, sigd_tra, sigd_rut, sigd_audit TO sigd_app;

-- En sigd_rut: solo SELECT e INSERT en tablas de movimiento (WORM estricto)
GRANT SELECT, INSERT ON TABLE sigd_rut.movimiento_tramite, sigd_rut.movimiento_identidad TO sigd_app;
GRANT SELECT, UPDATE ON TABLE sigd_rut.movimiento_secuencia TO sigd_app;
GRANT SELECT ON ALL TABLES IN SCHEMA sigd_rut TO sigd_app;

-- En sigd_audit: solo INSERT y SELECT para la aplicación
GRANT SELECT, INSERT ON TABLE sigd_audit.bitacora_auditoria, sigd_audit.evento_outbox TO sigd_app;

-- Concesión de ejecución restringida a funciones de negocio específicas
GRANT EXECUTE ON FUNCTION sigd_tra.generar_cut_expediente(INT) TO sigd_app;
GRANT EXECUTE ON FUNCTION sigd_tra.fn_generar_cut(INT) TO sigd_app;
GRANT EXECUTE ON FUNCTION sigd_tra.acumular_expediente(UUID, UUID, TEXT) TO sigd_app;
GRANT EXECUTE ON FUNCTION sigd_tra.agregar_folio_expediente(UUID, UUID, INT, UUID) TO sigd_app;
GRANT EXECUTE ON FUNCTION sigd_rut.pestana_de_estado(TEXT) TO sigd_app;
GRANT EXECUTE ON FUNCTION sigd_tra.fn_mgd_horas_habiles(TIMESTAMPTZ, TIMESTAMPTZ, DATE[]) TO sigd_app;
GRANT EXECUTE ON FUNCTION sigd_tra.fn_mgd_dias_habiles_entre(TIMESTAMPTZ, TIMESTAMPTZ, DATE[]) TO sigd_app;

-- Privilegios sigd_worker: procesador asíncrono de outbox exclusivamente
GRANT SELECT, UPDATE(estado, intentos, procesado_en) ON TABLE sigd_audit.evento_outbox TO sigd_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sigd_audit TO sigd_worker;

COMMIT;
