CREATE OR REPLACE FUNCTION sigd_tra.radiar_registro_ciudadano(p_id_persona UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, sigd_auth, sigd_doc, sigd_org, sigd_tra
AS $$
DECLARE
    v_persona RECORD;
    v_tipo_documental UUID;
    v_area_mesa_partes UUID;
    v_expediente UUID;
    v_asunto TEXT;
BEGIN
    SELECT p.id_persona, p.tipo, p.id_documento, p.creado_en,
           COALESCE(pn.nombre_completo, pj.razon_social, 'Titular ' || p.id_documento) AS titular
      INTO v_persona
      FROM sigd_auth.persona p
      LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
      LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
     WHERE p.id_persona = p_id_persona;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe la persona % para radicar el registro ciudadano.', p_id_persona;
    END IF;

    SELECT tipo_documental_id INTO v_tipo_documental
      FROM sigd_doc.tipo_documento
     WHERE codigo = 'REGISTRO_CIUDADANO' AND vigente = TRUE;
    SELECT area_id INTO v_area_mesa_partes
      FROM sigd_org.area
     WHERE codigo = 'MESA_PARTES' AND vigente = TRUE;

    IF v_tipo_documental IS NULL OR v_area_mesa_partes IS NULL THEN
        RAISE EXCEPTION 'Falta configurar REGISTRO_CIUDADANO o MESA_PARTES.';
    END IF;

    SELECT expediente_id
      INTO v_expediente
      FROM sigd_tra.expediente
     WHERE solicitante_id = p_id_persona
       AND tipo_documental_id = v_tipo_documental
     ORDER BY fecha_radicacion DESC
     LIMIT 1;
    IF FOUND THEN
        RETURN v_expediente;
    END IF;

    v_asunto := format('Registro ciudadano: %s (%s %s)',
        v_persona.titular,
        CASE WHEN v_persona.tipo = 'JURIDICA' THEN 'RUC' ELSE 'DNI' END,
        v_persona.id_documento);

    INSERT INTO sigd_tra.expediente (
        codigo_expediente, numero, dni_solicitante, tipo_documental_id,
        solicitante_id, area_destino_id, estado, fecha_radicacion
    )
    VALUES (
        NULL,
        'REG-' || left(replace(p_id_persona::text, '-', ''), 24),
        CASE WHEN v_persona.tipo = 'NATURAL' AND v_persona.id_documento ~ '^[0-9]{8}$'
             THEN v_persona.id_documento ELSE NULL END,
        v_tipo_documental,
        p_id_persona,
        v_area_mesa_partes,
        'REGISTRADO',
        v_persona.creado_en
    )
    RETURNING expediente_id INTO v_expediente;

    INSERT INTO sigd_tra.tramite (expediente_id, asunto, estado)
    VALUES (v_expediente, v_asunto, 'REGISTRADO');

    RETURN v_expediente;
END;
$$;

CREATE OR REPLACE FUNCTION sigd_auth.trg_radiar_registro_ciudadano()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, sigd_auth, sigd_tra
AS $$
BEGIN
    PERFORM sigd_tra.radiar_registro_ciudadano(NEW.id_persona);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_cuenta_radiar_registro_ciudadano
    ON sigd_auth.cuenta_usuario;
CREATE TRIGGER tr_cuenta_radiar_registro_ciudadano
    AFTER INSERT ON sigd_auth.cuenta_usuario
    FOR EACH ROW
    EXECUTE FUNCTION sigd_auth.trg_radiar_registro_ciudadano();

REVOKE ALL ON FUNCTION sigd_tra.radiar_registro_ciudadano(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION sigd_auth.trg_radiar_registro_ciudadano() FROM PUBLIC;

SELECT sigd_tra.radiar_registro_ciudadano(p.id_persona)
  FROM sigd_auth.persona p
  JOIN sigd_auth.cuenta_usuario u ON u.id_persona = p.id_persona
 WHERE u.debe_cambiar_password = TRUE
   AND NOT EXISTS (
       SELECT 1 FROM sigd_tra.expediente e
        WHERE e.solicitante_id = p.id_persona
          AND e.tipo_documental_id = (
              SELECT d.tipo_documental_id FROM sigd_doc.tipo_documento d
               WHERE d.codigo = 'REGISTRO_CIUDADANO' AND d.vigente = TRUE
          )
   );
