-- Calificar columnas evita ambiguedad con los parametros RETURNS TABLE.
CREATE OR REPLACE FUNCTION sigd_tra.agregar_folio_expediente(
    p_id_expediente UUID,
    p_id_documento  UUID,
    p_cantidad      INT,
    p_usuario_id    UUID DEFAULT NULL
)
RETURNS TABLE (folio_inicio INT, folio_fin INT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inicio INT;
BEGIN
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        RAISE EXCEPTION 'La cantidad de folios debe ser mayor que cero'
            USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM sigd_tra.expediente WHERE expediente_id = p_id_expediente FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Expediente inexistente: %', p_id_expediente
            USING ERRCODE = '23503';
    END IF;

    SELECT COALESCE(MAX(f.folio_fin), 0) + 1
      INTO v_inicio
      FROM sigd_tra.expediente_documento_folio f
     WHERE f.expediente_id = p_id_expediente;

    INSERT INTO sigd_tra.expediente_documento_folio
        (expediente_id, id_documento, folio_inicio, folio_fin, asignado_por)
    VALUES
        (p_id_expediente, p_id_documento, v_inicio, v_inicio + p_cantidad - 1, p_usuario_id);

    RETURN QUERY SELECT v_inicio, v_inicio + p_cantidad - 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION sigd_tra.agregar_folio_expediente(UUID, UUID, INT, UUID) FROM PUBLIC;

