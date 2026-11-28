-- 13_sigd_tupa_conmutacion_automatica.sql | Mecanismo optimizado de conmutacion y reemplazo de versiones TUPA
-- SIGD Institucional · Modulo TUPA 2026/2027

DROP FUNCTION IF EXISTS sigd_tupa.fn_reemplazar_version_vigente(VARCHAR, VARCHAR, NUMERIC, DATE, VARCHAR, DATE, VARCHAR, CHAR, UUID, UUID);
DROP FUNCTION IF EXISTS sigd_tupa.fn_reemplazar_version_vigente;

CREATE OR REPLACE FUNCTION sigd_tupa.fn_reemplazar_version_vigente(
    p_codigo VARCHAR(30),
    p_nombre VARCHAR(200),
    p_uit_vigente NUMERIC(10,2),
    p_fecha_vigencia DATE,
    p_resolucion_numero VARCHAR(100),
    p_resolucion_fecha DATE,
    p_resolucion_pdf_ref VARCHAR(500) DEFAULT NULL,
    p_resolucion_pdf_sha256 CHAR(64) DEFAULT NULL,
    p_copiar_desde_version_id UUID DEFAULT NULL,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS TABLE (
    version_id UUID,
    version_codigo VARCHAR(30),
    version_nombre VARCHAR(200),
    version_estado VARCHAR(20),
    total_tramites_copiados INT,
    version_anterior_id UUID,
    version_anterior_codigo VARCHAR(30)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_actual RECORD;
    v_origen_id UUID;
    v_nueva_id UUID;
    v_total_copiados INT := 0;
    v_pdf_ref VARCHAR(500);
    v_pdf_sha256 CHAR(64);
BEGIN
    -- 1. Establecer usuario para bitacora si fue provisto
    IF p_usuario_id IS NOT NULL THEN
        PERFORM set_config('sigd_tupa.usuario_id', p_usuario_id::text, true);
    END IF;

    -- 2. Bloquear y obtener la version vigente actual (si existe)
    SELECT v.version_id, v.codigo INTO v_actual
      FROM sigd_tupa.version v
     WHERE v.estado = 'VIGENTE'
     FOR UPDATE;

    -- 3. Determinar version origen para copiar tramites defensivamente
    v_origen_id := p_copiar_desde_version_id;
    IF v_origen_id IS NULL AND v_actual.version_id IS NOT NULL THEN
        IF (SELECT count(*) FROM sigd_tupa.tramite_version WHERE sigd_tupa.tramite_version.version_id = v_actual.version_id) > 0 THEN
            v_origen_id := v_actual.version_id;
        ELSE
            SELECT v.version_id INTO v_origen_id
              FROM sigd_tupa.version v
              JOIN sigd_tupa.tramite_version tv ON tv.version_id = v.version_id
             GROUP BY v.version_id, v.creado_en
             ORDER BY v.creado_en DESC
             LIMIT 1;
        END IF;
    END IF;

    -- 4. Preparar metadata de resolucion
    v_pdf_ref := COALESCE(p_resolucion_pdf_ref, 's3://resoluciones-tupa/RD-' || p_codigo || '.pdf');
    v_pdf_sha256 := COALESCE(
        p_resolucion_pdf_sha256,
        encode(sha256(('RESOLUCION-OFICIAL-TUPA-' || p_codigo || '-' || COALESCE(p_resolucion_numero, 'DIRECTORAL'))::bytea), 'hex')
    );

    -- 5. Crear la nueva version inicialmente en BORRADOR (conforme al trigger de seguridad)
    v_nueva_id := gen_random_uuid();
    INSERT INTO sigd_tupa.version (
        version_id, codigo, nombre, fecha_vigencia, uit_vigente,
        resolucion_numero, resolucion_fecha, resolucion_pdf_ref, resolucion_pdf_sha256,
        estado, version_anterior_id, creado_en
    ) VALUES (
        v_nueva_id, p_codigo, p_nombre, p_fecha_vigencia, p_uit_vigente,
        p_resolucion_numero, p_resolucion_fecha, v_pdf_ref, v_pdf_sha256,
        'BORRADOR', v_actual.version_id, now()
    );

    -- 6. Copiar tramites y requisitos si hay version origen
    IF v_origen_id IS NOT NULL THEN
        INSERT INTO sigd_tupa.tramite_version (
            version_id, codigo, denominacion, descripcion, rubro, derecho_monto, derecho_porcentaje_uit,
            derecho_texto, cuenta_pago, plazo_texto, plazo_dias_habiles, calificacion,
            silencio_administrativo, unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones
        )
        SELECT v_nueva_id, tv.codigo, tv.denominacion, tv.descripcion, tv.rubro, tv.derecho_monto, tv.derecho_porcentaje_uit,
               tv.derecho_texto, tv.cuenta_pago, tv.plazo_texto, tv.plazo_dias_habiles, tv.calificacion,
               tv.silencio_administrativo, tv.unidad_recibe, tv.autoridad_resuelve, tv.recursos, tv.base_legal, tv.observaciones
          FROM sigd_tupa.tramite_version tv
         WHERE tv.version_id = v_origen_id;

        GET DIAGNOSTICS v_total_copiados = ROW_COUNT;

        INSERT INTO sigd_tupa.tramite_requisito (tramite_version_id, orden, texto)
        SELECT nuevo.tramite_version_id, req.orden, req.texto
          FROM sigd_tupa.tramite_version anterior
          JOIN sigd_tupa.tramite_version nuevo
            ON nuevo.version_id = v_nueva_id AND nuevo.codigo = anterior.codigo
          JOIN sigd_tupa.tramite_requisito req
            ON req.tramite_version_id = anterior.tramite_version_id
         WHERE anterior.version_id = v_origen_id;
    END IF;

    -- 7. Superseder la version vigente actual (si existe)
    IF v_actual.version_id IS NOT NULL THEN
        UPDATE sigd_tupa.version
           SET estado = 'SUPERSEDIDA'
         WHERE sigd_tupa.version.version_id = v_actual.version_id;
    END IF;

    -- 8. Activar la nueva version a VIGENTE de forma atomica
    UPDATE sigd_tupa.version
       SET estado = 'VIGENTE'
     WHERE sigd_tupa.version.version_id = v_nueva_id;

    -- 9. Retornar resultado
    RETURN QUERY
    SELECT v_nueva_id, p_codigo, p_nombre, 'VIGENTE'::VARCHAR(20), v_total_copiados, v_actual.version_id, v_actual.codigo;
END;
$$;

DROP FUNCTION IF EXISTS sigd_tupa.fn_activar_borrador_tupa(UUID, VARCHAR, DATE, DATE, VARCHAR, CHAR, UUID);
DROP FUNCTION IF EXISTS sigd_tupa.fn_activar_borrador_tupa;

CREATE OR REPLACE FUNCTION sigd_tupa.fn_activar_borrador_tupa(
    p_version_id UUID,
    p_resolucion_numero VARCHAR(100) DEFAULT NULL,
    p_resolucion_fecha DATE DEFAULT NULL,
    p_fecha_vigencia DATE DEFAULT NULL,
    p_resolucion_pdf_ref VARCHAR(500) DEFAULT NULL,
    p_resolucion_pdf_sha256 CHAR(64) DEFAULT NULL,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS TABLE (
    version_id UUID,
    version_codigo VARCHAR(30),
    version_nombre VARCHAR(200),
    version_estado VARCHAR(20),
    total_tramites INT,
    version_anterior_id UUID,
    version_anterior_codigo VARCHAR(30)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_actual RECORD;
    v_borrador RECORD;
    v_total INT := 0;
    v_pdf_ref VARCHAR(500);
    v_pdf_sha256 CHAR(64);
BEGIN
    IF p_usuario_id IS NOT NULL THEN
        PERFORM set_config('sigd_tupa.usuario_id', p_usuario_id::text, true);
    END IF;

    -- Verificar que la version existe y es BORRADOR
    SELECT v.version_id, v.codigo, v.nombre, v.resolucion_numero, v.resolucion_fecha,
           v.fecha_vigencia, v.resolucion_pdf_ref, v.resolucion_pdf_sha256
      INTO v_borrador
      FROM sigd_tupa.version v
     WHERE v.version_id = p_version_id AND v.estado = 'BORRADOR'
     FOR UPDATE;

    IF v_borrador.version_id IS NULL THEN
        RAISE EXCEPTION 'La version indicada no existe o no se encuentra en estado BORRADOR' USING ERRCODE = '23001';
    END IF;

    -- Bloquear version vigente actual
    SELECT v.version_id, v.codigo INTO v_actual
      FROM sigd_tupa.version v
     WHERE v.estado = 'VIGENTE'
     FOR UPDATE;

    -- Contar tramites
    SELECT count(*)::INT INTO v_total FROM sigd_tupa.tramite_version WHERE sigd_tupa.tramite_version.version_id = p_version_id;

    -- Metadata de resolucion
    v_pdf_ref := COALESCE(p_resolucion_pdf_ref, v_borrador.resolucion_pdf_ref, 's3://resoluciones-tupa/RD-' || v_borrador.codigo || '.pdf');
    v_pdf_sha256 := COALESCE(
        p_resolucion_pdf_sha256,
        v_borrador.resolucion_pdf_sha256,
        encode(sha256(('RESOLUCION-OFICIAL-TUPA-' || v_borrador.codigo || '-' || COALESCE(p_resolucion_numero, v_borrador.resolucion_numero, 'DIRECTORAL'))::bytea), 'hex')
    );

    -- Actualizar metadata en borrador antes de activar
    UPDATE sigd_tupa.version
       SET resolucion_numero = COALESCE(p_resolucion_numero, v_borrador.resolucion_numero, 'R.D. NÂ° ' || to_char(now(), 'YYYY') || '-DG/IESTP-SUIZA'),
           resolucion_fecha = COALESCE(p_resolucion_fecha, v_borrador.resolucion_fecha, CURRENT_DATE),
           fecha_vigencia = COALESCE(p_fecha_vigencia, v_borrador.fecha_vigencia, CURRENT_DATE),
           resolucion_pdf_ref = v_pdf_ref,
           resolucion_pdf_sha256 = v_pdf_sha256,
           version_anterior_id = COALESCE(v_actual.version_id, sigd_tupa.version.version_anterior_id)
     WHERE sigd_tupa.version.version_id = p_version_id;

    -- Superseder la actual VIGENTE
    IF v_actual.version_id IS NOT NULL THEN
        UPDATE sigd_tupa.version
           SET estado = 'SUPERSEDIDA'
         WHERE sigd_tupa.version.version_id = v_actual.version_id;
    END IF;

    -- Activar el borrador a VIGENTE
    UPDATE sigd_tupa.version
       SET estado = 'VIGENTE'
     WHERE sigd_tupa.version.version_id = p_version_id;

    RETURN QUERY
    SELECT p_version_id, v_borrador.codigo, v_borrador.nombre, 'VIGENTE'::VARCHAR(20), v_total, v_actual.version_id, v_actual.codigo;
END;
$$;

