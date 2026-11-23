-- =============================================================================
-- Migración 05 · Esquema sigd_tra
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Ricardo Arévalo Villacorta (B_AREVALO) · Grupo 6 CoreLink
-- Marco     : MGD-PCM (CUT EXP-YYYY-XXXXXX), TUO Ley 27444 Art. 160,
--             Directiva N° 001-2019-AGN (foliación continua F. 1 a N)
-- Depende de: 02_sigd_auth.sql, 03_sigd_org.sql, 04_sigd_doc.sql
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS sigd_tra;

-- -----------------------------------------------------------------------------
-- 5.1 secuencia_anual_cut — correlativo atómico por año fiscal
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_tra.secuencia_anual_cut (
    anio_fiscal          INT         NOT NULL
                                     CONSTRAINT pk_secuencia_anual_cut PRIMARY KEY,
    ultimo_correlativo   BIGINT      NOT NULL DEFAULT 0,
    creado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_secuencia_anual_correlativo CHECK (ultimo_correlativo >= 0)
);

COMMENT ON TABLE sigd_tra.secuencia_anual_cut IS
    'Correlativo CUT por año fiscal. Se bloquea con SELECT ... FOR UPDATE para garantizar unicidad sin colisiones bajo concurrencia.';

-- -----------------------------------------------------------------------------
-- 5.2 generar_cut_expediente(p_anio INT) — CUT atómico EXP-YYYY-XXXXXX
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_tra.generar_cut_expediente(p_anio INT)
RETURNS VARCHAR(20)
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

COMMENT ON FUNCTION sigd_tra.generar_cut_expediente(INT) IS
    'Genera el Código Único de Trámite con máscara EXP-YYYY-XXXXXX bajo bloqueo pesimista de fila (cero colisiones).';
REVOKE EXECUTE ON FUNCTION sigd_tra.generar_cut_expediente(INT) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 5.2b fn_generar_cut(p_anio INT) — Alias de compatibilidad canónica para CutService
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_tra.fn_generar_cut(p_anio INT)
RETURNS VARCHAR(20)
LANGUAGE sql
STRICT
AS $$
    SELECT sigd_tra.generar_cut_expediente(p_anio);
$$;

COMMENT ON FUNCTION sigd_tra.fn_generar_cut(INT) IS
    'Alias canónico de compatibilidad para sigd_tra.generar_cut_expediente(INT).';
REVOKE EXECUTE ON FUNCTION sigd_tra.fn_generar_cut(INT) FROM PUBLIC;


-- -----------------------------------------------------------------------------
-- 5.3 expediente — registro formal y CUT
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_tra.expediente (
    expediente_id      UUID         NOT NULL DEFAULT gen_random_uuid()
                                   CONSTRAINT pk_tra_expediente PRIMARY KEY,
    codigo_expediente  VARCHAR(20)  NOT NULL UNIQUE,
    numero            VARCHAR(30)  NOT NULL,
    dni_solicitante    CHAR(8)      NULL,
    tipo_documental_id UUID         NOT NULL,
    solicitante_id     UUID         NOT NULL
                                   REFERENCES sigd_auth.persona (id_persona) ON DELETE RESTRICT,
    area_destino_id    UUID         NULL
                                   REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT,
    estado             VARCHAR(30)  NOT NULL DEFAULT 'REGISTRADO',
    fecha_radicacion   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    fecha_limite       TIMESTAMPTZ  NULL,
    CONSTRAINT uq_tra_expediente_numero UNIQUE (numero),
    CONSTRAINT chk_tra_expediente_dni CHECK (dni_solicitante IS NULL OR dni_solicitante ~ '^[0-9]{8}$'),
    CONSTRAINT chk_tra_expediente_cut CHECK (codigo_expediente ~ '^EXP-[0-9]{4}-[0-9]{6}$')
);

-- Asignación automática del CUT a partir del año de radicación.
CREATE OR REPLACE FUNCTION sigd_tra.fn_tra_expediente_asignar_cut()
RETURNS trigger
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

DROP TRIGGER IF EXISTS tr_tra_expediente_asignar_cut ON sigd_tra.expediente;
CREATE TRIGGER tr_tra_expediente_asignar_cut
    BEFORE INSERT ON sigd_tra.expediente
    FOR EACH ROW EXECUTE FUNCTION sigd_tra.fn_tra_expediente_asignar_cut();

-- Los expedientes ya insertados antes del trigger reciben su CUT correlativo.
UPDATE sigd_tra.expediente
   SET codigo_expediente = sigd_tra.generar_cut_expediente(
         EXTRACT(YEAR FROM fecha_radicacion)::INT
       )
 WHERE codigo_expediente IS NULL
    OR NOT (codigo_expediente ~ '^EXP-[0-9]{4}-[0-9]{6}$');

CREATE INDEX IF NOT EXISTS idx_tra_expediente_cut ON sigd_tra.expediente (codigo_expediente);
CREATE INDEX IF NOT EXISTS idx_tra_expediente_area ON sigd_tra.expediente (area_destino_id);
CREATE INDEX IF NOT EXISTS idx_tra_expediente_estado ON sigd_tra.expediente (estado);

-- -----------------------------------------------------------------------------
-- 5.4 expediente_acumulacion (Art. 160 TUO Ley 27444)
-- Sin ciclos de dependencia: un expediente no se acumula a sí mismo y un par no
-- puede tener dos acumulaciones vigentes simultáneas.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_tra.expediente_acumulacion (
    id_acumulacion       UUID        NOT NULL DEFAULT gen_random_uuid()
                                    CONSTRAINT pk_expediente_acumulacion PRIMARY KEY,
    expediente_principal UUID        NOT NULL
                                    REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    expediente_accesorio UUID        NOT NULL
                                    REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    acto_resolutivo      TEXT        NOT NULL,
    estado               VARCHAR(20) NOT NULL DEFAULT 'ACUMULADO',
    fecha_acumulacion    TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_desacumulacion TIMESTAMPTZ NULL,
    CONSTRAINT chk_acumulacion_distintos CHECK (expediente_principal <> expediente_accesorio),
    CONSTRAINT chk_acumulacion_estado CHECK (estado IN ('ACUMULADO', 'DESACUMULADO')),
    CONSTRAINT chk_acumulacion_desacumulacion CHECK (
        estado = 'ACUMULADO' OR fecha_desacumulacion IS NOT NULL
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_expediente_acumulacion_vigente
    ON sigd_tra.expediente_acumulacion (expediente_principal, expediente_accesorio)
    WHERE estado = 'ACUMULADO';

CREATE INDEX IF NOT EXISTS idx_expediente_acumulacion_accesorio
    ON sigd_tra.expediente_acumulacion (expediente_accesorio);

-- -----------------------------------------------------------------------------
-- 5.4b acumular_expediente — Acumulación conexa atómica (Art. 160 LPAG)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_tra.acumular_expediente(
    p_expediente_principal UUID,
    p_expediente_accesorio UUID,
    p_acto_resolutivo TEXT
)
RETURNS UUID
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

COMMENT ON FUNCTION sigd_tra.acumular_expediente(UUID, UUID, TEXT) IS
    'Acumula expedientes conexos bajo el Art. 160 del TUO de la Ley N° 27444 con control acíclico.';


-- -----------------------------------------------------------------------------
-- 5.5 expediente_documento_folio — foliación continua AGN (F. 1 a N)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_tra.expediente_documento_folio (
    id_folio       UUID        NOT NULL DEFAULT gen_random_uuid()
                              CONSTRAINT pk_expediente_documento_folio PRIMARY KEY,
    expediente_id  UUID        NOT NULL
                              REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    id_documento   UUID        NOT NULL,
    folio_inicio   INT         NOT NULL,
    folio_fin      INT         NOT NULL,
    asignado_por   UUID        NULL,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_folio_rango CHECK (folio_inicio > 0 AND folio_fin >= folio_inicio)
);

COMMENT ON TABLE sigd_tra.expediente_documento_folio IS
    'Foliación continua e ininterrumpida (Directiva N° 001-2019-AGN). El folio N+1 inicia exactamente en folio_fin(N) + 1.';

CREATE INDEX IF NOT EXISTS idx_expediente_documento_folio_rango
    ON sigd_tra.expediente_documento_folio (expediente_id, folio_inicio, folio_fin);

-- Continuidad estricta y sin solapamiento, con bloqueo pesimista del expediente.
CREATE OR REPLACE FUNCTION sigd_tra.fn_verificar_continuidad_folio()
RETURNS trigger
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

DROP TRIGGER IF EXISTS tr_folio_continuidad ON sigd_tra.expediente_documento_folio;
CREATE TRIGGER tr_folio_continuidad
    BEFORE INSERT ON sigd_tra.expediente_documento_folio
    FOR EACH ROW EXECUTE FUNCTION sigd_tra.fn_verificar_continuidad_folio();

-- Foliación inmutable: SQLSTATE 23001 ante UPDATE o DELETE.
CREATE OR REPLACE FUNCTION sigd_tra.fn_rechazar_mutacion_folio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'La foliación es inmutable (Directiva AGN): % rechazado sobre %',
        TG_OP, OLD.id_folio
        USING ERRCODE = '23001',
              HINT = 'Los folios emitidos no se corrigen; registre un nuevo documento.';
END;
$$;

DROP TRIGGER IF EXISTS trg_folio_no_update ON sigd_tra.expediente_documento_folio;
CREATE TRIGGER trg_folio_no_update
    BEFORE UPDATE ON sigd_tra.expediente_documento_folio
    FOR EACH ROW EXECUTE FUNCTION sigd_tra.fn_rechazar_mutacion_folio();

DROP TRIGGER IF EXISTS trg_folio_no_delete ON sigd_tra.expediente_documento_folio;
CREATE TRIGGER trg_folio_no_delete
    BEFORE DELETE ON sigd_tra.expediente_documento_folio
    FOR EACH ROW EXECUTE FUNCTION sigd_tra.fn_rechazar_mutacion_folio();

-- Vía canónica de foliación.
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

REVOKE EXECUTE ON FUNCTION sigd_tra.agregar_folio_expediente(UUID, UUID, INT, UUID) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 5.6 asiento_registro — Libro General de Entrada y Salida (inmutable)
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS sigd_tra.seq_asiento_numero_registro START WITH 10001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS sigd_tra.asiento_registro (
    id_asiento        UUID        NOT NULL DEFAULT gen_random_uuid()
                                   CONSTRAINT pk_asiento_registro PRIMARY KEY,
    numero_registro   BIGINT      NOT NULL UNIQUE
                                   DEFAULT nextval('sigd_tra.seq_asiento_numero_registro'),
    expediente_id     UUID        NOT NULL
                                   REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    fecha_ingreso     TIMESTAMPTZ NOT NULL DEFAULT now(),
    canal_ingreso     VARCHAR(30) NOT NULL DEFAULT 'MESA_VIRTUAL',
    asunto            VARCHAR(500) NOT NULL,
    remitente_id      UUID        NULL,
    destinatario_id   UUID        NULL,
    anulado           BOOLEAN     NOT NULL DEFAULT FALSE,
    motivo_anulacion  TEXT        NULL,
    CONSTRAINT chk_asiento_canal CHECK (canal_ingreso IN ('MESA_VIRTUAL', 'MESA_PRESENCIAL'))
);

CREATE OR REPLACE FUNCTION sigd_tra.fn_rechazar_mutacion_asiento()
RETURNS trigger
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

DROP TRIGGER IF EXISTS trg_asiento_inmutable ON sigd_tra.asiento_registro;
CREATE TRIGGER trg_asiento_inmutable
    BEFORE UPDATE OR DELETE ON sigd_tra.asiento_registro
    FOR EACH ROW EXECUTE FUNCTION sigd_tra.fn_rechazar_mutacion_asiento();

CREATE INDEX IF NOT EXISTS idx_asiento_registro_expediente ON sigd_tra.asiento_registro (expediente_id);
CREATE INDEX IF NOT EXISTS idx_asiento_registro_anulado ON sigd_tra.asiento_registro (anulado) WHERE anulado = TRUE;

-- -----------------------------------------------------------------------------
-- 5.7 tramite — instancia administrativa de tramitación
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_tra.tramite (
    tramite_id        UUID        NOT NULL DEFAULT gen_random_uuid()
                                CONSTRAINT pk_tra_tramite PRIMARY KEY,
    expediente_id     UUID        NOT NULL UNIQUE
                                REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    codigo_tramite    VARCHAR(30) NULL,
    asunto            VARCHAR(500) NOT NULL,
    estado            VARCHAR(30) NOT NULL DEFAULT 'REGISTRADO',
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en    TIMESTAMPTZ NULL,
    CONSTRAINT chk_tra_tramite_estado CHECK (estado IN (
        'REGISTRADO', 'EN_TRAMITE', 'OBSERVADO', 'CERRADO', 'ANULADO', 'REABIERTO'
    ))
);

CREATE INDEX IF NOT EXISTS idx_tra_tramite_estado ON sigd_tra.tramite (estado);
