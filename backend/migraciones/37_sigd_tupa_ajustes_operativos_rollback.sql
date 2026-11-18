-- =============================================================================
-- Rollback Migración 37 · Esquema sigd_doc · Ajustes Operativos TUPA 5E
-- =============================================================================

BEGIN;

UPDATE sigd_doc.tupa_procedimiento
   SET genera_expediente = true
 WHERE genera_expediente IS NULL;

ALTER TABLE sigd_doc.tupa_procedimiento
    ALTER COLUMN genera_expediente SET NOT NULL,
    ALTER COLUMN genera_expediente SET DEFAULT true;

ALTER TABLE sigd_doc.tupa_campo_procedencia
    DROP CONSTRAINT IF EXISTS chk_tupa_campo_proc_fuente;

ALTER TABLE sigd_doc.tupa_campo_procedencia
    ADD CONSTRAINT chk_tupa_campo_proc_fuente
    CHECK (fuente IN ('OFICIAL', 'DEFAULT', 'PROPUESTA', 'REFERENCIA'));

ALTER TABLE sigd_doc.tupa_campo_procedencia
    ALTER COLUMN id_registro_version SET NOT NULL;

COMMIT;
