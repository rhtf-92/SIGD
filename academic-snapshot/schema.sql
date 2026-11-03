--
-- PostgreSQL database dump
--

\restrict gSwFUjMgnvDVcS3QVQofzepmoJjrG6kIwgBIeVJ8FZAkCZ5BDYQ48cu53M9i3Tn

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: sigd_audit; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA sigd_audit;


--
-- Name: sigd_auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA sigd_auth;


--
-- Name: sigd_doc; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA sigd_doc;


--
-- Name: sigd_org; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA sigd_org;


--
-- Name: sigd_rut; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA sigd_rut;


--
-- Name: sigd_tra; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA sigd_tra;


--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: ltree; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public;


--
-- Name: EXTENSION ltree; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION ltree IS 'data type for hierarchical tree-like structures';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: fn_rechazar_mutacion_bitacora(); Type: FUNCTION; Schema: sigd_audit; Owner: -
--

CREATE FUNCTION sigd_audit.fn_rechazar_mutacion_bitacora() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'sigd_audit.bitacora_auditoria es inmutable (WORM): % rechazado', TG_OP
        USING ERRCODE = '23001',
              HINT = 'Registre un nuevo hecho administrativo en lugar de alterar el previo.';
END;
$$;


--
-- Name: fn_proteger_formulario_version(); Type: FUNCTION; Schema: sigd_doc; Owner: -
--

CREATE FUNCTION sigd_doc.fn_proteger_formulario_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'sigd_doc.formulario_version es inmutable: % rechazado sobre la versión %',
        TG_OP, OLD.version
        USING ERRCODE = '23001',
              HINT = 'Cree una nueva versión del formulario en lugar de alterar una publicada.';
END;
$$;


--
-- Name: fn_area_set_path(); Type: FUNCTION; Schema: sigd_org; Owner: -
--

CREATE FUNCTION sigd_org.fn_area_set_path() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_path  LTREE;
    v_nivel SMALLINT;
BEGIN
    IF NEW.area_padre_id IS NULL THEN
        SELECT text2ltree('a.' || replace(NEW.codigo, '.', '_')) INTO v_path;
        v_nivel := 1;
    ELSE
        SELECT path, nivel + 1 INTO v_path, v_nivel
        FROM sigd_org.area
        WHERE area_id = NEW.area_padre_id;

        IF v_path IS NULL THEN
            RAISE EXCEPTION 'El área padre % no existe o no tiene ruta calculada', NEW.area_padre_id
                USING ERRCODE = '23503';
        END IF;

        v_path := v_path || text2ltree('a.' || replace(NEW.codigo, '.', '_'));
    END IF;

    NEW.path := v_path;
    NEW.nivel := v_nivel;
    RETURN NEW;
END;
$$;


--
-- Name: actualizar_contador_expediente_externo(); Type: FUNCTION; Schema: sigd_rut; Owner: -
--

CREATE FUNCTION sigd_rut.actualizar_contador_expediente_externo() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'sigd_rut'
    AS $$
DECLARE
    v_vieja TEXT;
    v_nueva TEXT;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.expediente_id = NEW.expediente_id THEN
        RETURN NULL;
    END IF;
    IF TG_OP <> 'INSERT' THEN
        PERFORM pg_advisory_xact_lock(hashtext('exp_' || OLD.expediente_id::text));
        SELECT sigd_rut.pestana_de_estado(COALESCE(p.estado_nuevo, 'REGISTRADO'))
          INTO v_vieja FROM (SELECT 1) base
          LEFT JOIN sigd_rut.estado_actual_expediente p
            ON p.expediente_id = OLD.expediente_id;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        PERFORM pg_advisory_xact_lock(hashtext('exp_' || NEW.expediente_id::text));
        SELECT sigd_rut.pestana_de_estado(COALESCE(p.estado_nuevo, 'REGISTRADO'))
          INTO v_nueva FROM (SELECT 1) base
          LEFT JOIN sigd_rut.estado_actual_expediente p
            ON p.expediente_id = NEW.expediente_id;
    END IF;
    PERFORM 1 FROM sigd_rut.contador_pestana_local
     WHERE pestana IN (v_vieja, v_nueva) ORDER BY pestana FOR UPDATE;
    IF v_vieja IS NOT NULL THEN
        UPDATE sigd_rut.contador_pestana_local
           SET cantidad = cantidad - 1 WHERE pestana = v_vieja;
    END IF;
    IF v_nueva IS NOT NULL THEN
        UPDATE sigd_rut.contador_pestana_local
           SET cantidad = cantidad + 1 WHERE pestana = v_nueva;
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: actualizar_contador_pestana_local(); Type: FUNCTION; Schema: sigd_rut; Owner: -
--

CREATE FUNCTION sigd_rut.actualizar_contador_pestana_local() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'sigd_rut'
    AS $$
DECLARE
    v_anterior TEXT;
    v_nueva TEXT;
    v_expediente UUID;
    v_visible BOOLEAN;
BEGIN
    v_expediente := CASE WHEN TG_OP = 'DELETE' THEN OLD.expediente_id
                         ELSE NEW.expediente_id END;
    PERFORM pg_advisory_xact_lock(hashtext('exp_' || v_expediente::text));
    IF to_regclass('sigd_tra.expediente') IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM sigd_tra.expediente
            WHERE expediente_id = v_expediente) INTO v_visible;
        IF NOT v_visible THEN
            RETURN NULL;
        END IF;
    END IF;
    IF TG_OP <> 'INSERT' THEN
        v_anterior := sigd_rut.pestana_de_estado(OLD.estado_nuevo);
    ELSIF to_regclass('sigd_tra.expediente') IS NOT NULL THEN
        v_anterior := 'PENDIENTES';
    END IF;
    IF TG_OP <> 'DELETE' THEN
        v_nueva := sigd_rut.pestana_de_estado(NEW.estado_nuevo);
    ELSIF to_regclass('sigd_tra.expediente') IS NOT NULL THEN
        v_nueva := 'PENDIENTES';
    END IF;
    IF v_anterior IS NOT DISTINCT FROM v_nueva THEN
        RETURN NULL;
    END IF;
    -- Orden fijo para evitar deadlocks entre cambios de pestaña concurrentes.
    PERFORM 1 FROM sigd_rut.contador_pestana_local
     WHERE pestana IN (v_anterior, v_nueva) ORDER BY pestana FOR UPDATE;
    IF v_anterior IS NOT NULL THEN
        UPDATE sigd_rut.contador_pestana_local
           SET cantidad = cantidad - 1 WHERE pestana = v_anterior;
    END IF;
    IF v_nueva IS NOT NULL THEN
        UPDATE sigd_rut.contador_pestana_local
           SET cantidad = cantidad + 1 WHERE pestana = v_nueva;
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: actualizar_estado_actual_expediente(); Type: FUNCTION; Schema: sigd_rut; Owner: -
--

CREATE FUNCTION sigd_rut.actualizar_estado_actual_expediente() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'sigd_rut'
    AS $$
BEGIN
    INSERT INTO sigd_rut.estado_actual_expediente
        (expediente_id, secuencia, estado_nuevo, evento, area_actual_id,
         id_movimiento, fecha_hora, usuario_operador_id)
    VALUES (NEW.expediente_id, NEW.secuencia, NEW.estado_nuevo, NEW.evento,
            NEW.datos->>'areaId', NEW.id_movimiento, NEW.fecha_hora,
            NEW.usuario_operador_id)
    ON CONFLICT (expediente_id) DO UPDATE SET
        secuencia = EXCLUDED.secuencia,
        estado_nuevo = EXCLUDED.estado_nuevo,
        evento = EXCLUDED.evento,
        area_actual_id = EXCLUDED.area_actual_id,
        id_movimiento = EXCLUDED.id_movimiento,
        fecha_hora = EXCLUDED.fecha_hora,
        usuario_operador_id = EXCLUDED.usuario_operador_id
    WHERE sigd_rut.estado_actual_expediente.secuencia < EXCLUDED.secuencia;
    RETURN NULL;
END;
$$;


--
-- Name: pestana_de_estado(text); Type: FUNCTION; Schema: sigd_rut; Owner: -
--

CREATE FUNCTION sigd_rut.pestana_de_estado(p_estado text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    SET search_path TO 'pg_catalog'
    AS $$
    SELECT CASE
        WHEN p_estado IN ('REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION') THEN 'PENDIENTES'
        WHEN p_estado IN ('EN_REVISION', 'OBSERVADO', 'SUBSANADO') THEN 'EN_TRAMITE'
        WHEN p_estado = 'DERIVADO' THEN 'DERIVADOS'
        WHEN p_estado = 'EN_FIRMA' THEN 'POR_FIRMAR'
        WHEN p_estado = 'RESUELTO' THEN 'ATENDIDOS'
        WHEN p_estado = 'ARCHIVADO' THEN 'ARCHIVADOS'
    END
$$;


--
-- Name: rechazar_mutacion_compensatoria(); Type: FUNCTION; Schema: sigd_rut; Owner: -
--

CREATE FUNCTION sigd_rut.rechazar_mutacion_compensatoria() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
    RAISE EXCEPTION 'El asiento compensatorio es inmutable'
        USING ERRCODE = '23001';
END;
$$;


--
-- Name: registrar_movimiento_identidad(); Type: FUNCTION; Schema: sigd_rut; Owner: -
--

CREATE FUNCTION sigd_rut.registrar_movimiento_identidad() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'sigd_rut'
    AS $$
BEGIN
    IF NEW.secuencia IS NOT NULL THEN
        RAISE EXCEPTION 'La secuencia de RutaDoc se asigna en la base de datos'
            USING ERRCODE = '22023';
    END IF;

    INSERT INTO sigd_rut.movimiento_secuencia (expediente_id, ultima_secuencia)
        VALUES (NEW.expediente_id, 1)
        ON CONFLICT (expediente_id) DO UPDATE
            SET ultima_secuencia = sigd_rut.movimiento_secuencia.ultima_secuencia + 1
        RETURNING ultima_secuencia INTO NEW.secuencia;

    INSERT INTO sigd_rut.movimiento_identidad
        (id_movimiento, expediente_id, secuencia, fecha_hora, clave_idempotencia)
        VALUES (NEW.id_movimiento, NEW.expediente_id, NEW.secuencia,
                NEW.fecha_hora, NEW.clave_idempotencia);
    RETURN NEW;
END;
$$;


--
-- Name: acumular_expediente(uuid, uuid, text); Type: FUNCTION; Schema: sigd_tra; Owner: -
--

CREATE FUNCTION sigd_tra.acumular_expediente(p_expediente_principal uuid, p_expediente_accesorio uuid, p_acto_resolutivo text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id_acumulacion UUID;
BEGIN
    IF p_expediente_principal = p_expediente_accesorio THEN
        RAISE EXCEPTION 'Un expediente no puede acumularse a sí mismo: %', p_expediente_principal
            USING ERRCODE = '22023';
    END IF;
    IF p_acto_resolutivo IS NULL OR btrim(p_acto_resolutivo) = '' THEN
        RAISE EXCEPTION 'La acumulación exige un acto resolutivo justificado'
            USING ERRCODE = '22023';
    END IF;

    -- Bloqueo pesimista de ambas filas
    PERFORM 1 FROM sigd_tra.expediente WHERE expediente_id = p_expediente_principal FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Expediente principal no encontrado: %', p_expediente_principal
            USING ERRCODE = '02000';
    END IF;

    PERFORM 1 FROM sigd_tra.expediente WHERE expediente_id = p_expediente_accesorio FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Expediente accesorio no encontrado: %', p_expediente_accesorio
            USING ERRCODE = '02000';
    END IF;

    -- Validar que el accesorio no esté ya acumulado
    IF EXISTS (
        SELECT 1 FROM sigd_tra.expediente_acumulacion
         WHERE expediente_accesorio = p_expediente_accesorio
           AND estado = 'ACUMULADO'
    ) THEN
        RAISE EXCEPTION 'El expediente accesorio % ya se encuentra acumulado activamente', p_expediente_accesorio
            USING ERRCODE = '23505';
    END IF;

    -- Prevenir ciclos (que el principal no sea accesorio del que se pretende acumular)
    IF EXISTS (
        SELECT 1 FROM sigd_tra.expediente_acumulacion
         WHERE expediente_principal = p_expediente_accesorio
           AND expediente_accesorio = p_expediente_principal
           AND estado = 'ACUMULADO'
    ) THEN
        RAISE EXCEPTION 'Ciclo de dependencia detectado entre expedientes % y %', p_expediente_principal, p_expediente_accesorio
            USING ERRCODE = '23514';
    END IF;

    INSERT INTO sigd_tra.expediente_acumulacion (
        expediente_principal, expediente_accesorio, acto_resolutivo, estado
    ) VALUES (
        p_expediente_principal, p_expediente_accesorio, p_acto_resolutivo, 'ACUMULADO'
    ) RETURNING id_acumulacion INTO v_id_acumulacion;

    RETURN v_id_acumulacion;
END;
$$;


--
-- Name: FUNCTION acumular_expediente(p_expediente_principal uuid, p_expediente_accesorio uuid, p_acto_resolutivo text); Type: COMMENT; Schema: sigd_tra; Owner: -
--

COMMENT ON FUNCTION sigd_tra.acumular_expediente(p_expediente_principal uuid, p_expediente_accesorio uuid, p_acto_resolutivo text) IS 'Acumula expedientes conexos bajo el Art. 160 del TUO de la Ley N° 27444 con control acíclico.';


--
-- Name: agregar_folio_expediente(uuid, uuid, integer, uuid); Type: FUNCTION; Schema: sigd_tra; Owner: -
--

CREATE FUNCTION sigd_tra.agregar_folio_expediente(p_id_expediente uuid, p_id_documento uuid, p_cantidad integer, p_usuario_id uuid DEFAULT NULL::uuid) RETURNS TABLE(folio_inicio integer, folio_fin integer)
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


--
-- Name: exigir_adjunto_virtual(); Type: FUNCTION; Schema: sigd_tra; Owner: -
--

CREATE FUNCTION sigd_tra.exigir_adjunto_virtual() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW.tipo_tramite_id IS NOT NULL AND NOT EXISTS
  (SELECT 1 FROM sigd_doc.documento_adjunto WHERE expediente_id=NEW.expediente_id) THEN
  RAISE EXCEPTION 'La radicacion virtual exige un adjunto confirmado';
 END IF;
 RETURN NEW;
END $$;


--
-- Name: fn_generar_cut(integer); Type: FUNCTION; Schema: sigd_tra; Owner: -
--

CREATE FUNCTION sigd_tra.fn_generar_cut(p_anio integer) RETURNS character varying
    LANGUAGE sql STRICT
    AS $$
    SELECT sigd_tra.generar_cut_expediente(p_anio);
$$;


--
-- Name: FUNCTION fn_generar_cut(p_anio integer); Type: COMMENT; Schema: sigd_tra; Owner: -
--

COMMENT ON FUNCTION sigd_tra.fn_generar_cut(p_anio integer) IS 'Alias canónico de compatibilidad para sigd_tra.generar_cut_expediente(INT).';


--
-- Name: fn_mgd_dias_habiles_entre(timestamp with time zone, timestamp with time zone, date[]); Type: FUNCTION; Schema: sigd_tra; Owner: -
--

CREATE FUNCTION sigd_tra.fn_mgd_dias_habiles_entre(p_desde timestamp with time zone, p_hasta timestamp with time zone, p_feriados date[] DEFAULT ARRAY[]::date[]) RETURNS numeric
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
    SELECT COUNT(*)::NUMERIC
      FROM generate_series(
               (p_desde AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date + 1,
               (p_hasta AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date,
               INTERVAL '1 day'
           ) AS g(d)
     WHERE p_desde IS NOT NULL
       AND p_hasta IS NOT NULL
       AND EXTRACT(ISODOW FROM g.d::date) <= 5
       AND NOT (g.d::date = ANY (COALESCE(p_feriados, ARRAY[]::DATE[])));
$$;


--
-- Name: FUNCTION fn_mgd_dias_habiles_entre(p_desde timestamp with time zone, p_hasta timestamp with time zone, p_feriados date[]); Type: COMMENT; Schema: sigd_tra; Owner: -
--

COMMENT ON FUNCTION sigd_tra.fn_mgd_dias_habiles_entre(p_desde timestamp with time zone, p_hasta timestamp with time zone, p_feriados date[]) IS 'Dias habil entre dos instantes; el dia inicial no consume plazo. Misma regla que calcularSla() de RutaDoc.';


--
-- Name: fn_mgd_horas_habiles(timestamp with time zone, timestamp with time zone, date[]); Type: FUNCTION; Schema: sigd_tra; Owner: -
--

CREATE FUNCTION sigd_tra.fn_mgd_horas_habiles(p_desde timestamp with time zone, p_hasta timestamp with time zone, p_feriados date[] DEFAULT ARRAY[]::date[]) RETURNS numeric
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
    WITH dias AS (
        SELECT g.d::date AS dia
          FROM generate_series(
                   (p_desde AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date,
                   (p_hasta AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date,
                   INTERVAL '1 day'
               ) AS g(d)
         WHERE p_desde IS NOT NULL
           AND p_hasta IS NOT NULL
           AND p_hasta > p_desde
    ),
    habiles AS (
        SELECT d.dia
          FROM dias d
         WHERE EXTRACT(ISODOW FROM d.dia) <= 5
           AND NOT (d.dia = ANY (COALESCE(p_feriados, ARRAY[]::DATE[])))
    ),
    ventanas AS (
        -- El intervalo (no la cadena POSIX) lee `dia 08:00` como hora de Lima y
        -- devuelve el instante UTC correspondiente, sea cual sea el `TimeZone` de
        -- la sesión.
        SELECT (h.dia + TIME '08:00')
                   AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE AS apertura,
               (h.dia + TIME '16:30')
                   AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE AS cierre
          FROM habiles h
    )
    SELECT COALESCE(ROUND(SUM(
               GREATEST(0, EXTRACT(EPOCH FROM (
                   LEAST(v.cierre, p_hasta) - GREATEST(v.apertura, p_desde)
               )) / 3600.0)
           )::NUMERIC, 4), 0)
      FROM ventanas v;
$$;


--
-- Name: FUNCTION fn_mgd_horas_habiles(p_desde timestamp with time zone, p_hasta timestamp with time zone, p_feriados date[]); Type: COMMENT; Schema: sigd_tra; Owner: -
--

COMMENT ON FUNCTION sigd_tra.fn_mgd_horas_habiles(p_desde timestamp with time zone, p_hasta timestamp with time zone, p_feriados date[]) IS 'Horas habil institucionales (America/Lima, 08:00-16:30, sin sabado, domingo ni feriados) entre dos instantes. NUMERIC con 4 decimales.';


--
-- Name: fn_rechazar_mutacion_asiento(); Type: FUNCTION; Schema: sigd_tra; Owner: -
--

CREATE FUNCTION sigd_tra.fn_rechazar_mutacion_asiento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'El Libro General no admite eliminación física (TUO Ley 27444, Arts. 153-156)'
            USING ERRCODE = '23001',
                  HINT = 'Anule el asiento con anulado = TRUE.';
    END IF;
    IF OLD.numero_registro IS DISTINCT FROM NEW.numero_registro THEN
        RAISE EXCEPTION 'numero_registro es inmutable'
            USING ERRCODE = '23001';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: fn_rechazar_mutacion_folio(); Type: FUNCTION; Schema: sigd_tra; Owner: -
--

CREATE FUNCTION sigd_tra.fn_rechazar_mutacion_folio() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'La foliación es inmutable (Directiva AGN): % rechazado sobre %',
        TG_OP, OLD.id_folio
        USING ERRCODE = '23001',
              HINT = 'Los folios emitidos no se corrigen; registre un nuevo documento.';
END;
$$;


--
-- Name: fn_tra_expediente_asignar_cut(); Type: FUNCTION; Schema: sigd_tra; Owner: -
--

CREATE FUNCTION sigd_tra.fn_tra_expediente_asignar_cut() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.codigo_expediente IS NULL OR NEW.codigo_expediente = '' THEN
        NEW.codigo_expediente := sigd_tra.generar_cut_expediente(
            EXTRACT(YEAR FROM COALESCE(NEW.fecha_radicacion, NOW()))::INT
        );
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: fn_verificar_continuidad_folio(); Type: FUNCTION; Schema: sigd_tra; Owner: -
--

CREATE FUNCTION sigd_tra.fn_verificar_continuidad_folio() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_esperado INT;
BEGIN
    PERFORM 1 FROM sigd_tra.expediente WHERE expediente_id = NEW.expediente_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Expediente inexistente: %', NEW.expediente_id
            USING ERRCODE = '23503';
    END IF;

    SELECT COALESCE(MAX(folio_fin), 0) + 1
      INTO v_esperado
      FROM sigd_tra.expediente_documento_folio
     WHERE expediente_id = NEW.expediente_id;

    IF NEW.folio_inicio <> v_esperado THEN
        RAISE EXCEPTION 'Foliación no continua en expediente %: el folio % debe comenzar en %',
            NEW.expediente_id, NEW.folio_inicio, v_esperado
            USING ERRCODE = '23514',
                  HINT = 'Use sigd_tra.agregar_folio_expediente() para asignar folios correlativos.';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: generar_cut_expediente(integer); Type: FUNCTION; Schema: sigd_tra; Owner: -
--

CREATE FUNCTION sigd_tra.generar_cut_expediente(p_anio integer) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_correlativo BIGINT;
    v_cut         VARCHAR(20);
BEGIN
    IF p_anio IS NULL OR p_anio <= 0 THEN
        RAISE EXCEPTION 'Año fiscal inválido: %', p_anio
            USING ERRCODE = '22023';
    END IF;

    INSERT INTO sigd_tra.secuencia_anual_cut (anio_fiscal, ultimo_correlativo)
    VALUES (p_anio, 0)
    ON CONFLICT (anio_fiscal) DO NOTHING;

    SELECT ultimo_correlativo + 1
      INTO v_correlativo
      FROM sigd_tra.secuencia_anual_cut
     WHERE anio_fiscal = p_anio
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se pudo inicializar la secuencia anual del %', p_anio
            USING ERRCODE = '40001';
    END IF;

    UPDATE sigd_tra.secuencia_anual_cut
       SET ultimo_correlativo = v_correlativo
     WHERE anio_fiscal = p_anio;

    v_cut := 'EXP-' || p_anio::TEXT || '-' || LPAD(v_correlativo::TEXT, 6, '0');
    RETURN v_cut;
END;
$$;


--
-- Name: FUNCTION generar_cut_expediente(p_anio integer); Type: COMMENT; Schema: sigd_tra; Owner: -
--

COMMENT ON FUNCTION sigd_tra.generar_cut_expediente(p_anio integer) IS 'Genera el Código Único de Trámite con máscara EXP-YYYY-XXXXXX bajo bloqueo pesimista de fila (cero colisiones).';


--
-- Name: refrescar_vistas_mgd(); Type: FUNCTION; Schema: sigd_tra; Owner: -
--

CREATE FUNCTION sigd_tra.refrescar_vistas_mgd() RETURNS TABLE(vista text, duracion_ms numeric)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_inicio TIMESTAMPTZ := clock_timestamp();
    v_fin    TIMESTAMPTZ;
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY sigd_tra.mv_kpis_mgd_mensual;
    v_fin := clock_timestamp();
    vista := 'sigd_tra.mv_kpis_mgd_mensual';
    duracion_ms := EXTRACT(EPOCH FROM (v_fin - v_inicio)) * 1000;
    RETURN NEXT;

    v_inicio := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY sigd_tra.mv_tiempos_retencion_area;
    v_fin := clock_timestamp();
    vista := 'sigd_tra.mv_tiempos_retencion_area';
    duracion_ms := EXTRACT(EPOCH FROM (v_fin - v_inicio)) * 1000;
    RETURN NEXT;
END;
$$;


--
-- Name: FUNCTION refrescar_vistas_mgd(); Type: COMMENT; Schema: sigd_tra; Owner: -
--

COMMENT ON FUNCTION sigd_tra.refrescar_vistas_mgd() IS 'Refresco concurrente de las vistas MGD sin bloquear lecturas (#51). El endpoint administrativo la invoca sobre su propia conexión, fuera de la transacción de negocio.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: sigd_migraciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sigd_migraciones (
    id integer NOT NULL,
    nombre_script character varying(255) NOT NULL,
    checksum_sha256 character(64) NOT NULL,
    ejecutado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sigd_migraciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sigd_migraciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sigd_migraciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sigd_migraciones_id_seq OWNED BY public.sigd_migraciones.id;


--
-- Name: bitacora_auditoria; Type: TABLE; Schema: sigd_audit; Owner: -
--

CREATE TABLE sigd_audit.bitacora_auditoria (
    id_auditoria uuid DEFAULT gen_random_uuid() NOT NULL,
    correlation_id uuid NOT NULL,
    usuario_id uuid,
    ip_origen inet,
    user_agent character varying(512),
    esquema character varying(64) NOT NULL,
    tabla character varying(64) NOT NULL,
    operacion character varying(16) NOT NULL,
    datos_antes jsonb,
    datos_despues jsonb NOT NULL,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_bitacora_fecha_horaria CHECK ((fecha_hora IS NOT NULL)),
    CONSTRAINT chk_bitacora_operacion CHECK (((operacion)::text = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::text[])))
)
WITH (fillfactor='100');


--
-- Name: TABLE bitacora_auditoria; Type: COMMENT; Schema: sigd_audit; Owner: -
--

COMMENT ON TABLE sigd_audit.bitacora_auditoria IS 'Bitácora forense inmutable (append-only). Solo INSERT y SELECT para la cuenta de aplicación.';


--
-- Name: COLUMN bitacora_auditoria.correlation_id; Type: COMMENT; Schema: sigd_audit; Owner: -
--

COMMENT ON COLUMN sigd_audit.bitacora_auditoria.correlation_id IS 'UUIDv4 de la solicitud. SIN valor por defecto: debe propagarse SIEMPRE desde el contexto AsyncLocalStorage; la BD no genera un UUID distinto.';


--
-- Name: COLUMN bitacora_auditoria.datos_antes; Type: COMMENT; Schema: sigd_audit; Owner: -
--

COMMENT ON COLUMN sigd_audit.bitacora_auditoria.datos_antes IS 'Estado previo de la fila (NULL para INSERT).';


--
-- Name: COLUMN bitacora_auditoria.datos_despues; Type: COMMENT; Schema: sigd_audit; Owner: -
--

COMMENT ON COLUMN sigd_audit.bitacora_auditoria.datos_despues IS 'Estado posterior de la fila (para DELETE puede ser el estado previo a la eliminación).';


--
-- Name: evento_outbox; Type: TABLE; Schema: sigd_audit; Owner: -
--

CREATE TABLE sigd_audit.evento_outbox (
    id_evento uuid DEFAULT gen_random_uuid() NOT NULL,
    correlation_id uuid NOT NULL,
    agregado character varying(64) NOT NULL,
    tipo_evento character varying(64) NOT NULL,
    payload jsonb NOT NULL,
    estado character varying(16) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    intentos smallint DEFAULT 0 NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    procesado_en timestamp with time zone,
    CONSTRAINT chk_outbox_estado CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'PROCESADO'::character varying, 'FALLIDO'::character varying])::text[]))),
    CONSTRAINT chk_outbox_intentos CHECK ((intentos >= 0)),
    CONSTRAINT chk_outbox_procesado_en CHECK ((((estado)::text = 'PENDIENTE'::text) OR (procesado_en IS NOT NULL) OR ((estado)::text = 'FALLIDO'::text)))
);


--
-- Name: TABLE evento_outbox; Type: COMMENT; Schema: sigd_audit; Owner: -
--

COMMENT ON TABLE sigd_audit.evento_outbox IS 'Transactional Outbox: eventos persistidos atómicamente con la mutación de negocio y despachados por el worker.';


--
-- Name: COLUMN evento_outbox.estado; Type: COMMENT; Schema: sigd_audit; Owner: -
--

COMMENT ON COLUMN sigd_audit.evento_outbox.estado IS 'PENDIENTE -> PROCESADO (éxito) o FALLIDO (dead-letter tras agotar reintentos). Solo el worker modifica este campo.';


--
-- Name: auditoria_usuarios; Type: TABLE; Schema: sigd_auth; Owner: -
--

CREATE TABLE sigd_auth.auditoria_usuarios (
    id_auditoria uuid DEFAULT gen_random_uuid() NOT NULL,
    correlation_id uuid NOT NULL,
    id_usuario uuid,
    operacion character varying(64) NOT NULL,
    detalle jsonb,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: consentimiento_datos; Type: TABLE; Schema: sigd_auth; Owner: -
--

CREATE TABLE sigd_auth.consentimiento_datos (
    id_consentimiento uuid DEFAULT gen_random_uuid() NOT NULL,
    id_persona uuid NOT NULL,
    finalidade character varying(120) NOT NULL,
    version_politica character varying(20) NOT NULL,
    aceptado boolean NOT NULL,
    fecha_aceptacion timestamp with time zone,
    ip_origen inet,
    CONSTRAINT chk_consentimiento_aceptacion CHECK (((aceptado = false) OR (fecha_aceptacion IS NOT NULL)))
);


--
-- Name: cuenta_usuario; Type: TABLE; Schema: sigd_auth; Owner: -
--

CREATE TABLE sigd_auth.cuenta_usuario (
    id_usuario uuid DEFAULT gen_random_uuid() NOT NULL,
    id_persona uuid NOT NULL,
    usuario character varying(60) NOT NULL,
    correo character varying(160) NOT NULL,
    password_hash character varying(255) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    ultimo_acceso timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    intentos_fallidos smallint DEFAULT 0 NOT NULL,
    bloqueado_hasta timestamp with time zone,
    CONSTRAINT chk_cuenta_usuario_algoritmo CHECK (((password_hash)::text ~~ '$argon2id$%'::text)),
    CONSTRAINT chk_cuenta_usuario_intentos_fallidos CHECK ((intentos_fallidos >= 0))
);


--
-- Name: distrito_ubigeo; Type: TABLE; Schema: sigd_auth; Owner: -
--

CREATE TABLE sigd_auth.distrito_ubigeo (
    codigo character(6) NOT NULL,
    provincia_codigo character(4) NOT NULL,
    nombre character varying(120) NOT NULL
);


--
-- Name: notificacion_casilla; Type: TABLE; Schema: sigd_auth; Owner: -
--

CREATE TABLE sigd_auth.notificacion_casilla (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid,
    correo_destinatario character varying(160),
    cut character varying(20),
    asunto character varying(255) NOT NULL,
    tipo_acto character varying(100) DEFAULT 'Notificación de Acto Administrativo'::character varying NOT NULL,
    numero_documento character varying(100),
    cuerpo jsonb,
    referencia character varying(100),
    estado character varying(20) DEFAULT 'NO_LEIDO'::character varying NOT NULL,
    fecha_deposito timestamp with time zone DEFAULT now() NOT NULL,
    fecha_lectura timestamp with time zone,
    hash_sha256 character varying(64),
    cvd character varying(64),
    id_acuse character varying(50),
    acuse_hash_sha256 character varying(64),
    acuse_sellado_tiempo timestamp with time zone,
    documento_url character varying(255),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_notificacion_casilla_estado CHECK (((estado)::text = ANY ((ARRAY['NO_LEIDO'::character varying, 'LEIDO'::character varying, 'PENDIENTE'::character varying, 'NOTIFICADO'::character varying])::text[])))
);


--
-- Name: perfil_usuario; Type: TABLE; Schema: sigd_auth; Owner: -
--

CREATE TABLE sigd_auth.perfil_usuario (
    id_usuario uuid NOT NULL,
    cargo_id uuid,
    area_id uuid,
    telefono character varying(20),
    firma_electronica_habilitada boolean DEFAULT false NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: persona; Type: TABLE; Schema: sigd_auth; Owner: -
--

CREATE TABLE sigd_auth.persona (
    id_persona uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo character varying(20) NOT NULL,
    id_documento character varying(20) NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    direccion character varying(250),
    ubigeo_distrito character(6),
    CONSTRAINT chk_persona_tipo CHECK (((tipo)::text = ANY ((ARRAY['NATURAL'::character varying, 'JURIDICA'::character varying])::text[])))
);


--
-- Name: persona_documento_historial; Type: TABLE; Schema: sigd_auth; Owner: -
--

CREATE TABLE sigd_auth.persona_documento_historial (
    id_historial uuid DEFAULT gen_random_uuid() NOT NULL,
    id_persona uuid NOT NULL,
    id_documento character varying(20) NOT NULL,
    tipo_documento smallint,
    fecha_registro timestamp with time zone DEFAULT now() NOT NULL,
    origen character varying(64) NOT NULL,
    CONSTRAINT chk_persona_documento_historial_origen CHECK (((origen)::text = ANY ((ARRAY['RENIEC'::character varying, 'SUNAT'::character varying, 'MANUAL'::character varying])::text[])))
);


--
-- Name: persona_juridica; Type: TABLE; Schema: sigd_auth; Owner: -
--

CREATE TABLE sigd_auth.persona_juridica (
    id_persona uuid NOT NULL,
    razon_social character varying(255) NOT NULL,
    nombre_comercial character varying(255),
    representante_legal character varying(255),
    direccion character varying(255),
    partida_registral_sunarp character varying(18)
);


--
-- Name: persona_natural; Type: TABLE; Schema: sigd_auth; Owner: -
--

CREATE TABLE sigd_auth.persona_natural (
    id_persona uuid NOT NULL,
    nombres character varying(120) NOT NULL,
    apellidos character varying(120) NOT NULL,
    nombre_completo character varying(255) NOT NULL,
    fecha_nacimiento date,
    sexo character(1),
    correo character varying(160),
    telefono character varying(20),
    CONSTRAINT chk_persona_natural_sexo CHECK (((sexo IS NULL) OR (sexo = ANY (ARRAY['M'::bpchar, 'F'::bpchar]))))
);


--
-- Name: provincia_ubigeo; Type: TABLE; Schema: sigd_auth; Owner: -
--

CREATE TABLE sigd_auth.provincia_ubigeo (
    codigo character(4) NOT NULL,
    nombre character varying(100) NOT NULL
);


--
-- Name: representacion_legal; Type: TABLE; Schema: sigd_auth; Owner: -
--

CREATE TABLE sigd_auth.representacion_legal (
    id_representacion uuid DEFAULT gen_random_uuid() NOT NULL,
    id_persona_juridica uuid NOT NULL,
    id_persona_natural uuid NOT NULL,
    cargo character varying(120) NOT NULL,
    vigente_desde date DEFAULT CURRENT_DATE NOT NULL,
    vigente_hasta date,
    CONSTRAINT chk_representacion_vigencia CHECK (((vigente_hasta IS NULL) OR (vigente_hasta >= vigente_desde)))
);


--
-- Name: sesion_usuario; Type: TABLE; Schema: sigd_auth; Owner: -
--

CREATE TABLE sigd_auth.sesion_usuario (
    id_sesion uuid DEFAULT gen_random_uuid() NOT NULL,
    id_usuario uuid NOT NULL,
    refresh_token character varying(255) NOT NULL,
    fingerprint character varying(128),
    ip_origen inet,
    user_agent character varying(512),
    emitido_en timestamp with time zone DEFAULT now() NOT NULL,
    expira_en timestamp with time zone NOT NULL,
    revocado_en timestamp with time zone,
    CONSTRAINT chk_sesion_usuario_vigencia CHECK ((expira_en > emitido_en))
);


--
-- Name: tipos_documento; Type: TABLE; Schema: sigd_auth; Owner: -
--

CREATE TABLE sigd_auth.tipos_documento (
    id_tipo_documento smallint NOT NULL,
    codigo character varying(10) NOT NULL,
    descripcion character varying(120) NOT NULL,
    requiere_ruc boolean DEFAULT false NOT NULL,
    largo smallint DEFAULT 8 NOT NULL,
    vigente boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_tipos_documento_codigo CHECK (((codigo)::text = ANY ((ARRAY['DNI'::character varying, 'CE'::character varying, 'RUC'::character varying, 'PASAPORTE'::character varying])::text[])))
);


--
-- Name: tipos_documento_id_tipo_documento_seq; Type: SEQUENCE; Schema: sigd_auth; Owner: -
--

ALTER TABLE sigd_auth.tipos_documento ALTER COLUMN id_tipo_documento ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sigd_auth.tipos_documento_id_tipo_documento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: carga_documento; Type: TABLE; Schema: sigd_doc; Owner: -
--

CREATE TABLE sigd_doc.carga_documento (
    carga_id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    nombre_archivo character varying(255) NOT NULL,
    tamano_bytes bigint NOT NULL,
    sha256 character(64) NOT NULL,
    s3_bucket text NOT NULL,
    s3_key text NOT NULL,
    estado text DEFAULT 'PENDIENTE'::text NOT NULL,
    expediente_id uuid,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT carga_documento_estado_check CHECK ((estado = ANY (ARRAY['PENDIENTE'::text, 'CONFIRMADO'::text, 'VINCULADO'::text]))),
    CONSTRAINT carga_documento_sha256_check CHECK ((sha256 ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT carga_documento_tamano_bytes_check CHECK (((tamano_bytes >= 1) AND (tamano_bytes <= 20971520)))
);


--
-- Name: documento_adjunto; Type: TABLE; Schema: sigd_doc; Owner: -
--

CREATE TABLE sigd_doc.documento_adjunto (
    documento_adjunto_id uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    tipo_documental_id uuid NOT NULL,
    nombre_archivo character varying(255) NOT NULL,
    s3_bucket character varying(120) NOT NULL,
    s3_key character varying(500) NOT NULL,
    sha256 character(64) NOT NULL,
    tamano_bytes bigint NOT NULL,
    mime_type character varying(120) NOT NULL,
    magic_bytes character varying(16),
    subido_por uuid,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_documento_adjunto_tamano CHECK ((tamano_bytes > 0))
);


--
-- Name: COLUMN documento_adjunto.sha256; Type: COMMENT; Schema: sigd_doc; Owner: -
--

COMMENT ON COLUMN sigd_doc.documento_adjunto.sha256 IS 'SHA-256 del binario. La restricción de unicidad por bucket habilita la deduplicación de objetos idénticos.';


--
-- Name: COLUMN documento_adjunto.magic_bytes; Type: COMMENT; Schema: sigd_doc; Owner: -
--

COMMENT ON COLUMN sigd_doc.documento_adjunto.magic_bytes IS 'Prefijo hexadecimal de los Magic Bytes (PDF = 25504446) verificados en la carga presignada.';


--
-- Name: expediente; Type: TABLE; Schema: sigd_doc; Owner: -
--

CREATE TABLE sigd_doc.expediente (
    expediente_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo_tramite_id uuid NOT NULL,
    formulario_version_id uuid,
    codigo_expediente character varying(20) NOT NULL,
    asunto character varying(500) NOT NULL,
    area_actual_id uuid,
    solicitante_id uuid NOT NULL,
    estado character varying(30) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    fecha_registro timestamp with time zone DEFAULT now() NOT NULL,
    fecha_limite timestamp with time zone,
    CONSTRAINT chk_doc_expediente_cut CHECK (((codigo_expediente)::text ~ '^EXP-[0-9]{4}-[0-9]{6}$'::text)),
    CONSTRAINT chk_doc_expediente_estado CHECK (((estado)::text = ANY ((ARRAY['REGISTRADO'::character varying, 'EN_TRAMITE'::character varying, 'OBSERVADO'::character varying, 'RESUELTO'::character varying, 'ANULADO'::character varying])::text[])))
);


--
-- Name: expediente_formulario_respuesta; Type: TABLE; Schema: sigd_doc; Owner: -
--

CREATE TABLE sigd_doc.expediente_formulario_respuesta (
    id_respuesta uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    formulario_version_id uuid NOT NULL,
    datos jsonb NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expediente_requisito; Type: TABLE; Schema: sigd_doc; Owner: -
--

CREATE TABLE sigd_doc.expediente_requisito (
    id_expediente_requisito uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    requisito_id uuid NOT NULL,
    cumplido boolean DEFAULT false NOT NULL,
    documento_adjunto_id uuid,
    verificado_en timestamp with time zone
);


--
-- Name: firma_digital_documento; Type: TABLE; Schema: sigd_doc; Owner: -
--

CREATE TABLE sigd_doc.firma_digital_documento (
    documento_id uuid NOT NULL,
    cvd character varying(40) DEFAULT ((('CVD-'::text || to_char((CURRENT_DATE)::timestamp with time zone, 'YYYY'::text)) || '-'::text) || upper(substr(md5((gen_random_uuid())::text), 1, 16))) NOT NULL,
    sha256_firmado character(64) NOT NULL,
    firmante text NOT NULL,
    fecha_sello_tsa timestamp with time zone NOT NULL,
    s3_bucket character varying(100) NOT NULL,
    s3_key character varying(500) NOT NULL,
    estado character varying(30) DEFAULT 'FIRMADO_DIGITALMENTE'::character varying NOT NULL,
    fecha_registro timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_firma_estado CHECK (((estado)::text = 'FIRMADO_DIGITALMENTE'::text)),
    CONSTRAINT chk_firma_sha256 CHECK ((sha256_firmado ~ '^[0-9a-fA-F]{64}$'::text))
);


--
-- Name: formulario_version; Type: TABLE; Schema: sigd_doc; Owner: -
--

CREATE TABLE sigd_doc.formulario_version (
    formulario_version_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo_tramite_id uuid NOT NULL,
    version smallint NOT NULL,
    json_schema jsonb NOT NULL,
    vigente_desde date DEFAULT CURRENT_DATE NOT NULL,
    vigente_hasta date,
    publicado_por uuid,
    CONSTRAINT chk_formulario_vigencia CHECK (((vigente_hasta IS NULL) OR (vigente_hasta >= vigente_desde)))
);


--
-- Name: requisito; Type: TABLE; Schema: sigd_doc; Owner: -
--

CREATE TABLE sigd_doc.requisito (
    requisito_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo_tramite_id uuid NOT NULL,
    codigo character varying(30) NOT NULL,
    denominacion character varying(300) NOT NULL,
    obligatorio boolean DEFAULT true NOT NULL,
    orden smallint DEFAULT 0 NOT NULL
);


--
-- Name: resolucion; Type: TABLE; Schema: sigd_doc; Owner: -
--

CREATE TABLE sigd_doc.resolucion (
    resolucion_id uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    numero_borrador character varying(40) NOT NULL,
    numero_resolucion character varying(40),
    tipo_resolucion character varying(40) NOT NULL,
    asunto character varying(500) NOT NULL,
    estado character varying(40) DEFAULT 'BORRADOR_PENDIENTE_FIRMA'::character varying NOT NULL,
    fecha_proyeccion date NOT NULL,
    proyectado_por uuid,
    firmado_por uuid,
    firmado_en timestamp with time zone,
    hash_pades character varying(128),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_resolucion_estado CHECK (((estado)::text = ANY ((ARRAY['BORRADOR_PENDIENTE_FIRMA'::character varying, 'EN_FIRMA'::character varying, 'FIRMADA'::character varying, 'NOTIFICADA'::character varying, 'ANULADA'::character varying])::text[]))),
    CONSTRAINT chk_resolucion_firma CHECK ((((estado)::text <> ALL ((ARRAY['FIRMADA'::character varying, 'NOTIFICADA'::character varying])::text[])) OR (firmado_en IS NOT NULL))),
    CONSTRAINT chk_resolucion_tipo CHECK (((tipo_resolucion)::text = ANY ((ARRAY['DIRECTORAL_TITULACION'::character varying, 'DIRECTORAL_CONVALIDACION'::character varying, 'DIRECTORAL_ADMINISTRATIVA'::character varying])::text[])))
);


--
-- Name: tipo_documento; Type: TABLE; Schema: sigd_doc; Owner: -
--

CREATE TABLE sigd_doc.tipo_documento (
    tipo_documental_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(160) NOT NULL,
    extension character varying(10) DEFAULT 'pdf'::character varying NOT NULL,
    mime_type character varying(120) DEFAULT 'application/pdf'::character varying NOT NULL,
    tamano_maximo_mb smallint DEFAULT 25 NOT NULL,
    exige_firma boolean DEFAULT false NOT NULL,
    vigente boolean DEFAULT true NOT NULL
);


--
-- Name: tipo_documento_requisito; Type: TABLE; Schema: sigd_doc; Owner: -
--

CREATE TABLE sigd_doc.tipo_documento_requisito (
    id_relacion uuid DEFAULT gen_random_uuid() NOT NULL,
    requisito_id uuid NOT NULL,
    tipo_documental_id uuid NOT NULL,
    condicion_json_pointer character varying(200)
);


--
-- Name: tipo_tramite_tupa; Type: TABLE; Schema: sigd_doc; Owner: -
--

CREATE TABLE sigd_doc.tipo_tramite_tupa (
    tipo_tramite_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(30) NOT NULL,
    denominacion character varying(300) NOT NULL,
    descripcion text,
    unidad_organica character varying(160) NOT NULL,
    plazo_dias smallint DEFAULT 30 NOT NULL,
    silencio_administrativo character varying(30) DEFAULT 'POSITIVO'::character varying NOT NULL,
    base_legal character varying(500),
    vigente boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_tupa_plazo CHECK ((plazo_dias > 0)),
    CONSTRAINT chk_tupa_silencio CHECK (((silencio_administrativo)::text = ANY ((ARRAY['POSITIVO'::character varying, 'NEGATIVO'::character varying])::text[])))
);


--
-- Name: COLUMN tipo_tramite_tupa.plazo_dias; Type: COMMENT; Schema: sigd_doc; Owner: -
--

COMMENT ON COLUMN sigd_doc.tipo_tramite_tupa.plazo_dias IS 'Plazo máximo legal supletorio de 30 días hábiles (TUO Ley N° 27444, Art. 143).';


--
-- Name: workflow_academico; Type: TABLE; Schema: sigd_doc; Owner: -
--

CREATE TABLE sigd_doc.workflow_academico (
    id_tramite bigint NOT NULL,
    workflow jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_workflow_etapas CHECK (((jsonb_typeof((workflow -> 'etapas'::text)) = 'array'::text) AND (jsonb_array_length((workflow -> 'etapas'::text)) = 5))),
    CONSTRAINT chk_workflow_id_consistente CHECK ((((workflow ->> 'idTramite'::text))::bigint = id_tramite)),
    CONSTRAINT workflow_academico_version_check CHECK ((version > 0))
);


--
-- Name: area; Type: TABLE; Schema: sigd_org; Owner: -
--

CREATE TABLE sigd_org.area (
    area_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(160) NOT NULL,
    area_padre_id uuid,
    path public.ltree NOT NULL,
    nivel smallint DEFAULT 1 NOT NULL,
    vigente boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_area_nivel CHECK ((nivel >= 1))
);


--
-- Name: COLUMN area.path; Type: COMMENT; Schema: sigd_org; Owner: -
--

COMMENT ON COLUMN sigd_org.area.path IS 'Ruta jerárquica calculada automáticamente por sigd_org.fn_area_set_path() a partir de area_padre_id.';


--
-- Name: asignacion_personal; Type: TABLE; Schema: sigd_org; Owner: -
--

CREATE TABLE sigd_org.asignacion_personal (
    id_asignacion uuid DEFAULT gen_random_uuid() NOT NULL,
    id_usuario uuid NOT NULL,
    cargo_id uuid NOT NULL,
    area_id uuid NOT NULL,
    vigente_desde timestamp with time zone DEFAULT now() NOT NULL,
    vigente_hasta timestamp with time zone
);


--
-- Name: calendario_laboral; Type: TABLE; Schema: sigd_org; Owner: -
--

CREATE TABLE sigd_org.calendario_laboral (
    id_calendario uuid DEFAULT gen_random_uuid() NOT NULL,
    fecha date NOT NULL,
    anio integer GENERATED ALWAYS AS ((EXTRACT(year FROM fecha))::integer) STORED,
    tipo_feriado character varying(30),
    descripcion character varying(255) NOT NULL,
    unidad_territorial character varying(30) DEFAULT 'NACIONAL'::character varying NOT NULL,
    es_laborable boolean DEFAULT false NOT NULL,
    es_feriado boolean GENERATED ALWAYS AS ((NOT es_laborable)) STORED,
    base_legal character varying(255),
    registrado_por uuid,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cargo; Type: TABLE; Schema: sigd_org; Owner: -
--

CREATE TABLE sigd_org.cargo (
    cargo_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(160) NOT NULL,
    descripcion text,
    vigente boolean DEFAULT true NOT NULL
);


--
-- Name: encargatura_despacho; Type: TABLE; Schema: sigd_org; Owner: -
--

CREATE TABLE sigd_org.encargatura_despacho (
    encargatura_id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    titular_usuario_id uuid NOT NULL,
    cargo_id uuid NOT NULL,
    tipo_resolucion character varying(40),
    vigente boolean DEFAULT true NOT NULL,
    motivo_no_habilitado text,
    inicio timestamp with time zone DEFAULT now() NOT NULL,
    fin timestamp with time zone,
    CONSTRAINT chk_encargatura_no_auto CHECK ((usuario_id <> titular_usuario_id)),
    CONSTRAINT chk_encargatura_rango CHECK (((fin IS NULL) OR (fin > inicio)))
);


--
-- Name: facultad_despacho; Type: TABLE; Schema: sigd_org; Owner: -
--

CREATE TABLE sigd_org.facultad_despacho (
    facultad_id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    cargo_id uuid NOT NULL,
    tipo_resolucion character varying(40),
    vigente boolean DEFAULT true NOT NULL,
    motivo_no_habilitado text,
    emitido_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_facultad_tipo CHECK (((tipo_resolucion IS NULL) OR ((tipo_resolucion)::text = ANY ((ARRAY['DIRECTORAL_TITULACION'::character varying, 'DIRECTORAL_CONVALIDACION'::character varying, 'DIRECTORAL_ADMINISTRATIVA'::character varying])::text[]))))
);


--
-- Name: permiso_sistema; Type: TABLE; Schema: sigd_org; Owner: -
--

CREATE TABLE sigd_org.permiso_sistema (
    permiso_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(60) NOT NULL,
    nombre character varying(160) NOT NULL,
    ambito character varying(10) DEFAULT 'GLOBAL'::character varying NOT NULL,
    CONSTRAINT chk_permiso_ambito CHECK (((ambito)::text = ANY ((ARRAY['AREA'::character varying, 'GLOBAL'::character varying])::text[])))
);


--
-- Name: rol_permiso; Type: TABLE; Schema: sigd_org; Owner: -
--

CREATE TABLE sigd_org.rol_permiso (
    rol_id uuid NOT NULL,
    permiso_id uuid NOT NULL
);


--
-- Name: rol_sistema; Type: TABLE; Schema: sigd_org; Owner: -
--

CREATE TABLE sigd_org.rol_sistema (
    rol_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(120) NOT NULL,
    descripcion text,
    vigente boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_rol_codigo CHECK (((codigo)::text = ANY ((ARRAY['ADMINISTRADOR'::character varying, 'DIRECTOR'::character varying, 'SECRETARIO'::character varying, 'ESPECIALISTA'::character varying, 'MESA_PARTES'::character varying, 'CIUDADANO'::character varying])::text[])))
);


--
-- Name: usuario_rol; Type: TABLE; Schema: sigd_org; Owner: -
--

CREATE TABLE sigd_org.usuario_rol (
    id_usuario_rol uuid DEFAULT gen_random_uuid() NOT NULL,
    id_usuario uuid NOT NULL,
    rol_id uuid NOT NULL,
    area_id uuid,
    vigente_desde timestamp with time zone DEFAULT now() NOT NULL,
    vigente_hasta timestamp with time zone,
    CONSTRAINT chk_usuario_rol_vigencia CHECK (((vigente_hasta IS NULL) OR (vigente_hasta > vigente_desde)))
);


--
-- Name: accion_compensatoria; Type: TABLE; Schema: sigd_rut; Owner: -
--

CREATE TABLE sigd_rut.accion_compensatoria (
    codigo text NOT NULL,
    CONSTRAINT ck_accion_compensatoria_codigo CHECK ((codigo = 'REVERSION_ADMINISTRATIVA'::text))
);


--
-- Name: accion_tramite; Type: TABLE; Schema: sigd_rut; Owner: -
--

CREATE TABLE sigd_rut.accion_tramite (
    codigo text NOT NULL
);


--
-- Name: contador_pestana_local; Type: TABLE; Schema: sigd_rut; Owner: -
--

CREATE TABLE sigd_rut.contador_pestana_local (
    pestana text NOT NULL,
    cantidad bigint NOT NULL,
    CONSTRAINT contador_pestana_local_cantidad_check CHECK ((cantidad >= 0)),
    CONSTRAINT contador_pestana_local_pestana_check CHECK ((pestana = ANY (ARRAY['PENDIENTES'::text, 'EN_TRAMITE'::text, 'DERIVADOS'::text, 'POR_FIRMAR'::text, 'ATENDIDOS'::text, 'ARCHIVADOS'::text])))
);


--
-- Name: estado_actual_expediente; Type: TABLE; Schema: sigd_rut; Owner: -
--

CREATE TABLE sigd_rut.estado_actual_expediente (
    expediente_id uuid NOT NULL,
    secuencia bigint NOT NULL,
    estado_nuevo text NOT NULL,
    evento text NOT NULL,
    area_actual_id text,
    id_movimiento uuid NOT NULL,
    fecha_hora timestamp(3) with time zone NOT NULL,
    usuario_operador_id uuid NOT NULL,
    CONSTRAINT estado_actual_expediente_secuencia_check CHECK ((secuencia > 0))
);


--
-- Name: estado_tramite; Type: TABLE; Schema: sigd_rut; Owner: -
--

CREATE TABLE sigd_rut.estado_tramite (
    codigo text NOT NULL,
    es_terminal boolean DEFAULT false NOT NULL
);


--
-- Name: movimiento_compensatorio; Type: TABLE; Schema: sigd_rut; Owner: -
--

CREATE TABLE sigd_rut.movimiento_compensatorio (
    id_movimiento uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    secuencia bigint NOT NULL,
    evento text DEFAULT 'REVERSION_ADMINISTRATIVA'::text NOT NULL,
    estado_anterior text NOT NULL,
    estado_nuevo text NOT NULL,
    usuario_operador_id uuid NOT NULL,
    fecha_hora timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    correlation_id text NOT NULL,
    clave_idempotencia text NOT NULL,
    movimiento_objetivo_fecha_hora timestamp(3) with time zone CONSTRAINT movimiento_compensatorio_movimiento_objetivo_fecha_hor_not_null NOT NULL,
    movimiento_objetivo_id uuid NOT NULL,
    movimiento_objetivo_secuencia bigint NOT NULL,
    huella_comando text NOT NULL,
    motivo text NOT NULL,
    compensacion_folios jsonb NOT NULL,
    datos jsonb NOT NULL,
    CONSTRAINT ck_movimiento_compensatorio_evento CHECK ((evento = 'REVERSION_ADMINISTRATIVA'::text)),
    CONSTRAINT movimiento_compensatorio_compensacion_folios_check CHECK ((jsonb_typeof(compensacion_folios) = 'object'::text)),
    CONSTRAINT movimiento_compensatorio_datos_check CHECK ((jsonb_typeof(datos) = 'object'::text)),
    CONSTRAINT movimiento_compensatorio_motivo_check CHECK (((char_length(motivo) >= 10) AND (char_length(motivo) <= 1000))),
    CONSTRAINT movimiento_compensatorio_movimiento_objetivo_secuencia_check CHECK ((movimiento_objetivo_secuencia > 0)),
    CONSTRAINT movimiento_compensatorio_secuencia_check CHECK ((secuencia > 0))
);


--
-- Name: TABLE movimiento_compensatorio; Type: COMMENT; Schema: sigd_rut; Owner: -
--

COMMENT ON TABLE sigd_rut.movimiento_compensatorio IS 'Asiento compensatorio append-only, ajeno a las 13 transiciones FSM ordinarias.';


--
-- Name: COLUMN movimiento_compensatorio.secuencia; Type: COMMENT; Schema: sigd_rut; Owner: -
--

COMMENT ON COLUMN sigd_rut.movimiento_compensatorio.secuencia IS 'Secuencia global por expediente reservada con el mismo trigger de RD-02.';


--
-- Name: movimiento_identidad; Type: TABLE; Schema: sigd_rut; Owner: -
--

CREATE TABLE sigd_rut.movimiento_identidad (
    id_movimiento uuid NOT NULL,
    expediente_id uuid NOT NULL,
    secuencia bigint NOT NULL,
    fecha_hora timestamp(3) with time zone NOT NULL,
    clave_idempotencia text,
    CONSTRAINT movimiento_identidad_secuencia_check CHECK ((secuencia > 0))
);


--
-- Name: TABLE movimiento_identidad; Type: COMMENT; Schema: sigd_rut; Owner: -
--

COMMENT ON TABLE sigd_rut.movimiento_identidad IS 'Reserva transaccional no particionada: identidad, secuencia e idempotencia globales.';


--
-- Name: movimiento_secuencia; Type: TABLE; Schema: sigd_rut; Owner: -
--

CREATE TABLE sigd_rut.movimiento_secuencia (
    expediente_id uuid NOT NULL,
    ultima_secuencia bigint NOT NULL,
    CONSTRAINT movimiento_secuencia_ultima_secuencia_check CHECK ((ultima_secuencia > 0))
);


--
-- Name: movimiento_tramite; Type: TABLE; Schema: sigd_rut; Owner: -
--

CREATE TABLE sigd_rut.movimiento_tramite (
    id_movimiento uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    secuencia bigint NOT NULL,
    estado_anterior text NOT NULL,
    evento text NOT NULL,
    estado_nuevo text NOT NULL,
    usuario_operador_id uuid NOT NULL,
    fecha_hora timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    correlation_id uuid,
    clave_idempotencia text,
    datos jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT ck_movimiento_datos_objeto CHECK ((jsonb_typeof(datos) = 'object'::text)),
    CONSTRAINT ck_movimiento_secuencia CHECK ((secuencia > 0))
)
PARTITION BY RANGE (fecha_hora);


--
-- Name: TABLE movimiento_tramite; Type: COMMENT; Schema: sigd_rut; Owner: -
--

COMMENT ON TABLE sigd_rut.movimiento_tramite IS 'Historial RutaDoc particionado por año UTC; PK física (fecha_hora,id_movimiento).';


--
-- Name: COLUMN movimiento_tramite.expediente_id; Type: COMMENT; Schema: sigd_rut; Owner: -
--

COMMENT ON COLUMN sigd_rut.movimiento_tramite.expediente_id IS 'Identificador externo UUID de TramiCore; sin FK física intermodular.';


--
-- Name: COLUMN movimiento_tramite.usuario_operador_id; Type: COMMENT; Schema: sigd_rut; Owner: -
--

COMMENT ON COLUMN sigd_rut.movimiento_tramite.usuario_operador_id IS 'Identificador externo UUID del operador; sin FK física intermodular.';


--
-- Name: COLUMN movimiento_tramite.fecha_hora; Type: COMMENT; Schema: sigd_rut; Owner: -
--

COMMENT ON COLUMN sigd_rut.movimiento_tramite.fecha_hora IS 'Instante timestamptz(3); años físicos delimitados en UTC con extremo superior exclusivo.';


--
-- Name: COLUMN movimiento_tramite.clave_idempotencia; Type: COMMENT; Schema: sigd_rut; Owner: -
--

COMMENT ON COLUMN sigd_rut.movimiento_tramite.clave_idempotencia IS 'Única por expediente si no es NULL; el reintento devuelve 23505 hasta que un servicio resuelva la clave.';


--
-- Name: movimiento_tramite_2026; Type: TABLE; Schema: sigd_rut; Owner: -
--

CREATE TABLE sigd_rut.movimiento_tramite_2026 (
    id_movimiento uuid DEFAULT gen_random_uuid() CONSTRAINT movimiento_tramite_id_movimiento_not_null NOT NULL,
    expediente_id uuid CONSTRAINT movimiento_tramite_expediente_id_not_null NOT NULL,
    secuencia bigint CONSTRAINT movimiento_tramite_secuencia_not_null NOT NULL,
    estado_anterior text CONSTRAINT movimiento_tramite_estado_anterior_not_null NOT NULL,
    evento text CONSTRAINT movimiento_tramite_evento_not_null NOT NULL,
    estado_nuevo text CONSTRAINT movimiento_tramite_estado_nuevo_not_null NOT NULL,
    usuario_operador_id uuid CONSTRAINT movimiento_tramite_usuario_operador_id_not_null NOT NULL,
    fecha_hora timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) CONSTRAINT movimiento_tramite_fecha_hora_not_null NOT NULL,
    correlation_id uuid,
    clave_idempotencia text,
    datos jsonb DEFAULT '{}'::jsonb CONSTRAINT movimiento_tramite_datos_not_null NOT NULL,
    CONSTRAINT ck_movimiento_datos_objeto CHECK ((jsonb_typeof(datos) = 'object'::text)),
    CONSTRAINT ck_movimiento_secuencia CHECK ((secuencia > 0))
);


--
-- Name: movimiento_tramite_2027; Type: TABLE; Schema: sigd_rut; Owner: -
--

CREATE TABLE sigd_rut.movimiento_tramite_2027 (
    id_movimiento uuid DEFAULT gen_random_uuid() CONSTRAINT movimiento_tramite_id_movimiento_not_null NOT NULL,
    expediente_id uuid CONSTRAINT movimiento_tramite_expediente_id_not_null NOT NULL,
    secuencia bigint CONSTRAINT movimiento_tramite_secuencia_not_null NOT NULL,
    estado_anterior text CONSTRAINT movimiento_tramite_estado_anterior_not_null NOT NULL,
    evento text CONSTRAINT movimiento_tramite_evento_not_null NOT NULL,
    estado_nuevo text CONSTRAINT movimiento_tramite_estado_nuevo_not_null NOT NULL,
    usuario_operador_id uuid CONSTRAINT movimiento_tramite_usuario_operador_id_not_null NOT NULL,
    fecha_hora timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) CONSTRAINT movimiento_tramite_fecha_hora_not_null NOT NULL,
    correlation_id uuid,
    clave_idempotencia text,
    datos jsonb DEFAULT '{}'::jsonb CONSTRAINT movimiento_tramite_datos_not_null NOT NULL,
    CONSTRAINT ck_movimiento_datos_objeto CHECK ((jsonb_typeof(datos) = 'object'::text)),
    CONSTRAINT ck_movimiento_secuencia CHECK ((secuencia > 0))
);


--
-- Name: movimiento_tramite_default; Type: TABLE; Schema: sigd_rut; Owner: -
--

CREATE TABLE sigd_rut.movimiento_tramite_default (
    id_movimiento uuid DEFAULT gen_random_uuid() CONSTRAINT movimiento_tramite_id_movimiento_not_null NOT NULL,
    expediente_id uuid CONSTRAINT movimiento_tramite_expediente_id_not_null NOT NULL,
    secuencia bigint CONSTRAINT movimiento_tramite_secuencia_not_null NOT NULL,
    estado_anterior text CONSTRAINT movimiento_tramite_estado_anterior_not_null NOT NULL,
    evento text CONSTRAINT movimiento_tramite_evento_not_null NOT NULL,
    estado_nuevo text CONSTRAINT movimiento_tramite_estado_nuevo_not_null NOT NULL,
    usuario_operador_id uuid CONSTRAINT movimiento_tramite_usuario_operador_id_not_null NOT NULL,
    fecha_hora timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) CONSTRAINT movimiento_tramite_fecha_hora_not_null NOT NULL,
    correlation_id uuid,
    clave_idempotencia text,
    datos jsonb DEFAULT '{}'::jsonb CONSTRAINT movimiento_tramite_datos_not_null NOT NULL,
    CONSTRAINT ck_movimiento_datos_objeto CHECK ((jsonb_typeof(datos) = 'object'::text)),
    CONSTRAINT ck_movimiento_secuencia CHECK ((secuencia > 0))
);


--
-- Name: solicitud_compensacion_folios; Type: TABLE; Schema: sigd_rut; Owner: -
--

CREATE TABLE sigd_rut.solicitud_compensacion_folios (
    id_solicitud uuid NOT NULL,
    expediente_id uuid NOT NULL,
    movimiento_original_id uuid NOT NULL,
    movimiento_compensatorio_id uuid CONSTRAINT solicitud_compensacion_foli_movimiento_compensatorio_i_not_null NOT NULL,
    rango_afectado jsonb,
    motivo text NOT NULL,
    actor_id uuid NOT NULL,
    correlation_id text NOT NULL,
    clave_idempotencia uuid NOT NULL,
    estado text DEFAULT 'PENDIENTE'::text NOT NULL,
    id_evento_outbox uuid,
    creado_en timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    actualizado_en timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    CONSTRAINT solicitud_compensacion_folios_estado_check CHECK ((estado = ANY (ARRAY['PENDIENTE'::text, 'PROCESANDO'::text, 'COMPLETADO'::text, 'FALLIDO'::text]))),
    CONSTRAINT solicitud_compensacion_folios_rango_afectado_check CHECK (((rango_afectado IS NULL) OR (jsonb_typeof(rango_afectado) = 'object'::text)))
);


--
-- Name: transicion_estado_tramite; Type: TABLE; Schema: sigd_rut; Owner: -
--

CREATE TABLE sigd_rut.transicion_estado_tramite (
    estado_anterior text NOT NULL,
    evento text NOT NULL,
    estado_nuevo text NOT NULL,
    CONSTRAINT ck_transicion_archivado_terminal CHECK ((estado_anterior <> 'ARCHIVADO'::text))
);


--
-- Name: seq_asiento_numero_registro; Type: SEQUENCE; Schema: sigd_tra; Owner: -
--

CREATE SEQUENCE sigd_tra.seq_asiento_numero_registro
    START WITH 10001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asiento_registro; Type: TABLE; Schema: sigd_tra; Owner: -
--

CREATE TABLE sigd_tra.asiento_registro (
    id_asiento uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_registro bigint DEFAULT nextval('sigd_tra.seq_asiento_numero_registro'::regclass) NOT NULL,
    expediente_id uuid NOT NULL,
    fecha_ingreso timestamp with time zone DEFAULT now() NOT NULL,
    canal_ingreso character varying(30) DEFAULT 'MESA_VIRTUAL'::character varying NOT NULL,
    asunto character varying(500) NOT NULL,
    remitente_id uuid,
    destinatario_id uuid,
    anulado boolean DEFAULT false NOT NULL,
    motivo_anulacion text,
    CONSTRAINT chk_asiento_canal CHECK (((canal_ingreso)::text = ANY ((ARRAY['MESA_VIRTUAL'::character varying, 'MESA_PRESENCIAL'::character varying])::text[])))
);


--
-- Name: cargo_digital; Type: TABLE; Schema: sigd_tra; Owner: -
--

CREATE TABLE sigd_tra.cargo_digital (
    expediente_id uuid NOT NULL,
    codigo_cargo text NOT NULL,
    hash_sha256 character(64) NOT NULL,
    qr_contenido text NOT NULL,
    emitido_en timestamp with time zone NOT NULL
);


--
-- Name: expediente; Type: TABLE; Schema: sigd_tra; Owner: -
--

CREATE TABLE sigd_tra.expediente (
    expediente_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_expediente character varying(20) NOT NULL,
    numero character varying(30) NOT NULL,
    dni_solicitante character(8),
    tipo_documental_id uuid NOT NULL,
    solicitante_id uuid NOT NULL,
    area_destino_id uuid,
    estado character varying(30) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    fecha_radicacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_limite timestamp with time zone,
    tipo_tramite_id uuid,
    fecha_envio_real timestamp with time zone,
    fuera_de_horario boolean DEFAULT false NOT NULL,
    correo_notificacion character varying(150),
    nombre_solicitante character varying(120),
    total_folios integer,
    CONSTRAINT chk_tra_expediente_cut CHECK (((codigo_expediente)::text ~ '^EXP-[0-9]{4}-[0-9]{6}$'::text)),
    CONSTRAINT chk_tra_expediente_dni CHECK (((dni_solicitante IS NULL) OR (dni_solicitante ~ '^[0-9]{8}$'::text))),
    CONSTRAINT expediente_total_folios_check CHECK ((total_folios > 0))
);


--
-- Name: expediente_acumulacion; Type: TABLE; Schema: sigd_tra; Owner: -
--

CREATE TABLE sigd_tra.expediente_acumulacion (
    id_acumulacion uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_principal uuid NOT NULL,
    expediente_accesorio uuid NOT NULL,
    acto_resolutivo text NOT NULL,
    estado character varying(20) DEFAULT 'ACUMULADO'::character varying NOT NULL,
    fecha_acumulacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_desacumulacion timestamp with time zone,
    CONSTRAINT chk_acumulacion_desacumulacion CHECK ((((estado)::text = 'ACUMULADO'::text) OR (fecha_desacumulacion IS NOT NULL))),
    CONSTRAINT chk_acumulacion_distintos CHECK ((expediente_principal <> expediente_accesorio)),
    CONSTRAINT chk_acumulacion_estado CHECK (((estado)::text = ANY ((ARRAY['ACUMULADO'::character varying, 'DESACUMULADO'::character varying])::text[])))
);


--
-- Name: expediente_documento_folio; Type: TABLE; Schema: sigd_tra; Owner: -
--

CREATE TABLE sigd_tra.expediente_documento_folio (
    id_folio uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    id_documento uuid NOT NULL,
    folio_inicio integer NOT NULL,
    folio_fin integer NOT NULL,
    asignado_por uuid,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_folio_rango CHECK (((folio_inicio > 0) AND (folio_fin >= folio_inicio)))
);


--
-- Name: TABLE expediente_documento_folio; Type: COMMENT; Schema: sigd_tra; Owner: -
--

COMMENT ON TABLE sigd_tra.expediente_documento_folio IS 'Foliación continua e ininterrumpida (Directiva N° 001-2019-AGN). El folio N+1 inicia exactamente en folio_fin(N) + 1.';


--
-- Name: mv_kpis_mgd_mensual; Type: MATERIALIZED VIEW; Schema: sigd_tra; Owner: -
--

CREATE MATERIALIZED VIEW sigd_tra.mv_kpis_mgd_mensual AS
 WITH cierre AS (
         SELECT m.expediente_id,
            m.fecha_hora,
            row_number() OVER (PARTITION BY m.expediente_id ORDER BY m.fecha_hora) AS orden
           FROM sigd_rut.movimiento_tramite m
          WHERE (m.estado_nuevo = ANY (ARRAY['RESUELTO'::text, 'NOTIFICADO'::text, 'ARCHIVADO'::text]))
        ), base AS (
         SELECT (date_trunc('month'::text, e.fecha_radicacion))::date AS periodo,
            e.expediente_id,
            e.fecha_radicacion,
            e.fecha_limite,
            a.estado_nuevo AS estado_codigo,
            a.area_actual_id,
            ar.fecha_ingreso,
            c.fecha_hora AS fecha_cierre
           FROM (((sigd_tra.expediente e
             LEFT JOIN sigd_rut.estado_actual_expediente a ON ((a.expediente_id = e.expediente_id)))
             LEFT JOIN sigd_tra.asiento_registro ar ON (((ar.expediente_id = e.expediente_id) AND (NOT ar.anulado))))
             LEFT JOIN cierre c ON (((c.expediente_id = e.expediente_id) AND (c.orden = 1))))
        )
 SELECT periodo,
    (count(*))::integer AS radicados,
    (count(*) FILTER (WHERE (estado_codigo = ANY (ARRAY['RESUELTO'::text, 'NOTIFICADO'::text]))))::integer AS atendidos,
    (count(*) FILTER (WHERE (estado_codigo = 'ARCHIVADO'::text)))::integer AS archivados,
    (count(*) FILTER (WHERE (estado_codigo = 'OBSERVADO'::text)))::integer AS observados,
    (count(*) FILTER (WHERE ((estado_codigo IS NULL) OR (estado_codigo <> ALL (ARRAY['RESUELTO'::text, 'NOTIFICADO'::text, 'ARCHIVADO'::text, 'ANULADO'::text, 'OBSERVADO'::text])))))::integer AS en_tramite,
    (count(*) FILTER (WHERE ((estado_codigo IS NULL) OR (estado_codigo <> ALL (ARRAY['RESUELTO'::text, 'NOTIFICADO'::text, 'ARCHIVADO'::text, 'ANULADO'::text])))))::integer AS universo_teo,
    (count(fecha_cierre))::integer AS resueltos,
    (count(*) FILTER (WHERE ((fecha_cierre IS NOT NULL) AND (fecha_limite IS NOT NULL) AND (fecha_cierre <= fecha_limite))))::integer AS resueltos_dentro_de_plazo,
    (COALESCE(sum(EXTRACT(epoch FROM (COALESCE(fecha_cierre, now()) - COALESCE(fecha_ingreso, fecha_radicacion)))), (0)::numeric))::double precision AS horas_calendario_totales,
    (round(
        CASE
            WHEN (count(*) = 0) THEN NULL::numeric
            ELSE (((count(*) FILTER (WHERE (estado_codigo = ANY (ARRAY['RESUELTO'::text, 'NOTIFICADO'::text, 'ARCHIVADO'::text]))))::numeric * (100)::numeric) / (count(*))::numeric)
        END, 2))::double precision AS vtep,
    (round(
        CASE
            WHEN (count(fecha_cierre) = 0) THEN NULL::numeric
            ELSE (COALESCE(sum(EXTRACT(epoch FROM (fecha_cierre - COALESCE(fecha_ingreso, fecha_radicacion)))), (0)::numeric) / (count(fecha_cierre))::numeric)
        END, 2))::double precision AS tpr_horas_calendario,
    (round(
        CASE
            WHEN (count(fecha_cierre) = 0) THEN NULL::numeric
            ELSE (((count(*) FILTER (WHERE ((fecha_cierre IS NOT NULL) AND (fecha_limite IS NOT NULL) AND (fecha_cierre <= fecha_limite))))::numeric * (100)::numeric) / (count(fecha_cierre))::numeric)
        END, 2))::double precision AS tro,
    (round(
        CASE
            WHEN (count(*) FILTER (WHERE ((estado_codigo IS NULL) OR (estado_codigo <> ALL (ARRAY['RESUELTO'::text, 'NOTIFICADO'::text, 'ARCHIVADO'::text, 'ANULADO'::text, 'OBSERVADO'::text])))) = 0) THEN NULL::numeric
            ELSE (((count(*) FILTER (WHERE (estado_codigo = 'OBSERVADO'::text)))::numeric * (100)::numeric) / (count(*) FILTER (WHERE ((estado_codigo IS NULL) OR (estado_codigo <> ALL (ARRAY['RESUELTO'::text, 'NOTIFICADO'::text, 'ARCHIVADO'::text, 'ANULADO'::text, 'OBSERVADO'::text])))))::numeric)
        END, 2))::double precision AS teo
   FROM base
  GROUP BY periodo
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW mv_kpis_mgd_mensual; Type: COMMENT; Schema: sigd_tra; Owner: -
--

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_kpis_mgd_mensual IS 'Consolidado mensual de los 4 KPIs MGD (VTEP, TPR, TRO, TEO). Índice único por periodo para permitir REFRESH CONCURRENTLY.';


--
-- Name: vw_mgd_expediente_base; Type: VIEW; Schema: sigd_tra; Owner: -
--

CREATE VIEW sigd_tra.vw_mgd_expediente_base AS
 WITH feriados AS (
         SELECT COALESCE(array_agg(c.fecha), ARRAY[]::date[]) AS dias
           FROM sigd_org.calendario_laboral c
          WHERE (c.es_feriado = true)
        ), corte AS (
         SELECT CURRENT_TIMESTAMP AS instante
        ), radicaciones AS (
         SELECT e.expediente_id AS id_expediente,
            e.codigo_expediente,
            COALESCE(e.fecha_envio_real, e.fecha_radicacion) AS fecha_radicacion,
            (date_trunc('month'::text, (COALESCE(e.fecha_envio_real, e.fecha_radicacion) AT TIME ZONE '-05:00:00'::interval hour to minute)))::date AS periodo,
            COALESCE(NULLIF(btrim(a.area_actual_id), ''::text), (e.area_destino_id)::text, 'SIN_AREA'::text) AS unidad_organica_id,
            COALESCE(NULLIF(btrim(a.estado_nuevo), ''::text), 'REGISTRADO'::text) AS estado_actual,
            COALESCE(sigd_rut.pestana_de_estado(COALESCE(NULLIF(btrim(a.estado_nuevo), ''::text), 'REGISTRADO'::text)), 'PENDIENTES'::text) AS pestana
           FROM (sigd_tra.expediente e
             LEFT JOIN sigd_rut.estado_actual_expediente a ON ((a.expediente_id = e.expediente_id)))
        ), resoluciones AS (
         SELECT m.expediente_id,
            min(m.fecha_hora) AS fecha_resolucion
           FROM sigd_rut.movimiento_tramite m
          WHERE (m.estado_nuevo = ANY (ARRAY['RESUELTO'::text, 'ARCHIVADO'::text]))
          GROUP BY m.expediente_id
        ), base AS (
         SELECT r.id_expediente,
            r.codigo_expediente,
            r.periodo,
            r.unidad_organica_id,
            r.estado_actual,
            r.pestana,
            r.fecha_radicacion,
            res.fecha_resolucion,
            COALESCE(res.fecha_resolucion, c.instante) AS fecha_corte,
            (r.estado_actual = ANY (ARRAY['RESUELTO'::text, 'ARCHIVADO'::text])) AS es_resuelto,
            (r.estado_actual = 'ARCHIVADO'::text) AS es_archivado,
            (r.estado_actual = 'OBSERVADO'::text) AS es_observado,
            (r.pestana = 'EN_TRAMITE'::text) AS es_en_tramite
           FROM (((radicaciones r
             CROSS JOIN feriados f_1)
             CROSS JOIN corte c)
             LEFT JOIN resoluciones res ON ((res.expediente_id = r.id_expediente)))
        )
 SELECT b.id_expediente,
    b.codigo_expediente,
    b.periodo,
    b.unidad_organica_id,
    b.estado_actual,
    b.pestana,
    b.fecha_radicacion,
    b.fecha_resolucion,
    b.es_resuelto,
    b.es_archivado,
    b.es_observado,
    b.es_en_tramite,
    sigd_tra.fn_mgd_horas_habiles(b.fecha_radicacion, b.fecha_corte, f.dias) AS horas_habiles_atencion,
    sigd_tra.fn_mgd_dias_habiles_entre(b.fecha_radicacion, b.fecha_corte, f.dias) AS dias_habiles_permanencia
   FROM (base b
     CROSS JOIN feriados f);


--
-- Name: VIEW vw_mgd_expediente_base; Type: COMMENT; Schema: sigd_tra; Owner: -
--

COMMENT ON VIEW sigd_tra.vw_mgd_expediente_base IS 'Grain de una fila por expediente con su tiempo habil de atencion. Fuente unica de las vistas materializadas MGD.';


--
-- Name: mv_kpis_mgd_mensual_v2; Type: MATERIALIZED VIEW; Schema: sigd_tra; Owner: -
--

CREATE MATERIALIZED VIEW sigd_tra.mv_kpis_mgd_mensual_v2 AS
 SELECT periodo,
    unidad_organica_id,
    CURRENT_TIMESTAMP AS actualizado_en,
    count(*) AS n_radicados,
    count(*) FILTER (WHERE (estado_actual = 'RESUELTO'::text)) AS n_atendidos,
    count(*) FILTER (WHERE (estado_actual = 'ARCHIVADO'::text)) AS n_archivados,
    count(*) FILTER (WHERE es_resuelto) AS n_resueltos,
    count(*) FILTER (WHERE es_en_tramite) AS n_en_tramite,
    count(*) FILTER (WHERE es_observado) AS n_observados,
    count(*) FILTER (WHERE (es_resuelto AND (dias_habiles_permanencia <= (30)::numeric))) AS n_resueltos_dentro_plazo,
    COALESCE(sum(horas_habiles_atencion) FILTER (WHERE es_resuelto), (0)::numeric) AS horas_habiles_suma,
    round(COALESCE(((((count(*) FILTER (WHERE (estado_actual = 'RESUELTO'::text)) + count(*) FILTER (WHERE (estado_actual = 'ARCHIVADO'::text))))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), (0)::numeric), 2) AS vtep_porcentaje,
    round(COALESCE((sum(horas_habiles_atencion) FILTER (WHERE es_resuelto) / (NULLIF(count(*) FILTER (WHERE es_resuelto), 0))::numeric), (0)::numeric), 2) AS tpr_horas_habiles,
    round(COALESCE((((count(*) FILTER (WHERE (es_resuelto AND (dias_habiles_permanencia <= (30)::numeric))))::numeric / (NULLIF(count(*) FILTER (WHERE es_resuelto), 0))::numeric) * (100)::numeric), (0)::numeric), 2) AS tro_porcentaje,
    round(COALESCE((((count(*) FILTER (WHERE es_observado))::numeric / (NULLIF(count(*) FILTER (WHERE es_en_tramite), 0))::numeric) * (100)::numeric), (0)::numeric), 2) AS teo_porcentaje
   FROM sigd_tra.vw_mgd_expediente_base b
  GROUP BY periodo, unidad_organica_id
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW mv_kpis_mgd_mensual_v2; Type: COMMENT; Schema: sigd_tra; Owner: -
--

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_kpis_mgd_mensual_v2 IS 'KPIs MGD-PCM por (periodo, unidad_organica_id) con numeradores y denominadores de auditoria. Fuente: vw_mgd_expediente_base.';


--
-- Name: mv_tiempos_retencion_area; Type: MATERIALIZED VIEW; Schema: sigd_tra; Owner: -
--

CREATE MATERIALIZED VIEW sigd_tra.mv_tiempos_retencion_area AS
 SELECT COALESCE(ar.area_id, e.area_destino_id) AS area_id,
    COALESCE(ar.nombre, 'Sin área asignada'::character varying) AS area,
    a.estado_nuevo AS estado,
    (count(*))::integer AS expedientes,
    (round(avg((EXTRACT(epoch FROM (now() - a.fecha_hora)) / (3600)::numeric)), 2))::double precision AS horas_promedio,
    (round(avg((EXTRACT(epoch FROM (now() - a.fecha_hora)) / (86400)::numeric)), 2))::double precision AS dias_promedio,
    (round(max((EXTRACT(epoch FROM (now() - a.fecha_hora)) / (86400)::numeric)), 2))::double precision AS dias_maximo,
    (count(*) FILTER (WHERE ((e.fecha_limite IS NOT NULL) AND (e.fecha_limite < now()))))::integer AS vencidos,
    (count(*) FILTER (WHERE (e.fecha_limite < now())))::integer AS semaforo_rojo,
    (count(*) FILTER (WHERE ((e.fecha_limite >= now()) AND (now() >= (e.fecha_radicacion + ((e.fecha_limite - e.fecha_radicacion) * (0.8)::double precision))))))::integer AS semaforo_amarillo,
    (count(*) FILTER (WHERE ((e.fecha_limite >= now()) AND (now() < (e.fecha_radicacion + ((e.fecha_limite - e.fecha_radicacion) * (0.8)::double precision))))))::integer AS semaforo_verde
   FROM ((sigd_rut.estado_actual_expediente a
     JOIN sigd_tra.expediente e ON ((e.expediente_id = a.expediente_id)))
     LEFT JOIN sigd_org.area ar ON (((ar.area_id)::text = a.area_actual_id)))
  WHERE (a.estado_nuevo <> ALL (ARRAY['RESUELTO'::text, 'NOTIFICADO'::text, 'ARCHIVADO'::text, 'ANULADO'::text]))
  GROUP BY COALESCE(ar.area_id, e.area_destino_id), COALESCE(ar.nombre, 'Sin área asignada'::character varying), a.estado_nuevo
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW mv_tiempos_retencion_area; Type: COMMENT; Schema: sigd_tra; Owner: -
--

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_tiempos_retencion_area IS 'Expedientes en trámite por área y estado, con permanencia promedio y semáforo SLA. Base del ranking de cuellos de botella (#51/#52).';


--
-- Name: mv_tiempos_retencion_area_v2; Type: MATERIALIZED VIEW; Schema: sigd_tra; Owner: -
--

CREATE MATERIALIZED VIEW sigd_tra.mv_tiempos_retencion_area_v2 AS
 WITH clasificado AS (
         SELECT c.periodo,
            c.unidad_organica_id,
            c.dias_habiles_permanencia,
            c.horas_habiles_atencion,
                CASE
                    WHEN (c.dias_habiles_permanencia <= (5)::numeric) THEN '01_00_05'::text
                    WHEN (c.dias_habiles_permanencia <= (10)::numeric) THEN '02_06_10'::text
                    WHEN (c.dias_habiles_permanencia <= (15)::numeric) THEN '03_11_15'::text
                    WHEN (c.dias_habiles_permanencia <= (20)::numeric) THEN '04_16_20'::text
                    WHEN (c.dias_habiles_permanencia <= (30)::numeric) THEN '05_21_30'::text
                    WHEN (c.dias_habiles_permanencia <= (45)::numeric) THEN '06_31_45'::text
                    WHEN (c.dias_habiles_permanencia <= (60)::numeric) THEN '07_46_60'::text
                    ELSE '08_MAS_60'::text
                END AS tramo_permanencia_dias_habiles
           FROM sigd_tra.vw_mgd_expediente_base c
        ), agregado AS (
         SELECT c.periodo,
            c.unidad_organica_id,
            c.tramo_permanencia_dias_habiles,
            count(*) AS n_expedientes,
            avg(c.dias_habiles_permanencia) AS promedio_dias_habiles_permanencia,
            avg(c.horas_habiles_atencion) AS promedio_horas_habiles,
            min(c.horas_habiles_atencion) AS minimo_horas_habiles,
            max(c.horas_habiles_atencion) AS maximo_horas_habiles
           FROM clasificado c
          GROUP BY c.periodo, c.unidad_organica_id, c.tramo_permanencia_dias_habiles
        )
 SELECT periodo,
    unidad_organica_id,
    tramo_permanencia_dias_habiles,
    CURRENT_TIMESTAMP AS actualizado_en,
    n_expedientes,
    round(promedio_dias_habiles_permanencia, 4) AS promedio_dias_habiles_permanencia,
    round(promedio_horas_habiles, 4) AS promedio_horas_habiles,
    round(minimo_horas_habiles, 4) AS minimo_horas_habiles,
    round(maximo_horas_habiles, 4) AS maximo_horas_habiles,
    round(COALESCE((((n_expedientes)::numeric * (100)::numeric) / NULLIF(sum(n_expedientes) OVER (PARTITION BY periodo, unidad_organica_id), (0)::numeric)), (0)::numeric), 2) AS porcentaje_del_area
   FROM agregado a
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW mv_tiempos_retencion_area_v2; Type: COMMENT; Schema: sigd_tra; Owner: -
--

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_tiempos_retencion_area_v2 IS 'Distribucion de permanencia en dias habiles por (periodo, unidad_organica_id, tramo). Base del analisis de cuellos de botella.';


--
-- Name: secuencia_anual_cut; Type: TABLE; Schema: sigd_tra; Owner: -
--

CREATE TABLE sigd_tra.secuencia_anual_cut (
    anio_fiscal integer NOT NULL,
    ultimo_correlativo bigint DEFAULT 0 NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_secuencia_anual_correlativo CHECK ((ultimo_correlativo >= 0))
);


--
-- Name: TABLE secuencia_anual_cut; Type: COMMENT; Schema: sigd_tra; Owner: -
--

COMMENT ON TABLE sigd_tra.secuencia_anual_cut IS 'Correlativo CUT por año fiscal. Se bloquea con SELECT ... FOR UPDATE para garantizar unicidad sin colisiones bajo concurrencia.';


--
-- Name: tramite; Type: TABLE; Schema: sigd_tra; Owner: -
--

CREATE TABLE sigd_tra.tramite (
    tramite_id uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    codigo_tramite character varying(30),
    asunto character varying(500) NOT NULL,
    estado character varying(30) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone,
    CONSTRAINT chk_tra_tramite_estado CHECK (((estado)::text = ANY ((ARRAY['REGISTRADO'::character varying, 'EN_TRAMITE'::character varying, 'OBSERVADO'::character varying, 'CERRADO'::character varying, 'ANULADO'::character varying, 'REABIERTO'::character varying])::text[])))
);


--
-- Name: movimiento_tramite_2026; Type: TABLE ATTACH; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_tramite ATTACH PARTITION sigd_rut.movimiento_tramite_2026 FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');


--
-- Name: movimiento_tramite_2027; Type: TABLE ATTACH; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_tramite ATTACH PARTITION sigd_rut.movimiento_tramite_2027 FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2028-01-01 00:00:00+00');


--
-- Name: movimiento_tramite_default; Type: TABLE ATTACH; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_tramite ATTACH PARTITION sigd_rut.movimiento_tramite_default DEFAULT;


--
-- Name: sigd_migraciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sigd_migraciones ALTER COLUMN id SET DEFAULT nextval('public.sigd_migraciones_id_seq'::regclass);


--
-- Name: sigd_migraciones sigd_migraciones_nombre_script_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sigd_migraciones
    ADD CONSTRAINT sigd_migraciones_nombre_script_key UNIQUE (nombre_script);


--
-- Name: sigd_migraciones sigd_migraciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sigd_migraciones
    ADD CONSTRAINT sigd_migraciones_pkey PRIMARY KEY (id);


--
-- Name: bitacora_auditoria pk_bitacora_auditoria; Type: CONSTRAINT; Schema: sigd_audit; Owner: -
--

ALTER TABLE ONLY sigd_audit.bitacora_auditoria
    ADD CONSTRAINT pk_bitacora_auditoria PRIMARY KEY (id_auditoria);


--
-- Name: evento_outbox pk_evento_outbox; Type: CONSTRAINT; Schema: sigd_audit; Owner: -
--

ALTER TABLE ONLY sigd_audit.evento_outbox
    ADD CONSTRAINT pk_evento_outbox PRIMARY KEY (id_evento);


--
-- Name: cuenta_usuario cuenta_usuario_correo_key; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.cuenta_usuario
    ADD CONSTRAINT cuenta_usuario_correo_key UNIQUE (correo);


--
-- Name: cuenta_usuario cuenta_usuario_usuario_key; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.cuenta_usuario
    ADD CONSTRAINT cuenta_usuario_usuario_key UNIQUE (usuario);


--
-- Name: distrito_ubigeo distrito_ubigeo_pkey; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.distrito_ubigeo
    ADD CONSTRAINT distrito_ubigeo_pkey PRIMARY KEY (codigo);


--
-- Name: auditoria_usuarios pk_auditoria_usuarios; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.auditoria_usuarios
    ADD CONSTRAINT pk_auditoria_usuarios PRIMARY KEY (id_auditoria);


--
-- Name: consentimiento_datos pk_consentimiento_datos; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.consentimiento_datos
    ADD CONSTRAINT pk_consentimiento_datos PRIMARY KEY (id_consentimiento);


--
-- Name: cuenta_usuario pk_cuenta_usuario; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.cuenta_usuario
    ADD CONSTRAINT pk_cuenta_usuario PRIMARY KEY (id_usuario);


--
-- Name: notificacion_casilla pk_notificacion_casilla; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.notificacion_casilla
    ADD CONSTRAINT pk_notificacion_casilla PRIMARY KEY (id);


--
-- Name: perfil_usuario pk_perfil_usuario; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.perfil_usuario
    ADD CONSTRAINT pk_perfil_usuario PRIMARY KEY (id_usuario);


--
-- Name: persona pk_persona; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.persona
    ADD CONSTRAINT pk_persona PRIMARY KEY (id_persona);


--
-- Name: persona_documento_historial pk_persona_documento_historial; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.persona_documento_historial
    ADD CONSTRAINT pk_persona_documento_historial PRIMARY KEY (id_historial);


--
-- Name: persona_juridica pk_persona_juridica; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.persona_juridica
    ADD CONSTRAINT pk_persona_juridica PRIMARY KEY (id_persona);


--
-- Name: persona_natural pk_persona_natural; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.persona_natural
    ADD CONSTRAINT pk_persona_natural PRIMARY KEY (id_persona);


--
-- Name: representacion_legal pk_representacion_legal; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.representacion_legal
    ADD CONSTRAINT pk_representacion_legal PRIMARY KEY (id_representacion);


--
-- Name: sesion_usuario pk_sesion_usuario; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.sesion_usuario
    ADD CONSTRAINT pk_sesion_usuario PRIMARY KEY (id_sesion);


--
-- Name: provincia_ubigeo provincia_ubigeo_nombre_key; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.provincia_ubigeo
    ADD CONSTRAINT provincia_ubigeo_nombre_key UNIQUE (nombre);


--
-- Name: provincia_ubigeo provincia_ubigeo_pkey; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.provincia_ubigeo
    ADD CONSTRAINT provincia_ubigeo_pkey PRIMARY KEY (codigo);


--
-- Name: sesion_usuario sesion_usuario_refresh_token_key; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.sesion_usuario
    ADD CONSTRAINT sesion_usuario_refresh_token_key UNIQUE (refresh_token);


--
-- Name: tipos_documento tipos_documento_codigo_key; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.tipos_documento
    ADD CONSTRAINT tipos_documento_codigo_key UNIQUE (codigo);


--
-- Name: tipos_documento tipos_documento_pkey; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.tipos_documento
    ADD CONSTRAINT tipos_documento_pkey PRIMARY KEY (id_tipo_documento);


--
-- Name: distrito_ubigeo uq_distrito_ubigeo_nombre; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.distrito_ubigeo
    ADD CONSTRAINT uq_distrito_ubigeo_nombre UNIQUE (provincia_codigo, nombre);


--
-- Name: persona uq_persona_documento; Type: CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.persona
    ADD CONSTRAINT uq_persona_documento UNIQUE (tipo, id_documento);


--
-- Name: carga_documento carga_documento_pkey; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.carga_documento
    ADD CONSTRAINT carga_documento_pkey PRIMARY KEY (carga_id);


--
-- Name: carga_documento carga_documento_s3_key_key; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.carga_documento
    ADD CONSTRAINT carga_documento_s3_key_key UNIQUE (s3_key);


--
-- Name: expediente expediente_codigo_expediente_key; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.expediente
    ADD CONSTRAINT expediente_codigo_expediente_key UNIQUE (codigo_expediente);


--
-- Name: firma_digital_documento firma_digital_documento_cvd_key; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.firma_digital_documento
    ADD CONSTRAINT firma_digital_documento_cvd_key UNIQUE (cvd);


--
-- Name: firma_digital_documento firma_digital_documento_pkey; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.firma_digital_documento
    ADD CONSTRAINT firma_digital_documento_pkey PRIMARY KEY (documento_id);


--
-- Name: expediente pk_doc_expediente; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.expediente
    ADD CONSTRAINT pk_doc_expediente PRIMARY KEY (expediente_id);


--
-- Name: documento_adjunto pk_documento_adjunto; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.documento_adjunto
    ADD CONSTRAINT pk_documento_adjunto PRIMARY KEY (documento_adjunto_id);


--
-- Name: expediente_formulario_respuesta pk_expediente_formulario_respuesta; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.expediente_formulario_respuesta
    ADD CONSTRAINT pk_expediente_formulario_respuesta PRIMARY KEY (id_respuesta);


--
-- Name: expediente_requisito pk_expediente_requisito; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.expediente_requisito
    ADD CONSTRAINT pk_expediente_requisito PRIMARY KEY (id_expediente_requisito);


--
-- Name: formulario_version pk_formulario_version; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.formulario_version
    ADD CONSTRAINT pk_formulario_version PRIMARY KEY (formulario_version_id);


--
-- Name: requisito pk_requisito; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.requisito
    ADD CONSTRAINT pk_requisito PRIMARY KEY (requisito_id);


--
-- Name: resolucion pk_resolucion; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.resolucion
    ADD CONSTRAINT pk_resolucion PRIMARY KEY (resolucion_id);


--
-- Name: tipo_documento pk_tipo_documento; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.tipo_documento
    ADD CONSTRAINT pk_tipo_documento PRIMARY KEY (tipo_documental_id);


--
-- Name: tipo_documento_requisito pk_tipo_documento_requisito; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.tipo_documento_requisito
    ADD CONSTRAINT pk_tipo_documento_requisito PRIMARY KEY (id_relacion);


--
-- Name: tipo_tramite_tupa pk_tipo_tramite_tupa; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.tipo_tramite_tupa
    ADD CONSTRAINT pk_tipo_tramite_tupa PRIMARY KEY (tipo_tramite_id);


--
-- Name: tipo_documento tipo_documento_codigo_key; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.tipo_documento
    ADD CONSTRAINT tipo_documento_codigo_key UNIQUE (codigo);


--
-- Name: tipo_tramite_tupa tipo_tramite_tupa_codigo_key; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.tipo_tramite_tupa
    ADD CONSTRAINT tipo_tramite_tupa_codigo_key UNIQUE (codigo);


--
-- Name: documento_adjunto uq_documento_adjunto_s3; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.documento_adjunto
    ADD CONSTRAINT uq_documento_adjunto_s3 UNIQUE (s3_bucket, s3_key);


--
-- Name: documento_adjunto uq_documento_adjunto_sha; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.documento_adjunto
    ADD CONSTRAINT uq_documento_adjunto_sha UNIQUE (s3_bucket, sha256);


--
-- Name: expediente_formulario_respuesta uq_expediente_formulario; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.expediente_formulario_respuesta
    ADD CONSTRAINT uq_expediente_formulario UNIQUE (expediente_id, formulario_version_id);


--
-- Name: expediente_requisito uq_expediente_requisito; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.expediente_requisito
    ADD CONSTRAINT uq_expediente_requisito UNIQUE (expediente_id, requisito_id);


--
-- Name: formulario_version uq_formulario_version; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.formulario_version
    ADD CONSTRAINT uq_formulario_version UNIQUE (tipo_tramite_id, version);


--
-- Name: requisito uq_requisito_tramite_codigo; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.requisito
    ADD CONSTRAINT uq_requisito_tramite_codigo UNIQUE (tipo_tramite_id, codigo);


--
-- Name: resolucion uq_resolucion_borrador; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.resolucion
    ADD CONSTRAINT uq_resolucion_borrador UNIQUE (expediente_id, numero_borrador);


--
-- Name: tipo_documento_requisito uq_tipo_documento_requisito; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.tipo_documento_requisito
    ADD CONSTRAINT uq_tipo_documento_requisito UNIQUE (requisito_id, tipo_documental_id);


--
-- Name: workflow_academico workflow_academico_pkey; Type: CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.workflow_academico
    ADD CONSTRAINT workflow_academico_pkey PRIMARY KEY (id_tramite);


--
-- Name: area area_codigo_key; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.area
    ADD CONSTRAINT area_codigo_key UNIQUE (codigo);


--
-- Name: cargo cargo_codigo_key; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.cargo
    ADD CONSTRAINT cargo_codigo_key UNIQUE (codigo);


--
-- Name: asignacion_personal ex_asignacion_personal_vigencia; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.asignacion_personal
    ADD CONSTRAINT ex_asignacion_personal_vigencia EXCLUDE USING gist (id_usuario WITH =, cargo_id WITH =, tstzrange(vigente_desde, COALESCE(vigente_hasta, 'infinity'::timestamp with time zone), '[)'::text) WITH &&);


--
-- Name: encargatura_despacho ex_encargatura_vigencia; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.encargatura_despacho
    ADD CONSTRAINT ex_encargatura_vigencia EXCLUDE USING gist (usuario_id WITH =, cargo_id WITH =, tstzrange(inicio, COALESCE(fin, 'infinity'::timestamp with time zone), '[)'::text) WITH &&);


--
-- Name: usuario_rol ex_usuario_rol_vigencia; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.usuario_rol
    ADD CONSTRAINT ex_usuario_rol_vigencia EXCLUDE USING gist (id_usuario WITH =, rol_id WITH =, COALESCE(area_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =, tstzrange(vigente_desde, COALESCE(vigente_hasta, 'infinity'::timestamp with time zone), '[)'::text) WITH &&);


--
-- Name: permiso_sistema permiso_sistema_codigo_key; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.permiso_sistema
    ADD CONSTRAINT permiso_sistema_codigo_key UNIQUE (codigo);


--
-- Name: area pk_area; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.area
    ADD CONSTRAINT pk_area PRIMARY KEY (area_id);


--
-- Name: asignacion_personal pk_asignacion_personal; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.asignacion_personal
    ADD CONSTRAINT pk_asignacion_personal PRIMARY KEY (id_asignacion);


--
-- Name: calendario_laboral pk_calendario_laboral; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.calendario_laboral
    ADD CONSTRAINT pk_calendario_laboral PRIMARY KEY (id_calendario);


--
-- Name: cargo pk_cargo; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.cargo
    ADD CONSTRAINT pk_cargo PRIMARY KEY (cargo_id);


--
-- Name: encargatura_despacho pk_encargatura_despacho; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.encargatura_despacho
    ADD CONSTRAINT pk_encargatura_despacho PRIMARY KEY (encargatura_id);


--
-- Name: facultad_despacho pk_facultad_despacho; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.facultad_despacho
    ADD CONSTRAINT pk_facultad_despacho PRIMARY KEY (facultad_id);


--
-- Name: permiso_sistema pk_permiso_sistema; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.permiso_sistema
    ADD CONSTRAINT pk_permiso_sistema PRIMARY KEY (permiso_id);


--
-- Name: rol_permiso pk_rol_permiso; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.rol_permiso
    ADD CONSTRAINT pk_rol_permiso PRIMARY KEY (rol_id, permiso_id);


--
-- Name: rol_sistema pk_rol_sistema; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.rol_sistema
    ADD CONSTRAINT pk_rol_sistema PRIMARY KEY (rol_id);


--
-- Name: usuario_rol pk_usuario_rol; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.usuario_rol
    ADD CONSTRAINT pk_usuario_rol PRIMARY KEY (id_usuario_rol);


--
-- Name: rol_sistema rol_sistema_codigo_key; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.rol_sistema
    ADD CONSTRAINT rol_sistema_codigo_key UNIQUE (codigo);


--
-- Name: area uq_area_path; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.area
    ADD CONSTRAINT uq_area_path UNIQUE (path);


--
-- Name: calendario_laboral uq_calendario_fecha_unidad; Type: CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.calendario_laboral
    ADD CONSTRAINT uq_calendario_fecha_unidad UNIQUE (fecha, unidad_territorial);


--
-- Name: accion_compensatoria accion_compensatoria_pkey; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.accion_compensatoria
    ADD CONSTRAINT accion_compensatoria_pkey PRIMARY KEY (codigo);


--
-- Name: accion_tramite accion_tramite_pkey; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.accion_tramite
    ADD CONSTRAINT accion_tramite_pkey PRIMARY KEY (codigo);


--
-- Name: contador_pestana_local contador_pestana_local_pkey; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.contador_pestana_local
    ADD CONSTRAINT contador_pestana_local_pkey PRIMARY KEY (pestana);


--
-- Name: estado_actual_expediente estado_actual_expediente_pkey; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.estado_actual_expediente
    ADD CONSTRAINT estado_actual_expediente_pkey PRIMARY KEY (expediente_id);


--
-- Name: estado_tramite estado_tramite_pkey; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.estado_tramite
    ADD CONSTRAINT estado_tramite_pkey PRIMARY KEY (codigo);


--
-- Name: movimiento_compensatorio movimiento_compensatorio_pkey; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_compensatorio
    ADD CONSTRAINT movimiento_compensatorio_pkey PRIMARY KEY (id_movimiento);


--
-- Name: movimiento_identidad movimiento_identidad_expediente_id_clave_idempotencia_key; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_identidad
    ADD CONSTRAINT movimiento_identidad_expediente_id_clave_idempotencia_key UNIQUE (expediente_id, clave_idempotencia);


--
-- Name: movimiento_identidad movimiento_identidad_expediente_id_secuencia_key; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_identidad
    ADD CONSTRAINT movimiento_identidad_expediente_id_secuencia_key UNIQUE (expediente_id, secuencia);


--
-- Name: movimiento_identidad movimiento_identidad_pkey; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_identidad
    ADD CONSTRAINT movimiento_identidad_pkey PRIMARY KEY (id_movimiento);


--
-- Name: movimiento_secuencia movimiento_secuencia_pkey; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_secuencia
    ADD CONSTRAINT movimiento_secuencia_pkey PRIMARY KEY (expediente_id);


--
-- Name: movimiento_tramite pk_movimiento_tramite; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_tramite
    ADD CONSTRAINT pk_movimiento_tramite PRIMARY KEY (fecha_hora, id_movimiento);


--
-- Name: movimiento_tramite_2026 movimiento_tramite_2026_pkey; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_tramite_2026
    ADD CONSTRAINT movimiento_tramite_2026_pkey PRIMARY KEY (fecha_hora, id_movimiento);


--
-- Name: movimiento_tramite_2027 movimiento_tramite_2027_pkey; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_tramite_2027
    ADD CONSTRAINT movimiento_tramite_2027_pkey PRIMARY KEY (fecha_hora, id_movimiento);


--
-- Name: movimiento_tramite_default movimiento_tramite_default_pkey; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_tramite_default
    ADD CONSTRAINT movimiento_tramite_default_pkey PRIMARY KEY (fecha_hora, id_movimiento);


--
-- Name: solicitud_compensacion_folios solicitud_compensacion_folios_expediente_id_clave_idempoten_key; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.solicitud_compensacion_folios
    ADD CONSTRAINT solicitud_compensacion_folios_expediente_id_clave_idempoten_key UNIQUE (expediente_id, clave_idempotencia);


--
-- Name: solicitud_compensacion_folios solicitud_compensacion_folios_movimiento_compensatorio_id_key; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.solicitud_compensacion_folios
    ADD CONSTRAINT solicitud_compensacion_folios_movimiento_compensatorio_id_key UNIQUE (movimiento_compensatorio_id);


--
-- Name: solicitud_compensacion_folios solicitud_compensacion_folios_pkey; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.solicitud_compensacion_folios
    ADD CONSTRAINT solicitud_compensacion_folios_pkey PRIMARY KEY (id_solicitud);


--
-- Name: transicion_estado_tramite transicion_estado_tramite_estado_anterior_evento_estado_nue_key; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.transicion_estado_tramite
    ADD CONSTRAINT transicion_estado_tramite_estado_anterior_evento_estado_nue_key UNIQUE (estado_anterior, evento, estado_nuevo);


--
-- Name: transicion_estado_tramite transicion_estado_tramite_pkey; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.transicion_estado_tramite
    ADD CONSTRAINT transicion_estado_tramite_pkey PRIMARY KEY (estado_anterior, evento);


--
-- Name: movimiento_compensatorio uq_compensacion_idempotencia; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_compensatorio
    ADD CONSTRAINT uq_compensacion_idempotencia UNIQUE (expediente_id, clave_idempotencia);


--
-- Name: movimiento_compensatorio uq_compensacion_objetivo; Type: CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_compensatorio
    ADD CONSTRAINT uq_compensacion_objetivo UNIQUE (movimiento_objetivo_fecha_hora, movimiento_objetivo_id);


--
-- Name: asiento_registro asiento_registro_numero_registro_key; Type: CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.asiento_registro
    ADD CONSTRAINT asiento_registro_numero_registro_key UNIQUE (numero_registro);


--
-- Name: cargo_digital cargo_digital_codigo_cargo_key; Type: CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.cargo_digital
    ADD CONSTRAINT cargo_digital_codigo_cargo_key UNIQUE (codigo_cargo);


--
-- Name: cargo_digital cargo_digital_pkey; Type: CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.cargo_digital
    ADD CONSTRAINT cargo_digital_pkey PRIMARY KEY (expediente_id);


--
-- Name: expediente expediente_codigo_expediente_key; Type: CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.expediente
    ADD CONSTRAINT expediente_codigo_expediente_key UNIQUE (codigo_expediente);


--
-- Name: asiento_registro pk_asiento_registro; Type: CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.asiento_registro
    ADD CONSTRAINT pk_asiento_registro PRIMARY KEY (id_asiento);


--
-- Name: expediente_acumulacion pk_expediente_acumulacion; Type: CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.expediente_acumulacion
    ADD CONSTRAINT pk_expediente_acumulacion PRIMARY KEY (id_acumulacion);


--
-- Name: expediente_documento_folio pk_expediente_documento_folio; Type: CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.expediente_documento_folio
    ADD CONSTRAINT pk_expediente_documento_folio PRIMARY KEY (id_folio);


--
-- Name: secuencia_anual_cut pk_secuencia_anual_cut; Type: CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.secuencia_anual_cut
    ADD CONSTRAINT pk_secuencia_anual_cut PRIMARY KEY (anio_fiscal);


--
-- Name: expediente pk_tra_expediente; Type: CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.expediente
    ADD CONSTRAINT pk_tra_expediente PRIMARY KEY (expediente_id);


--
-- Name: tramite pk_tra_tramite; Type: CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.tramite
    ADD CONSTRAINT pk_tra_tramite PRIMARY KEY (tramite_id);


--
-- Name: tramite tramite_expediente_id_key; Type: CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.tramite
    ADD CONSTRAINT tramite_expediente_id_key UNIQUE (expediente_id);


--
-- Name: expediente uq_tra_expediente_numero; Type: CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.expediente
    ADD CONSTRAINT uq_tra_expediente_numero UNIQUE (numero);


--
-- Name: idx_bitacora_correlation_id; Type: INDEX; Schema: sigd_audit; Owner: -
--

CREATE INDEX idx_bitacora_correlation_id ON sigd_audit.bitacora_auditoria USING btree (correlation_id);


--
-- Name: idx_bitacora_fecha; Type: INDEX; Schema: sigd_audit; Owner: -
--

CREATE INDEX idx_bitacora_fecha ON sigd_audit.bitacora_auditoria USING btree (fecha_hora);


--
-- Name: idx_bitacora_jsonb; Type: INDEX; Schema: sigd_audit; Owner: -
--

CREATE INDEX idx_bitacora_jsonb ON sigd_audit.bitacora_auditoria USING gin (datos_despues);


--
-- Name: idx_bitacora_tabla; Type: INDEX; Schema: sigd_audit; Owner: -
--

CREATE INDEX idx_bitacora_tabla ON sigd_audit.bitacora_auditoria USING btree (esquema, tabla);


--
-- Name: idx_bitacora_usuario; Type: INDEX; Schema: sigd_audit; Owner: -
--

CREATE INDEX idx_bitacora_usuario ON sigd_audit.bitacora_auditoria USING btree (usuario_id);


--
-- Name: idx_outbox_estado_fecha; Type: INDEX; Schema: sigd_audit; Owner: -
--

CREATE INDEX idx_outbox_estado_fecha ON sigd_audit.evento_outbox USING btree (estado, creado_en);


--
-- Name: idx_auditoria_usuarios_correlacion; Type: INDEX; Schema: sigd_auth; Owner: -
--

CREATE INDEX idx_auditoria_usuarios_correlacion ON sigd_auth.auditoria_usuarios USING btree (correlation_id);


--
-- Name: idx_consentimiento_persona; Type: INDEX; Schema: sigd_auth; Owner: -
--

CREATE INDEX idx_consentimiento_persona ON sigd_auth.consentimiento_datos USING btree (id_persona);


--
-- Name: idx_cuenta_usuario_bloqueado_hasta; Type: INDEX; Schema: sigd_auth; Owner: -
--

CREATE INDEX idx_cuenta_usuario_bloqueado_hasta ON sigd_auth.cuenta_usuario USING btree (bloqueado_hasta) WHERE (bloqueado_hasta IS NOT NULL);


--
-- Name: idx_cuenta_usuario_persona; Type: INDEX; Schema: sigd_auth; Owner: -
--

CREATE INDEX idx_cuenta_usuario_persona ON sigd_auth.cuenta_usuario USING btree (id_persona);


--
-- Name: idx_notif_casilla_cut; Type: INDEX; Schema: sigd_auth; Owner: -
--

CREATE INDEX idx_notif_casilla_cut ON sigd_auth.notificacion_casilla USING btree (cut);


--
-- Name: idx_notif_casilla_estado; Type: INDEX; Schema: sigd_auth; Owner: -
--

CREATE INDEX idx_notif_casilla_estado ON sigd_auth.notificacion_casilla USING btree (usuario_id, estado);


--
-- Name: idx_notif_casilla_fecha; Type: INDEX; Schema: sigd_auth; Owner: -
--

CREATE INDEX idx_notif_casilla_fecha ON sigd_auth.notificacion_casilla USING btree (fecha_deposito DESC);


--
-- Name: idx_notif_casilla_usuario; Type: INDEX; Schema: sigd_auth; Owner: -
--

CREATE INDEX idx_notif_casilla_usuario ON sigd_auth.notificacion_casilla USING btree (usuario_id);


--
-- Name: idx_sesion_usuario_expira; Type: INDEX; Schema: sigd_auth; Owner: -
--

CREATE INDEX idx_sesion_usuario_expira ON sigd_auth.sesion_usuario USING btree (expira_en);


--
-- Name: idx_sesion_usuario_usuario; Type: INDEX; Schema: sigd_auth; Owner: -
--

CREATE INDEX idx_sesion_usuario_usuario ON sigd_auth.sesion_usuario USING btree (id_usuario);


--
-- Name: idx_doc_expediente_area; Type: INDEX; Schema: sigd_doc; Owner: -
--

CREATE INDEX idx_doc_expediente_area ON sigd_doc.expediente USING btree (area_actual_id);


--
-- Name: idx_doc_expediente_solicitante; Type: INDEX; Schema: sigd_doc; Owner: -
--

CREATE INDEX idx_doc_expediente_solicitante ON sigd_doc.expediente USING btree (solicitante_id);


--
-- Name: idx_doc_expediente_tramite; Type: INDEX; Schema: sigd_doc; Owner: -
--

CREATE INDEX idx_doc_expediente_tramite ON sigd_doc.expediente USING btree (tipo_tramite_id);


--
-- Name: idx_documento_adjunto_expediente; Type: INDEX; Schema: sigd_doc; Owner: -
--

CREATE INDEX idx_documento_adjunto_expediente ON sigd_doc.documento_adjunto USING btree (expediente_id);


--
-- Name: idx_documento_adjunto_sha; Type: INDEX; Schema: sigd_doc; Owner: -
--

CREATE INDEX idx_documento_adjunto_sha ON sigd_doc.documento_adjunto USING btree (sha256);


--
-- Name: idx_firma_digital_cvd; Type: INDEX; Schema: sigd_doc; Owner: -
--

CREATE INDEX idx_firma_digital_cvd ON sigd_doc.firma_digital_documento USING btree (cvd);


--
-- Name: idx_firma_digital_sha256; Type: INDEX; Schema: sigd_doc; Owner: -
--

CREATE INDEX idx_firma_digital_sha256 ON sigd_doc.firma_digital_documento USING btree (sha256_firmado);


--
-- Name: idx_resolucion_estado; Type: INDEX; Schema: sigd_doc; Owner: -
--

CREATE INDEX idx_resolucion_estado ON sigd_doc.resolucion USING btree (estado);


--
-- Name: idx_resolucion_proyeccion; Type: INDEX; Schema: sigd_doc; Owner: -
--

CREATE INDEX idx_resolucion_proyeccion ON sigd_doc.resolucion USING btree (fecha_proyeccion);


--
-- Name: idx_workflow_academico_estado; Type: INDEX; Schema: sigd_doc; Owner: -
--

CREATE INDEX idx_workflow_academico_estado ON sigd_doc.workflow_academico USING btree (((workflow ->> 'estado'::text)));


--
-- Name: idx_area_padre; Type: INDEX; Schema: sigd_org; Owner: -
--

CREATE INDEX idx_area_padre ON sigd_org.area USING btree (area_padre_id);


--
-- Name: idx_area_path; Type: INDEX; Schema: sigd_org; Owner: -
--

CREATE INDEX idx_area_path ON sigd_org.area USING gist (path);


--
-- Name: idx_area_vigente; Type: INDEX; Schema: sigd_org; Owner: -
--

CREATE INDEX idx_area_vigente ON sigd_org.area USING btree (vigente) WHERE (vigente = true);


--
-- Name: idx_calendario_anio; Type: INDEX; Schema: sigd_org; Owner: -
--

CREATE INDEX idx_calendario_anio ON sigd_org.calendario_laboral USING btree (anio);


--
-- Name: idx_calendario_fecha; Type: INDEX; Schema: sigd_org; Owner: -
--

CREATE INDEX idx_calendario_fecha ON sigd_org.calendario_laboral USING btree (fecha);


--
-- Name: idx_encargatura_usuario; Type: INDEX; Schema: sigd_org; Owner: -
--

CREATE INDEX idx_encargatura_usuario ON sigd_org.encargatura_despacho USING btree (usuario_id) WHERE (vigente = true);


--
-- Name: idx_facultad_usuario; Type: INDEX; Schema: sigd_org; Owner: -
--

CREATE INDEX idx_facultad_usuario ON sigd_org.facultad_despacho USING btree (usuario_id) WHERE (vigente = true);


--
-- Name: idx_rol_permiso_rol; Type: INDEX; Schema: sigd_org; Owner: -
--

CREATE INDEX idx_rol_permiso_rol ON sigd_org.rol_permiso USING btree (rol_id);


--
-- Name: idx_usuario_rol_usuario; Type: INDEX; Schema: sigd_org; Owner: -
--

CREATE INDEX idx_usuario_rol_usuario ON sigd_org.usuario_rol USING btree (id_usuario);


--
-- Name: ix_compensacion_expediente_secuencia; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX ix_compensacion_expediente_secuencia ON sigd_rut.movimiento_compensatorio USING btree (expediente_id, secuencia DESC);


--
-- Name: ix_estado_actual_area_estado; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX ix_estado_actual_area_estado ON sigd_rut.estado_actual_expediente USING btree (area_actual_id, estado_nuevo, expediente_id);


--
-- Name: ix_estado_actual_estado_expediente; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX ix_estado_actual_estado_expediente ON sigd_rut.estado_actual_expediente USING btree (estado_nuevo, expediente_id);


--
-- Name: ix_estado_actual_expediente_conteo; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX ix_estado_actual_expediente_conteo ON sigd_rut.estado_actual_expediente USING btree (expediente_id) INCLUDE (estado_nuevo, area_actual_id);


--
-- Name: ix_movimiento_estado_fecha; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX ix_movimiento_estado_fecha ON ONLY sigd_rut.movimiento_tramite USING btree (estado_nuevo, fecha_hora DESC, id_movimiento DESC);


--
-- Name: ix_movimiento_expediente_fecha; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX ix_movimiento_expediente_fecha ON ONLY sigd_rut.movimiento_tramite USING btree (expediente_id, fecha_hora DESC, id_movimiento DESC);


--
-- Name: ix_movimiento_expediente_secuencia; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX ix_movimiento_expediente_secuencia ON ONLY sigd_rut.movimiento_tramite USING btree (expediente_id, secuencia DESC);


--
-- Name: ix_movimiento_fecha_id; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX ix_movimiento_fecha_id ON ONLY sigd_rut.movimiento_tramite USING btree (fecha_hora DESC, id_movimiento DESC);


--
-- Name: ix_solicitud_folios_estado_fecha; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX ix_solicitud_folios_estado_fecha ON sigd_rut.solicitud_compensacion_folios USING btree (estado, creado_en);


--
-- Name: movimiento_tramite_2026_estado_nuevo_fecha_hora_id_movimien_idx; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX movimiento_tramite_2026_estado_nuevo_fecha_hora_id_movimien_idx ON sigd_rut.movimiento_tramite_2026 USING btree (estado_nuevo, fecha_hora DESC, id_movimiento DESC);


--
-- Name: movimiento_tramite_2026_expediente_id_fecha_hora_id_movimie_idx; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX movimiento_tramite_2026_expediente_id_fecha_hora_id_movimie_idx ON sigd_rut.movimiento_tramite_2026 USING btree (expediente_id, fecha_hora DESC, id_movimiento DESC);


--
-- Name: movimiento_tramite_2026_expediente_id_secuencia_idx; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX movimiento_tramite_2026_expediente_id_secuencia_idx ON sigd_rut.movimiento_tramite_2026 USING btree (expediente_id, secuencia DESC);


--
-- Name: movimiento_tramite_2026_fecha_hora_id_movimiento_idx; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX movimiento_tramite_2026_fecha_hora_id_movimiento_idx ON sigd_rut.movimiento_tramite_2026 USING btree (fecha_hora DESC, id_movimiento DESC);


--
-- Name: movimiento_tramite_2027_estado_nuevo_fecha_hora_id_movimien_idx; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX movimiento_tramite_2027_estado_nuevo_fecha_hora_id_movimien_idx ON sigd_rut.movimiento_tramite_2027 USING btree (estado_nuevo, fecha_hora DESC, id_movimiento DESC);


--
-- Name: movimiento_tramite_2027_expediente_id_fecha_hora_id_movimie_idx; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX movimiento_tramite_2027_expediente_id_fecha_hora_id_movimie_idx ON sigd_rut.movimiento_tramite_2027 USING btree (expediente_id, fecha_hora DESC, id_movimiento DESC);


--
-- Name: movimiento_tramite_2027_expediente_id_secuencia_idx; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX movimiento_tramite_2027_expediente_id_secuencia_idx ON sigd_rut.movimiento_tramite_2027 USING btree (expediente_id, secuencia DESC);


--
-- Name: movimiento_tramite_2027_fecha_hora_id_movimiento_idx; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX movimiento_tramite_2027_fecha_hora_id_movimiento_idx ON sigd_rut.movimiento_tramite_2027 USING btree (fecha_hora DESC, id_movimiento DESC);


--
-- Name: movimiento_tramite_default_estado_nuevo_fecha_hora_id_movim_idx; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX movimiento_tramite_default_estado_nuevo_fecha_hora_id_movim_idx ON sigd_rut.movimiento_tramite_default USING btree (estado_nuevo, fecha_hora DESC, id_movimiento DESC);


--
-- Name: movimiento_tramite_default_expediente_id_fecha_hora_id_movi_idx; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX movimiento_tramite_default_expediente_id_fecha_hora_id_movi_idx ON sigd_rut.movimiento_tramite_default USING btree (expediente_id, fecha_hora DESC, id_movimiento DESC);


--
-- Name: movimiento_tramite_default_expediente_id_secuencia_idx; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX movimiento_tramite_default_expediente_id_secuencia_idx ON sigd_rut.movimiento_tramite_default USING btree (expediente_id, secuencia DESC);


--
-- Name: movimiento_tramite_default_fecha_hora_id_movimiento_idx; Type: INDEX; Schema: sigd_rut; Owner: -
--

CREATE INDEX movimiento_tramite_default_fecha_hora_id_movimiento_idx ON sigd_rut.movimiento_tramite_default USING btree (fecha_hora DESC, id_movimiento DESC);


--
-- Name: idx_asiento_registro_anulado; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE INDEX idx_asiento_registro_anulado ON sigd_tra.asiento_registro USING btree (anulado) WHERE (anulado = true);


--
-- Name: idx_asiento_registro_expediente; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE INDEX idx_asiento_registro_expediente ON sigd_tra.asiento_registro USING btree (expediente_id);


--
-- Name: idx_expediente_acumulacion_accesorio; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE INDEX idx_expediente_acumulacion_accesorio ON sigd_tra.expediente_acumulacion USING btree (expediente_accesorio);


--
-- Name: idx_expediente_documento_folio_rango; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE INDEX idx_expediente_documento_folio_rango ON sigd_tra.expediente_documento_folio USING btree (expediente_id, folio_inicio, folio_fin);


--
-- Name: idx_tra_expediente_area; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE INDEX idx_tra_expediente_area ON sigd_tra.expediente USING btree (area_destino_id);


--
-- Name: idx_tra_expediente_cut; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE INDEX idx_tra_expediente_cut ON sigd_tra.expediente USING btree (codigo_expediente);


--
-- Name: idx_tra_expediente_estado; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE INDEX idx_tra_expediente_estado ON sigd_tra.expediente USING btree (estado);


--
-- Name: idx_tra_tramite_estado; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE INDEX idx_tra_tramite_estado ON sigd_tra.tramite USING btree (estado);


--
-- Name: ix_mv_kpis_mgd_mensual_v2_unidad; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE INDEX ix_mv_kpis_mgd_mensual_v2_unidad ON sigd_tra.mv_kpis_mgd_mensual_v2 USING btree (unidad_organica_id, periodo);


--
-- Name: ix_mv_tiempos_retencion_area_dias; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE INDEX ix_mv_tiempos_retencion_area_dias ON sigd_tra.mv_tiempos_retencion_area USING btree (dias_promedio DESC);


--
-- Name: ix_mv_tiempos_retencion_area_v2_unidad; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE INDEX ix_mv_tiempos_retencion_area_v2_unidad ON sigd_tra.mv_tiempos_retencion_area_v2 USING btree (unidad_organica_id, periodo);


--
-- Name: ix_rutadoc_expediente_fecha_id; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE INDEX ix_rutadoc_expediente_fecha_id ON sigd_tra.expediente USING btree (fecha_radicacion DESC, expediente_id DESC);


--
-- Name: uq_expediente_acumulacion_vigente; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE UNIQUE INDEX uq_expediente_acumulacion_vigente ON sigd_tra.expediente_acumulacion USING btree (expediente_principal, expediente_accesorio) WHERE ((estado)::text = 'ACUMULADO'::text);


--
-- Name: uq_mv_kpis_mgd_mensual_v2; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE UNIQUE INDEX uq_mv_kpis_mgd_mensual_v2 ON sigd_tra.mv_kpis_mgd_mensual_v2 USING btree (periodo, unidad_organica_id);


--
-- Name: uq_mv_tiempos_retencion_area_v2; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE UNIQUE INDEX uq_mv_tiempos_retencion_area_v2 ON sigd_tra.mv_tiempos_retencion_area_v2 USING btree (periodo, unidad_organica_id, tramo_permanencia_dias_habiles);


--
-- Name: ux_mv_kpis_mgd_mensual_periodo; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE UNIQUE INDEX ux_mv_kpis_mgd_mensual_periodo ON sigd_tra.mv_kpis_mgd_mensual USING btree (periodo);


--
-- Name: ux_mv_tiempos_retencion_area_clave; Type: INDEX; Schema: sigd_tra; Owner: -
--

CREATE UNIQUE INDEX ux_mv_tiempos_retencion_area_clave ON sigd_tra.mv_tiempos_retencion_area USING btree (COALESCE(area_id, '00000000-0000-0000-0000-000000000000'::uuid), estado);


--
-- Name: movimiento_tramite_2026_estado_nuevo_fecha_hora_id_movimien_idx; Type: INDEX ATTACH; Schema: sigd_rut; Owner: -
--

ALTER INDEX sigd_rut.ix_movimiento_estado_fecha ATTACH PARTITION sigd_rut.movimiento_tramite_2026_estado_nuevo_fecha_hora_id_movimien_idx;


--
-- Name: movimiento_tramite_2026_expediente_id_fecha_hora_id_movimie_idx; Type: INDEX ATTACH; Schema: sigd_rut; Owner: -
--

ALTER INDEX sigd_rut.ix_movimiento_expediente_fecha ATTACH PARTITION sigd_rut.movimiento_tramite_2026_expediente_id_fecha_hora_id_movimie_idx;


--
-- Name: movimiento_tramite_2026_expediente_id_secuencia_idx; Type: INDEX ATTACH; Schema: sigd_rut; Owner: -
--

ALTER INDEX sigd_rut.ix_movimiento_expediente_secuencia ATTACH PARTITION sigd_rut.movimiento_tramite_2026_expediente_id_secuencia_idx;


--
-- Name: movimiento_tramite_2026_fecha_hora_id_movimiento_idx; Type: INDEX ATTACH; Schema: sigd_rut; Owner: -
--

ALTER INDEX sigd_rut.ix_movimiento_fecha_id ATTACH PARTITION sigd_rut.movimiento_tramite_2026_fecha_hora_id_movimiento_idx;


--
-- Name: movimiento_tramite_2026_pkey; Type: INDEX ATTACH; Schema: sigd_rut; Owner: -
--

ALTER INDEX sigd_rut.pk_movimiento_tramite ATTACH PARTITION sigd_rut.movimiento_tramite_2026_pkey;


--
-- Name: movimiento_tramite_2027_estado_nuevo_fecha_hora_id_movimien_idx; Type: INDEX ATTACH; Schema: sigd_rut; Owner: -
--

ALTER INDEX sigd_rut.ix_movimiento_estado_fecha ATTACH PARTITION sigd_rut.movimiento_tramite_2027_estado_nuevo_fecha_hora_id_movimien_idx;


--
-- Name: movimiento_tramite_2027_expediente_id_fecha_hora_id_movimie_idx; Type: INDEX ATTACH; Schema: sigd_rut; Owner: -
--

ALTER INDEX sigd_rut.ix_movimiento_expediente_fecha ATTACH PARTITION sigd_rut.movimiento_tramite_2027_expediente_id_fecha_hora_id_movimie_idx;


--
-- Name: movimiento_tramite_2027_expediente_id_secuencia_idx; Type: INDEX ATTACH; Schema: sigd_rut; Owner: -
--

ALTER INDEX sigd_rut.ix_movimiento_expediente_secuencia ATTACH PARTITION sigd_rut.movimiento_tramite_2027_expediente_id_secuencia_idx;


--
-- Name: movimiento_tramite_2027_fecha_hora_id_movimiento_idx; Type: INDEX ATTACH; Schema: sigd_rut; Owner: -
--

ALTER INDEX sigd_rut.ix_movimiento_fecha_id ATTACH PARTITION sigd_rut.movimiento_tramite_2027_fecha_hora_id_movimiento_idx;


--
-- Name: movimiento_tramite_2027_pkey; Type: INDEX ATTACH; Schema: sigd_rut; Owner: -
--

ALTER INDEX sigd_rut.pk_movimiento_tramite ATTACH PARTITION sigd_rut.movimiento_tramite_2027_pkey;


--
-- Name: movimiento_tramite_default_estado_nuevo_fecha_hora_id_movim_idx; Type: INDEX ATTACH; Schema: sigd_rut; Owner: -
--

ALTER INDEX sigd_rut.ix_movimiento_estado_fecha ATTACH PARTITION sigd_rut.movimiento_tramite_default_estado_nuevo_fecha_hora_id_movim_idx;


--
-- Name: movimiento_tramite_default_expediente_id_fecha_hora_id_movi_idx; Type: INDEX ATTACH; Schema: sigd_rut; Owner: -
--

ALTER INDEX sigd_rut.ix_movimiento_expediente_fecha ATTACH PARTITION sigd_rut.movimiento_tramite_default_expediente_id_fecha_hora_id_movi_idx;


--
-- Name: movimiento_tramite_default_expediente_id_secuencia_idx; Type: INDEX ATTACH; Schema: sigd_rut; Owner: -
--

ALTER INDEX sigd_rut.ix_movimiento_expediente_secuencia ATTACH PARTITION sigd_rut.movimiento_tramite_default_expediente_id_secuencia_idx;


--
-- Name: movimiento_tramite_default_fecha_hora_id_movimiento_idx; Type: INDEX ATTACH; Schema: sigd_rut; Owner: -
--

ALTER INDEX sigd_rut.ix_movimiento_fecha_id ATTACH PARTITION sigd_rut.movimiento_tramite_default_fecha_hora_id_movimiento_idx;


--
-- Name: movimiento_tramite_default_pkey; Type: INDEX ATTACH; Schema: sigd_rut; Owner: -
--

ALTER INDEX sigd_rut.pk_movimiento_tramite ATTACH PARTITION sigd_rut.movimiento_tramite_default_pkey;


--
-- Name: bitacora_auditoria tr_bitacora_append_only; Type: TRIGGER; Schema: sigd_audit; Owner: -
--

CREATE TRIGGER tr_bitacora_append_only BEFORE DELETE OR UPDATE ON sigd_audit.bitacora_auditoria FOR EACH ROW EXECUTE FUNCTION sigd_audit.fn_rechazar_mutacion_bitacora();


--
-- Name: formulario_version tr_proteger_formulario_version; Type: TRIGGER; Schema: sigd_doc; Owner: -
--

CREATE TRIGGER tr_proteger_formulario_version BEFORE DELETE OR UPDATE ON sigd_doc.formulario_version FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_proteger_formulario_version();


--
-- Name: area tr_area_set_path; Type: TRIGGER; Schema: sigd_org; Owner: -
--

CREATE TRIGGER tr_area_set_path BEFORE INSERT OR UPDATE OF area_padre_id, codigo ON sigd_org.area FOR EACH ROW EXECUTE FUNCTION sigd_org.fn_area_set_path();


--
-- Name: movimiento_compensatorio tr_compensacion_inmutable; Type: TRIGGER; Schema: sigd_rut; Owner: -
--

CREATE TRIGGER tr_compensacion_inmutable BEFORE DELETE OR UPDATE ON sigd_rut.movimiento_compensatorio FOR EACH ROW EXECUTE FUNCTION sigd_rut.rechazar_mutacion_compensatoria();


--
-- Name: movimiento_compensatorio tr_compensacion_no_truncar; Type: TRIGGER; Schema: sigd_rut; Owner: -
--

CREATE TRIGGER tr_compensacion_no_truncar BEFORE TRUNCATE ON sigd_rut.movimiento_compensatorio FOR EACH STATEMENT EXECUTE FUNCTION sigd_rut.rechazar_mutacion_compensatoria();


--
-- Name: estado_actual_expediente tr_contador_pestana_local; Type: TRIGGER; Schema: sigd_rut; Owner: -
--

CREATE TRIGGER tr_contador_pestana_local AFTER INSERT OR DELETE OR UPDATE ON sigd_rut.estado_actual_expediente FOR EACH ROW EXECUTE FUNCTION sigd_rut.actualizar_contador_pestana_local();


--
-- Name: movimiento_compensatorio tr_estado_actual_compensacion; Type: TRIGGER; Schema: sigd_rut; Owner: -
--

CREATE TRIGGER tr_estado_actual_compensacion AFTER INSERT ON sigd_rut.movimiento_compensatorio FOR EACH ROW EXECUTE FUNCTION sigd_rut.actualizar_estado_actual_expediente();


--
-- Name: movimiento_tramite tr_estado_actual_movimiento; Type: TRIGGER; Schema: sigd_rut; Owner: -
--

CREATE TRIGGER tr_estado_actual_movimiento AFTER INSERT ON sigd_rut.movimiento_tramite FOR EACH ROW EXECUTE FUNCTION sigd_rut.actualizar_estado_actual_expediente();


--
-- Name: movimiento_compensatorio tr_registrar_compensacion_identidad; Type: TRIGGER; Schema: sigd_rut; Owner: -
--

CREATE TRIGGER tr_registrar_compensacion_identidad BEFORE INSERT ON sigd_rut.movimiento_compensatorio FOR EACH ROW EXECUTE FUNCTION sigd_rut.registrar_movimiento_identidad();


--
-- Name: movimiento_tramite tr_registrar_movimiento_identidad; Type: TRIGGER; Schema: sigd_rut; Owner: -
--

CREATE TRIGGER tr_registrar_movimiento_identidad BEFORE INSERT ON sigd_rut.movimiento_tramite FOR EACH ROW EXECUTE FUNCTION sigd_rut.registrar_movimiento_identidad();


--
-- Name: expediente_documento_folio tr_folio_continuidad; Type: TRIGGER; Schema: sigd_tra; Owner: -
--

CREATE TRIGGER tr_folio_continuidad BEFORE INSERT ON sigd_tra.expediente_documento_folio FOR EACH ROW EXECUTE FUNCTION sigd_tra.fn_verificar_continuidad_folio();


--
-- Name: expediente tr_rutadoc_contador_expediente; Type: TRIGGER; Schema: sigd_tra; Owner: -
--

CREATE TRIGGER tr_rutadoc_contador_expediente AFTER INSERT OR DELETE OR UPDATE ON sigd_tra.expediente FOR EACH ROW EXECUTE FUNCTION sigd_rut.actualizar_contador_expediente_externo();


--
-- Name: expediente tr_tra_expediente_asignar_cut; Type: TRIGGER; Schema: sigd_tra; Owner: -
--

CREATE TRIGGER tr_tra_expediente_asignar_cut BEFORE INSERT ON sigd_tra.expediente FOR EACH ROW EXECUTE FUNCTION sigd_tra.fn_tra_expediente_asignar_cut();


--
-- Name: asiento_registro trg_asiento_inmutable; Type: TRIGGER; Schema: sigd_tra; Owner: -
--

CREATE TRIGGER trg_asiento_inmutable BEFORE DELETE OR UPDATE ON sigd_tra.asiento_registro FOR EACH ROW EXECUTE FUNCTION sigd_tra.fn_rechazar_mutacion_asiento();


--
-- Name: expediente trg_expediente_exigir_adjunto; Type: TRIGGER; Schema: sigd_tra; Owner: -
--

CREATE CONSTRAINT TRIGGER trg_expediente_exigir_adjunto AFTER INSERT OR UPDATE ON sigd_tra.expediente DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sigd_tra.exigir_adjunto_virtual();


--
-- Name: expediente_documento_folio trg_folio_no_delete; Type: TRIGGER; Schema: sigd_tra; Owner: -
--

CREATE TRIGGER trg_folio_no_delete BEFORE DELETE ON sigd_tra.expediente_documento_folio FOR EACH ROW EXECUTE FUNCTION sigd_tra.fn_rechazar_mutacion_folio();


--
-- Name: expediente_documento_folio trg_folio_no_update; Type: TRIGGER; Schema: sigd_tra; Owner: -
--

CREATE TRIGGER trg_folio_no_update BEFORE UPDATE ON sigd_tra.expediente_documento_folio FOR EACH ROW EXECUTE FUNCTION sigd_tra.fn_rechazar_mutacion_folio();


--
-- Name: consentimiento_datos consentimiento_datos_id_persona_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.consentimiento_datos
    ADD CONSTRAINT consentimiento_datos_id_persona_fkey FOREIGN KEY (id_persona) REFERENCES sigd_auth.persona(id_persona) ON DELETE CASCADE;


--
-- Name: cuenta_usuario cuenta_usuario_id_persona_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.cuenta_usuario
    ADD CONSTRAINT cuenta_usuario_id_persona_fkey FOREIGN KEY (id_persona) REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT;


--
-- Name: distrito_ubigeo distrito_ubigeo_provincia_codigo_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.distrito_ubigeo
    ADD CONSTRAINT distrito_ubigeo_provincia_codigo_fkey FOREIGN KEY (provincia_codigo) REFERENCES sigd_auth.provincia_ubigeo(codigo) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: persona fk_persona_distrito_ubigeo; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.persona
    ADD CONSTRAINT fk_persona_distrito_ubigeo FOREIGN KEY (ubigeo_distrito) REFERENCES sigd_auth.distrito_ubigeo(codigo);


--
-- Name: notificacion_casilla notificacion_casilla_usuario_id_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.notificacion_casilla
    ADD CONSTRAINT notificacion_casilla_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: perfil_usuario perfil_usuario_id_usuario_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.perfil_usuario
    ADD CONSTRAINT perfil_usuario_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: persona_documento_historial persona_documento_historial_id_persona_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.persona_documento_historial
    ADD CONSTRAINT persona_documento_historial_id_persona_fkey FOREIGN KEY (id_persona) REFERENCES sigd_auth.persona(id_persona) ON DELETE CASCADE;


--
-- Name: persona_documento_historial persona_documento_historial_tipo_documento_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.persona_documento_historial
    ADD CONSTRAINT persona_documento_historial_tipo_documento_fkey FOREIGN KEY (tipo_documento) REFERENCES sigd_auth.tipos_documento(id_tipo_documento);


--
-- Name: persona_juridica persona_juridica_id_persona_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.persona_juridica
    ADD CONSTRAINT persona_juridica_id_persona_fkey FOREIGN KEY (id_persona) REFERENCES sigd_auth.persona(id_persona) ON DELETE CASCADE;


--
-- Name: persona_natural persona_natural_id_persona_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.persona_natural
    ADD CONSTRAINT persona_natural_id_persona_fkey FOREIGN KEY (id_persona) REFERENCES sigd_auth.persona(id_persona) ON DELETE CASCADE;


--
-- Name: representacion_legal representacion_legal_id_persona_juridica_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.representacion_legal
    ADD CONSTRAINT representacion_legal_id_persona_juridica_fkey FOREIGN KEY (id_persona_juridica) REFERENCES sigd_auth.persona(id_persona) ON DELETE CASCADE;


--
-- Name: representacion_legal representacion_legal_id_persona_natural_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.representacion_legal
    ADD CONSTRAINT representacion_legal_id_persona_natural_fkey FOREIGN KEY (id_persona_natural) REFERENCES sigd_auth.persona(id_persona) ON DELETE CASCADE;


--
-- Name: sesion_usuario sesion_usuario_id_usuario_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: -
--

ALTER TABLE ONLY sigd_auth.sesion_usuario
    ADD CONSTRAINT sesion_usuario_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: carga_documento carga_documento_expediente_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.carga_documento
    ADD CONSTRAINT carga_documento_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES sigd_tra.expediente(expediente_id);


--
-- Name: carga_documento carga_documento_usuario_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.carga_documento
    ADD CONSTRAINT carga_documento_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES sigd_auth.cuenta_usuario(id_usuario);


--
-- Name: documento_adjunto documento_adjunto_expediente_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.documento_adjunto
    ADD CONSTRAINT documento_adjunto_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES sigd_doc.expediente(expediente_id) ON DELETE CASCADE;


--
-- Name: documento_adjunto documento_adjunto_tipo_documental_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.documento_adjunto
    ADD CONSTRAINT documento_adjunto_tipo_documental_id_fkey FOREIGN KEY (tipo_documental_id) REFERENCES sigd_doc.tipo_documento(tipo_documental_id) ON DELETE RESTRICT;


--
-- Name: expediente expediente_area_actual_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.expediente
    ADD CONSTRAINT expediente_area_actual_id_fkey FOREIGN KEY (area_actual_id) REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT;


--
-- Name: expediente_formulario_respuesta expediente_formulario_respuesta_expediente_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.expediente_formulario_respuesta
    ADD CONSTRAINT expediente_formulario_respuesta_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES sigd_doc.expediente(expediente_id) ON DELETE CASCADE;


--
-- Name: expediente_formulario_respuesta expediente_formulario_respuesta_formulario_version_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.expediente_formulario_respuesta
    ADD CONSTRAINT expediente_formulario_respuesta_formulario_version_id_fkey FOREIGN KEY (formulario_version_id) REFERENCES sigd_doc.formulario_version(formulario_version_id) ON DELETE RESTRICT;


--
-- Name: expediente expediente_formulario_version_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.expediente
    ADD CONSTRAINT expediente_formulario_version_id_fkey FOREIGN KEY (formulario_version_id) REFERENCES sigd_doc.formulario_version(formulario_version_id) ON DELETE RESTRICT;


--
-- Name: expediente_requisito expediente_requisito_expediente_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.expediente_requisito
    ADD CONSTRAINT expediente_requisito_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES sigd_doc.expediente(expediente_id) ON DELETE CASCADE;


--
-- Name: expediente_requisito expediente_requisito_requisito_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.expediente_requisito
    ADD CONSTRAINT expediente_requisito_requisito_id_fkey FOREIGN KEY (requisito_id) REFERENCES sigd_doc.requisito(requisito_id) ON DELETE RESTRICT;


--
-- Name: expediente expediente_solicitante_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.expediente
    ADD CONSTRAINT expediente_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT;


--
-- Name: expediente expediente_tipo_tramite_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.expediente
    ADD CONSTRAINT expediente_tipo_tramite_id_fkey FOREIGN KEY (tipo_tramite_id) REFERENCES sigd_doc.tipo_tramite_tupa(tipo_tramite_id) ON DELETE RESTRICT;


--
-- Name: firma_digital_documento firma_digital_documento_documento_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.firma_digital_documento
    ADD CONSTRAINT firma_digital_documento_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES sigd_doc.documento_adjunto(documento_adjunto_id) ON DELETE CASCADE;


--
-- Name: formulario_version formulario_version_tipo_tramite_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.formulario_version
    ADD CONSTRAINT formulario_version_tipo_tramite_id_fkey FOREIGN KEY (tipo_tramite_id) REFERENCES sigd_doc.tipo_tramite_tupa(tipo_tramite_id) ON DELETE RESTRICT;


--
-- Name: requisito requisito_tipo_tramite_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.requisito
    ADD CONSTRAINT requisito_tipo_tramite_id_fkey FOREIGN KEY (tipo_tramite_id) REFERENCES sigd_doc.tipo_tramite_tupa(tipo_tramite_id) ON DELETE CASCADE;


--
-- Name: resolucion resolucion_expediente_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.resolucion
    ADD CONSTRAINT resolucion_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES sigd_doc.expediente(expediente_id) ON DELETE RESTRICT;


--
-- Name: tipo_documento_requisito tipo_documento_requisito_requisito_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.tipo_documento_requisito
    ADD CONSTRAINT tipo_documento_requisito_requisito_id_fkey FOREIGN KEY (requisito_id) REFERENCES sigd_doc.requisito(requisito_id) ON DELETE CASCADE;


--
-- Name: tipo_documento_requisito tipo_documento_requisito_tipo_documental_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: -
--

ALTER TABLE ONLY sigd_doc.tipo_documento_requisito
    ADD CONSTRAINT tipo_documento_requisito_tipo_documental_id_fkey FOREIGN KEY (tipo_documental_id) REFERENCES sigd_doc.tipo_documento(tipo_documental_id) ON DELETE RESTRICT;


--
-- Name: area area_area_padre_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.area
    ADD CONSTRAINT area_area_padre_id_fkey FOREIGN KEY (area_padre_id) REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT;


--
-- Name: asignacion_personal asignacion_personal_area_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.asignacion_personal
    ADD CONSTRAINT asignacion_personal_area_id_fkey FOREIGN KEY (area_id) REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT;


--
-- Name: asignacion_personal asignacion_personal_cargo_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.asignacion_personal
    ADD CONSTRAINT asignacion_personal_cargo_id_fkey FOREIGN KEY (cargo_id) REFERENCES sigd_org.cargo(cargo_id) ON DELETE RESTRICT;


--
-- Name: asignacion_personal asignacion_personal_id_usuario_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.asignacion_personal
    ADD CONSTRAINT asignacion_personal_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: encargatura_despacho encargatura_despacho_cargo_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.encargatura_despacho
    ADD CONSTRAINT encargatura_despacho_cargo_id_fkey FOREIGN KEY (cargo_id) REFERENCES sigd_org.cargo(cargo_id) ON DELETE RESTRICT;


--
-- Name: encargatura_despacho encargatura_despacho_titular_usuario_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.encargatura_despacho
    ADD CONSTRAINT encargatura_despacho_titular_usuario_id_fkey FOREIGN KEY (titular_usuario_id) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT;


--
-- Name: encargatura_despacho encargatura_despacho_usuario_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.encargatura_despacho
    ADD CONSTRAINT encargatura_despacho_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: facultad_despacho facultad_despacho_cargo_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.facultad_despacho
    ADD CONSTRAINT facultad_despacho_cargo_id_fkey FOREIGN KEY (cargo_id) REFERENCES sigd_org.cargo(cargo_id) ON DELETE RESTRICT;


--
-- Name: facultad_despacho facultad_despacho_usuario_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.facultad_despacho
    ADD CONSTRAINT facultad_despacho_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: rol_permiso rol_permiso_permiso_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.rol_permiso
    ADD CONSTRAINT rol_permiso_permiso_id_fkey FOREIGN KEY (permiso_id) REFERENCES sigd_org.permiso_sistema(permiso_id) ON DELETE CASCADE;


--
-- Name: rol_permiso rol_permiso_rol_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.rol_permiso
    ADD CONSTRAINT rol_permiso_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES sigd_org.rol_sistema(rol_id) ON DELETE CASCADE;


--
-- Name: usuario_rol usuario_rol_area_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.usuario_rol
    ADD CONSTRAINT usuario_rol_area_id_fkey FOREIGN KEY (area_id) REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT;


--
-- Name: usuario_rol usuario_rol_id_usuario_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.usuario_rol
    ADD CONSTRAINT usuario_rol_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: usuario_rol usuario_rol_rol_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: -
--

ALTER TABLE ONLY sigd_org.usuario_rol
    ADD CONSTRAINT usuario_rol_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES sigd_org.rol_sistema(rol_id) ON DELETE RESTRICT;


--
-- Name: estado_actual_expediente estado_actual_expediente_estado_nuevo_fkey; Type: FK CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.estado_actual_expediente
    ADD CONSTRAINT estado_actual_expediente_estado_nuevo_fkey FOREIGN KEY (estado_nuevo) REFERENCES sigd_rut.estado_tramite(codigo);


--
-- Name: movimiento_compensatorio fk_compensacion_movimiento_objetivo; Type: FK CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_compensatorio
    ADD CONSTRAINT fk_compensacion_movimiento_objetivo FOREIGN KEY (movimiento_objetivo_fecha_hora, movimiento_objetivo_id) REFERENCES sigd_rut.movimiento_tramite(fecha_hora, id_movimiento);


--
-- Name: movimiento_tramite fk_movimiento_estado_anterior; Type: FK CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE sigd_rut.movimiento_tramite
    ADD CONSTRAINT fk_movimiento_estado_anterior FOREIGN KEY (estado_anterior) REFERENCES sigd_rut.estado_tramite(codigo);


--
-- Name: movimiento_tramite fk_movimiento_estado_nuevo; Type: FK CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE sigd_rut.movimiento_tramite
    ADD CONSTRAINT fk_movimiento_estado_nuevo FOREIGN KEY (estado_nuevo) REFERENCES sigd_rut.estado_tramite(codigo);


--
-- Name: movimiento_tramite fk_movimiento_evento; Type: FK CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE sigd_rut.movimiento_tramite
    ADD CONSTRAINT fk_movimiento_evento FOREIGN KEY (evento) REFERENCES sigd_rut.accion_tramite(codigo);


--
-- Name: movimiento_tramite fk_movimiento_transicion; Type: FK CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE sigd_rut.movimiento_tramite
    ADD CONSTRAINT fk_movimiento_transicion FOREIGN KEY (estado_anterior, evento, estado_nuevo) REFERENCES sigd_rut.transicion_estado_tramite(estado_anterior, evento, estado_nuevo);


--
-- Name: movimiento_compensatorio movimiento_compensatorio_estado_anterior_fkey; Type: FK CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_compensatorio
    ADD CONSTRAINT movimiento_compensatorio_estado_anterior_fkey FOREIGN KEY (estado_anterior) REFERENCES sigd_rut.estado_tramite(codigo);


--
-- Name: movimiento_compensatorio movimiento_compensatorio_estado_nuevo_fkey; Type: FK CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_compensatorio
    ADD CONSTRAINT movimiento_compensatorio_estado_nuevo_fkey FOREIGN KEY (estado_nuevo) REFERENCES sigd_rut.estado_tramite(codigo);


--
-- Name: movimiento_compensatorio movimiento_compensatorio_evento_fkey; Type: FK CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.movimiento_compensatorio
    ADD CONSTRAINT movimiento_compensatorio_evento_fkey FOREIGN KEY (evento) REFERENCES sigd_rut.accion_compensatoria(codigo);


--
-- Name: solicitud_compensacion_folios solicitud_compensacion_folios_movimiento_compensatorio_id_fkey; Type: FK CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.solicitud_compensacion_folios
    ADD CONSTRAINT solicitud_compensacion_folios_movimiento_compensatorio_id_fkey FOREIGN KEY (movimiento_compensatorio_id) REFERENCES sigd_rut.movimiento_compensatorio(id_movimiento);


--
-- Name: transicion_estado_tramite transicion_estado_tramite_estado_anterior_fkey; Type: FK CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.transicion_estado_tramite
    ADD CONSTRAINT transicion_estado_tramite_estado_anterior_fkey FOREIGN KEY (estado_anterior) REFERENCES sigd_rut.estado_tramite(codigo);


--
-- Name: transicion_estado_tramite transicion_estado_tramite_estado_nuevo_fkey; Type: FK CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.transicion_estado_tramite
    ADD CONSTRAINT transicion_estado_tramite_estado_nuevo_fkey FOREIGN KEY (estado_nuevo) REFERENCES sigd_rut.estado_tramite(codigo);


--
-- Name: transicion_estado_tramite transicion_estado_tramite_evento_fkey; Type: FK CONSTRAINT; Schema: sigd_rut; Owner: -
--

ALTER TABLE ONLY sigd_rut.transicion_estado_tramite
    ADD CONSTRAINT transicion_estado_tramite_evento_fkey FOREIGN KEY (evento) REFERENCES sigd_rut.accion_tramite(codigo);


--
-- Name: asiento_registro asiento_registro_expediente_id_fkey; Type: FK CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.asiento_registro
    ADD CONSTRAINT asiento_registro_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT;


--
-- Name: cargo_digital cargo_digital_expediente_id_fkey; Type: FK CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.cargo_digital
    ADD CONSTRAINT cargo_digital_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES sigd_tra.expediente(expediente_id);


--
-- Name: expediente_acumulacion expediente_acumulacion_expediente_accesorio_fkey; Type: FK CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.expediente_acumulacion
    ADD CONSTRAINT expediente_acumulacion_expediente_accesorio_fkey FOREIGN KEY (expediente_accesorio) REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT;


--
-- Name: expediente_acumulacion expediente_acumulacion_expediente_principal_fkey; Type: FK CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.expediente_acumulacion
    ADD CONSTRAINT expediente_acumulacion_expediente_principal_fkey FOREIGN KEY (expediente_principal) REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT;


--
-- Name: expediente expediente_area_destino_id_fkey; Type: FK CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.expediente
    ADD CONSTRAINT expediente_area_destino_id_fkey FOREIGN KEY (area_destino_id) REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT;


--
-- Name: expediente_documento_folio expediente_documento_folio_expediente_id_fkey; Type: FK CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.expediente_documento_folio
    ADD CONSTRAINT expediente_documento_folio_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT;


--
-- Name: expediente expediente_solicitante_id_fkey; Type: FK CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.expediente
    ADD CONSTRAINT expediente_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT;


--
-- Name: expediente expediente_tipo_tramite_id_fkey; Type: FK CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.expediente
    ADD CONSTRAINT expediente_tipo_tramite_id_fkey FOREIGN KEY (tipo_tramite_id) REFERENCES sigd_doc.tipo_tramite_tupa(tipo_tramite_id);


--
-- Name: tramite tramite_expediente_id_fkey; Type: FK CONSTRAINT; Schema: sigd_tra; Owner: -
--

ALTER TABLE ONLY sigd_tra.tramite
    ADD CONSTRAINT tramite_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict gSwFUjMgnvDVcS3QVQofzepmoJjrG6kIwgBIeVJ8FZAkCZ5BDYQ48cu53M9i3Tn
