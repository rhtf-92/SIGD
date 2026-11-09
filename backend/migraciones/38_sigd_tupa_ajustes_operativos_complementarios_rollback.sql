-- =============================================================================
-- Rollback Migración 38 · Esquema sigd_doc · Ajustes Operativos TUPA Complementarios
-- =============================================================================

BEGIN;

ALTER TABLE sigd_doc.tupa_campo_procedencia
    DROP CONSTRAINT IF EXISTS chk_tupa_campo_proc_fuente;

ALTER TABLE sigd_doc.tupa_campo_procedencia
    ADD CONSTRAINT chk_tupa_campo_proc_fuente
    CHECK (fuente IN ('OFICIAL_SUIZA', 'REFERENCIA_EXTERNA', 'DISEÑO_SIGD', 'NO_DETERMINADO'));

COMMIT;
