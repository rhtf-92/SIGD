-- No destruir evidencia histórica: rollback permitido solo antes de confirmar cargas nuevas.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM sigd_doc.tupa_documento_oficial_upload) THEN
        RAISE EXCEPTION 'Rollback bloqueado: existen cargas emitidas que podrían conservar objetos físicos';
    END IF;
END $$;

DROP TRIGGER tr_tupa_historial_inmutable ON sigd_doc.tupa_documento_oficial_historial;
DROP FUNCTION sigd_doc.bloquear_cambio_historial_tupa();
DROP INDEX sigd_doc.uq_tupa_historial_storage_key_nueva;
ALTER TABLE sigd_doc.tupa_documento_oficial_historial
    DROP CONSTRAINT fk_tupa_historial_carga_exacta,
    DROP CONSTRAINT uq_tupa_historial_upload,
    DROP COLUMN upload_id;
DROP TABLE sigd_doc.tupa_documento_oficial_upload;
