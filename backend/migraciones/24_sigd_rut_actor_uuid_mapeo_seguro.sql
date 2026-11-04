-- Migración correctiva: validación estricta para conversión actor_id a UUID en RUT
-- No modifica 09_sigd_rut_actor_uuid.sql (histórica). Añade verificación segura para bases con datos.
DO 
DECLARE
  v_type text;
  v_count integer;
BEGIN
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'sigd_rut'
    AND table_name   = 'solicitud_compensacion_folios'
    AND column_name  = 'actor_id';

  IF v_type IS DISTINCT FROM 'uuid' THEN
    SELECT COUNT(*) INTO v_count
    FROM sigd_rut.solicitud_compensacion_folios;

    IF v_count > 0 THEN
      RAISE EXCEPTION 'Corrección requerida: existen % filas con actor_id no-UUID en sigd_rut.solicitud_compensacion_folios. Se requiere tabla de mapeo actor_id_numérico -> actor_uuid antes de convertir.', v_count;
    END IF;

    -- Solo si no hay datos, conversión segura
    ALTER TABLE sigd_rut.solicitud_compensacion_folios
      ALTER COLUMN actor_id TYPE UUID USING NULL::UUID;
  END IF;
END ;
