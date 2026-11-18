-- ==============================================================================
-- ROLLBACK MIGRACIÓN 49: Homologación Técnica de Procedimientos TUPA-2026
-- ==============================================================================
-- Revierte exclusivamente los 54 procedimientos actualizados por la
-- migración 49, identificados por su referencia canónica de homologación:
--   referencia_aprobacion = 'HOMOLOGACION_TECNICA_SIGD:TUPA-SUIZA-2026:C3.3'
--
-- Los 18 procedimientos validados previamente en el prototipo quedan intactos.
-- ==============================================================================

BEGIN;

-- Desactivar temporalmente el trigger WORM de inmutabilidad durante el rollback
ALTER TABLE sigd_doc.tupa_registro_version DISABLE TRIGGER tr_tupa_registro_inmutable;

DO $$
DECLARE
    v_version_id UUID;
    v_revertidos INT;
BEGIN
    SELECT id_version INTO v_version_id
      FROM sigd_doc.tupa_version
     WHERE codigo = 'TUPA-2026';

    IF v_version_id IS NOT NULL THEN
        UPDATE sigd_doc.tupa_registro_version
           SET estado_validacion = 'PENDIENTE_VALIDACION',
               referencia_aprobacion = NULL
         WHERE registro_version_id IN (
           SELECT p.registro_version_id
             FROM sigd_doc.tupa_procedimiento p
            WHERE p.id_version = v_version_id
         )
         AND referencia_aprobacion = 'HOMOLOGACION_TECNICA_SIGD:TUPA-SUIZA-2026:C3.3';

        GET DIAGNOSTICS v_revertidos = ROW_COUNT;
        RAISE NOTICE 'ROLLBACK_MIGRACION_49: Revertidos % procedimientos a PENDIENTE_VALIDACION.', v_revertidos;
    END IF;
END $$;

-- Reactivar inmediatamente el trigger WORM de inmutabilidad
ALTER TABLE sigd_doc.tupa_registro_version ENABLE TRIGGER tr_tupa_registro_inmutable;

COMMIT;
