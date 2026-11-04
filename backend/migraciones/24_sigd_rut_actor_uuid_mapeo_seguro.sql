-- Migración correctiva: validación estricta para conversión actor_id a UUID en RUT
-- NO modifica 09_sigd_rut_actor_uuid.sql (histórica). Evita conversión silenciosa.
DO \$\$
DECLARE
  v_type  text;
  v_count integer;
BEGIN
  SELECT data_type
    INTO v_type
    FROM information_schema.columns
   WHERE table_schema = 'sigd_rut'
     AND table_name   = 'solicitud_compensacion_folios'
     AND column_name  = 'actor_id';

  IF v_type IS NOT NULL AND v_type <> 'uuid' THEN
    SELECT COUNT(*)
      INTO v_count
      FROM sigd_rut.solicitud_compensacion_folios;

    IF v_count > 0 THEN
      RAISE EXCEPTION 'CORRECCIÓN REQUERIDA: existen % fila(s) con actor_id no-UUID en sigd_rut.solicitud_compensacion_folios. Crear tabla de mapeo actor_id_numerico -> actor_uuid (IdentiCore UUID) y migración correctiva con ese mapeo. No se aplica ALTER TYPE automático.', v_count;
    END IF;

    EXECUTE 'ALTER TABLE sigd_rut.solicitud_compensacion_folios ALTER COLUMN actor_id TYPE UUID USING NULL::UUID';
  END IF;

EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END;
\$\$ LANGUAGE plpgsql;
