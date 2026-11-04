-- Migración correctiva segura para convertir actor_id BIGINT a IdentiCore UUID.
-- No modifica 09_sigd_rut_actor_uuid.sql ni convierte valores implícitamente.
-- Si existen datos, el operador debe cargar primero el mapeo explícito.
DO $$
DECLARE
  v_type text;
  v_rows bigint;
  v_unmapped bigint;
BEGIN
  IF to_regclass('sigd_rut.solicitud_compensacion_folios') IS NULL THEN
    RETURN;
  END IF;

  SELECT data_type INTO v_type FROM information_schema.columns
   WHERE table_schema = 'sigd_rut' AND table_name = 'solicitud_compensacion_folios'
     AND column_name = 'actor_id';

  IF v_type IS NULL OR v_type = 'uuid' THEN RETURN; END IF;
  IF v_type <> 'bigint' THEN
    RAISE EXCEPTION 'actor_id tiene tipo %, se requiere BIGINT para aplicar el mapeo explícito', v_type;
  END IF;

  EXECUTE 'CREATE TABLE IF NOT EXISTS sigd_rut.actor_id_uuid_mapeo (
    actor_id_numerico BIGINT PRIMARY KEY,
    actor_uuid UUID NOT NULL UNIQUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
  )';

  EXECUTE 'SELECT COUNT(*) FROM sigd_rut.solicitud_compensacion_folios' INTO v_rows;
  IF v_rows = 0 THEN
    EXECUTE 'ALTER TABLE sigd_rut.solicitud_compensacion_folios
               ALTER COLUMN actor_id TYPE UUID USING NULL::UUID';
    RETURN;
  END IF;

  EXECUTE 'SELECT COUNT(*) FROM sigd_rut.solicitud_compensacion_folios s
             LEFT JOIN sigd_rut.actor_id_uuid_mapeo m
               ON m.actor_id_numerico = s.actor_id
            WHERE m.actor_uuid IS NULL' INTO v_unmapped;
  IF v_unmapped > 0 THEN
    RAISE EXCEPTION
      'CORRECCIÓN REQUERIDA: % fila(s) no tienen correspondencia en sigd_rut.actor_id_uuid_mapeo (actor_id_numerico -> actor_uuid)',
      v_unmapped;
  END IF;

  EXECUTE 'ALTER TABLE sigd_rut.solicitud_compensacion_folios ADD COLUMN IF NOT EXISTS actor_uuid UUID';
  EXECUTE 'UPDATE sigd_rut.solicitud_compensacion_folios s
              SET actor_uuid = m.actor_uuid
             FROM sigd_rut.actor_id_uuid_mapeo m
            WHERE m.actor_id_numerico = s.actor_id';
  EXECUTE 'SELECT COUNT(*) FROM sigd_rut.solicitud_compensacion_folios
            WHERE actor_uuid IS NULL' INTO v_unmapped;
  IF v_unmapped > 0 THEN
    RAISE EXCEPTION 'El mapeo produjo % actor_uuid NULL; no se altera la columna histórica', v_unmapped;
  END IF;

  EXECUTE 'ALTER TABLE sigd_rut.solicitud_compensacion_folios DROP COLUMN actor_id';
  EXECUTE 'ALTER TABLE sigd_rut.solicitud_compensacion_folios RENAME COLUMN actor_uuid TO actor_id';
END $$ LANGUAGE plpgsql;
