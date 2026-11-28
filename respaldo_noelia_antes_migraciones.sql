--
-- PostgreSQL database dump
--

\restrict y2gG6kOjCfWqWjBNVaCRSdnMcxX8XeHe83GI4240Lj9Iz4Qwrr9oNn1NmSiKZHD

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
-- Name: sigd_audit; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA sigd_audit;


ALTER SCHEMA sigd_audit OWNER TO postgres;

--
-- Name: sigd_auth; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA sigd_auth;


ALTER SCHEMA sigd_auth OWNER TO postgres;

--
-- Name: sigd_doc; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA sigd_doc;


ALTER SCHEMA sigd_doc OWNER TO postgres;

--
-- Name: sigd_org; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA sigd_org;


ALTER SCHEMA sigd_org OWNER TO postgres;

--
-- Name: sigd_tra; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA sigd_tra;


ALTER SCHEMA sigd_tra OWNER TO postgres;

--
-- Name: sigd_tupa; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA sigd_tupa;


ALTER SCHEMA sigd_tupa OWNER TO postgres;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: ltree; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public;


--
-- Name: EXTENSION ltree; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION ltree IS 'data type for hierarchical tree-like structures';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: fn_rechazar_mutacion_bitacora(); Type: FUNCTION; Schema: sigd_audit; Owner: postgres
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


ALTER FUNCTION sigd_audit.fn_rechazar_mutacion_bitacora() OWNER TO postgres;

--
-- Name: fn_proteger_formulario_version(); Type: FUNCTION; Schema: sigd_doc; Owner: postgres
--

CREATE FUNCTION sigd_doc.fn_proteger_formulario_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'sigd_doc.formulario_version es inmutable: % rechazado sobre la versi??n %',
        TG_OP, OLD.version
        USING ERRCODE = '23001',
              HINT = 'Cree una nueva versi??n del formulario en lugar de alterar una publicada.';
END;
$$;


ALTER FUNCTION sigd_doc.fn_proteger_formulario_version() OWNER TO postgres;

--
-- Name: fn_area_set_path(); Type: FUNCTION; Schema: sigd_org; Owner: postgres
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
            RAISE EXCEPTION 'El ??rea padre % no existe o no tiene ruta calculada', NEW.area_padre_id
                USING ERRCODE = '23503';
        END IF;

        v_path := v_path || text2ltree('a.' || replace(NEW.codigo, '.', '_'));
    END IF;

    NEW.path := v_path;
    NEW.nivel := v_nivel;
    RETURN NEW;
END;
$$;


ALTER FUNCTION sigd_org.fn_area_set_path() OWNER TO postgres;

--
-- Name: acumular_expediente(uuid, uuid, text); Type: FUNCTION; Schema: sigd_tra; Owner: postgres
--

CREATE FUNCTION sigd_tra.acumular_expediente(p_expediente_principal uuid, p_expediente_accesorio uuid, p_acto_resolutivo text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id_acumulacion UUID;
BEGIN
    IF p_expediente_principal = p_expediente_accesorio THEN
        RAISE EXCEPTION 'Un expediente no puede acumularse a s?? mismo: %', p_expediente_principal
            USING ERRCODE = '22023';
    END IF;
    IF p_acto_resolutivo IS NULL OR btrim(p_acto_resolutivo) = '' THEN
        RAISE EXCEPTION 'La acumulaci??n exige un acto resolutivo justificado'
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

    -- Validar que el accesorio no est?? ya acumulado
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


ALTER FUNCTION sigd_tra.acumular_expediente(p_expediente_principal uuid, p_expediente_accesorio uuid, p_acto_resolutivo text) OWNER TO postgres;

--
-- Name: FUNCTION acumular_expediente(p_expediente_principal uuid, p_expediente_accesorio uuid, p_acto_resolutivo text); Type: COMMENT; Schema: sigd_tra; Owner: postgres
--

COMMENT ON FUNCTION sigd_tra.acumular_expediente(p_expediente_principal uuid, p_expediente_accesorio uuid, p_acto_resolutivo text) IS 'Acumula expedientes conexos bajo el Art. 160 del TUO de la Ley N?? 27444 con control ac??clico.';


--
-- Name: agregar_folio_expediente(uuid, uuid, integer, uuid); Type: FUNCTION; Schema: sigd_tra; Owner: postgres
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

    SELECT COALESCE(MAX(folio_fin), 0) + 1
      INTO v_inicio
      FROM sigd_tra.expediente_documento_folio
     WHERE expediente_id = p_id_expediente;

    INSERT INTO sigd_tra.expediente_documento_folio
        (expediente_id, id_documento, folio_inicio, folio_fin, asignado_por)
    VALUES
        (p_id_expediente, p_id_documento, v_inicio, v_inicio + p_cantidad - 1, p_usuario_id);

    RETURN QUERY SELECT v_inicio, v_inicio + p_cantidad - 1;
END;
$$;


ALTER FUNCTION sigd_tra.agregar_folio_expediente(p_id_expediente uuid, p_id_documento uuid, p_cantidad integer, p_usuario_id uuid) OWNER TO postgres;

--
-- Name: fn_generar_cut(integer); Type: FUNCTION; Schema: sigd_tra; Owner: postgres
--

CREATE FUNCTION sigd_tra.fn_generar_cut(p_anio integer) RETURNS character varying
    LANGUAGE sql STRICT
    AS $$
    SELECT sigd_tra.generar_cut_expediente(p_anio);
$$;


ALTER FUNCTION sigd_tra.fn_generar_cut(p_anio integer) OWNER TO postgres;

--
-- Name: FUNCTION fn_generar_cut(p_anio integer); Type: COMMENT; Schema: sigd_tra; Owner: postgres
--

COMMENT ON FUNCTION sigd_tra.fn_generar_cut(p_anio integer) IS 'Alias can??nico de compatibilidad para sigd_tra.generar_cut_expediente(INT).';


--
-- Name: fn_rechazar_mutacion_asiento(); Type: FUNCTION; Schema: sigd_tra; Owner: postgres
--

CREATE FUNCTION sigd_tra.fn_rechazar_mutacion_asiento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'El Libro General no admite eliminaci??n f??sica (TUO Ley 27444, Arts. 153-156)'
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


ALTER FUNCTION sigd_tra.fn_rechazar_mutacion_asiento() OWNER TO postgres;

--
-- Name: fn_rechazar_mutacion_folio(); Type: FUNCTION; Schema: sigd_tra; Owner: postgres
--

CREATE FUNCTION sigd_tra.fn_rechazar_mutacion_folio() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'La foliaci??n es inmutable (Directiva AGN): % rechazado sobre %',
        TG_OP, OLD.id_folio
        USING ERRCODE = '23001',
              HINT = 'Los folios emitidos no se corrigen; registre un nuevo documento.';
END;
$$;


ALTER FUNCTION sigd_tra.fn_rechazar_mutacion_folio() OWNER TO postgres;

--
-- Name: fn_tra_expediente_asignar_cut(); Type: FUNCTION; Schema: sigd_tra; Owner: postgres
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


ALTER FUNCTION sigd_tra.fn_tra_expediente_asignar_cut() OWNER TO postgres;

--
-- Name: fn_verificar_continuidad_folio(); Type: FUNCTION; Schema: sigd_tra; Owner: postgres
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
        RAISE EXCEPTION 'Foliaci??n no continua en expediente %: el folio % debe comenzar en %',
            NEW.expediente_id, NEW.folio_inicio, v_esperado
            USING ERRCODE = '23514',
                  HINT = 'Use sigd_tra.agregar_folio_expediente() para asignar folios correlativos.';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION sigd_tra.fn_verificar_continuidad_folio() OWNER TO postgres;

--
-- Name: generar_cut_expediente(integer); Type: FUNCTION; Schema: sigd_tra; Owner: postgres
--

CREATE FUNCTION sigd_tra.generar_cut_expediente(p_anio integer) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_correlativo BIGINT;
    v_cut         VARCHAR(20);
BEGIN
    IF p_anio IS NULL OR p_anio <= 0 THEN
        RAISE EXCEPTION 'A??o fiscal inv??lido: %', p_anio
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


ALTER FUNCTION sigd_tra.generar_cut_expediente(p_anio integer) OWNER TO postgres;

--
-- Name: FUNCTION generar_cut_expediente(p_anio integer); Type: COMMENT; Schema: sigd_tra; Owner: postgres
--

COMMENT ON FUNCTION sigd_tra.generar_cut_expediente(p_anio integer) IS 'Genera el C??digo ??nico de Tr??mite con m??scara EXP-YYYY-XXXXXX bajo bloqueo pesimista de fila (cero colisiones).';


--
-- Name: refrescar_vistas_mgd(); Type: FUNCTION; Schema: sigd_tra; Owner: postgres
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


ALTER FUNCTION sigd_tra.refrescar_vistas_mgd() OWNER TO postgres;

--
-- Name: FUNCTION refrescar_vistas_mgd(); Type: COMMENT; Schema: sigd_tra; Owner: postgres
--

COMMENT ON FUNCTION sigd_tra.refrescar_vistas_mgd() IS 'Refresco concurrente de las vistas MGD sin bloquear lecturas (#51). El endpoint administrativo la invoca sobre su propia conexi??n, fuera de la transacci??n de negocio.';


--
-- Name: fn_bitacora_inmutable(); Type: FUNCTION; Schema: sigd_tupa; Owner: postgres
--

CREATE FUNCTION sigd_tupa.fn_bitacora_inmutable() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
    RAISE EXCEPTION 'La bit??cora del TUPA es inmutable: % rechazado', TG_OP
        USING ERRCODE = '23001';
END;
$$;


ALTER FUNCTION sigd_tupa.fn_bitacora_inmutable() OWNER TO postgres;

--
-- Name: fn_bitacora_version(); Type: FUNCTION; Schema: sigd_tupa; Owner: postgres
--

CREATE FUNCTION sigd_tupa.fn_bitacora_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'sigd_tupa'
    AS $_$
DECLARE
    v_crudo   TEXT;
    v_usuario UUID;
BEGIN
    v_crudo := current_setting('sigd_tupa.usuario_id', true);
    IF v_crudo ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_usuario := v_crudo::uuid;
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO sigd_tupa.bitacora (version_id, accion, estado_anterior, estado_nuevo, usuario_id, detalle)
        VALUES (NEW.version_id, 'CREADA', NULL, NEW.estado, v_usuario,
                jsonb_build_object('codigo', NEW.codigo, 'nombre', NEW.nombre));
    ELSIF NEW.estado <> OLD.estado THEN
        INSERT INTO sigd_tupa.bitacora (version_id, accion, estado_anterior, estado_nuevo, usuario_id, detalle)
        VALUES (NEW.version_id,
                CASE NEW.estado WHEN 'VIGENTE' THEN 'PUBLICADA' ELSE 'SUPERSEDIDA' END,
                OLD.estado, NEW.estado, v_usuario,
                jsonb_build_object('codigo', NEW.codigo));
    END IF;
    RETURN NULL;
END;
$_$;


ALTER FUNCTION sigd_tupa.fn_bitacora_version() OWNER TO postgres;

--
-- Name: fn_proteger_tramite_requisito(); Type: FUNCTION; Schema: sigd_tupa; Owner: postgres
--

CREATE FUNCTION sigd_tupa.fn_proteger_tramite_requisito() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'sigd_tupa'
    AS $$
DECLARE
    v_tramite UUID;
    v_estado  VARCHAR(20);
BEGIN
    v_tramite := CASE WHEN TG_OP = 'DELETE' THEN OLD.tramite_version_id ELSE NEW.tramite_version_id END;
    SELECT v.estado INTO v_estado
      FROM sigd_tupa.tramite_version t
      JOIN sigd_tupa.version v ON v.version_id = t.version_id
     WHERE t.tramite_version_id = v_tramite;
    IF v_estado IS DISTINCT FROM 'BORRADOR' THEN
        RAISE EXCEPTION 'Los requisitos de una versi??n % del TUPA no se pueden % (solo en BORRADOR)',
            COALESCE(v_estado, 'inexistente'), TG_OP USING ERRCODE = '23001';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.tramite_version_id <> OLD.tramite_version_id THEN
        RAISE EXCEPTION 'Un requisito no puede cambiar de tr??mite' USING ERRCODE = '23001';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;


ALTER FUNCTION sigd_tupa.fn_proteger_tramite_requisito() OWNER TO postgres;

--
-- Name: fn_proteger_tramite_version(); Type: FUNCTION; Schema: sigd_tupa; Owner: postgres
--

CREATE FUNCTION sigd_tupa.fn_proteger_tramite_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'sigd_tupa'
    AS $$
DECLARE
    v_version UUID;
    v_estado  VARCHAR(20);
BEGIN
    v_version := CASE WHEN TG_OP = 'DELETE' THEN OLD.version_id ELSE NEW.version_id END;
    SELECT estado INTO v_estado FROM sigd_tupa.version WHERE version_id = v_version;
    IF v_estado IS DISTINCT FROM 'BORRADOR' THEN
        RAISE EXCEPTION 'Los tr??mites de una versi??n % del TUPA no se pueden % (solo en BORRADOR)',
            COALESCE(v_estado, 'inexistente'), TG_OP USING ERRCODE = '23001';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.version_id <> OLD.version_id THEN
        RAISE EXCEPTION 'Un tr??mite no puede cambiar de versi??n' USING ERRCODE = '23001';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;


ALTER FUNCTION sigd_tupa.fn_proteger_tramite_version() OWNER TO postgres;

--
-- Name: fn_proteger_version(); Type: FUNCTION; Schema: sigd_tupa; Owner: postgres
--

CREATE FUNCTION sigd_tupa.fn_proteger_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'sigd_tupa'
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.estado <> 'BORRADOR' THEN
            RAISE EXCEPTION 'Una versi??n del TUPA nace como BORRADOR (recibido: %)', NEW.estado
                USING ERRCODE = '23001';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.estado <> 'BORRADOR' THEN
            RAISE EXCEPTION 'La versi??n % del TUPA est?? % y no se puede eliminar; solo los borradores',
                OLD.codigo, OLD.estado USING ERRCODE = '23001';
        END IF;
        RETURN OLD;
    END IF;

    -- UPDATE
    IF OLD.estado = 'BORRADOR' THEN
        IF NEW.estado = 'SUPERSEDIDA' THEN
            RAISE EXCEPTION 'La versi??n % debe publicarse antes de quedar supersedida', OLD.codigo
                USING ERRCODE = '23001';
        END IF;
        RETURN NEW;
    END IF;

    IF OLD.estado = 'VIGENTE' THEN
        IF NEW.estado <> 'SUPERSEDIDA' THEN
            RAISE EXCEPTION 'La versi??n % est?? VIGENTE y solo puede pasar a SUPERSEDIDA', OLD.codigo
                USING ERRCODE = '23001';
        END IF;
        IF ROW(NEW.version_id, NEW.codigo, NEW.nombre, NEW.fecha_vigencia, NEW.uit_vigente,
               NEW.resolucion_numero, NEW.resolucion_fecha, NEW.resolucion_pdf_ref,
               NEW.resolucion_pdf_sha256, NEW.version_anterior_id, NEW.creado_en)
           IS DISTINCT FROM
           ROW(OLD.version_id, OLD.codigo, OLD.nombre, OLD.fecha_vigencia, OLD.uit_vigente,
               OLD.resolucion_numero, OLD.resolucion_fecha, OLD.resolucion_pdf_ref,
               OLD.resolucion_pdf_sha256, OLD.version_anterior_id, OLD.creado_en) THEN
            RAISE EXCEPTION 'La versi??n % ya fue publicada: solo se permite cambiar su estado', OLD.codigo
                USING ERRCODE = '23001';
        END IF;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'La versi??n % est?? SUPERSEDIDA y es inmutable', OLD.codigo
        USING ERRCODE = '23001';
END;
$$;


ALTER FUNCTION sigd_tupa.fn_proteger_version() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bitacora_auditoria; Type: TABLE; Schema: sigd_audit; Owner: postgres
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


ALTER TABLE sigd_audit.bitacora_auditoria OWNER TO postgres;

--
-- Name: TABLE bitacora_auditoria; Type: COMMENT; Schema: sigd_audit; Owner: postgres
--

COMMENT ON TABLE sigd_audit.bitacora_auditoria IS 'Bit??cora forense inmutable (append-only). Solo INSERT y SELECT para la cuenta de aplicaci??n.';


--
-- Name: COLUMN bitacora_auditoria.correlation_id; Type: COMMENT; Schema: sigd_audit; Owner: postgres
--

COMMENT ON COLUMN sigd_audit.bitacora_auditoria.correlation_id IS 'UUIDv4 de la solicitud. SIN valor por defecto: debe propagarse SIEMPRE desde el contexto AsyncLocalStorage; la BD no genera un UUID distinto.';


--
-- Name: COLUMN bitacora_auditoria.datos_antes; Type: COMMENT; Schema: sigd_audit; Owner: postgres
--

COMMENT ON COLUMN sigd_audit.bitacora_auditoria.datos_antes IS 'Estado previo de la fila (NULL para INSERT).';


--
-- Name: COLUMN bitacora_auditoria.datos_despues; Type: COMMENT; Schema: sigd_audit; Owner: postgres
--

COMMENT ON COLUMN sigd_audit.bitacora_auditoria.datos_despues IS 'Estado posterior de la fila (para DELETE puede ser el estado previo a la eliminaci??n).';


--
-- Name: evento_outbox; Type: TABLE; Schema: sigd_audit; Owner: postgres
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


ALTER TABLE sigd_audit.evento_outbox OWNER TO postgres;

--
-- Name: TABLE evento_outbox; Type: COMMENT; Schema: sigd_audit; Owner: postgres
--

COMMENT ON TABLE sigd_audit.evento_outbox IS 'Transactional Outbox: eventos persistidos at??micamente con la mutaci??n de negocio y despachados por el worker.';


--
-- Name: COLUMN evento_outbox.estado; Type: COMMENT; Schema: sigd_audit; Owner: postgres
--

COMMENT ON COLUMN sigd_audit.evento_outbox.estado IS 'PENDIENTE -> PROCESADO (??xito) o FALLIDO (dead-letter tras agotar reintentos). Solo el worker modifica este campo.';


--
-- Name: auditoria_usuarios; Type: TABLE; Schema: sigd_auth; Owner: postgres
--

CREATE TABLE sigd_auth.auditoria_usuarios (
    id_auditoria uuid DEFAULT gen_random_uuid() NOT NULL,
    correlation_id uuid NOT NULL,
    id_usuario uuid,
    operacion character varying(64) NOT NULL,
    detalle jsonb,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE sigd_auth.auditoria_usuarios OWNER TO postgres;

--
-- Name: consentimiento_datos; Type: TABLE; Schema: sigd_auth; Owner: postgres
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


ALTER TABLE sigd_auth.consentimiento_datos OWNER TO postgres;

--
-- Name: cuenta_usuario; Type: TABLE; Schema: sigd_auth; Owner: postgres
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
    CONSTRAINT chk_cuenta_usuario_algoritmo CHECK (((password_hash)::text ~~ '$argon2id$%'::text))
);


ALTER TABLE sigd_auth.cuenta_usuario OWNER TO postgres;

--
-- Name: notificacion_casilla; Type: TABLE; Schema: sigd_auth; Owner: postgres
--

CREATE TABLE sigd_auth.notificacion_casilla (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid,
    correo_destinatario character varying(160),
    cut character varying(20),
    asunto character varying(255) NOT NULL,
    tipo_acto character varying(100) DEFAULT 'Notificaci??n de Acto Administrativo'::character varying NOT NULL,
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


ALTER TABLE sigd_auth.notificacion_casilla OWNER TO postgres;

--
-- Name: perfil_usuario; Type: TABLE; Schema: sigd_auth; Owner: postgres
--

CREATE TABLE sigd_auth.perfil_usuario (
    id_usuario uuid NOT NULL,
    cargo_id uuid,
    area_id uuid,
    telefono character varying(20),
    firma_electronica_habilitada boolean DEFAULT false NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE sigd_auth.perfil_usuario OWNER TO postgres;

--
-- Name: persona; Type: TABLE; Schema: sigd_auth; Owner: postgres
--

CREATE TABLE sigd_auth.persona (
    id_persona uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo character varying(20) NOT NULL,
    id_documento character varying(20) NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_persona_tipo CHECK (((tipo)::text = ANY ((ARRAY['NATURAL'::character varying, 'JURIDICA'::character varying])::text[])))
);


ALTER TABLE sigd_auth.persona OWNER TO postgres;

--
-- Name: persona_documento_historial; Type: TABLE; Schema: sigd_auth; Owner: postgres
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


ALTER TABLE sigd_auth.persona_documento_historial OWNER TO postgres;

--
-- Name: persona_juridica; Type: TABLE; Schema: sigd_auth; Owner: postgres
--

CREATE TABLE sigd_auth.persona_juridica (
    id_persona uuid NOT NULL,
    razon_social character varying(255) NOT NULL,
    nombre_comercial character varying(255),
    representante_legal character varying(255),
    direccion character varying(255)
);


ALTER TABLE sigd_auth.persona_juridica OWNER TO postgres;

--
-- Name: persona_natural; Type: TABLE; Schema: sigd_auth; Owner: postgres
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


ALTER TABLE sigd_auth.persona_natural OWNER TO postgres;

--
-- Name: representacion_legal; Type: TABLE; Schema: sigd_auth; Owner: postgres
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


ALTER TABLE sigd_auth.representacion_legal OWNER TO postgres;

--
-- Name: sesion_usuario; Type: TABLE; Schema: sigd_auth; Owner: postgres
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


ALTER TABLE sigd_auth.sesion_usuario OWNER TO postgres;

--
-- Name: tipos_documento; Type: TABLE; Schema: sigd_auth; Owner: postgres
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


ALTER TABLE sigd_auth.tipos_documento OWNER TO postgres;

--
-- Name: tipos_documento_id_tipo_documento_seq; Type: SEQUENCE; Schema: sigd_auth; Owner: postgres
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
-- Name: documento_adjunto; Type: TABLE; Schema: sigd_doc; Owner: postgres
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


ALTER TABLE sigd_doc.documento_adjunto OWNER TO postgres;

--
-- Name: COLUMN documento_adjunto.sha256; Type: COMMENT; Schema: sigd_doc; Owner: postgres
--

COMMENT ON COLUMN sigd_doc.documento_adjunto.sha256 IS 'SHA-256 del binario. La restricci??n de unicidad por bucket habilita la deduplicaci??n de objetos id??nticos.';


--
-- Name: COLUMN documento_adjunto.magic_bytes; Type: COMMENT; Schema: sigd_doc; Owner: postgres
--

COMMENT ON COLUMN sigd_doc.documento_adjunto.magic_bytes IS 'Prefijo hexadecimal de los Magic Bytes (PDF = 25504446) verificados en la carga presignada.';


--
-- Name: expediente; Type: TABLE; Schema: sigd_doc; Owner: postgres
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


ALTER TABLE sigd_doc.expediente OWNER TO postgres;

--
-- Name: expediente_formulario_respuesta; Type: TABLE; Schema: sigd_doc; Owner: postgres
--

CREATE TABLE sigd_doc.expediente_formulario_respuesta (
    id_respuesta uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    formulario_version_id uuid NOT NULL,
    datos jsonb NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE sigd_doc.expediente_formulario_respuesta OWNER TO postgres;

--
-- Name: expediente_requisito; Type: TABLE; Schema: sigd_doc; Owner: postgres
--

CREATE TABLE sigd_doc.expediente_requisito (
    id_expediente_requisito uuid DEFAULT gen_random_uuid() NOT NULL,
    expediente_id uuid NOT NULL,
    requisito_id uuid NOT NULL,
    cumplido boolean DEFAULT false NOT NULL,
    documento_adjunto_id uuid,
    verificado_en timestamp with time zone
);


ALTER TABLE sigd_doc.expediente_requisito OWNER TO postgres;

--
-- Name: firma_digital_documento; Type: TABLE; Schema: sigd_doc; Owner: postgres
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


ALTER TABLE sigd_doc.firma_digital_documento OWNER TO postgres;

--
-- Name: formulario_version; Type: TABLE; Schema: sigd_doc; Owner: postgres
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


ALTER TABLE sigd_doc.formulario_version OWNER TO postgres;

--
-- Name: requisito; Type: TABLE; Schema: sigd_doc; Owner: postgres
--

CREATE TABLE sigd_doc.requisito (
    requisito_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo_tramite_id uuid NOT NULL,
    codigo character varying(30) NOT NULL,
    denominacion character varying(300) NOT NULL,
    obligatorio boolean DEFAULT true NOT NULL,
    orden smallint DEFAULT 0 NOT NULL
);


ALTER TABLE sigd_doc.requisito OWNER TO postgres;

--
-- Name: resolucion; Type: TABLE; Schema: sigd_doc; Owner: postgres
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


ALTER TABLE sigd_doc.resolucion OWNER TO postgres;

--
-- Name: tipo_documento; Type: TABLE; Schema: sigd_doc; Owner: postgres
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


ALTER TABLE sigd_doc.tipo_documento OWNER TO postgres;

--
-- Name: tipo_documento_requisito; Type: TABLE; Schema: sigd_doc; Owner: postgres
--

CREATE TABLE sigd_doc.tipo_documento_requisito (
    id_relacion uuid DEFAULT gen_random_uuid() NOT NULL,
    requisito_id uuid NOT NULL,
    tipo_documental_id uuid NOT NULL,
    condicion_json_pointer character varying(200)
);


ALTER TABLE sigd_doc.tipo_documento_requisito OWNER TO postgres;

--
-- Name: tipo_tramite_tupa; Type: TABLE; Schema: sigd_doc; Owner: postgres
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


ALTER TABLE sigd_doc.tipo_tramite_tupa OWNER TO postgres;

--
-- Name: COLUMN tipo_tramite_tupa.plazo_dias; Type: COMMENT; Schema: sigd_doc; Owner: postgres
--

COMMENT ON COLUMN sigd_doc.tipo_tramite_tupa.plazo_dias IS 'Plazo m??ximo legal supletorio de 30 d??as h??biles (TUO Ley N?? 27444, Art. 143).';


--
-- Name: area; Type: TABLE; Schema: sigd_org; Owner: postgres
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


ALTER TABLE sigd_org.area OWNER TO postgres;

--
-- Name: COLUMN area.path; Type: COMMENT; Schema: sigd_org; Owner: postgres
--

COMMENT ON COLUMN sigd_org.area.path IS 'Ruta jer??rquica calculada autom??ticamente por sigd_org.fn_area_set_path() a partir de area_padre_id.';


--
-- Name: asignacion_personal; Type: TABLE; Schema: sigd_org; Owner: postgres
--

CREATE TABLE sigd_org.asignacion_personal (
    id_asignacion uuid DEFAULT gen_random_uuid() NOT NULL,
    id_usuario uuid NOT NULL,
    cargo_id uuid NOT NULL,
    area_id uuid NOT NULL,
    vigente_desde timestamp with time zone DEFAULT now() NOT NULL,
    vigente_hasta timestamp with time zone
);


ALTER TABLE sigd_org.asignacion_personal OWNER TO postgres;

--
-- Name: calendario_laboral; Type: TABLE; Schema: sigd_org; Owner: postgres
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


ALTER TABLE sigd_org.calendario_laboral OWNER TO postgres;

--
-- Name: cargo; Type: TABLE; Schema: sigd_org; Owner: postgres
--

CREATE TABLE sigd_org.cargo (
    cargo_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(160) NOT NULL,
    descripcion text,
    vigente boolean DEFAULT true NOT NULL
);


ALTER TABLE sigd_org.cargo OWNER TO postgres;

--
-- Name: encargatura_despacho; Type: TABLE; Schema: sigd_org; Owner: postgres
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


ALTER TABLE sigd_org.encargatura_despacho OWNER TO postgres;

--
-- Name: facultad_despacho; Type: TABLE; Schema: sigd_org; Owner: postgres
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


ALTER TABLE sigd_org.facultad_despacho OWNER TO postgres;

--
-- Name: permiso_sistema; Type: TABLE; Schema: sigd_org; Owner: postgres
--

CREATE TABLE sigd_org.permiso_sistema (
    permiso_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(60) NOT NULL,
    nombre character varying(160) NOT NULL,
    ambito character varying(10) DEFAULT 'GLOBAL'::character varying NOT NULL,
    CONSTRAINT chk_permiso_ambito CHECK (((ambito)::text = ANY ((ARRAY['AREA'::character varying, 'GLOBAL'::character varying])::text[])))
);


ALTER TABLE sigd_org.permiso_sistema OWNER TO postgres;

--
-- Name: rol_permiso; Type: TABLE; Schema: sigd_org; Owner: postgres
--

CREATE TABLE sigd_org.rol_permiso (
    rol_id uuid NOT NULL,
    permiso_id uuid NOT NULL
);


ALTER TABLE sigd_org.rol_permiso OWNER TO postgres;

--
-- Name: rol_sistema; Type: TABLE; Schema: sigd_org; Owner: postgres
--

CREATE TABLE sigd_org.rol_sistema (
    rol_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(120) NOT NULL,
    descripcion text,
    vigente boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_rol_codigo CHECK (((codigo)::text = ANY ((ARRAY['ADMINISTRADOR'::character varying, 'DIRECTOR'::character varying, 'SECRETARIO'::character varying, 'ESPECIALISTA'::character varying, 'MESA_PARTES'::character varying, 'CIUDADANO'::character varying])::text[])))
);


ALTER TABLE sigd_org.rol_sistema OWNER TO postgres;

--
-- Name: usuario_rol; Type: TABLE; Schema: sigd_org; Owner: postgres
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


ALTER TABLE sigd_org.usuario_rol OWNER TO postgres;

--
-- Name: seq_asiento_numero_registro; Type: SEQUENCE; Schema: sigd_tra; Owner: postgres
--

CREATE SEQUENCE sigd_tra.seq_asiento_numero_registro
    START WITH 10001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE sigd_tra.seq_asiento_numero_registro OWNER TO postgres;

--
-- Name: asiento_registro; Type: TABLE; Schema: sigd_tra; Owner: postgres
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


ALTER TABLE sigd_tra.asiento_registro OWNER TO postgres;

--
-- Name: expediente; Type: TABLE; Schema: sigd_tra; Owner: postgres
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
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_tra_expediente_cut CHECK (((codigo_expediente)::text ~ '^EXP-[0-9]{4}-[0-9]{6}$'::text)),
    CONSTRAINT chk_tra_expediente_dni CHECK (((dni_solicitante IS NULL) OR (dni_solicitante ~ '^[0-9]{8}$'::text)))
);


ALTER TABLE sigd_tra.expediente OWNER TO postgres;

--
-- Name: expediente_acumulacion; Type: TABLE; Schema: sigd_tra; Owner: postgres
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


ALTER TABLE sigd_tra.expediente_acumulacion OWNER TO postgres;

--
-- Name: expediente_documento_folio; Type: TABLE; Schema: sigd_tra; Owner: postgres
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


ALTER TABLE sigd_tra.expediente_documento_folio OWNER TO postgres;

--
-- Name: TABLE expediente_documento_folio; Type: COMMENT; Schema: sigd_tra; Owner: postgres
--

COMMENT ON TABLE sigd_tra.expediente_documento_folio IS 'Foliaci??n continua e ininterrumpida (Directiva N?? 001-2019-AGN). El folio N+1 inicia exactamente en folio_fin(N) + 1.';


--
-- Name: secuencia_anual_cut; Type: TABLE; Schema: sigd_tra; Owner: postgres
--

CREATE TABLE sigd_tra.secuencia_anual_cut (
    anio_fiscal integer NOT NULL,
    ultimo_correlativo bigint DEFAULT 0 NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_secuencia_anual_correlativo CHECK ((ultimo_correlativo >= 0))
);


ALTER TABLE sigd_tra.secuencia_anual_cut OWNER TO postgres;

--
-- Name: TABLE secuencia_anual_cut; Type: COMMENT; Schema: sigd_tra; Owner: postgres
--

COMMENT ON TABLE sigd_tra.secuencia_anual_cut IS 'Correlativo CUT por a??o fiscal. Se bloquea con SELECT ... FOR UPDATE para garantizar unicidad sin colisiones bajo concurrencia.';


--
-- Name: tramite; Type: TABLE; Schema: sigd_tra; Owner: postgres
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


ALTER TABLE sigd_tra.tramite OWNER TO postgres;

--
-- Name: bitacora; Type: TABLE; Schema: sigd_tupa; Owner: postgres
--

CREATE TABLE sigd_tupa.bitacora (
    bitacora_id bigint NOT NULL,
    version_id uuid NOT NULL,
    accion character varying(20) NOT NULL,
    estado_anterior character varying(20),
    estado_nuevo character varying(20) NOT NULL,
    usuario_id uuid,
    detalle jsonb DEFAULT '{}'::jsonb NOT NULL,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_tupa_bitacora_accion CHECK (((accion)::text = ANY ((ARRAY['CREADA'::character varying, 'PUBLICADA'::character varying, 'SUPERSEDIDA'::character varying])::text[]))),
    CONSTRAINT chk_tupa_bitacora_detalle CHECK ((jsonb_typeof(detalle) = 'object'::text))
);


ALTER TABLE sigd_tupa.bitacora OWNER TO postgres;

--
-- Name: COLUMN bitacora.usuario_id; Type: COMMENT; Schema: sigd_tupa; Owner: postgres
--

COMMENT ON COLUMN sigd_tupa.bitacora.usuario_id IS 'Se toma de la variable de sesi??n sigd_tupa.usuario_id (SET LOCAL) si es un UUID v??lido; si no, queda NULL.';


--
-- Name: bitacora_bitacora_id_seq; Type: SEQUENCE; Schema: sigd_tupa; Owner: postgres
--

ALTER TABLE sigd_tupa.bitacora ALTER COLUMN bitacora_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sigd_tupa.bitacora_bitacora_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tramite_requisito; Type: TABLE; Schema: sigd_tupa; Owner: postgres
--

CREATE TABLE sigd_tupa.tramite_requisito (
    requisito_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tramite_version_id uuid NOT NULL,
    orden smallint NOT NULL,
    texto text NOT NULL,
    CONSTRAINT chk_tupa_requisito_orden CHECK ((orden > 0))
);


ALTER TABLE sigd_tupa.tramite_requisito OWNER TO postgres;

--
-- Name: tramite_version; Type: TABLE; Schema: sigd_tupa; Owner: postgres
--

CREATE TABLE sigd_tupa.tramite_version (
    tramite_version_id uuid DEFAULT gen_random_uuid() NOT NULL,
    version_id uuid NOT NULL,
    codigo character varying(30) NOT NULL,
    denominacion character varying(300) NOT NULL,
    descripcion text,
    rubro character varying(200) NOT NULL,
    derecho_monto numeric(10,2),
    derecho_porcentaje_uit numeric(6,2),
    derecho_texto text,
    cuenta_pago character varying(60),
    plazo_texto character varying(300),
    plazo_dias_habiles smallint,
    calificacion character varying(30) NOT NULL,
    silencio_administrativo character varying(20) NOT NULL,
    unidad_recibe character varying(200),
    autoridad_resuelve character varying(200),
    recursos text,
    base_legal text,
    observaciones text,
    CONSTRAINT chk_tupa_tramite_calificacion CHECK (((calificacion)::text = ANY ((ARRAY['EVALUACION_PREVIA'::character varying, 'APROBACION_AUTOMATICA'::character varying, 'NO_APLICA'::character varying])::text[]))),
    CONSTRAINT chk_tupa_tramite_monto CHECK (((derecho_monto IS NULL) OR (derecho_monto >= (0)::numeric))),
    CONSTRAINT chk_tupa_tramite_plazo CHECK (((plazo_dias_habiles IS NULL) OR (plazo_dias_habiles > 0))),
    CONSTRAINT chk_tupa_tramite_porcentaje CHECK (((derecho_porcentaje_uit IS NULL) OR (derecho_porcentaje_uit >= (0)::numeric))),
    CONSTRAINT chk_tupa_tramite_silencio CHECK (((silencio_administrativo)::text = ANY ((ARRAY['POSITIVO'::character varying, 'NEGATIVO'::character varying, 'NO_APLICA'::character varying])::text[])))
);


ALTER TABLE sigd_tupa.tramite_version OWNER TO postgres;

--
-- Name: COLUMN tramite_version.derecho_texto; Type: COMMENT; Schema: sigd_tupa; Owner: postgres
--

COMMENT ON COLUMN sigd_tupa.tramite_version.derecho_texto IS 'Texto libre cuando el monto no es un ??nico n??mero (por ejemplo "de acuerdo al mercado").';


--
-- Name: COLUMN tramite_version.observaciones; Type: COMMENT; Schema: sigd_tupa; Owner: postgres
--

COMMENT ON COLUMN sigd_tupa.tramite_version.observaciones IS 'Marcas de transcripci??n como [REVISAR] o [VALIDAR].';


--
-- Name: version; Type: TABLE; Schema: sigd_tupa; Owner: postgres
--

CREATE TABLE sigd_tupa.version (
    version_id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(200) NOT NULL,
    fecha_vigencia date,
    uit_vigente numeric(10,2),
    resolucion_numero character varying(100),
    resolucion_fecha date,
    resolucion_pdf_ref character varying(500),
    resolucion_pdf_sha256 character(64),
    estado character varying(20) DEFAULT 'BORRADOR'::character varying NOT NULL,
    version_anterior_id uuid,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_tupa_version_estado CHECK (((estado)::text = ANY ((ARRAY['BORRADOR'::character varying, 'VIGENTE'::character varying, 'SUPERSEDIDA'::character varying])::text[]))),
    CONSTRAINT chk_tupa_version_uit CHECK (((uit_vigente IS NULL) OR (uit_vigente > (0)::numeric)))
);


ALTER TABLE sigd_tupa.version OWNER TO postgres;

--
-- Name: TABLE version; Type: COMMENT; Schema: sigd_tupa; Owner: postgres
--

COMMENT ON TABLE sigd_tupa.version IS 'Versiones del TUPA. Una versi??n publicada no se modifica: se crea otra versi??n y la anterior queda SUPERSEDIDA.';


--
-- Name: COLUMN version.resolucion_pdf_ref; Type: COMMENT; Schema: sigd_tupa; Owner: postgres
--

COMMENT ON COLUMN sigd_tupa.version.resolucion_pdf_ref IS 'Referencia (ruta u objeto S3) al PDF de la resoluci??n aprobatoria; el archivo no se guarda en la base.';


--
-- Data for Name: bitacora_auditoria; Type: TABLE DATA; Schema: sigd_audit; Owner: postgres
--

COPY sigd_audit.bitacora_auditoria (id_auditoria, correlation_id, usuario_id, ip_origen, user_agent, esquema, tabla, operacion, datos_antes, datos_despues, fecha_hora) FROM stdin;
\.


--
-- Data for Name: evento_outbox; Type: TABLE DATA; Schema: sigd_audit; Owner: postgres
--

COPY sigd_audit.evento_outbox (id_evento, correlation_id, agregado, tipo_evento, payload, estado, intentos, creado_en, procesado_en) FROM stdin;
\.


--
-- Data for Name: auditoria_usuarios; Type: TABLE DATA; Schema: sigd_auth; Owner: postgres
--

COPY sigd_auth.auditoria_usuarios (id_auditoria, correlation_id, id_usuario, operacion, detalle, fecha_hora) FROM stdin;
\.


--
-- Data for Name: consentimiento_datos; Type: TABLE DATA; Schema: sigd_auth; Owner: postgres
--

COPY sigd_auth.consentimiento_datos (id_consentimiento, id_persona, finalidade, version_politica, aceptado, fecha_aceptacion, ip_origen) FROM stdin;
\.


--
-- Data for Name: cuenta_usuario; Type: TABLE DATA; Schema: sigd_auth; Owner: postgres
--

COPY sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo, ultimo_acceso, creado_en) FROM stdin;
00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000001	74561238	74561238@casilla.iestpsuiza.edu.pe	$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA	t	\N	2026-10-22 17:06:34.796172+00
\.


--
-- Data for Name: notificacion_casilla; Type: TABLE DATA; Schema: sigd_auth; Owner: postgres
--

COPY sigd_auth.notificacion_casilla (id, usuario_id, correo_destinatario, cut, asunto, tipo_acto, numero_documento, cuerpo, referencia, estado, fecha_deposito, fecha_lectura, hash_sha256, cvd, id_acuse, acuse_hash_sha256, acuse_sellado_tiempo, documento_url, creado_en) FROM stdin;
00000000-0000-0000-0000-000000000101	00000000-0000-0000-0000-000000000001	\N	EXP-2026-000142	Notificaci?n de Resoluci?n Directoral de Matr?cula	Resoluci?n Directoral	RD N.? 0142-2026-DG-IESTP-SUIZA	\N	\N	NO_LEIDO	2026-10-22 17:06:34.799668+00	\N	e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855	CVD-2026-RD-000142-A4F2	\N	\N	\N	\N	2026-10-22 17:06:34.799668+00
\.


--
-- Data for Name: perfil_usuario; Type: TABLE DATA; Schema: sigd_auth; Owner: postgres
--

COPY sigd_auth.perfil_usuario (id_usuario, cargo_id, area_id, telefono, firma_electronica_habilitada, actualizado_en) FROM stdin;
\.


--
-- Data for Name: persona; Type: TABLE DATA; Schema: sigd_auth; Owner: postgres
--

COPY sigd_auth.persona (id_persona, tipo, id_documento, creado_en) FROM stdin;
00000000-0000-0000-0000-000000000001	NATURAL	74561238	2026-10-22 17:06:34.792874+00
52084724-0317-4195-abcf-96e448a0ad64	NATURAL	45678934	2026-10-22 20:36:34.064908+00
\.


--
-- Data for Name: persona_documento_historial; Type: TABLE DATA; Schema: sigd_auth; Owner: postgres
--

COPY sigd_auth.persona_documento_historial (id_historial, id_persona, id_documento, tipo_documento, fecha_registro, origen) FROM stdin;
\.


--
-- Data for Name: persona_juridica; Type: TABLE DATA; Schema: sigd_auth; Owner: postgres
--

COPY sigd_auth.persona_juridica (id_persona, razon_social, nombre_comercial, representante_legal, direccion) FROM stdin;
\.


--
-- Data for Name: persona_natural; Type: TABLE DATA; Schema: sigd_auth; Owner: postgres
--

COPY sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, fecha_nacimiento, sexo, correo, telefono) FROM stdin;
00000000-0000-0000-0000-000000000001	Sergio	Serruche Panduro	Sergio Serruche Panduro	\N	\N	sergio.serruche@iestpsuiza.edu.pe	\N
52084724-0317-4195-abcf-96e448a0ad64	maria	quispes	maria quispes	\N	\N	maria.mar@gmail.com	\N
\.


--
-- Data for Name: representacion_legal; Type: TABLE DATA; Schema: sigd_auth; Owner: postgres
--

COPY sigd_auth.representacion_legal (id_representacion, id_persona_juridica, id_persona_natural, cargo, vigente_desde, vigente_hasta) FROM stdin;
\.


--
-- Data for Name: sesion_usuario; Type: TABLE DATA; Schema: sigd_auth; Owner: postgres
--

COPY sigd_auth.sesion_usuario (id_sesion, id_usuario, refresh_token, fingerprint, ip_origen, user_agent, emitido_en, expira_en, revocado_en) FROM stdin;
\.


--
-- Data for Name: tipos_documento; Type: TABLE DATA; Schema: sigd_auth; Owner: postgres
--

COPY sigd_auth.tipos_documento (id_tipo_documento, codigo, descripcion, requiere_ruc, largo, vigente) FROM stdin;
\.


--
-- Data for Name: documento_adjunto; Type: TABLE DATA; Schema: sigd_doc; Owner: postgres
--

COPY sigd_doc.documento_adjunto (documento_adjunto_id, expediente_id, tipo_documental_id, nombre_archivo, s3_bucket, s3_key, sha256, tamano_bytes, mime_type, magic_bytes, subido_por, creado_en) FROM stdin;
\.


--
-- Data for Name: expediente; Type: TABLE DATA; Schema: sigd_doc; Owner: postgres
--

COPY sigd_doc.expediente (expediente_id, tipo_tramite_id, formulario_version_id, codigo_expediente, asunto, area_actual_id, solicitante_id, estado, fecha_registro, fecha_limite) FROM stdin;
\.


--
-- Data for Name: expediente_formulario_respuesta; Type: TABLE DATA; Schema: sigd_doc; Owner: postgres
--

COPY sigd_doc.expediente_formulario_respuesta (id_respuesta, expediente_id, formulario_version_id, datos, actualizado_en) FROM stdin;
\.


--
-- Data for Name: expediente_requisito; Type: TABLE DATA; Schema: sigd_doc; Owner: postgres
--

COPY sigd_doc.expediente_requisito (id_expediente_requisito, expediente_id, requisito_id, cumplido, documento_adjunto_id, verificado_en) FROM stdin;
\.


--
-- Data for Name: firma_digital_documento; Type: TABLE DATA; Schema: sigd_doc; Owner: postgres
--

COPY sigd_doc.firma_digital_documento (documento_id, cvd, sha256_firmado, firmante, fecha_sello_tsa, s3_bucket, s3_key, estado, fecha_registro) FROM stdin;
\.


--
-- Data for Name: formulario_version; Type: TABLE DATA; Schema: sigd_doc; Owner: postgres
--

COPY sigd_doc.formulario_version (formulario_version_id, tipo_tramite_id, version, json_schema, vigente_desde, vigente_hasta, publicado_por) FROM stdin;
\.


--
-- Data for Name: requisito; Type: TABLE DATA; Schema: sigd_doc; Owner: postgres
--

COPY sigd_doc.requisito (requisito_id, tipo_tramite_id, codigo, denominacion, obligatorio, orden) FROM stdin;
\.


--
-- Data for Name: resolucion; Type: TABLE DATA; Schema: sigd_doc; Owner: postgres
--

COPY sigd_doc.resolucion (resolucion_id, expediente_id, numero_borrador, numero_resolucion, tipo_resolucion, asunto, estado, fecha_proyeccion, proyectado_por, firmado_por, firmado_en, hash_pades, creado_en) FROM stdin;
\.


--
-- Data for Name: tipo_documento; Type: TABLE DATA; Schema: sigd_doc; Owner: postgres
--

COPY sigd_doc.tipo_documento (tipo_documental_id, codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente) FROM stdin;
\.


--
-- Data for Name: tipo_documento_requisito; Type: TABLE DATA; Schema: sigd_doc; Owner: postgres
--

COPY sigd_doc.tipo_documento_requisito (id_relacion, requisito_id, tipo_documental_id, condicion_json_pointer) FROM stdin;
\.


--
-- Data for Name: tipo_tramite_tupa; Type: TABLE DATA; Schema: sigd_doc; Owner: postgres
--

COPY sigd_doc.tipo_tramite_tupa (tipo_tramite_id, codigo, denominacion, descripcion, unidad_organica, plazo_dias, silencio_administrativo, base_legal, vigente) FROM stdin;
00000000-0000-0000-0000-000000000001	TUPA-01	Expedici?n de T?tulo Profesional T?cnico	Requisitos: Pago del derecho en Tesorer?a (1.90% UIT Vigente - S/ 105.00), FUT, constancia de no adeudar y carpeta completa.	Direcci?n General	30	NEGATIVO	Ley N? 30512	t
00000000-0000-0000-0000-000000000002	TUPA-02	Certificado de Estudios Superiores (6 Semestres)	Requisitos: Pago del derecho en Tesorer?a (2.24% UIT Vigente - S/ 124.00) y FUT dirigido a Secretar?a Acad?mica.	Secretar?a Acad?mica	7	POSITIVO	RVM N? 277-2019-MINEDU	t
00000000-0000-0000-0000-000000000003	TUPA-03	Visaci?n de Certificado de Estudios Superiores	Requisitos: Pago del derecho en Tesorer?a (0.29% UIT Vigente - S/ 16.00) y presentaci?n de certificados originales.	Secretar?a Acad?mica	5	POSITIVO	RVM N? 277-2019-MINEDU	t
6cff7c2c-bc90-41d9-a1bb-ef56cc0b1294	TUPA-04	Constancia de No Adeudar (Para Fines de Titulaci?n)	Requisitos: Pago del derecho en Tesorer?a (0.30% UIT Vigente - S/ 16.50).	Unidad Administrativa	3	POSITIVO	Ley N? 28693	t
449c4cc9-8111-4185-9a50-f7d0d1a4234f	TUPA-05	Constancia de Egresado	Requisitos: Pago del derecho en Tesorer?a (S/ 31.00) y verificaci?n de r?cord acad?mico.	Secretar?a Acad?mica	5	POSITIVO	RVM N? 277-2019-MINEDU	t
67957d3a-b19f-4447-b629-b81b1c3b521e	TUPA-06	Constancias Varias (T?tulo, Estudios o Matr?cula)	Requisitos: Pago del derecho en Tesorer?a (0.41% UIT Vigente - S/ 23.00) y FUT.	Secretar?a Acad?mica	5	POSITIVO	RVM N? 277-2019-MINEDU	t
7f796f3f-ddec-4dea-8633-24c420b46e79	TUPA-07	Certificado Modular (I, II, III y IV)	Requisitos: Pago en Tesorer?a (S/ 100.00 por m?dulo) y emisi?n de B/V.	Secretar?a Acad?mica	10	POSITIVO	RVM N? 277-2019-MINEDU	t
de268f6d-dee2-40c1-bb56-ac41e7c7bc68	TUPA-08	Certificado de Bachillerato	Requisitos: Pago del derecho en Tesorer?a (0.75% UIT Vigente - S/ 42.00) y comprobante de pago.	Secretar?a Acad?mica	15	POSITIVO	Ley N? 30512	t
3ab73a06-be37-4bcd-b32a-ddc0d755add1	TUPA-09	Derecho de Duplicado de T?tulo	Requisitos: Pago del derecho en Tesorer?a (5.61% UIT Vigente - S/ 309.00), publicaci?n en diario y denuncia policial.	Direcci?n General	30	NEGATIVO	Ley N? 30512	t
c5d706c6-5f79-4445-bd0e-d19cb1d56625	TUPA-10	Modificaci?n de Datos del T?tulo	Requisitos: Pago del derecho en Tesorer?a (4.88% UIT Vigente - S/ 269.00) y partida/DNI rectificado.	Direcci?n General	20	POSITIVO	Ley N? 30512	t
0cd3551c-b91e-47d0-820f-da1ba58b3490	TUPA-11	Convalidaci?n entre Planes de Estudios	Requisitos: Pago del derecho en Tesorer?a (0.84% UIT Vigente - S/ 46.50) y s?labos visados.	Jefatura de Unidad Acad?mica	15	POSITIVO	RVM N? 277-2019-MINEDU	t
4eb23f50-73b1-4af3-bdd2-314c5aaf8d96	TUPA-12	Convalidaci?n por Unidades de Competencia	Requisitos: Pago del derecho en Tesorer?a (0.84% UIT Vigente - S/ 46.50) y portafolio de evidencias.	Jefatura de Unidad Acad?mica	15	POSITIVO	RVM N? 277-2019-MINEDU	t
99b0323a-2c4b-4e1e-b405-0e31c29e9c47	TUPA-13	Traslado Interno	Requisitos: Solicitud en FUT, vacante en carrera, Resoluci?n Directoral (5.61% UIT Vigente - S/ 309.00).	Secretar?a Acad?mica	10	POSITIVO	RVM N? 277-2019-MINEDU	t
2abe0f1e-8d7c-4952-a4d1-121d073eb401	TUPA-14	Traslado Externo	Requisitos: Solicitud en FUT dirigida al Director, vacante en carrera, Resoluci?n Directoral (7.48% UIT Vigente - S/ 412.00).	Direcci?n General	15	POSITIVO	RVM N? 277-2019-MINEDU	t
7a3e21ea-c86b-405c-b88e-8cc3a5f229fe	TUPA-17	Derecho de Reincorporaci?n (Reingreso)	Requisitos: Pago en el ?rea de Tesorer?a (S/ 300.00) y FUT dirigido a Direcci?n.	Secretar?a Acad?mica	10	POSITIVO	RVM N? 277-2019-MINEDU	t
2e30f353-307c-489d-8dc1-8ecfe1a9cc34	TUPA-15	Reserva de Matr?cula - Ingresantes	Requisitos: Pago en Tesorer?a (1.20% UIT Vigente - S/ 66.00) y Resoluci?n Directoral de Secretar?a Acad?mica.	Secretar?a Acad?mica	5	POSITIVO	RVM N? 277-2019-MINEDU	t
82384f3c-5274-49b4-be14-8969efb9ba16	TUPA-16	Licencia de Estudios - Estudiantes Antiguos	Requisitos: Pago en Tesorer?a (1.20% UIT Vigente - S/ 66.00) y Resoluci?n Directoral de Secretar?a Acad?mica.	Secretar?a Acad?mica	5	POSITIVO	RVM N? 277-2019-MINEDU	t
4c4610a1-99a5-4f50-9494-960701ec818c	TUPA-18	Examen de Recuperaci?n / Subsanaci?n con Jurado	Requisitos: Resoluci?n Directoral, pago en Tesorer?a (0.60% UIT Vigente - S/ 33.00 a 1.27% UIT Vigente - S/ 70.00).	Jefatura de Unidad Acad?mica	5	POSITIVO	RVM N? 277-2019-MINEDU	t
ba5c6653-6ce4-40a3-a360-ca7adae499d0	TUPA-19	Evaluaci?n Extraordinaria	Requisitos: Pago en Tesorer?a (1.27% a 1.68% UIT Vigente - S/ 70.00 a S/ 93.00) seg?n RM 069.	Jefatura de Unidad Acad?mica	7	POSITIVO	RVM N? 277-2019-MINEDU	t
f30a37af-4a34-4740-90f7-54de186dffcc	TUPA-20	Prueba de Suficiencia Acad?mica	Requisitos: Resoluci?n Directoral, pago en Tesorer?a (1.90% UIT Vigente - S/ 105.00).	Jefatura de Unidad Acad?mica	10	POSITIVO	RVM N? 277-2019-MINEDU	t
81ba6e4c-a0b4-4d24-9b26-591ced8cdaca	TUPA-21	Devoluci?n de Expediente	Requisitos: Pago del derecho en Tesorer?a (0.37% UIT Vigente - S/ 21.00) y FUT de solicitud.	Mesa de Partes	3	POSITIVO	TUO Ley N? 27444	t
209ad0ae-64c9-407f-9276-a5410dc5bc4f	TUPA-22	Acceso a la Informaci?n P?blica	Requisitos: Solicitud dirigida a Direcci?n en FUT (Costo de reproducci?n: 0.19% UIT Vigente - S/ 10.50).	Direcci?n General	10	POSITIVO	Ley N? 27806	t
ca6fbd5f-1eba-4384-a35d-09f4d394ba56	TUPA-23	B?squeda y Duplicados de Boletas / S?labos	Requisitos: Pago del derecho en Tesorer?a (0.19% UIT Vigente - S/ 10.50).	Secretar?a Acad?mica	3	POSITIVO	Ley N? 28693	t
\.


--
-- Data for Name: area; Type: TABLE DATA; Schema: sigd_org; Owner: postgres
--

COPY sigd_org.area (area_id, codigo, nombre, area_padre_id, path, nivel, vigente, creado_en) FROM stdin;
\.


--
-- Data for Name: asignacion_personal; Type: TABLE DATA; Schema: sigd_org; Owner: postgres
--

COPY sigd_org.asignacion_personal (id_asignacion, id_usuario, cargo_id, area_id, vigente_desde, vigente_hasta) FROM stdin;
\.


--
-- Data for Name: calendario_laboral; Type: TABLE DATA; Schema: sigd_org; Owner: postgres
--

COPY sigd_org.calendario_laboral (id_calendario, fecha, tipo_feriado, descripcion, unidad_territorial, es_laborable, base_legal, registrado_por, activo, creado_en, actualizado_en) FROM stdin;
0df1393e-4cf4-4bd5-ab7d-3631d03b6c72	2026-06-24	REGIONAL_UCAYALI	Fiesta Patronal de San Juan Bautista	REGIONAL_UCAYALI	f	Ley N?? 29001	\N	t	2026-10-22 16:56:09.727855+00	2026-10-22 16:56:09.727855+00
2725983c-14bd-4fa9-870a-4c2533e3006e	2026-10-13	REGIONAL_UCAYALI	Aniversario de Creaci??n de Ucayali	REGIONAL_UCAYALI	f	Ley N?? 29001	\N	t	2026-10-22 16:56:09.727855+00	2026-10-22 16:56:09.727855+00
\.


--
-- Data for Name: cargo; Type: TABLE DATA; Schema: sigd_org; Owner: postgres
--

COPY sigd_org.cargo (cargo_id, codigo, nombre, descripcion, vigente) FROM stdin;
\.


--
-- Data for Name: encargatura_despacho; Type: TABLE DATA; Schema: sigd_org; Owner: postgres
--

COPY sigd_org.encargatura_despacho (encargatura_id, usuario_id, titular_usuario_id, cargo_id, tipo_resolucion, vigente, motivo_no_habilitado, inicio, fin) FROM stdin;
\.


--
-- Data for Name: facultad_despacho; Type: TABLE DATA; Schema: sigd_org; Owner: postgres
--

COPY sigd_org.facultad_despacho (facultad_id, usuario_id, cargo_id, tipo_resolucion, vigente, motivo_no_habilitado, emitido_en) FROM stdin;
\.


--
-- Data for Name: permiso_sistema; Type: TABLE DATA; Schema: sigd_org; Owner: postgres
--

COPY sigd_org.permiso_sistema (permiso_id, codigo, nombre, ambito) FROM stdin;
f84299b2-1432-49ee-9ba0-c9b7b2cd568a	EXPEDIENTE_LEER	Leer expedientes	GLOBAL
9f30e665-2611-40bd-ac57-c871f457f789	EXPEDIENTE_DERIVAR	Derivar expedientes	AREA
a2cfef90-37b2-4977-9c0e-9ac612fa1fde	EXPEDIENTE_RESOLVER	Resolver expedientes	AREA
7f2177dc-eef8-4e46-97b1-a148db75d4a2	FIRMA_FIRMAR	Firmar documentos oficiales	GLOBAL
f50d5d68-bfab-4baf-95db-e0602c4e5fac	ADMIN_USUARIOS	Administrar usuarios y roles	GLOBAL
552cd739-0b29-4448-b81c-dd6d3d72fad5	REPORTE_LEER	Consultar reportes MGD	GLOBAL
\.


--
-- Data for Name: rol_permiso; Type: TABLE DATA; Schema: sigd_org; Owner: postgres
--

COPY sigd_org.rol_permiso (rol_id, permiso_id) FROM stdin;
\.


--
-- Data for Name: rol_sistema; Type: TABLE DATA; Schema: sigd_org; Owner: postgres
--

COPY sigd_org.rol_sistema (rol_id, codigo, nombre, descripcion, vigente) FROM stdin;
1730f744-ce7a-418f-8a86-be625ca42902	ADMINISTRADOR	Administrador del Sistema	Administraci??n t??cnica total de la plataforma SIGD	t
1d9abe57-bd3b-4eb0-926c-059334e14295	DIRECTOR	Director	Emisi??n de resoluciones directorales y firma digital	t
a4d5a92c-9ff8-46f3-b28f-a59af4355364	SECRETARIO	Secretario Acad??mico	Proyecci??n y preparaci??n de resoluciones y expedientes de titulaci??n	t
626a8572-a5ac-4415-88a0-356e4808bf7f	ESPECIALISTA	Especialista	An??lisis t??cnico y emisi??n de dict??menes	t
88017686-8f99-47d9-b229-fc985d002d07	MESA_PARTES	Mesa de Partes	Recepci??n, radicaci??n y registro de documentos	t
e48b583c-7e54-45a1-a8ff-aeb447c62363	CIUDADANO	Ciudadano	Acceso restringido a la Casilla Electr??nica del administrado	t
\.


--
-- Data for Name: usuario_rol; Type: TABLE DATA; Schema: sigd_org; Owner: postgres
--

COPY sigd_org.usuario_rol (id_usuario_rol, id_usuario, rol_id, area_id, vigente_desde, vigente_hasta) FROM stdin;
\.


--
-- Data for Name: asiento_registro; Type: TABLE DATA; Schema: sigd_tra; Owner: postgres
--

COPY sigd_tra.asiento_registro (id_asiento, numero_registro, expediente_id, fecha_ingreso, canal_ingreso, asunto, remitente_id, destinatario_id, anulado, motivo_anulacion) FROM stdin;
441475fc-2884-4efa-baa8-826d3e374a7a	10001	78f1b1b0-22eb-4593-8a1a-5d05384d223d	2026-10-22 20:31:50.571+00	MESA_VIRTUAL	Solicitud formal de Certificado de Estudios Superiores - Semestre 2026	00000000-0000-0000-0000-000000000001	\N	f	\N
0e4ec713-7d69-4573-b363-7702405a5326	10002	518f22f9-e4a8-4068-9229-0afbc1e139ee	2026-10-22 20:36:34.064+00	MESA_VIRTUAL	solicitud de certificado de estudios	52084724-0317-4195-abcf-96e448a0ad64	\N	f	\N
\.


--
-- Data for Name: expediente; Type: TABLE DATA; Schema: sigd_tra; Owner: postgres
--

COPY sigd_tra.expediente (expediente_id, codigo_expediente, numero, dni_solicitante, tipo_documental_id, solicitante_id, area_destino_id, estado, fecha_radicacion, fecha_limite, actualizado_en) FROM stdin;
78f1b1b0-22eb-4593-8a1a-5d05384d223d	EXP-2026-000001	EXP-2026-000001	74561238	00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000001	\N	REGISTRADO	2026-10-22 13:00:00+00	\N	2026-10-22 20:31:50.571818+00
518f22f9-e4a8-4068-9229-0afbc1e139ee	EXP-2026-000002	EXP-2026-000002	45678934	00000000-0000-0000-0000-000000000001	52084724-0317-4195-abcf-96e448a0ad64	\N	REGISTRADO	2026-10-22 13:00:00+00	\N	2026-10-22 20:36:34.064908+00
\.


--
-- Data for Name: expediente_acumulacion; Type: TABLE DATA; Schema: sigd_tra; Owner: postgres
--

COPY sigd_tra.expediente_acumulacion (id_acumulacion, expediente_principal, expediente_accesorio, acto_resolutivo, estado, fecha_acumulacion, fecha_desacumulacion) FROM stdin;
\.


--
-- Data for Name: expediente_documento_folio; Type: TABLE DATA; Schema: sigd_tra; Owner: postgres
--

COPY sigd_tra.expediente_documento_folio (id_folio, expediente_id, id_documento, folio_inicio, folio_fin, asignado_por, creado_en) FROM stdin;
b91eb66d-5b10-43f7-b895-31c66c313a99	78f1b1b0-22eb-4593-8a1a-5d05384d223d	5c219448-f0d5-43c9-938e-9ee8ffa4e410	1	4	\N	2026-10-22 20:31:50.571818+00
cca4fa32-7c2e-453b-bed6-8a7ee9a4b668	518f22f9-e4a8-4068-9229-0afbc1e139ee	ae0ca6a1-4792-4386-b7e9-01ca62bc0e86	1	2	\N	2026-10-22 20:36:34.064908+00
\.


--
-- Data for Name: secuencia_anual_cut; Type: TABLE DATA; Schema: sigd_tra; Owner: postgres
--

COPY sigd_tra.secuencia_anual_cut (anio_fiscal, ultimo_correlativo, creado_en) FROM stdin;
2026	2	2026-10-22 20:31:50.571818+00
\.


--
-- Data for Name: tramite; Type: TABLE DATA; Schema: sigd_tra; Owner: postgres
--

COPY sigd_tra.tramite (tramite_id, expediente_id, codigo_tramite, asunto, estado, creado_en, actualizado_en) FROM stdin;
69d0389b-e570-483d-86da-6f9c8a4a278c	78f1b1b0-22eb-4593-8a1a-5d05384d223d	CARGO-372DFE23	Solicitud formal de Certificado de Estudios Superiores - Semestre 2026	REGISTRADO	2026-10-22 20:31:50.571+00	\N
03e7f12e-912a-4aac-a48d-f8eb5e97c4e7	518f22f9-e4a8-4068-9229-0afbc1e139ee	CARGO-E9109731	solicitud de certificado de estudios	REGISTRADO	2026-10-22 20:36:34.064+00	\N
\.


--
-- Data for Name: bitacora; Type: TABLE DATA; Schema: sigd_tupa; Owner: postgres
--

COPY sigd_tupa.bitacora (bitacora_id, version_id, accion, estado_anterior, estado_nuevo, usuario_id, detalle, fecha_hora) FROM stdin;
1	00000000-0000-0000-0000-000000000801	CREADA	\N	BORRADOR	\N	{"codigo": "TUPA-2026-V1", "nombre": "TUPA Institucional IESTP Suiza 2026"}	2026-10-22 17:06:34.801891+00
2	00000000-0000-0000-0000-000000000801	PUBLICADA	BORRADOR	VIGENTE	\N	{"codigo": "TUPA-2026-V1"}	2026-10-22 17:06:34.818363+00
\.


--
-- Data for Name: tramite_requisito; Type: TABLE DATA; Schema: sigd_tupa; Owner: postgres
--

COPY sigd_tupa.tramite_requisito (requisito_id, tramite_version_id, orden, texto) FROM stdin;
\.


--
-- Data for Name: tramite_version; Type: TABLE DATA; Schema: sigd_tupa; Owner: postgres
--

COPY sigd_tupa.tramite_version (tramite_version_id, version_id, codigo, denominacion, descripcion, rubro, derecho_monto, derecho_porcentaje_uit, derecho_texto, cuenta_pago, plazo_texto, plazo_dias_habiles, calificacion, silencio_administrativo, unidad_recibe, autoridad_resuelve, recursos, base_legal, observaciones) FROM stdin;
b3fd9c5f-f115-4ad5-aa0c-42b325984c70	00000000-0000-0000-0000-000000000801	TUPA-01	Procedimiento Administrativo TUPA-01	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
71cbdc8d-83c6-4a65-bd25-047486e39850	00000000-0000-0000-0000-000000000801	TUPA-02	Procedimiento Administrativo TUPA-02	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
68ab7522-7619-4a03-84de-727f8a80bc8a	00000000-0000-0000-0000-000000000801	TUPA-03	Procedimiento Administrativo TUPA-03	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
5074c425-d8d4-4a12-9763-664731a9d677	00000000-0000-0000-0000-000000000801	TUPA-04	Procedimiento Administrativo TUPA-04	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
c73c95cf-74e1-49ce-a5ab-8d090fa307e7	00000000-0000-0000-0000-000000000801	TUPA-05	Procedimiento Administrativo TUPA-05	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
36ab11a8-4586-4375-88d5-d727d92ca65e	00000000-0000-0000-0000-000000000801	TUPA-06	Procedimiento Administrativo TUPA-06	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
948715c2-fafa-4c00-b662-5f5ef3291e8d	00000000-0000-0000-0000-000000000801	TUPA-07	Procedimiento Administrativo TUPA-07	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
289054c2-e39b-46ad-9e99-ddc577999cb4	00000000-0000-0000-0000-000000000801	TUPA-08	Procedimiento Administrativo TUPA-08	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
662ed48a-88fa-41c7-b933-1ea41a259d51	00000000-0000-0000-0000-000000000801	TUPA-09	Procedimiento Administrativo TUPA-09	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
edf1b8bc-5bcc-4bc4-94fd-9f1e4f9a00f7	00000000-0000-0000-0000-000000000801	TUPA-10	Procedimiento Administrativo TUPA-10	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
934e1f87-8cf7-4649-933c-98166776e28c	00000000-0000-0000-0000-000000000801	TUPA-11	Procedimiento Administrativo TUPA-11	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
fa07b5f4-0e27-465f-b4bb-c9d020df6435	00000000-0000-0000-0000-000000000801	TUPA-12	Procedimiento Administrativo TUPA-12	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
bcaa8aca-32f9-4b08-a7d6-e10937daf155	00000000-0000-0000-0000-000000000801	TUPA-13	Procedimiento Administrativo TUPA-13	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
c81ef115-e121-484e-9a28-3f3cafbb715b	00000000-0000-0000-0000-000000000801	TUPA-14	Procedimiento Administrativo TUPA-14	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
1b3f9cda-c5f5-4a99-9957-11467a51d989	00000000-0000-0000-0000-000000000801	TUPA-15	Procedimiento Administrativo TUPA-15	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
c14e8f66-2538-498e-8194-d625461a5972	00000000-0000-0000-0000-000000000801	TUPA-16	Procedimiento Administrativo TUPA-16	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
efc584c6-aa70-4255-8f0c-b776df3ac313	00000000-0000-0000-0000-000000000801	TUPA-17	Procedimiento Administrativo TUPA-17	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
f7f85f03-4100-42ba-b9fd-29a33b469a76	00000000-0000-0000-0000-000000000801	TUPA-18	Procedimiento Administrativo TUPA-18	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
29b36b10-110f-4657-adb4-b871e2b20afb	00000000-0000-0000-0000-000000000801	TUPA-19	Procedimiento Administrativo TUPA-19	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
fc9cf0dd-b8dc-441b-8692-8910692efd92	00000000-0000-0000-0000-000000000801	TUPA-20	Procedimiento Administrativo TUPA-20	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
753a5e31-b152-463c-8b90-c4f07bb7f191	00000000-0000-0000-0000-000000000801	TUPA-21	Procedimiento Administrativo TUPA-21	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
38660190-8415-4aae-8fc0-a349e342f0b4	00000000-0000-0000-0000-000000000801	TUPA-22	Procedimiento Administrativo TUPA-22	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
26d584cf-25c7-4fc9-8eb1-0ba870b21afc	00000000-0000-0000-0000-000000000801	TUPA-23	Procedimiento Administrativo TUPA-23	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
ffafe45a-78f4-4ccf-9c6b-b346f1453076	00000000-0000-0000-0000-000000000801	TUPA-24	Procedimiento Administrativo TUPA-24	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
0a915911-82b7-4ce0-80f6-1a165203f03b	00000000-0000-0000-0000-000000000801	TUPA-25	Procedimiento Administrativo TUPA-25	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
ffccf78f-34bd-44aa-baa3-6774006755b1	00000000-0000-0000-0000-000000000801	TUPA-26	Procedimiento Administrativo TUPA-26	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
e593af0f-c314-46e5-9fbe-d4c592d69304	00000000-0000-0000-0000-000000000801	TUPA-27	Procedimiento Administrativo TUPA-27	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
7b04f47b-32f7-4f80-9119-d312e5fe1672	00000000-0000-0000-0000-000000000801	TUPA-28	Procedimiento Administrativo TUPA-28	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
9227a135-fe7c-4d8e-a48a-2763517436ed	00000000-0000-0000-0000-000000000801	TUPA-29	Procedimiento Administrativo TUPA-29	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
db98f94d-2b3a-4b8b-8712-c2e8ef7ac4ef	00000000-0000-0000-0000-000000000801	TUPA-30	Procedimiento Administrativo TUPA-30	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
f60fc5fd-7c62-4d45-bdfa-5ab535fc9a13	00000000-0000-0000-0000-000000000801	TUPA-31	Procedimiento Administrativo TUPA-31	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
18a04c14-76c3-4c53-bad7-d58c60e0997d	00000000-0000-0000-0000-000000000801	TUPA-32	Procedimiento Administrativo TUPA-32	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
5376e041-b377-4290-96ed-b7f038c29d8c	00000000-0000-0000-0000-000000000801	TUPA-33	Procedimiento Administrativo TUPA-33	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
df1dfbf2-92cc-40f5-a802-ba6a375049ef	00000000-0000-0000-0000-000000000801	TUPA-34	Procedimiento Administrativo TUPA-34	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
d805bf27-1a51-45fa-8732-0c861ba508a2	00000000-0000-0000-0000-000000000801	TUPA-35	Procedimiento Administrativo TUPA-35	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
e921ffa1-9b77-4c53-a5cb-764d195e6d5f	00000000-0000-0000-0000-000000000801	TUPA-36	Procedimiento Administrativo TUPA-36	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
48a69526-b230-4b71-b48f-a7002e486e2e	00000000-0000-0000-0000-000000000801	TUPA-37	Procedimiento Administrativo TUPA-37	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
b60015df-e642-4119-9e09-b1bba83bf520	00000000-0000-0000-0000-000000000801	TUPA-38	Procedimiento Administrativo TUPA-38	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
b61bf351-f0c2-4789-b0e8-b4b08d50a183	00000000-0000-0000-0000-000000000801	TUPA-39	Procedimiento Administrativo TUPA-39	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
8c8d1ea7-3ec0-4fa3-9b20-933cba5546eb	00000000-0000-0000-0000-000000000801	TUPA-40	Procedimiento Administrativo TUPA-40	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
45f40abe-c52c-4d09-ab90-f5da9c12d6cb	00000000-0000-0000-0000-000000000801	TUPA-41	Procedimiento Administrativo TUPA-41	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
ea31801f-b8f9-41bc-9b79-bca2dd9daea3	00000000-0000-0000-0000-000000000801	TUPA-42	Procedimiento Administrativo TUPA-42	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
18c2824d-b831-49b3-8571-dbd861c066d6	00000000-0000-0000-0000-000000000801	TUPA-43	Procedimiento Administrativo TUPA-43	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
f048a2f6-9396-40b2-a619-3cdb4849ccce	00000000-0000-0000-0000-000000000801	TUPA-44	Procedimiento Administrativo TUPA-44	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
456bca6f-8b67-4fde-9f06-0b8f4f8a919a	00000000-0000-0000-0000-000000000801	TUPA-45	Procedimiento Administrativo TUPA-45	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
1516faa7-43ab-4b13-aed1-bb8d91e553d6	00000000-0000-0000-0000-000000000801	TUPA-46	Procedimiento Administrativo TUPA-46	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
9844d09b-0bcf-45ca-b200-56da9a775abe	00000000-0000-0000-0000-000000000801	TUPA-47	Procedimiento Administrativo TUPA-47	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
6b9b31a8-4a5c-48b6-b186-00152b7601c3	00000000-0000-0000-0000-000000000801	TUPA-48	Procedimiento Administrativo TUPA-48	\N	SECRETARIA ACADEMICA	35.00	\N	\N	\N	\N	30	EVALUACION_PREVIA	POSITIVO	Mesa de Partes	Direcci?n General	\N	\N	\N
\.


--
-- Data for Name: version; Type: TABLE DATA; Schema: sigd_tupa; Owner: postgres
--

COPY sigd_tupa.version (version_id, codigo, nombre, fecha_vigencia, uit_vigente, resolucion_numero, resolucion_fecha, resolucion_pdf_ref, resolucion_pdf_sha256, estado, version_anterior_id, creado_en) FROM stdin;
00000000-0000-0000-0000-000000000801	TUPA-2026-V1	TUPA Institucional IESTP Suiza 2026	2026-01-01	5350.00	RD-001-2026-IESTP-SUIZA	2026-01-01	tupa/resolucion-2026.pdf	e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855	VIGENTE	\N	2026-10-22 17:06:34.801891+00
\.


--
-- Name: tipos_documento_id_tipo_documento_seq; Type: SEQUENCE SET; Schema: sigd_auth; Owner: postgres
--

SELECT pg_catalog.setval('sigd_auth.tipos_documento_id_tipo_documento_seq', 1, false);


--
-- Name: seq_asiento_numero_registro; Type: SEQUENCE SET; Schema: sigd_tra; Owner: postgres
--

SELECT pg_catalog.setval('sigd_tra.seq_asiento_numero_registro', 10002, true);


--
-- Name: bitacora_bitacora_id_seq; Type: SEQUENCE SET; Schema: sigd_tupa; Owner: postgres
--

SELECT pg_catalog.setval('sigd_tupa.bitacora_bitacora_id_seq', 2, true);


--
-- Name: bitacora_auditoria pk_bitacora_auditoria; Type: CONSTRAINT; Schema: sigd_audit; Owner: postgres
--

ALTER TABLE ONLY sigd_audit.bitacora_auditoria
    ADD CONSTRAINT pk_bitacora_auditoria PRIMARY KEY (id_auditoria);


--
-- Name: evento_outbox pk_evento_outbox; Type: CONSTRAINT; Schema: sigd_audit; Owner: postgres
--

ALTER TABLE ONLY sigd_audit.evento_outbox
    ADD CONSTRAINT pk_evento_outbox PRIMARY KEY (id_evento);


--
-- Name: cuenta_usuario cuenta_usuario_correo_key; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.cuenta_usuario
    ADD CONSTRAINT cuenta_usuario_correo_key UNIQUE (correo);


--
-- Name: cuenta_usuario cuenta_usuario_usuario_key; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.cuenta_usuario
    ADD CONSTRAINT cuenta_usuario_usuario_key UNIQUE (usuario);


--
-- Name: auditoria_usuarios pk_auditoria_usuarios; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.auditoria_usuarios
    ADD CONSTRAINT pk_auditoria_usuarios PRIMARY KEY (id_auditoria);


--
-- Name: consentimiento_datos pk_consentimiento_datos; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.consentimiento_datos
    ADD CONSTRAINT pk_consentimiento_datos PRIMARY KEY (id_consentimiento);


--
-- Name: cuenta_usuario pk_cuenta_usuario; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.cuenta_usuario
    ADD CONSTRAINT pk_cuenta_usuario PRIMARY KEY (id_usuario);


--
-- Name: notificacion_casilla pk_notificacion_casilla; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.notificacion_casilla
    ADD CONSTRAINT pk_notificacion_casilla PRIMARY KEY (id);


--
-- Name: perfil_usuario pk_perfil_usuario; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.perfil_usuario
    ADD CONSTRAINT pk_perfil_usuario PRIMARY KEY (id_usuario);


--
-- Name: persona pk_persona; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.persona
    ADD CONSTRAINT pk_persona PRIMARY KEY (id_persona);


--
-- Name: persona_documento_historial pk_persona_documento_historial; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.persona_documento_historial
    ADD CONSTRAINT pk_persona_documento_historial PRIMARY KEY (id_historial);


--
-- Name: persona_juridica pk_persona_juridica; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.persona_juridica
    ADD CONSTRAINT pk_persona_juridica PRIMARY KEY (id_persona);


--
-- Name: persona_natural pk_persona_natural; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.persona_natural
    ADD CONSTRAINT pk_persona_natural PRIMARY KEY (id_persona);


--
-- Name: representacion_legal pk_representacion_legal; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.representacion_legal
    ADD CONSTRAINT pk_representacion_legal PRIMARY KEY (id_representacion);


--
-- Name: sesion_usuario pk_sesion_usuario; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.sesion_usuario
    ADD CONSTRAINT pk_sesion_usuario PRIMARY KEY (id_sesion);


--
-- Name: sesion_usuario sesion_usuario_refresh_token_key; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.sesion_usuario
    ADD CONSTRAINT sesion_usuario_refresh_token_key UNIQUE (refresh_token);


--
-- Name: tipos_documento tipos_documento_codigo_key; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.tipos_documento
    ADD CONSTRAINT tipos_documento_codigo_key UNIQUE (codigo);


--
-- Name: tipos_documento tipos_documento_pkey; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.tipos_documento
    ADD CONSTRAINT tipos_documento_pkey PRIMARY KEY (id_tipo_documento);


--
-- Name: persona uq_persona_documento; Type: CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.persona
    ADD CONSTRAINT uq_persona_documento UNIQUE (tipo, id_documento);


--
-- Name: expediente expediente_codigo_expediente_key; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.expediente
    ADD CONSTRAINT expediente_codigo_expediente_key UNIQUE (codigo_expediente);


--
-- Name: firma_digital_documento firma_digital_documento_cvd_key; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.firma_digital_documento
    ADD CONSTRAINT firma_digital_documento_cvd_key UNIQUE (cvd);


--
-- Name: firma_digital_documento firma_digital_documento_pkey; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.firma_digital_documento
    ADD CONSTRAINT firma_digital_documento_pkey PRIMARY KEY (documento_id);


--
-- Name: expediente pk_doc_expediente; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.expediente
    ADD CONSTRAINT pk_doc_expediente PRIMARY KEY (expediente_id);


--
-- Name: documento_adjunto pk_documento_adjunto; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.documento_adjunto
    ADD CONSTRAINT pk_documento_adjunto PRIMARY KEY (documento_adjunto_id);


--
-- Name: expediente_formulario_respuesta pk_expediente_formulario_respuesta; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.expediente_formulario_respuesta
    ADD CONSTRAINT pk_expediente_formulario_respuesta PRIMARY KEY (id_respuesta);


--
-- Name: expediente_requisito pk_expediente_requisito; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.expediente_requisito
    ADD CONSTRAINT pk_expediente_requisito PRIMARY KEY (id_expediente_requisito);


--
-- Name: formulario_version pk_formulario_version; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.formulario_version
    ADD CONSTRAINT pk_formulario_version PRIMARY KEY (formulario_version_id);


--
-- Name: requisito pk_requisito; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.requisito
    ADD CONSTRAINT pk_requisito PRIMARY KEY (requisito_id);


--
-- Name: resolucion pk_resolucion; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.resolucion
    ADD CONSTRAINT pk_resolucion PRIMARY KEY (resolucion_id);


--
-- Name: tipo_documento pk_tipo_documento; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.tipo_documento
    ADD CONSTRAINT pk_tipo_documento PRIMARY KEY (tipo_documental_id);


--
-- Name: tipo_documento_requisito pk_tipo_documento_requisito; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.tipo_documento_requisito
    ADD CONSTRAINT pk_tipo_documento_requisito PRIMARY KEY (id_relacion);


--
-- Name: tipo_tramite_tupa pk_tipo_tramite_tupa; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.tipo_tramite_tupa
    ADD CONSTRAINT pk_tipo_tramite_tupa PRIMARY KEY (tipo_tramite_id);


--
-- Name: tipo_documento tipo_documento_codigo_key; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.tipo_documento
    ADD CONSTRAINT tipo_documento_codigo_key UNIQUE (codigo);


--
-- Name: tipo_tramite_tupa tipo_tramite_tupa_codigo_key; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.tipo_tramite_tupa
    ADD CONSTRAINT tipo_tramite_tupa_codigo_key UNIQUE (codigo);


--
-- Name: documento_adjunto uq_documento_adjunto_s3; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.documento_adjunto
    ADD CONSTRAINT uq_documento_adjunto_s3 UNIQUE (s3_bucket, s3_key);


--
-- Name: documento_adjunto uq_documento_adjunto_sha; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.documento_adjunto
    ADD CONSTRAINT uq_documento_adjunto_sha UNIQUE (s3_bucket, sha256);


--
-- Name: expediente_formulario_respuesta uq_expediente_formulario; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.expediente_formulario_respuesta
    ADD CONSTRAINT uq_expediente_formulario UNIQUE (expediente_id, formulario_version_id);


--
-- Name: expediente_requisito uq_expediente_requisito; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.expediente_requisito
    ADD CONSTRAINT uq_expediente_requisito UNIQUE (expediente_id, requisito_id);


--
-- Name: formulario_version uq_formulario_version; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.formulario_version
    ADD CONSTRAINT uq_formulario_version UNIQUE (tipo_tramite_id, version);


--
-- Name: requisito uq_requisito_tramite_codigo; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.requisito
    ADD CONSTRAINT uq_requisito_tramite_codigo UNIQUE (tipo_tramite_id, codigo);


--
-- Name: resolucion uq_resolucion_borrador; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.resolucion
    ADD CONSTRAINT uq_resolucion_borrador UNIQUE (expediente_id, numero_borrador);


--
-- Name: tipo_documento_requisito uq_tipo_documento_requisito; Type: CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.tipo_documento_requisito
    ADD CONSTRAINT uq_tipo_documento_requisito UNIQUE (requisito_id, tipo_documental_id);


--
-- Name: area area_codigo_key; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.area
    ADD CONSTRAINT area_codigo_key UNIQUE (codigo);


--
-- Name: cargo cargo_codigo_key; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.cargo
    ADD CONSTRAINT cargo_codigo_key UNIQUE (codigo);


--
-- Name: asignacion_personal ex_asignacion_personal_vigencia; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.asignacion_personal
    ADD CONSTRAINT ex_asignacion_personal_vigencia EXCLUDE USING gist (id_usuario WITH =, cargo_id WITH =, tstzrange(vigente_desde, COALESCE(vigente_hasta, 'infinity'::timestamp with time zone), '[)'::text) WITH &&);


--
-- Name: encargatura_despacho ex_encargatura_vigencia; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.encargatura_despacho
    ADD CONSTRAINT ex_encargatura_vigencia EXCLUDE USING gist (usuario_id WITH =, cargo_id WITH =, tstzrange(inicio, COALESCE(fin, 'infinity'::timestamp with time zone), '[)'::text) WITH &&);


--
-- Name: usuario_rol ex_usuario_rol_vigencia; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.usuario_rol
    ADD CONSTRAINT ex_usuario_rol_vigencia EXCLUDE USING gist (id_usuario WITH =, rol_id WITH =, COALESCE(area_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =, tstzrange(vigente_desde, COALESCE(vigente_hasta, 'infinity'::timestamp with time zone), '[)'::text) WITH &&);


--
-- Name: permiso_sistema permiso_sistema_codigo_key; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.permiso_sistema
    ADD CONSTRAINT permiso_sistema_codigo_key UNIQUE (codigo);


--
-- Name: area pk_area; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.area
    ADD CONSTRAINT pk_area PRIMARY KEY (area_id);


--
-- Name: asignacion_personal pk_asignacion_personal; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.asignacion_personal
    ADD CONSTRAINT pk_asignacion_personal PRIMARY KEY (id_asignacion);


--
-- Name: calendario_laboral pk_calendario_laboral; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.calendario_laboral
    ADD CONSTRAINT pk_calendario_laboral PRIMARY KEY (id_calendario);


--
-- Name: cargo pk_cargo; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.cargo
    ADD CONSTRAINT pk_cargo PRIMARY KEY (cargo_id);


--
-- Name: encargatura_despacho pk_encargatura_despacho; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.encargatura_despacho
    ADD CONSTRAINT pk_encargatura_despacho PRIMARY KEY (encargatura_id);


--
-- Name: facultad_despacho pk_facultad_despacho; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.facultad_despacho
    ADD CONSTRAINT pk_facultad_despacho PRIMARY KEY (facultad_id);


--
-- Name: permiso_sistema pk_permiso_sistema; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.permiso_sistema
    ADD CONSTRAINT pk_permiso_sistema PRIMARY KEY (permiso_id);


--
-- Name: rol_permiso pk_rol_permiso; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.rol_permiso
    ADD CONSTRAINT pk_rol_permiso PRIMARY KEY (rol_id, permiso_id);


--
-- Name: rol_sistema pk_rol_sistema; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.rol_sistema
    ADD CONSTRAINT pk_rol_sistema PRIMARY KEY (rol_id);


--
-- Name: usuario_rol pk_usuario_rol; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.usuario_rol
    ADD CONSTRAINT pk_usuario_rol PRIMARY KEY (id_usuario_rol);


--
-- Name: rol_sistema rol_sistema_codigo_key; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.rol_sistema
    ADD CONSTRAINT rol_sistema_codigo_key UNIQUE (codigo);


--
-- Name: area uq_area_path; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.area
    ADD CONSTRAINT uq_area_path UNIQUE (path);


--
-- Name: calendario_laboral uq_calendario_fecha_unidad; Type: CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.calendario_laboral
    ADD CONSTRAINT uq_calendario_fecha_unidad UNIQUE (fecha, unidad_territorial);


--
-- Name: asiento_registro asiento_registro_numero_registro_key; Type: CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.asiento_registro
    ADD CONSTRAINT asiento_registro_numero_registro_key UNIQUE (numero_registro);


--
-- Name: expediente expediente_codigo_expediente_key; Type: CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.expediente
    ADD CONSTRAINT expediente_codigo_expediente_key UNIQUE (codigo_expediente);


--
-- Name: asiento_registro pk_asiento_registro; Type: CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.asiento_registro
    ADD CONSTRAINT pk_asiento_registro PRIMARY KEY (id_asiento);


--
-- Name: expediente_acumulacion pk_expediente_acumulacion; Type: CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.expediente_acumulacion
    ADD CONSTRAINT pk_expediente_acumulacion PRIMARY KEY (id_acumulacion);


--
-- Name: expediente_documento_folio pk_expediente_documento_folio; Type: CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.expediente_documento_folio
    ADD CONSTRAINT pk_expediente_documento_folio PRIMARY KEY (id_folio);


--
-- Name: secuencia_anual_cut pk_secuencia_anual_cut; Type: CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.secuencia_anual_cut
    ADD CONSTRAINT pk_secuencia_anual_cut PRIMARY KEY (anio_fiscal);


--
-- Name: expediente pk_tra_expediente; Type: CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.expediente
    ADD CONSTRAINT pk_tra_expediente PRIMARY KEY (expediente_id);


--
-- Name: tramite pk_tra_tramite; Type: CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.tramite
    ADD CONSTRAINT pk_tra_tramite PRIMARY KEY (tramite_id);


--
-- Name: tramite tramite_expediente_id_key; Type: CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.tramite
    ADD CONSTRAINT tramite_expediente_id_key UNIQUE (expediente_id);


--
-- Name: expediente uq_tra_expediente_numero; Type: CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.expediente
    ADD CONSTRAINT uq_tra_expediente_numero UNIQUE (numero);


--
-- Name: bitacora pk_tupa_bitacora; Type: CONSTRAINT; Schema: sigd_tupa; Owner: postgres
--

ALTER TABLE ONLY sigd_tupa.bitacora
    ADD CONSTRAINT pk_tupa_bitacora PRIMARY KEY (bitacora_id);


--
-- Name: tramite_requisito pk_tupa_tramite_requisito; Type: CONSTRAINT; Schema: sigd_tupa; Owner: postgres
--

ALTER TABLE ONLY sigd_tupa.tramite_requisito
    ADD CONSTRAINT pk_tupa_tramite_requisito PRIMARY KEY (requisito_id);


--
-- Name: tramite_version pk_tupa_tramite_version; Type: CONSTRAINT; Schema: sigd_tupa; Owner: postgres
--

ALTER TABLE ONLY sigd_tupa.tramite_version
    ADD CONSTRAINT pk_tupa_tramite_version PRIMARY KEY (tramite_version_id);


--
-- Name: version pk_tupa_version; Type: CONSTRAINT; Schema: sigd_tupa; Owner: postgres
--

ALTER TABLE ONLY sigd_tupa.version
    ADD CONSTRAINT pk_tupa_version PRIMARY KEY (version_id);


--
-- Name: tramite_requisito uq_tupa_requisito_orden; Type: CONSTRAINT; Schema: sigd_tupa; Owner: postgres
--

ALTER TABLE ONLY sigd_tupa.tramite_requisito
    ADD CONSTRAINT uq_tupa_requisito_orden UNIQUE (tramite_version_id, orden);


--
-- Name: tramite_version uq_tupa_tramite_version_codigo; Type: CONSTRAINT; Schema: sigd_tupa; Owner: postgres
--

ALTER TABLE ONLY sigd_tupa.tramite_version
    ADD CONSTRAINT uq_tupa_tramite_version_codigo UNIQUE (version_id, codigo);


--
-- Name: version version_codigo_key; Type: CONSTRAINT; Schema: sigd_tupa; Owner: postgres
--

ALTER TABLE ONLY sigd_tupa.version
    ADD CONSTRAINT version_codigo_key UNIQUE (codigo);


--
-- Name: idx_bitacora_correlation_id; Type: INDEX; Schema: sigd_audit; Owner: postgres
--

CREATE INDEX idx_bitacora_correlation_id ON sigd_audit.bitacora_auditoria USING btree (correlation_id);


--
-- Name: idx_bitacora_fecha; Type: INDEX; Schema: sigd_audit; Owner: postgres
--

CREATE INDEX idx_bitacora_fecha ON sigd_audit.bitacora_auditoria USING btree (fecha_hora);


--
-- Name: idx_bitacora_jsonb; Type: INDEX; Schema: sigd_audit; Owner: postgres
--

CREATE INDEX idx_bitacora_jsonb ON sigd_audit.bitacora_auditoria USING gin (datos_despues);


--
-- Name: idx_bitacora_tabla; Type: INDEX; Schema: sigd_audit; Owner: postgres
--

CREATE INDEX idx_bitacora_tabla ON sigd_audit.bitacora_auditoria USING btree (esquema, tabla);


--
-- Name: idx_bitacora_usuario; Type: INDEX; Schema: sigd_audit; Owner: postgres
--

CREATE INDEX idx_bitacora_usuario ON sigd_audit.bitacora_auditoria USING btree (usuario_id);


--
-- Name: idx_outbox_estado_fecha; Type: INDEX; Schema: sigd_audit; Owner: postgres
--

CREATE INDEX idx_outbox_estado_fecha ON sigd_audit.evento_outbox USING btree (estado, creado_en);


--
-- Name: idx_auditoria_usuarios_correlacion; Type: INDEX; Schema: sigd_auth; Owner: postgres
--

CREATE INDEX idx_auditoria_usuarios_correlacion ON sigd_auth.auditoria_usuarios USING btree (correlation_id);


--
-- Name: idx_consentimiento_persona; Type: INDEX; Schema: sigd_auth; Owner: postgres
--

CREATE INDEX idx_consentimiento_persona ON sigd_auth.consentimiento_datos USING btree (id_persona);


--
-- Name: idx_cuenta_usuario_persona; Type: INDEX; Schema: sigd_auth; Owner: postgres
--

CREATE INDEX idx_cuenta_usuario_persona ON sigd_auth.cuenta_usuario USING btree (id_persona);


--
-- Name: idx_notif_casilla_cut; Type: INDEX; Schema: sigd_auth; Owner: postgres
--

CREATE INDEX idx_notif_casilla_cut ON sigd_auth.notificacion_casilla USING btree (cut);


--
-- Name: idx_notif_casilla_estado; Type: INDEX; Schema: sigd_auth; Owner: postgres
--

CREATE INDEX idx_notif_casilla_estado ON sigd_auth.notificacion_casilla USING btree (usuario_id, estado);


--
-- Name: idx_notif_casilla_fecha; Type: INDEX; Schema: sigd_auth; Owner: postgres
--

CREATE INDEX idx_notif_casilla_fecha ON sigd_auth.notificacion_casilla USING btree (fecha_deposito DESC);


--
-- Name: idx_notif_casilla_usuario; Type: INDEX; Schema: sigd_auth; Owner: postgres
--

CREATE INDEX idx_notif_casilla_usuario ON sigd_auth.notificacion_casilla USING btree (usuario_id);


--
-- Name: idx_sesion_usuario_expira; Type: INDEX; Schema: sigd_auth; Owner: postgres
--

CREATE INDEX idx_sesion_usuario_expira ON sigd_auth.sesion_usuario USING btree (expira_en);


--
-- Name: idx_sesion_usuario_usuario; Type: INDEX; Schema: sigd_auth; Owner: postgres
--

CREATE INDEX idx_sesion_usuario_usuario ON sigd_auth.sesion_usuario USING btree (id_usuario);


--
-- Name: idx_doc_expediente_area; Type: INDEX; Schema: sigd_doc; Owner: postgres
--

CREATE INDEX idx_doc_expediente_area ON sigd_doc.expediente USING btree (area_actual_id);


--
-- Name: idx_doc_expediente_solicitante; Type: INDEX; Schema: sigd_doc; Owner: postgres
--

CREATE INDEX idx_doc_expediente_solicitante ON sigd_doc.expediente USING btree (solicitante_id);


--
-- Name: idx_doc_expediente_tramite; Type: INDEX; Schema: sigd_doc; Owner: postgres
--

CREATE INDEX idx_doc_expediente_tramite ON sigd_doc.expediente USING btree (tipo_tramite_id);


--
-- Name: idx_documento_adjunto_expediente; Type: INDEX; Schema: sigd_doc; Owner: postgres
--

CREATE INDEX idx_documento_adjunto_expediente ON sigd_doc.documento_adjunto USING btree (expediente_id);


--
-- Name: idx_documento_adjunto_sha; Type: INDEX; Schema: sigd_doc; Owner: postgres
--

CREATE INDEX idx_documento_adjunto_sha ON sigd_doc.documento_adjunto USING btree (sha256);


--
-- Name: idx_firma_digital_cvd; Type: INDEX; Schema: sigd_doc; Owner: postgres
--

CREATE INDEX idx_firma_digital_cvd ON sigd_doc.firma_digital_documento USING btree (cvd);


--
-- Name: idx_firma_digital_sha256; Type: INDEX; Schema: sigd_doc; Owner: postgres
--

CREATE INDEX idx_firma_digital_sha256 ON sigd_doc.firma_digital_documento USING btree (sha256_firmado);


--
-- Name: idx_resolucion_estado; Type: INDEX; Schema: sigd_doc; Owner: postgres
--

CREATE INDEX idx_resolucion_estado ON sigd_doc.resolucion USING btree (estado);


--
-- Name: idx_resolucion_proyeccion; Type: INDEX; Schema: sigd_doc; Owner: postgres
--

CREATE INDEX idx_resolucion_proyeccion ON sigd_doc.resolucion USING btree (fecha_proyeccion);


--
-- Name: idx_area_padre; Type: INDEX; Schema: sigd_org; Owner: postgres
--

CREATE INDEX idx_area_padre ON sigd_org.area USING btree (area_padre_id);


--
-- Name: idx_area_path; Type: INDEX; Schema: sigd_org; Owner: postgres
--

CREATE INDEX idx_area_path ON sigd_org.area USING gist (path);


--
-- Name: idx_area_vigente; Type: INDEX; Schema: sigd_org; Owner: postgres
--

CREATE INDEX idx_area_vigente ON sigd_org.area USING btree (vigente) WHERE (vigente = true);


--
-- Name: idx_calendario_anio; Type: INDEX; Schema: sigd_org; Owner: postgres
--

CREATE INDEX idx_calendario_anio ON sigd_org.calendario_laboral USING btree (anio);


--
-- Name: idx_calendario_fecha; Type: INDEX; Schema: sigd_org; Owner: postgres
--

CREATE INDEX idx_calendario_fecha ON sigd_org.calendario_laboral USING btree (fecha);


--
-- Name: idx_encargatura_usuario; Type: INDEX; Schema: sigd_org; Owner: postgres
--

CREATE INDEX idx_encargatura_usuario ON sigd_org.encargatura_despacho USING btree (usuario_id) WHERE (vigente = true);


--
-- Name: idx_facultad_usuario; Type: INDEX; Schema: sigd_org; Owner: postgres
--

CREATE INDEX idx_facultad_usuario ON sigd_org.facultad_despacho USING btree (usuario_id) WHERE (vigente = true);


--
-- Name: idx_rol_permiso_rol; Type: INDEX; Schema: sigd_org; Owner: postgres
--

CREATE INDEX idx_rol_permiso_rol ON sigd_org.rol_permiso USING btree (rol_id);


--
-- Name: idx_usuario_rol_usuario; Type: INDEX; Schema: sigd_org; Owner: postgres
--

CREATE INDEX idx_usuario_rol_usuario ON sigd_org.usuario_rol USING btree (id_usuario);


--
-- Name: idx_asiento_registro_anulado; Type: INDEX; Schema: sigd_tra; Owner: postgres
--

CREATE INDEX idx_asiento_registro_anulado ON sigd_tra.asiento_registro USING btree (anulado) WHERE (anulado = true);


--
-- Name: idx_asiento_registro_expediente; Type: INDEX; Schema: sigd_tra; Owner: postgres
--

CREATE INDEX idx_asiento_registro_expediente ON sigd_tra.asiento_registro USING btree (expediente_id);


--
-- Name: idx_expediente_acumulacion_accesorio; Type: INDEX; Schema: sigd_tra; Owner: postgres
--

CREATE INDEX idx_expediente_acumulacion_accesorio ON sigd_tra.expediente_acumulacion USING btree (expediente_accesorio);


--
-- Name: idx_expediente_documento_folio_rango; Type: INDEX; Schema: sigd_tra; Owner: postgres
--

CREATE INDEX idx_expediente_documento_folio_rango ON sigd_tra.expediente_documento_folio USING btree (expediente_id, folio_inicio, folio_fin);


--
-- Name: idx_tra_expediente_area; Type: INDEX; Schema: sigd_tra; Owner: postgres
--

CREATE INDEX idx_tra_expediente_area ON sigd_tra.expediente USING btree (area_destino_id);


--
-- Name: idx_tra_expediente_cut; Type: INDEX; Schema: sigd_tra; Owner: postgres
--

CREATE INDEX idx_tra_expediente_cut ON sigd_tra.expediente USING btree (codigo_expediente);


--
-- Name: idx_tra_expediente_estado; Type: INDEX; Schema: sigd_tra; Owner: postgres
--

CREATE INDEX idx_tra_expediente_estado ON sigd_tra.expediente USING btree (estado);


--
-- Name: idx_tra_tramite_estado; Type: INDEX; Schema: sigd_tra; Owner: postgres
--

CREATE INDEX idx_tra_tramite_estado ON sigd_tra.tramite USING btree (estado);


--
-- Name: uq_expediente_acumulacion_vigente; Type: INDEX; Schema: sigd_tra; Owner: postgres
--

CREATE UNIQUE INDEX uq_expediente_acumulacion_vigente ON sigd_tra.expediente_acumulacion USING btree (expediente_principal, expediente_accesorio) WHERE ((estado)::text = 'ACUMULADO'::text);


--
-- Name: ix_tupa_bitacora_version_fecha; Type: INDEX; Schema: sigd_tupa; Owner: postgres
--

CREATE INDEX ix_tupa_bitacora_version_fecha ON sigd_tupa.bitacora USING btree (version_id, fecha_hora DESC);


--
-- Name: ix_tupa_tramite_version_codigo; Type: INDEX; Schema: sigd_tupa; Owner: postgres
--

CREATE INDEX ix_tupa_tramite_version_codigo ON sigd_tupa.tramite_version USING btree (codigo);


--
-- Name: uq_tupa_version_unica_vigente; Type: INDEX; Schema: sigd_tupa; Owner: postgres
--

CREATE UNIQUE INDEX uq_tupa_version_unica_vigente ON sigd_tupa.version USING btree (estado) WHERE ((estado)::text = 'VIGENTE'::text);


--
-- Name: bitacora_auditoria tr_bitacora_append_only; Type: TRIGGER; Schema: sigd_audit; Owner: postgres
--

CREATE TRIGGER tr_bitacora_append_only BEFORE DELETE OR UPDATE ON sigd_audit.bitacora_auditoria FOR EACH ROW EXECUTE FUNCTION sigd_audit.fn_rechazar_mutacion_bitacora();


--
-- Name: formulario_version tr_proteger_formulario_version; Type: TRIGGER; Schema: sigd_doc; Owner: postgres
--

CREATE TRIGGER tr_proteger_formulario_version BEFORE DELETE OR UPDATE ON sigd_doc.formulario_version FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_proteger_formulario_version();


--
-- Name: area tr_area_set_path; Type: TRIGGER; Schema: sigd_org; Owner: postgres
--

CREATE TRIGGER tr_area_set_path BEFORE INSERT OR UPDATE OF area_padre_id, codigo ON sigd_org.area FOR EACH ROW EXECUTE FUNCTION sigd_org.fn_area_set_path();


--
-- Name: expediente_documento_folio tr_folio_continuidad; Type: TRIGGER; Schema: sigd_tra; Owner: postgres
--

CREATE TRIGGER tr_folio_continuidad BEFORE INSERT ON sigd_tra.expediente_documento_folio FOR EACH ROW EXECUTE FUNCTION sigd_tra.fn_verificar_continuidad_folio();


--
-- Name: expediente tr_tra_expediente_asignar_cut; Type: TRIGGER; Schema: sigd_tra; Owner: postgres
--

CREATE TRIGGER tr_tra_expediente_asignar_cut BEFORE INSERT ON sigd_tra.expediente FOR EACH ROW EXECUTE FUNCTION sigd_tra.fn_tra_expediente_asignar_cut();


--
-- Name: asiento_registro trg_asiento_inmutable; Type: TRIGGER; Schema: sigd_tra; Owner: postgres
--

CREATE TRIGGER trg_asiento_inmutable BEFORE DELETE OR UPDATE ON sigd_tra.asiento_registro FOR EACH ROW EXECUTE FUNCTION sigd_tra.fn_rechazar_mutacion_asiento();


--
-- Name: expediente_documento_folio trg_folio_no_delete; Type: TRIGGER; Schema: sigd_tra; Owner: postgres
--

CREATE TRIGGER trg_folio_no_delete BEFORE DELETE ON sigd_tra.expediente_documento_folio FOR EACH ROW EXECUTE FUNCTION sigd_tra.fn_rechazar_mutacion_folio();


--
-- Name: expediente_documento_folio trg_folio_no_update; Type: TRIGGER; Schema: sigd_tra; Owner: postgres
--

CREATE TRIGGER trg_folio_no_update BEFORE UPDATE ON sigd_tra.expediente_documento_folio FOR EACH ROW EXECUTE FUNCTION sigd_tra.fn_rechazar_mutacion_folio();


--
-- Name: bitacora tr_tupa_bitacora_inmutable; Type: TRIGGER; Schema: sigd_tupa; Owner: postgres
--

CREATE TRIGGER tr_tupa_bitacora_inmutable BEFORE DELETE OR UPDATE ON sigd_tupa.bitacora FOR EACH ROW EXECUTE FUNCTION sigd_tupa.fn_bitacora_inmutable();


--
-- Name: bitacora tr_tupa_bitacora_no_truncar; Type: TRIGGER; Schema: sigd_tupa; Owner: postgres
--

CREATE TRIGGER tr_tupa_bitacora_no_truncar BEFORE TRUNCATE ON sigd_tupa.bitacora FOR EACH STATEMENT EXECUTE FUNCTION sigd_tupa.fn_bitacora_inmutable();


--
-- Name: version tr_tupa_bitacora_version; Type: TRIGGER; Schema: sigd_tupa; Owner: postgres
--

CREATE TRIGGER tr_tupa_bitacora_version AFTER INSERT OR UPDATE ON sigd_tupa.version FOR EACH ROW EXECUTE FUNCTION sigd_tupa.fn_bitacora_version();


--
-- Name: tramite_requisito tr_tupa_proteger_tramite_requisito; Type: TRIGGER; Schema: sigd_tupa; Owner: postgres
--

CREATE TRIGGER tr_tupa_proteger_tramite_requisito BEFORE INSERT OR DELETE OR UPDATE ON sigd_tupa.tramite_requisito FOR EACH ROW EXECUTE FUNCTION sigd_tupa.fn_proteger_tramite_requisito();


--
-- Name: tramite_version tr_tupa_proteger_tramite_version; Type: TRIGGER; Schema: sigd_tupa; Owner: postgres
--

CREATE TRIGGER tr_tupa_proteger_tramite_version BEFORE INSERT OR DELETE OR UPDATE ON sigd_tupa.tramite_version FOR EACH ROW EXECUTE FUNCTION sigd_tupa.fn_proteger_tramite_version();


--
-- Name: version tr_tupa_proteger_version; Type: TRIGGER; Schema: sigd_tupa; Owner: postgres
--

CREATE TRIGGER tr_tupa_proteger_version BEFORE INSERT OR DELETE OR UPDATE ON sigd_tupa.version FOR EACH ROW EXECUTE FUNCTION sigd_tupa.fn_proteger_version();


--
-- Name: consentimiento_datos consentimiento_datos_id_persona_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.consentimiento_datos
    ADD CONSTRAINT consentimiento_datos_id_persona_fkey FOREIGN KEY (id_persona) REFERENCES sigd_auth.persona(id_persona) ON DELETE CASCADE;


--
-- Name: cuenta_usuario cuenta_usuario_id_persona_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.cuenta_usuario
    ADD CONSTRAINT cuenta_usuario_id_persona_fkey FOREIGN KEY (id_persona) REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT;


--
-- Name: notificacion_casilla notificacion_casilla_usuario_id_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.notificacion_casilla
    ADD CONSTRAINT notificacion_casilla_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: perfil_usuario perfil_usuario_id_usuario_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.perfil_usuario
    ADD CONSTRAINT perfil_usuario_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: persona_documento_historial persona_documento_historial_id_persona_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.persona_documento_historial
    ADD CONSTRAINT persona_documento_historial_id_persona_fkey FOREIGN KEY (id_persona) REFERENCES sigd_auth.persona(id_persona) ON DELETE CASCADE;


--
-- Name: persona_documento_historial persona_documento_historial_tipo_documento_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.persona_documento_historial
    ADD CONSTRAINT persona_documento_historial_tipo_documento_fkey FOREIGN KEY (tipo_documento) REFERENCES sigd_auth.tipos_documento(id_tipo_documento);


--
-- Name: persona_juridica persona_juridica_id_persona_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.persona_juridica
    ADD CONSTRAINT persona_juridica_id_persona_fkey FOREIGN KEY (id_persona) REFERENCES sigd_auth.persona(id_persona) ON DELETE CASCADE;


--
-- Name: persona_natural persona_natural_id_persona_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.persona_natural
    ADD CONSTRAINT persona_natural_id_persona_fkey FOREIGN KEY (id_persona) REFERENCES sigd_auth.persona(id_persona) ON DELETE CASCADE;


--
-- Name: representacion_legal representacion_legal_id_persona_juridica_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.representacion_legal
    ADD CONSTRAINT representacion_legal_id_persona_juridica_fkey FOREIGN KEY (id_persona_juridica) REFERENCES sigd_auth.persona(id_persona) ON DELETE CASCADE;


--
-- Name: representacion_legal representacion_legal_id_persona_natural_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.representacion_legal
    ADD CONSTRAINT representacion_legal_id_persona_natural_fkey FOREIGN KEY (id_persona_natural) REFERENCES sigd_auth.persona(id_persona) ON DELETE CASCADE;


--
-- Name: sesion_usuario sesion_usuario_id_usuario_fkey; Type: FK CONSTRAINT; Schema: sigd_auth; Owner: postgres
--

ALTER TABLE ONLY sigd_auth.sesion_usuario
    ADD CONSTRAINT sesion_usuario_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: documento_adjunto documento_adjunto_expediente_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.documento_adjunto
    ADD CONSTRAINT documento_adjunto_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES sigd_doc.expediente(expediente_id) ON DELETE CASCADE;


--
-- Name: documento_adjunto documento_adjunto_tipo_documental_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.documento_adjunto
    ADD CONSTRAINT documento_adjunto_tipo_documental_id_fkey FOREIGN KEY (tipo_documental_id) REFERENCES sigd_doc.tipo_documento(tipo_documental_id) ON DELETE RESTRICT;


--
-- Name: expediente expediente_area_actual_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.expediente
    ADD CONSTRAINT expediente_area_actual_id_fkey FOREIGN KEY (area_actual_id) REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT;


--
-- Name: expediente_formulario_respuesta expediente_formulario_respuesta_expediente_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.expediente_formulario_respuesta
    ADD CONSTRAINT expediente_formulario_respuesta_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES sigd_doc.expediente(expediente_id) ON DELETE CASCADE;


--
-- Name: expediente_formulario_respuesta expediente_formulario_respuesta_formulario_version_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.expediente_formulario_respuesta
    ADD CONSTRAINT expediente_formulario_respuesta_formulario_version_id_fkey FOREIGN KEY (formulario_version_id) REFERENCES sigd_doc.formulario_version(formulario_version_id) ON DELETE RESTRICT;


--
-- Name: expediente expediente_formulario_version_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.expediente
    ADD CONSTRAINT expediente_formulario_version_id_fkey FOREIGN KEY (formulario_version_id) REFERENCES sigd_doc.formulario_version(formulario_version_id) ON DELETE RESTRICT;


--
-- Name: expediente_requisito expediente_requisito_expediente_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.expediente_requisito
    ADD CONSTRAINT expediente_requisito_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES sigd_doc.expediente(expediente_id) ON DELETE CASCADE;


--
-- Name: expediente_requisito expediente_requisito_requisito_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.expediente_requisito
    ADD CONSTRAINT expediente_requisito_requisito_id_fkey FOREIGN KEY (requisito_id) REFERENCES sigd_doc.requisito(requisito_id) ON DELETE RESTRICT;


--
-- Name: expediente expediente_solicitante_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.expediente
    ADD CONSTRAINT expediente_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT;


--
-- Name: expediente expediente_tipo_tramite_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.expediente
    ADD CONSTRAINT expediente_tipo_tramite_id_fkey FOREIGN KEY (tipo_tramite_id) REFERENCES sigd_doc.tipo_tramite_tupa(tipo_tramite_id) ON DELETE RESTRICT;


--
-- Name: firma_digital_documento firma_digital_documento_documento_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.firma_digital_documento
    ADD CONSTRAINT firma_digital_documento_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES sigd_doc.documento_adjunto(documento_adjunto_id) ON DELETE CASCADE;


--
-- Name: formulario_version formulario_version_tipo_tramite_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.formulario_version
    ADD CONSTRAINT formulario_version_tipo_tramite_id_fkey FOREIGN KEY (tipo_tramite_id) REFERENCES sigd_doc.tipo_tramite_tupa(tipo_tramite_id) ON DELETE RESTRICT;


--
-- Name: requisito requisito_tipo_tramite_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.requisito
    ADD CONSTRAINT requisito_tipo_tramite_id_fkey FOREIGN KEY (tipo_tramite_id) REFERENCES sigd_doc.tipo_tramite_tupa(tipo_tramite_id) ON DELETE CASCADE;


--
-- Name: resolucion resolucion_expediente_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.resolucion
    ADD CONSTRAINT resolucion_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES sigd_doc.expediente(expediente_id) ON DELETE RESTRICT;


--
-- Name: tipo_documento_requisito tipo_documento_requisito_requisito_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.tipo_documento_requisito
    ADD CONSTRAINT tipo_documento_requisito_requisito_id_fkey FOREIGN KEY (requisito_id) REFERENCES sigd_doc.requisito(requisito_id) ON DELETE CASCADE;


--
-- Name: tipo_documento_requisito tipo_documento_requisito_tipo_documental_id_fkey; Type: FK CONSTRAINT; Schema: sigd_doc; Owner: postgres
--

ALTER TABLE ONLY sigd_doc.tipo_documento_requisito
    ADD CONSTRAINT tipo_documento_requisito_tipo_documental_id_fkey FOREIGN KEY (tipo_documental_id) REFERENCES sigd_doc.tipo_documento(tipo_documental_id) ON DELETE RESTRICT;


--
-- Name: area area_area_padre_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.area
    ADD CONSTRAINT area_area_padre_id_fkey FOREIGN KEY (area_padre_id) REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT;


--
-- Name: asignacion_personal asignacion_personal_area_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.asignacion_personal
    ADD CONSTRAINT asignacion_personal_area_id_fkey FOREIGN KEY (area_id) REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT;


--
-- Name: asignacion_personal asignacion_personal_cargo_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.asignacion_personal
    ADD CONSTRAINT asignacion_personal_cargo_id_fkey FOREIGN KEY (cargo_id) REFERENCES sigd_org.cargo(cargo_id) ON DELETE RESTRICT;


--
-- Name: asignacion_personal asignacion_personal_id_usuario_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.asignacion_personal
    ADD CONSTRAINT asignacion_personal_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: encargatura_despacho encargatura_despacho_cargo_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.encargatura_despacho
    ADD CONSTRAINT encargatura_despacho_cargo_id_fkey FOREIGN KEY (cargo_id) REFERENCES sigd_org.cargo(cargo_id) ON DELETE RESTRICT;


--
-- Name: encargatura_despacho encargatura_despacho_titular_usuario_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.encargatura_despacho
    ADD CONSTRAINT encargatura_despacho_titular_usuario_id_fkey FOREIGN KEY (titular_usuario_id) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT;


--
-- Name: encargatura_despacho encargatura_despacho_usuario_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.encargatura_despacho
    ADD CONSTRAINT encargatura_despacho_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: facultad_despacho facultad_despacho_cargo_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.facultad_despacho
    ADD CONSTRAINT facultad_despacho_cargo_id_fkey FOREIGN KEY (cargo_id) REFERENCES sigd_org.cargo(cargo_id) ON DELETE RESTRICT;


--
-- Name: facultad_despacho facultad_despacho_usuario_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.facultad_despacho
    ADD CONSTRAINT facultad_despacho_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: rol_permiso rol_permiso_permiso_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.rol_permiso
    ADD CONSTRAINT rol_permiso_permiso_id_fkey FOREIGN KEY (permiso_id) REFERENCES sigd_org.permiso_sistema(permiso_id) ON DELETE CASCADE;


--
-- Name: rol_permiso rol_permiso_rol_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.rol_permiso
    ADD CONSTRAINT rol_permiso_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES sigd_org.rol_sistema(rol_id) ON DELETE CASCADE;


--
-- Name: usuario_rol usuario_rol_area_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.usuario_rol
    ADD CONSTRAINT usuario_rol_area_id_fkey FOREIGN KEY (area_id) REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT;


--
-- Name: usuario_rol usuario_rol_id_usuario_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.usuario_rol
    ADD CONSTRAINT usuario_rol_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE CASCADE;


--
-- Name: usuario_rol usuario_rol_rol_id_fkey; Type: FK CONSTRAINT; Schema: sigd_org; Owner: postgres
--

ALTER TABLE ONLY sigd_org.usuario_rol
    ADD CONSTRAINT usuario_rol_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES sigd_org.rol_sistema(rol_id) ON DELETE RESTRICT;


--
-- Name: asiento_registro asiento_registro_expediente_id_fkey; Type: FK CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.asiento_registro
    ADD CONSTRAINT asiento_registro_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT;


--
-- Name: expediente_acumulacion expediente_acumulacion_expediente_accesorio_fkey; Type: FK CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.expediente_acumulacion
    ADD CONSTRAINT expediente_acumulacion_expediente_accesorio_fkey FOREIGN KEY (expediente_accesorio) REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT;


--
-- Name: expediente_acumulacion expediente_acumulacion_expediente_principal_fkey; Type: FK CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.expediente_acumulacion
    ADD CONSTRAINT expediente_acumulacion_expediente_principal_fkey FOREIGN KEY (expediente_principal) REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT;


--
-- Name: expediente expediente_area_destino_id_fkey; Type: FK CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.expediente
    ADD CONSTRAINT expediente_area_destino_id_fkey FOREIGN KEY (area_destino_id) REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT;


--
-- Name: expediente_documento_folio expediente_documento_folio_expediente_id_fkey; Type: FK CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.expediente_documento_folio
    ADD CONSTRAINT expediente_documento_folio_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT;


--
-- Name: expediente expediente_solicitante_id_fkey; Type: FK CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.expediente
    ADD CONSTRAINT expediente_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT;


--
-- Name: tramite tramite_expediente_id_fkey; Type: FK CONSTRAINT; Schema: sigd_tra; Owner: postgres
--

ALTER TABLE ONLY sigd_tra.tramite
    ADD CONSTRAINT tramite_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT;


--
-- Name: bitacora bitacora_version_id_fkey; Type: FK CONSTRAINT; Schema: sigd_tupa; Owner: postgres
--

ALTER TABLE ONLY sigd_tupa.bitacora
    ADD CONSTRAINT bitacora_version_id_fkey FOREIGN KEY (version_id) REFERENCES sigd_tupa.version(version_id) ON DELETE RESTRICT;


--
-- Name: tramite_requisito tramite_requisito_tramite_version_id_fkey; Type: FK CONSTRAINT; Schema: sigd_tupa; Owner: postgres
--

ALTER TABLE ONLY sigd_tupa.tramite_requisito
    ADD CONSTRAINT tramite_requisito_tramite_version_id_fkey FOREIGN KEY (tramite_version_id) REFERENCES sigd_tupa.tramite_version(tramite_version_id) ON DELETE RESTRICT;


--
-- Name: tramite_version tramite_version_version_id_fkey; Type: FK CONSTRAINT; Schema: sigd_tupa; Owner: postgres
--

ALTER TABLE ONLY sigd_tupa.tramite_version
    ADD CONSTRAINT tramite_version_version_id_fkey FOREIGN KEY (version_id) REFERENCES sigd_tupa.version(version_id) ON DELETE RESTRICT;


--
-- Name: version version_version_anterior_id_fkey; Type: FK CONSTRAINT; Schema: sigd_tupa; Owner: postgres
--

ALTER TABLE ONLY sigd_tupa.version
    ADD CONSTRAINT version_version_anterior_id_fkey FOREIGN KEY (version_anterior_id) REFERENCES sigd_tupa.version(version_id) ON DELETE RESTRICT;


--
-- Name: SCHEMA sigd_audit; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA sigd_audit TO sigd_app;
GRANT USAGE ON SCHEMA sigd_audit TO sigd_worker;


--
-- Name: FUNCTION agregar_folio_expediente(p_id_expediente uuid, p_id_documento uuid, p_cantidad integer, p_usuario_id uuid); Type: ACL; Schema: sigd_tra; Owner: postgres
--

REVOKE ALL ON FUNCTION sigd_tra.agregar_folio_expediente(p_id_expediente uuid, p_id_documento uuid, p_cantidad integer, p_usuario_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION fn_generar_cut(p_anio integer); Type: ACL; Schema: sigd_tra; Owner: postgres
--

REVOKE ALL ON FUNCTION sigd_tra.fn_generar_cut(p_anio integer) FROM PUBLIC;


--
-- Name: FUNCTION generar_cut_expediente(p_anio integer); Type: ACL; Schema: sigd_tra; Owner: postgres
--

REVOKE ALL ON FUNCTION sigd_tra.generar_cut_expediente(p_anio integer) FROM PUBLIC;


--
-- Name: TABLE bitacora_auditoria; Type: ACL; Schema: sigd_audit; Owner: postgres
--

GRANT SELECT,INSERT ON TABLE sigd_audit.bitacora_auditoria TO sigd_app;


--
-- Name: TABLE evento_outbox; Type: ACL; Schema: sigd_audit; Owner: postgres
--

GRANT SELECT,INSERT ON TABLE sigd_audit.evento_outbox TO sigd_app;
GRANT SELECT,UPDATE ON TABLE sigd_audit.evento_outbox TO sigd_worker;


--
-- PostgreSQL database dump complete
--

\unrestrict y2gG6kOjCfWqWjBNVaCRSdnMcxX8XeHe83GI4240Lj9Iz4Qwrr9oNn1NmSiKZHD

