-- =============================================================================
-- ROLLBACK MIGRACIÓN 11: Corrección Post-Auditoría Codex (N-03)
-- SIGD 2026
-- =============================================================================
--
-- POLÍTICA DE ROLLBACK / IRREVERSIBILIDAD:
-- La migración forward 11 actualiza de forma idempotente los expedientes preexistentes
-- donde sigd_tra.expediente.estado = 'EN_TRAMITE' y sigd_rut.estado_actual_expediente
-- marcaba 'EN_REVISION', sincronizándolos al estado canónico 'EN_REVISION'.
--
-- Un rollback genérico que revierta 'EN_REVISION' a 'EN_TRAMITE' degradaría expedientes
-- que ya se encontraban legítimamente en revisión con anterioridad a la migración,
-- provocando inconsistencia y corrupción semántica del estado FSM.
--
-- En consecuencia, esta migración es declarada FORWARD-ONLY e IRREVERSIBLE por
-- diseño de integridad referencial.
-- =============================================================================

DO $$
BEGIN
    RAISE EXCEPTION 'MIGRACIÓN 11 ES FORWARD-ONLY E IRREVERSIBLE: Revertir masivamente el estado EN_REVISION a EN_TRAMITE causaría degradación destructiva de expedientes legítimos preexistentes.'
        USING ERRCODE = '0A000'; -- feature_not_supported
END $$;
