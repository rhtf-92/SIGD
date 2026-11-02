-- ==============================================================================
-- ROLLBACK MIGRACIÓN 24: Requisitos Documentales por Procedimiento TUPA
-- ARCHIVO: 24_sigd_tupa_requisitos_documentales_rollback.sql
-- ==============================================================================

BEGIN;

DO $$
BEGIN
    IF to_regclass('sigd_doc.tupa_requisito_documental') IS NOT NULL
       AND EXISTS (SELECT 1 FROM sigd_doc.tupa_requisito_documental) THEN
        RAISE EXCEPTION 'Rollback 24 abortado: existen requisitos documentales que deben conservarse.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM sigd_doc.documento_adjunto
        WHERE id_requisito IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Rollback 24 abortado: existen documentos vinculados a requisitos que deben conservarse.';
    END IF;
END $$;

DROP INDEX IF EXISTS sigd_doc.idx_doc_adjunto_requisito;
ALTER TABLE sigd_doc.documento_adjunto DROP COLUMN IF EXISTS id_requisito;

DROP TABLE IF EXISTS sigd_doc.tupa_requisito_documental;

COMMIT;
