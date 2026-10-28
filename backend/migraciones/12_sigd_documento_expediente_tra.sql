-- Acoplamiento documental aditivo con el expediente canónico de TramiCore/RutaDoc.
-- Las filas históricas conservan expediente_id -> sigd_doc.expediente.
-- Las nuevas radicaciones usan expediente_tra_id -> sigd_tra.expediente.
ALTER TABLE sigd_doc.documento_adjunto
    ADD COLUMN IF NOT EXISTS expediente_tra_id UUID NULL;

ALTER TABLE sigd_doc.documento_adjunto
    ALTER COLUMN expediente_id DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'sigd_doc.documento_adjunto'::regclass
           AND conname = 'fk_documento_adjunto_expediente_tra'
    ) THEN
        ALTER TABLE sigd_doc.documento_adjunto
            ADD CONSTRAINT fk_documento_adjunto_expediente_tra
            FOREIGN KEY (expediente_tra_id)
            REFERENCES sigd_tra.expediente (expediente_id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'sigd_doc.documento_adjunto'::regclass
           AND conname = 'chk_documento_adjunto_expediente_unico'
    ) THEN
        ALTER TABLE sigd_doc.documento_adjunto
            ADD CONSTRAINT chk_documento_adjunto_expediente_unico
            CHECK (num_nonnulls(expediente_id, expediente_tra_id) = 1);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_documento_adjunto_expediente_tra
    ON sigd_doc.documento_adjunto (expediente_tra_id);

COMMENT ON COLUMN sigd_doc.documento_adjunto.expediente_tra_id IS
    'Expediente canónico de TramiCore/RutaDoc; exactamente una de las dos FK de expediente debe estar informada.';
