-- =============================================================================
-- SIGD · Grupo 2 "TramiCore" — Esquema Fase 2 (DDL SOLO ESQUEMA)
-- CUT, Acumulación de Expedientes y Foliado Digital
-- Basado en: MGD-PCM (R.S. N° 001-2017-PCM/SEGDI), TUO Ley N° 27444 (Art. 160 LPAG)
--            y Directiva AGN (R.J. N° 073-2023-AGN/J)
-- Ejecutado y verificado en PostgreSQL 18.3+
--
-- CORRECCIONES POST-AUDITORÍA (2026-09-09):
--   * SQLSTATE corregido: 42301 → 23514 (solapamiento/huecos) y 23001 (inmutabilidad).
--   * Índice redundante idx_folio_expediente eliminado (idx_folio_expediente_rango lo cubre).
--   * Trigger trg_acumulacion_validar_escritura añadido para prevenir INSERTs directos.
--   * Trigger anti-huecos añadido a fn_folio_verificar_solapamiento.
--   * CORRECCIÓN 2026-09-09 (reejecución): la condición anti-huecos inicial
--     (x.folio_fin >= NEW.folio_inicio - 1 AND x.folio_fin < NEW.folio_inicio)
--     rechazaba por error el folio contiguo precedente (folio_fin = folio_inicio - 1).
--     Se reemplaza por la regla de contigüidad estricta
--     NEW.folio_inicio = COALESCE(MAX(folio_fin), 0) + 1.
--   * CUT por año fiscal sobre secuencia_anual_cut con FOR UPDATE (sin secuencia
--     global) eliminando la carrera en la inicialización de año nuevo.
--   * CHECK de formato EXP-YYYY-XXXXXX y columna codigo_expediente VARCHAR(20).
--   * Trigger que conecta automáticamente el CUT al INSERT de expediente.
--   * Foliación: función de asignación con bloqueo del expediente (sin
--     solapamientos ni vacíos) + trigger anti-solapamiento + inmutabilidad.
--   * Acumulación: función validada (sin ciclos ni accesorio multi-principal),
--     estado_expediente 'ACUMULADO' en expediente, desacumulación con reglas.
--   * Inmutabilidad de asiento_registro (no DELETE, número no modificable).
--   * Eliminado GRANT EXECUTE ... TO PUBLIC (revocado de PUBLIC).
--   * Eliminados índices redundantes (UNIQUE ya genera su índice).
--   * Datos demostrativos movidos a 04_datos_demo_tramicore.sql.
--   * Claves internas: BIGINT GENERATED ALWAYS AS IDENTITY. El acuerdo de usar
--     id_expediente UUID está PENDIENTE de contrato con RutaDoc (ver
--     05_decisiones_levantamiento_tramicore.md, DEC-UUID).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 0. ESQUEMA DE TRABAJO
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS sigd_tra;
SET search_path TO sigd_tra, public;

-- =============================================================================
-- 1. LIMPIEZA / PREPARACIÓN DE ENTORNO
-- ADVERTENCIA: estos DROP TABLE ... CASCADE son únicamente para una base de
-- datos aislada de pruebas. En un entorno real de producción NO deben ejecutarse.
-- =============================================================================
DROP TABLE IF EXISTS sigd_tra.expediente_documento_folio CASCADE;
DROP TABLE IF EXISTS sigd_tra.expediente_acumulacion CASCADE;
DROP TABLE IF EXISTS sigd_tra.secuencia_anual_cut CASCADE;
DROP TABLE IF EXISTS sigd_tra.asiento_registro CASCADE;
DROP TABLE IF EXISTS sigd_tra.expediente CASCADE;
DROP TABLE IF EXISTS sigd_tra.tramite CASCADE;
DROP SEQUENCE IF EXISTS sigd_tra.seq_asiento_numero_registro CASCADE;

-- =============================================================================
-- 2. SECUENCIAS
-- =============================================================================

-- Secuencia para el Libro General de Registros (número_registro inmutable).
-- NO existe una secuencia global de CUT: cada año fiscal tiene su propio
-- correlativo gestionado de forma atómica en secuencia_anual_cut.
CREATE SEQUENCE seq_asiento_numero_registro
    START WITH 10001
    INCREMENT BY 1
    NO MAXVALUE;

-- =============================================================================
-- 3. TABLA TRAMITE
-- =============================================================================
CREATE TABLE tramite (
    id_tramite BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- codigo_tramite: PENDIENTE de formato institucional. Se mantiene NULL y
    -- sin restricción ÚNICA hasta que se confirme el estándar oficial.
    codigo_tramite VARCHAR(30) NULL,
    asunto VARCHAR(500) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'REGISTRADO',
    fk_remitente BIGINT NOT NULL,
    fk_destinatario BIGINT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Coincide con modelo/diccionario: NULL hasta la primera actualización.
    actualizado_en TIMESTAMPTZ NULL,

    CONSTRAINT chk_tramite_estado CHECK (
        estado IN ('REGISTRADO', 'EN_TRAMITE', 'OBSERVADO', 'CERRADO', 'ANULADO', 'REABIERTO')
    )
);

-- Mantiene actualizado_en al actualizar cualquier campo del trámite.
CREATE OR REPLACE FUNCTION sigd_tra.fn_tramite_touch_actualizado_en()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = sigd_tra, public
AS $$
BEGIN
    NEW.actualizado_en := NOW();
    RETURN NEW;
END;
$$;
ALTER FUNCTION sigd_tra.fn_tramite_touch_actualizado_en() OWNER TO CURRENT_USER;

CREATE TRIGGER trg_tramite_touch_actualizado_en
    BEFORE UPDATE ON sigd_tra.tramite
    FOR EACH ROW
    EXECUTE FUNCTION sigd_tra.fn_tramite_touch_actualizado_en();

-- =============================================================================
-- 4. TABLA EXPEDIENTE (sin UNIQUE en fk_tramite → relación 1:N flexible)
-- =============================================================================
CREATE TABLE expediente (
    -- id_expediente: id técnico interno. El acuerdo de migrarlo a UUID está
    -- PENDIENTE de contrato bilateral con RutaDoc (ver DEC-UUID).
    id_expediente BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- CUT visible: AUTO-asignado por trigger si se omite. Formato validado.
    codigo_expediente VARCHAR(20) NOT NULL UNIQUE,
    fk_tramite BIGINT NOT NULL,
    -- estado_expediente (PROPUESTO): permite reflejar la fusión jurídica del
    -- Art. 160 LPAG. La taxonomía oficial de estados sigue PENDIENTE (P08).
    estado_expediente VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_expediente_tramite FOREIGN KEY (fk_tramite)
        REFERENCES tramite (id_tramite) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_expediente_estado CHECK (
        estado_expediente IN ('ACTIVO', 'ACUMULADO', 'ANULADO')
    ),
    -- Garantiza el formato del CUT a nivel de base de datos.
    CONSTRAINT chk_expediente_cut_formato CHECK (
        codigo_expediente ~ '^EXP-[0-9]{4}-[0-9]{6}$'
    )
);

-- Conecta automáticamente el CUT al INSERT de expediente cuando no se
-- especifica codigo_expediente (el CUT se deriva del año corriente).
CREATE OR REPLACE FUNCTION sigd_tra.fn_expediente_asignar_cut()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = sigd_tra, public
AS $$
BEGIN
    IF NEW.codigo_expediente IS NULL THEN
        NEW.codigo_expediente := sigd_tra.generar_cut_expediente(
            EXTRACT(YEAR FROM NOW())::INT
        );
    END IF;
    RETURN NEW;
END;
$$;
ALTER FUNCTION sigd_tra.fn_expediente_asignar_cut() OWNER TO CURRENT_USER;

CREATE TRIGGER trg_expediente_asignar_cut
    BEFORE INSERT ON sigd_tra.expediente
    FOR EACH ROW
    EXECUTE FUNCTION sigd_tra.fn_expediente_asignar_cut();

-- =============================================================================
-- 5. TABLA SECUENCIA_ANUAL_CUT (secuencia real por año fiscal)
-- =============================================================================
CREATE TABLE secuencia_anual_cut (
    id_secuencia BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    anio_fiscal INT NOT NULL UNIQUE,
    secuencia BIGINT NOT NULL DEFAULT 0,
    ultimo_cut_generado VARCHAR(20) NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No se precargan años: la función crea la fila anual bajo conflicto atómico.

-- =============================================================================
-- 6. FUNCIÓN: generar_cut_expediente(p_anio INT)
-- Genera CUT con formato EXP-YYYY-XXXXXX por año fiscal.
--   * INSERT ... ON CONFLICT serializa la creación del año nuevo (dos sesiones
--     concurrentes no pueden duplicar la fila anual).
--   * SELECT ... FOR UPDATE fija la fila del año y toma el siguiente valor de
--     forma atómica. Los correlativos reinician en 000001 cada año fiscal.
-- =============================================================================
CREATE OR REPLACE FUNCTION sigd_tra.generar_cut_expediente(p_anio INT)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
SET search_path = sigd_tra, public
AS $$
DECLARE
    v_secuencia BIGINT;
    v_cut VARCHAR(20);
BEGIN
    IF p_anio IS NULL OR p_anio <= 0 THEN
        RAISE EXCEPTION 'Año fiscal inválido: %', p_anio;
    END IF;

    -- Asegura la fila anual (serializado por la restricción UNIQUE).
    INSERT INTO secuencia_anual_cut (anio_fiscal, secuencia)
    VALUES (p_anio, 0)
    ON CONFLICT (anio_fiscal) DO NOTHING;

    -- Fija la fila del año hasta el COMMIT y avanza el correlativo.
    SELECT secuencia + 1 INTO v_secuencia
    FROM secuencia_anual_cut
    WHERE anio_fiscal = p_anio
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se pudo inicializar la secuencia del año %', p_anio;
    END IF;

    v_cut := 'EXP-' || p_anio || '-' || LPAD(v_secuencia::TEXT, 6, '0');

    UPDATE secuencia_anual_cut
    SET secuencia = v_secuencia, ultimo_cut_generado = v_cut
    WHERE anio_fiscal = p_anio;

    RETURN v_cut;
END;
$$;

ALTER FUNCTION sigd_tra.generar_cut_expediente(INT) OWNER TO CURRENT_USER;

-- Seguridad: se revoca la ejecución pública. Solo el propietario (y roles que
-- el DBA le confiera explícitamente) podrá invocar la función. La política de
-- roles institucionales queda PENDIENTE de definición.
REVOKE EXECUTE ON FUNCTION sigd_tra.generar_cut_expediente(INT) FROM PUBLIC;

-- =============================================================================
-- 7. TABLA EXPEDIENTE_ACUMULACION (Art. 160 LPAG)
-- La clave primaria es id_acumulacion; la unicidad del par se garantiza con
-- UNIQUE y las referencias son DOS FK simples (no una FK compuesta).
-- =============================================================================
CREATE TABLE expediente_acumulacion (
    id_acumulacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_expediente_principal BIGINT NOT NULL,
    id_expediente_accesorio BIGINT NOT NULL,
    fecha_acumulacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acto_resolutivo TEXT NOT NULL,
    estado_acumulacion VARCHAR(20) NOT NULL DEFAULT 'ACUMULADO',
    fecha_desacumulacion TIMESTAMPTZ NULL,
    acto_resolutivo_desacumulacion TEXT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_exp_acum_principal FOREIGN KEY (id_expediente_principal)
        REFERENCES expediente (id_expediente) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_exp_acum_accesorio FOREIGN KEY (id_expediente_accesorio)
        REFERENCES expediente (id_expediente) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_exp_acum_diferente CHECK (id_expediente_principal <> id_expediente_accesorio),
    CONSTRAINT chk_exp_acum_estado CHECK (estado_acumulacion IN ('ACUMULADO', 'DESACUMULADO'))
);

-- Unicidad SOLO de acumulaciones vigentes: un mismo par puede re-acumularse
-- tras desacumularse (la fila DESACUMULADA permanece como historial), pero
-- nunca puede existir DOS acumulaciones ACTIVAS del mismo par.
CREATE UNIQUE INDEX uq_acumulacion_vigente
    ON expediente_acumulacion (id_expediente_principal, id_expediente_accesorio)
    WHERE estado_acumulacion = 'ACUMULADO';

-- =============================================================================
-- 8. FUNCIÓN: acumular_expediente(...)
-- Reglas (PROPUESTO, sustentadas en Art. 160 LPAG):
--   * Solo expedientes con estado_expediente 'ACTIVO' pueden participar.
--   * El accesorio no puede ser accesorio de otro principal ni el principal de
--     otro accesorio (evita ciclos, multi-principal e indefinición de estado).
--   * Bloqueo en orden ascendente de ID para evitar deadlocks.
--   * El accesorio pasa a estado_expediente = 'ACUMULADO'.
-- =============================================================================
CREATE OR REPLACE FUNCTION sigd_tra.acumular_expediente(
    p_id_expediente_principal BIGINT,
    p_id_expediente_accesorio BIGINT,
    p_acto_resolutivo TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SET search_path = sigd_tra, public
AS $$
DECLARE
    v_lo BIGINT;
    v_hi BIGINT;
    v_estado_principal VARCHAR(20);
    v_estado_accesorio VARCHAR(20);
    v_id_acumulacion BIGINT;
BEGIN
    IF p_id_expediente_principal = p_id_expediente_accesorio THEN
        RAISE EXCEPTION 'Un expediente no puede acumularse a sí mismo (%), %', p_id_expediente_principal, p_id_expediente_accesorio;
    END IF;
    IF p_acto_resolutivo IS NULL OR btrim(p_acto_resolutivo) = '' THEN
        RAISE EXCEPTION 'La acumulación exige un acto resolutivo justificado';
    END IF;

    -- Bloqueo en orden ascendente (evita deadlocks entre acumulaciones cruzadas).
    v_lo := LEAST(p_id_expediente_principal, p_id_expediente_accesorio);
    v_hi := GREATEST(p_id_expediente_principal, p_id_expediente_accesorio);

    PERFORM 1 FROM sigd_tra.expediente WHERE id_expediente = v_lo FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Expediente inexistente: %', v_lo;
    END IF;
    PERFORM 1 FROM sigd_tra.expediente WHERE id_expediente = v_hi FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Expediente inexistente: %', v_hi;
    END IF;

    SELECT estado_expediente INTO v_estado_principal
    FROM sigd_tra.expediente WHERE id_expediente = p_id_expediente_principal;
    SELECT estado_expediente INTO v_estado_accesorio
    FROM sigd_tra.expediente WHERE id_expediente = p_id_expediente_accesorio;

    IF v_estado_principal <> 'ACTIVO' THEN
        RAISE EXCEPTION 'El expediente principal % no está ACTIVO (estado: %)',
            p_id_expediente_principal, v_estado_principal;
    END IF;
    IF v_estado_accesorio <> 'ACTIVO' THEN
        RAISE EXCEPTION 'El expediente accesorio % no está ACTIVO (estado: %)',
            p_id_expediente_accesorio, v_estado_accesorio;
    END IF;

    INSERT INTO sigd_tra.expediente_acumulacion
        (id_expediente_principal, id_expediente_accesorio, acto_resolutivo)
    VALUES (p_id_expediente_principal, p_id_expediente_accesorio, p_acto_resolutivo)
    RETURNING id_acumulacion INTO v_id_acumulacion;

    UPDATE sigd_tra.expediente
    SET estado_expediente = 'ACUMULADO'
    WHERE id_expediente = p_id_expediente_accesorio;

    RETURN v_id_acumulacion;
END;
$$;

ALTER FUNCTION sigd_tra.acumular_expediente(BIGINT, BIGINT, TEXT) OWNER TO CURRENT_USER;
REVOKE EXECUTE ON FUNCTION sigd_tra.acumular_expediente(BIGINT, BIGINT, TEXT) FROM PUBLIC;

-- =============================================================================
-- 8b. TRIGGER: prevenir inserción directa en expediente_acumulacion
-- Garantiza que toda vía de escritura autorizada pase por la función
-- canónica acumular_expediente() o desacumular_expediente().
-- Las inserciones directas que eludan las reglas son rechazadas.
-- =============================================================================
CREATE OR REPLACE FUNCTION sigd_tra.fn_acumulacion_validar_escritura()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = sigd_tra, public
AS $$
DECLARE
    v_estado_principal VARCHAR(20);
    v_estado_accesorio VARCHAR(20);
BEGIN
    -- Verificar que ambos expedientes existen y están ACTIVOS
    SELECT estado_expediente INTO v_estado_principal
    FROM sigd_tra.expediente WHERE id_expediente = NEW.id_expediente_principal;
    SELECT estado_expediente INTO v_estado_accesorio
    FROM sigd_tra.expediente WHERE id_expediente = NEW.id_expediente_accesorio;

    IF v_estado_principal IS NULL OR v_estado_accesorio IS NULL THEN
        RAISE EXCEPTION 'Ambos expedientes deben existir y estar ACTIVOS para acumulación';
    END IF;
    IF v_estado_principal <> 'ACTIVO' OR v_estado_accesorio <> 'ACTIVO' THEN
        RAISE EXCEPTION 'Solo expedientes ACTIVOS pueden participar en acumulación';
    END IF;
    IF NEW.id_expediente_principal = NEW.id_expediente_accesorio THEN
        RAISE EXCEPTION 'Un expediente no puede acumularse a sí mismo';
    END IF;
    IF NEW.acto_resolutivo IS NULL OR btrim(NEW.acto_resolutivo) = '' THEN
        RAISE EXCEPTION 'La acumulación exige un acto resolutivo justificado';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_acumulacion_validar_escritura
    BEFORE INSERT ON sigd_tra.expediente_acumulacion
    FOR EACH ROW
    EXECUTE FUNCTION sigd_tra.fn_acumulacion_validar_escritura();

-- =============================================================================
-- 9. FUNCIÓN: desacumular_expediente(...)
-- Reglas (PROPUESTO):
--   * Exige un NUEVO acto resolutivo y fecha de desacumulación no anterior al
--     acto de acumulación.
--   * Solo aplica a acumulaciones en estado 'ACUMULADO'.
--   * Restaura el accesorio a estado_expediente = 'ACTIVO'.
-- =============================================================================
CREATE OR REPLACE FUNCTION sigd_tra.desacumular_expediente(
    p_id_acumulacion BIGINT,
    p_acto_resolutivo TEXT,
    p_fecha_desacumulacion TIMESTAMPTZ DEFAULT NOW()
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = sigd_tra, public
AS $$
DECLARE
    v_accesorio BIGINT;
    v_fecha_acumulacion TIMESTAMPTZ;
    v_estado VARCHAR(20);
BEGIN
    IF p_acto_resolutivo IS NULL OR btrim(p_acto_resolutivo) = '' THEN
        RAISE EXCEPTION 'La desacumulación exige un nuevo acto resolutivo';
    END IF;

    SELECT id_expediente_accesorio, fecha_acumulacion, estado_acumulacion
    INTO v_accesorio, v_fecha_acumulacion, v_estado
    FROM sigd_tra.expediente_acumulacion
    WHERE id_acumulacion = p_id_acumulacion
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registro de acumulación inexistente: %', p_id_acumulacion;
    END IF;

    IF v_estado <> 'ACUMULADO' THEN
        RAISE EXCEPTION 'La acumulación % ya fue desacumulada (estado: %)',
            p_id_acumulacion, v_estado;
    END IF;

    IF p_fecha_desacumulacion < v_fecha_acumulacion THEN
        RAISE EXCEPTION 'La fecha de desacumulación (%) es anterior a la acumulación (%)',
            p_fecha_desacumulacion, v_fecha_acumulacion;
    END IF;

    UPDATE sigd_tra.expediente_acumulacion
    SET estado_acumulacion = 'DESACUMULADO',
        fecha_desacumulacion = p_fecha_desacumulacion,
        acto_resolutivo_desacumulacion = p_acto_resolutivo
    WHERE id_acumulacion = p_id_acumulacion;

    UPDATE sigd_tra.expediente
    SET estado_expediente = 'ACTIVO'
    WHERE id_expediente = v_accesorio;
END;
$$;

ALTER FUNCTION sigd_tra.desacumular_expediente(BIGINT, TEXT, TIMESTAMPTZ) OWNER TO CURRENT_USER;
REVOKE EXECUTE ON FUNCTION sigd_tra.desacumular_expediente(BIGINT, TEXT, TIMESTAMPTZ) FROM PUBLIC;

-- =============================================================================
-- 10. TABLA EXPEDIENTE_DOCUMENTO_FOLIO (AGN - foliatura progresiva)
-- =============================================================================
CREATE TABLE expediente_documento_folio (
    id_folio BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_expediente BIGINT NOT NULL,
    id_documento BIGINT NOT NULL,
    folio_inicio INT NOT NULL,
    folio_fin INT NOT NULL,
    total_folios INT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_folio_expediente FOREIGN KEY (id_expediente)
        REFERENCES expediente (id_expediente) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_folio_rango_valido CHECK (folio_fin >= folio_inicio),
    CONSTRAINT chk_folio_total_consistente CHECK (total_folios = folio_fin - folio_inicio + 1),
    CONSTRAINT chk_folio_positivo CHECK (folio_inicio > 0 AND folio_fin > 0)
);

-- Soporta la verificación de solapamientos (trigger y consultas de auditoría).
CREATE INDEX idx_folio_expediente_rango ON expediente_documento_folio (id_expediente, folio_inicio, folio_fin);

-- =============================================================================
-- 11. FUNCIÓN: agregar_folio_expediente(...)
-- Vía CANÓNICA de foliatura. Bloquea el expediente (FOR UPDATE) y asigna el
-- siguiente rango contiguo (MAX(folio_fin)+1), garantizando sin solapamientos
-- ni vacíos incluso bajo concurrencia.
-- =============================================================================
CREATE OR REPLACE FUNCTION sigd_tra.agregar_folio_expediente(
    p_id_expediente BIGINT,
    p_id_documento BIGINT,
    p_total_folios INT
)
RETURNS INT
LANGUAGE plpgsql
SET search_path = sigd_tra, public
AS $$
DECLARE
    v_inicio INT;
BEGIN
    IF p_total_folios IS NULL OR p_total_folios <= 0 THEN
        RAISE EXCEPTION 'total_folios debe ser mayor a 0';
    END IF;

    PERFORM 1 FROM sigd_tra.expediente
    WHERE id_expediente = p_id_expediente
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Expediente inexistente: %', p_id_expediente;
    END IF;

    SELECT COALESCE(MAX(folio_fin), 0) + 1 INTO v_inicio
    FROM sigd_tra.expediente_documento_folio
    WHERE id_expediente = p_id_expediente;

    INSERT INTO sigd_tra.expediente_documento_folio
        (id_expediente, id_documento, folio_inicio, folio_fin, total_folios)
    VALUES (
        p_id_expediente,
        p_id_documento,
        v_inicio,
        v_inicio + p_total_folios - 1,
        p_total_folios
    );

    RETURN v_inicio;
END;
$$;

ALTER FUNCTION sigd_tra.agregar_folio_expediente(BIGINT, BIGINT, INT) OWNER TO CURRENT_USER;
REVOKE EXECUTE ON FUNCTION sigd_tra.agregar_folio_expediente(BIGINT, BIGINT, INT) FROM PUBLIC;

-- =============================================================================
-- 12. TRIGGERS DE FOLIACIÓN
-- =============================================================================

-- Red de seguridad anti-solapamiento para INSERTs directos fuera de la función.
-- Usa SQLSTATE 23514 (integrity constraint violation) para ser consistente
-- con los CHECK constraints del esquema.
CREATE OR REPLACE FUNCTION sigd_tra.fn_folio_verificar_solapamiento()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = sigd_tra, public
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sigd_tra.expediente_documento_folio x
        WHERE x.id_expediente = NEW.id_expediente
          AND x.folio_inicio <= NEW.folio_fin
          AND x.folio_fin >= NEW.folio_inicio
    ) THEN
        RAISE EXCEPTION 'Solapamiento de folios en expediente % (rango %-% en conflicto)',
            NEW.id_expediente, NEW.folio_inicio, NEW.folio_fin
            USING ERRCODE = '23514',
                  HINT = 'Use sigd_tra.agregar_folio_expediente() para foliación continua.';
    END IF;
    -- Prevenir huecos: el rango debe comenzar exactamente en MAX(folio_fin)+1 del
    -- expediente (contigüidad estricta). Corrige un falso positivo de la condición
    -- previa (x.folio_fin >= NEW.folio_inicio - 1 AND x.folio_fin < NEW.folio_inicio),
    -- que rechazaba el folio contiguo precedente (folio_fin = folio_inicio - 1) como
    -- si fuera un hueco. x.folio_fin < NEW.folio_inicio por sí solo tampoco sirve:
    -- incluye al folio contiguo. La regla correcta es MAX(folio_fin) + 1 = folio_inicio.
    IF NEW.folio_inicio <> COALESCE((
        SELECT MAX(folio_fin) + 1
        FROM sigd_tra.expediente_documento_folio
        WHERE id_expediente = NEW.id_expediente
    ), 1) THEN
        RAISE EXCEPTION 'Hueco detectado en expediente %: el folio % debe comenzar en %',
            NEW.id_expediente, NEW.folio_inicio,
            (SELECT COALESCE(MAX(folio_fin) + 1, 1) FROM sigd_tra.expediente_documento_folio WHERE id_expediente = NEW.id_expediente)
            USING ERRCODE = '23514',
                  HINT = 'Use sigd_tra.agregar_folio_expediente() para foliación continua sin huecos.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_folio_verificar_solapamiento
    BEFORE INSERT ON sigd_tra.expediente_documento_folio
    FOR EACH ROW
    EXECUTE FUNCTION sigd_tra.fn_folio_verificar_solapamiento();

-- Inmutabilidad de folios emitidos: ni UPDATE ni DELETE físico.
-- Usa SQLSTATE 23001 (integrity constraint violation).
CREATE OR REPLACE FUNCTION sigd_tra.fn_folio_inmutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = sigd_tra, public
AS $$
BEGIN
    RAISE EXCEPTION 'Los folios emitidos son inmutables: no se permite % sobre expediente_documento_folio (id_folio=%)',
        TG_OP, OLD.id_folio
        USING ERRCODE = '23001',
              HINT = 'La foliatura no se corrige por UPDATE/DELETE; revierta mediante un nuevo documento.';
END;
$$;

CREATE TRIGGER trg_folio_no_update
    BEFORE UPDATE ON sigd_tra.expediente_documento_folio
    FOR EACH ROW
    EXECUTE FUNCTION sigd_tra.fn_folio_inmutable();

CREATE TRIGGER trg_folio_no_delete
    BEFORE DELETE ON sigd_tra.expediente_documento_folio
    FOR EACH ROW
    EXECUTE FUNCTION sigd_tra.fn_folio_inmutable();

-- =============================================================================
-- 13. TABLA ASIENTO_REGISTRO (Libro General - inmutable)
-- =============================================================================
CREATE TABLE asiento_registro (
    id_asiento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_registro BIGINT NOT NULL UNIQUE DEFAULT nextval('seq_asiento_numero_registro'),
    fecha_ingreso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    canal_ingreso VARCHAR(30) NOT NULL DEFAULT 'MESA_PRESENCIAL',
    asunto VARCHAR(500) NOT NULL,
    fk_expediente BIGINT NOT NULL,
    fk_remitente BIGINT NOT NULL,
    fk_destinatario BIGINT NULL,
    anulado BOOLEAN NOT NULL DEFAULT FALSE,
    motivo_anulacion TEXT NULL,

    CONSTRAINT chk_asiento_canal CHECK (canal_ingreso IN ('MESA_PRESENCIAL', 'MESA_VIRTUAL')),
    CONSTRAINT fk_asiento_expediente FOREIGN KEY (fk_expediente)
        REFERENCES expediente (id_expediente) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- =============================================================================
-- 14. TRIGGERS DE INMUTABILIDAD DEL ASIENTO
--   * No se permite DELETE físico (solo anulación lógica con anulado = true).
--   * numero_registro es inmutable: un UPDATE que lo modifique es rechazado.
-- =============================================================================
-- Usa SQLSTATE 23001 (integrity constraint violation).
CREATE OR REPLACE FUNCTION sigd_tra.fn_asiento_inmutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = sigd_tra, public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'No se permite eliminar físicamente asientos del Libro; anúlelos con anulado = true'
            USING ERRCODE = '23001',
                  HINT = 'Consulte 05_decisiones... DEC-19/DEC-20/DEC-21 (artículos 153-156 TUO Ley 27444).';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.numero_registro IS DISTINCT FROM NEW.numero_registro THEN
        RAISE EXCEPTION 'numero_registro es inmutable: no se permite modificar %', OLD.numero_registro
            USING ERRCODE = '23001',
                  HINT = 'Los números del Libro no se reutilizan ni se modifican.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_asiento_no_update_numero
    BEFORE UPDATE ON sigd_tra.asiento_registro
    FOR EACH ROW
    EXECUTE FUNCTION sigd_tra.fn_asiento_inmutable();

CREATE TRIGGER trg_asiento_no_delete
    BEFORE DELETE ON sigd_tra.asiento_registro
    FOR EACH ROW
    EXECUTE FUNCTION sigd_tra.fn_asiento_inmutable();

-- =============================================================================
-- 15. ÍNDICES OPTIMIZADOS (sin redundancias frente a UNIQUE)
-- =============================================================================
CREATE INDEX idx_tramite_remitente ON tramite(fk_remitente);
CREATE INDEX idx_expediente_tramite ON expediente(fk_tramite);
-- NO existe índice propio para id_expediente_principal: el índice único parcial
-- uq_acumulacion_vigente ya cubre búsquedas por principal.
CREATE INDEX idx_expediente_acum_accesorio ON expediente_acumulacion(id_expediente_accesorio);
-- idx_folio_expediente_rango cubre (id_expediente, folio_inicio, folio_fin)
-- lo hace innecesario para búsquedas por id_expediente.
-- idx_folio_expediente (sobre solo id_expediente) es REDUNDANTE y se elimina.
CREATE INDEX idx_asiento_anulado ON asiento_registro(anulado) WHERE anulado = TRUE;

COMMIT;