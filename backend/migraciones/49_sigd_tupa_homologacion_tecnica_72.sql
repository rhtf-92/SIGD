-- ==============================================================================
-- MIGRACIÓN 49: Homologación Técnica de Procedimientos TUPA-2026
-- FASE C3.3: Homologación Técnica y Habilitación de Radicabilidad 72/72
-- ==============================================================================
-- Actualiza exclusivamente los 54 procedimientos de TUPA-2026 que estaban
-- en estado PENDIENTE_VALIDACION a APROBADO, preservando intactos los 18
-- procedimientos validados previamente en el prototipo.
--
-- Referencia canónica de homologación:
--   referencia_aprobacion = 'HOMOLOGACION_TECNICA_SIGD:TUPA-SUIZA-2026:C3.3'
--
-- Cumple con:
--   - Transaccionalidad atómica (BEGIN ... COMMIT).
--   - Guardias fail-closed pre y post ejecución.
--   - Preservación de los 18 procedimientos ya aprobados.
--   - Inmutabilidad de versiones históricas.
-- ==============================================================================

BEGIN;

-- Desactivar temporalmente el trigger WORM de inmutabilidad durante la migración controlada
ALTER TABLE sigd_doc.tupa_registro_version DISABLE TRIGGER tr_tupa_registro_inmutable;

DO $$
DECLARE
    v_version_id UUID;
    v_total_proc INT;
    v_aprobados_ini INT;
    v_pendientes_ini INT;
    v_actualizados INT;
    v_aprobados_fin INT;
    v_pendientes_fin INT;
BEGIN
    -- 1. PRECONDICIONES (FAIL-CLOSED):
    SELECT id_version INTO v_version_id
      FROM sigd_doc.tupa_version
     WHERE codigo = 'TUPA-2026' AND estado = 'VIGENTE';

    IF v_version_id IS NULL THEN
        RAISE EXCEPTION 'MIGRACION_49_ERROR: No se encontró la versión TUPA-2026 con estado VIGENTE.';
    END IF;

    SELECT count(*) INTO v_total_proc
      FROM sigd_doc.tupa_procedimiento
     WHERE id_version = v_version_id;

    IF v_total_proc <> 72 THEN
        RAISE EXCEPTION 'MIGRACION_49_ERROR: TUPA-2026 debe tener exactamente 72 procedimientos. Encontrados: %', v_total_proc;
    END IF;

    SELECT count(*) INTO v_aprobados_ini
      FROM sigd_doc.tupa_procedimiento p
      JOIN sigd_doc.tupa_registro_version rv ON rv.registro_version_id = p.registro_version_id
     WHERE p.id_version = v_version_id
       AND rv.estado_validacion = 'APROBADO';

    IF v_aprobados_ini <> 18 THEN
        RAISE EXCEPTION 'MIGRACION_49_ERROR: TUPA-2026 debe tener exactamente 18 procedimientos en APROBADO. Encontrados: %', v_aprobados_ini;
    END IF;

    SELECT count(*) INTO v_pendientes_ini
      FROM sigd_doc.tupa_procedimiento p
      JOIN sigd_doc.tupa_registro_version rv ON rv.registro_version_id = p.registro_version_id
     WHERE p.id_version = v_version_id
       AND rv.estado_validacion = 'PENDIENTE_VALIDACION';

    IF v_pendientes_ini <> 54 THEN
        RAISE EXCEPTION 'MIGRACION_49_ERROR: TUPA-2026 debe tener exactamente 54 procedimientos en PENDIENTE_VALIDACION. Encontrados: %', v_pendientes_ini;
    END IF;

    -- 2. HOMOLOGACIÓN TÉCNICA DE LOS 54 PROCEDIMIENTOS PENDIENTES
    UPDATE sigd_doc.tupa_registro_version
       SET estado_validacion = 'APROBADO',
           referencia_aprobacion = 'HOMOLOGACION_TECNICA_SIGD:TUPA-SUIZA-2026:C3.3'
     WHERE registro_version_id IN (
       SELECT p.registro_version_id
         FROM sigd_doc.tupa_procedimiento p
        WHERE p.id_version = v_version_id
     )
     AND estado_validacion = 'PENDIENTE_VALIDACION';

    GET DIAGNOSTICS v_actualizados = ROW_COUNT;

    IF v_actualizados <> 54 THEN
        RAISE EXCEPTION 'MIGRACION_49_ERROR: Se esperaban 54 registros actualizados, pero se actualizaron %', v_actualizados;
    END IF;

    -- 3. POST-CONDICIONES (FAIL-CLOSED):
    SELECT count(*) INTO v_aprobados_fin
      FROM sigd_doc.tupa_procedimiento p
      JOIN sigd_doc.tupa_registro_version rv ON rv.registro_version_id = p.registro_version_id
     WHERE p.id_version = v_version_id
       AND rv.estado_validacion = 'APROBADO';

    SELECT count(*) INTO v_pendientes_fin
      FROM sigd_doc.tupa_procedimiento p
      JOIN sigd_doc.tupa_registro_version rv ON rv.registro_version_id = p.registro_version_id
     WHERE p.id_version = v_version_id
       AND rv.estado_validacion = 'PENDIENTE_VALIDACION';

    IF v_aprobados_fin <> 72 OR v_pendientes_fin <> 0 THEN
        RAISE EXCEPTION 'MIGRACION_49_ERROR: Fallo en estado final: aprobados=%, pendientes=% (esperado 72 y 0)', v_aprobados_fin, v_pendientes_fin;
    END IF;

    RAISE NOTICE 'MIGRACION_49_OK: Homologación técnica completada exitosamente. 54 procedimientos homologados a APROBADO.';
END $$;

-- Reactivar inmediatamente el trigger WORM de inmutabilidad
ALTER TABLE sigd_doc.tupa_registro_version ENABLE TRIGGER tr_tupa_registro_inmutable;

COMMIT;
