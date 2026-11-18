-- ==============================================================================
-- ROLLBACK 46: Restauración de Destinos Funcionales TUPA al Estado Pre-C1
-- FASE C1: Reversión Controlada a NULL físicamente verificado
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_version_id UUID;
    v_updated_count INT;
BEGIN
    SELECT id_version INTO v_version_id
      FROM sigd_doc.tupa_version
     WHERE codigo = 'TUPA-2026';

    IF v_version_id IS NOT NULL THEN
        UPDATE sigd_doc.tupa_procedimiento
           SET unidad_receptora_id = NULL,
               unidad_responsable_id = NULL,
               unidad_resolutiva_id = NULL,
               unidad_financiera_id = NULL,
               intervencion_financiera = NULL,
               actualizado_en = now()
         WHERE id_version = v_version_id;

        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        RAISE NOTICE 'ROLLBACK_46_EXITO: % procedimientos de TUPA-2026 restaurados a estado pre-C1 (NULL).', v_updated_count;
    END IF;
END $$;

COMMIT;
