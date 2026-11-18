-- 11_sigd_tra_expediente_tramite_tupa.sql
-- Guarda el tramite TUPA real elegido al radicar. Columna opcional:
-- los expedientes anteriores quedan en NULL.
ALTER TABLE sigd_tra.expediente
  ADD COLUMN IF NOT EXISTS tramite_version_id UUID
  REFERENCES sigd_tupa.tramite_version (tramite_version_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_tra_expediente_tramite_version
  ON sigd_tra.expediente (tramite_version_id);

COMMENT ON COLUMN sigd_tra.expediente.tramite_version_id IS
  'Tramite del TUPA elegido al radicar (sigd_tupa.tramite_version). NULL en expedientes anteriores.';