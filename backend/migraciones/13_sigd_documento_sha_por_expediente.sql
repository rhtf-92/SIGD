-- Un mismo PDF puede respaldar expedientes distintos; la unicidad corresponde
-- al par expediente + SHA y nunca al bucket completo.
ALTER TABLE sigd_doc.documento_adjunto
    DROP CONSTRAINT IF EXISTS uq_documento_adjunto_sha;

CREATE UNIQUE INDEX IF NOT EXISTS uq_documento_adjunto_sha_doc
    ON sigd_doc.documento_adjunto (expediente_id, sha256)
    WHERE expediente_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_documento_adjunto_sha_tra
    ON sigd_doc.documento_adjunto (expediente_tra_id, sha256)
    WHERE expediente_tra_id IS NOT NULL;
