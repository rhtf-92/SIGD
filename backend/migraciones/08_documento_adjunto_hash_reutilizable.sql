-- Fix: one immutable document binary may be attached to separate expedientes.
-- Keep (s3_bucket, s3_key) unique so each stored object reference remains
-- distinct, and keep idx_documento_adjunto_sha for hash lookups. A content hash
-- identifies bytes; it is not the identity of an expediente attachment.
ALTER TABLE sigd_doc.documento_adjunto
  DROP CONSTRAINT IF EXISTS uq_documento_adjunto_sha;

COMMENT ON COLUMN sigd_doc.documento_adjunto.sha256 IS
  'SHA-256 del binario para verificar integridad y buscar contenido; no es una clave de unicidad del adjunto, pues el mismo documento puede corresponder a expedientes distintos.';
