-- 12_sigd_tra_expediente_tipo_documental_opcional.sql
-- Los tramites del TUPA real no tienen tipo documental propio en sigd_doc.tipo_documento.
-- Se vuelve opcional, pero cada expediente debe traer al menos uno de los dos datos.
-- Repetible: el backend reejecuta las migraciones en cada arranque.
ALTER TABLE sigd_tra.expediente
  ALTER COLUMN tipo_documental_id DROP NOT NULL;

ALTER TABLE sigd_tra.expediente
  DROP CONSTRAINT IF EXISTS chk_tra_expediente_tipo_o_tramite;

ALTER TABLE sigd_tra.expediente
  ADD CONSTRAINT chk_tra_expediente_tipo_o_tramite
  CHECK (tipo_documental_id IS NOT NULL OR tramite_version_id IS NOT NULL);