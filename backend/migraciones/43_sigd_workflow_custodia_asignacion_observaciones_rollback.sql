-- =============================================================================
-- Rollback 43: Workflow Configurable, Custodia Institucional, Asignación Individual y Observaciones Trazables
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Fail-Safe: Aborta si existen instancias de workflow, asignaciones u observaciones activas
-- =============================================================================

DO $$
DECLARE
    v_conteo_instancias INTEGER := 0;
    v_conteo_asignaciones INTEGER := 0;
    v_conteo_observaciones INTEGER := 0;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sigd_rut' AND table_name = 'workflow_instancia') THEN
        SELECT COUNT(*) INTO v_conteo_instancias FROM sigd_rut.workflow_instancia;
        IF v_conteo_instancias > 0 THEN
            RAISE EXCEPTION 'ABORTANDO ROLLBACK 43: Existen % instancias de workflow registradas. La reversión causaría pérdida de historia operativa.', v_conteo_instancias;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sigd_rut' AND table_name = 'expediente_asignacion') THEN
        SELECT COUNT(*) INTO v_conteo_asignaciones FROM sigd_rut.expediente_asignacion;
        IF v_conteo_asignaciones > 0 THEN
            RAISE EXCEPTION 'ABORTANDO ROLLBACK 43: Existen % asignaciones individuales registradas. La reversión causaría pérdida de asignación.', v_conteo_asignaciones;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sigd_rut' AND table_name = 'expediente_observacion') THEN
        SELECT COUNT(*) INTO v_conteo_observaciones FROM sigd_rut.expediente_observacion;
        IF v_conteo_observaciones > 0 THEN
            RAISE EXCEPTION 'ABORTANDO ROLLBACK 43: Existen % observaciones estructuradas registradas. La reversión causaría pérdida de trazabilidad.', v_conteo_observaciones;
        END IF;
    END IF;
END $$;

-- 1. Restaurar función trigger a versión anterior (sin columnas nuevas de asignación)
CREATE OR REPLACE FUNCTION sigd_rut.actualizar_estado_actual_expediente()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigd_rut'
AS $function$
BEGIN
    INSERT INTO sigd_rut.estado_actual_expediente
        (expediente_id, secuencia, estado_nuevo, evento, area_actual_id,
         id_movimiento, fecha_hora, usuario_operador_id)
    VALUES (NEW.expediente_id, NEW.secuencia, NEW.estado_nuevo, NEW.evento,
            NEW.datos->>'areaId', NEW.id_movimiento, NEW.fecha_hora,
            NEW.usuario_operador_id)
    ON CONFLICT (expediente_id) DO UPDATE SET
        secuencia = EXCLUDED.secuencia,
        estado_nuevo = EXCLUDED.estado_nuevo,
        evento = EXCLUDED.evento,
        area_actual_id = EXCLUDED.area_actual_id,
        id_movimiento = EXCLUDED.id_movimiento,
        fecha_hora = EXCLUDED.fecha_hora,
        usuario_operador_id = EXCLUDED.usuario_operador_id
    WHERE sigd_rut.estado_actual_expediente.secuencia < EXCLUDED.secuencia;
    RETURN NULL;
END;
$function$;

-- 2. Eliminar columnas aditivas de sigd_rut.estado_actual_expediente
ALTER TABLE sigd_rut.estado_actual_expediente
    DROP COLUMN IF EXISTS persona_asignada_id,
    DROP COLUMN IF EXISTS usuario_asignado_id,
    DROP COLUMN IF EXISTS id_version_workflow;

-- 3. Eliminar tablas creadas en orden inverso de dependencias
DROP TABLE IF EXISTS sigd_rut.expediente_observacion CASCADE;
DROP TABLE IF EXISTS sigd_rut.expediente_asignacion CASCADE;
DROP TABLE IF EXISTS sigd_rut.workflow_instancia CASCADE;
DROP TABLE IF EXISTS sigd_rut.workflow_procedimiento_config CASCADE;
DROP TABLE IF EXISTS sigd_rut.workflow_version CASCADE;
DROP TABLE IF EXISTS sigd_rut.workflow_definicion CASCADE;
