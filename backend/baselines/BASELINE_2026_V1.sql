-- BASELINE_2026_V1: instalación nueva y optativa. No equivale a ejecutar 06/07.
-- UUID físico de sigd_tra.expediente; sin correspondencias BIGINT inferidas.
-- T-BE-RD-02 | RutaDoc | PostgreSQL 18
-- Fuente de los catálogos: rutadoc.fsm.ts, commit eba677c.
-- Este archivo se instala después de 01..05 cuando exista el runner general.
-- Los límites anuales son instantes UTC con extremo superior exclusivo.

CREATE SCHEMA IF NOT EXISTS sigd_rut;

CREATE TABLE IF NOT EXISTS sigd_rut.estado_tramite (
    codigo TEXT PRIMARY KEY,
    es_terminal BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS sigd_rut.accion_tramite (
    codigo TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS sigd_rut.transicion_estado_tramite (
    estado_anterior TEXT NOT NULL REFERENCES sigd_rut.estado_tramite (codigo),
    evento TEXT NOT NULL REFERENCES sigd_rut.accion_tramite (codigo),
    estado_nuevo TEXT NOT NULL REFERENCES sigd_rut.estado_tramite (codigo),
    CONSTRAINT ck_transicion_archivado_terminal CHECK (estado_anterior <> 'ARCHIVADO'),
    PRIMARY KEY (estado_anterior, evento),
    UNIQUE (estado_anterior, evento, estado_nuevo)
);

INSERT INTO sigd_rut.estado_tramite (codigo, es_terminal) VALUES
    ('REGISTRADO', FALSE),
    ('RECEPCIONADO', FALSE),
    ('EN_CALIFICACION', FALSE),
    ('DERIVADO', FALSE),
    ('EN_REVISION', FALSE),
    ('OBSERVADO', FALSE),
    ('SUBSANADO', FALSE),
    ('EN_FIRMA', FALSE),
    ('RESUELTO', FALSE),
    ('ARCHIVADO', TRUE)
ON CONFLICT (codigo) DO UPDATE SET es_terminal = EXCLUDED.es_terminal;

INSERT INTO sigd_rut.accion_tramite (codigo) VALUES
    ('RECEPCION'),
    ('INICIAR_CALIFICACION'),
    ('INICIAR_REVISION'),
    ('DERIVACION'),
    ('OBSERVACION'),
    ('CORRECCION'),
    ('ENVIAR_A_FIRMA'),
    ('FIRMA'),
    ('CIERRE')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO sigd_rut.transicion_estado_tramite
    (estado_anterior, evento, estado_nuevo) VALUES
    ('REGISTRADO', 'RECEPCION', 'RECEPCIONADO'),
    ('RECEPCIONADO', 'INICIAR_CALIFICACION', 'EN_CALIFICACION'),
    ('EN_CALIFICACION', 'INICIAR_REVISION', 'EN_REVISION'),
    ('EN_CALIFICACION', 'DERIVACION', 'DERIVADO'),
    ('EN_CALIFICACION', 'OBSERVACION', 'OBSERVADO'),
    ('DERIVADO', 'RECEPCION', 'EN_REVISION'),
    ('EN_REVISION', 'DERIVACION', 'DERIVADO'),
    ('EN_REVISION', 'OBSERVACION', 'OBSERVADO'),
    ('EN_REVISION', 'ENVIAR_A_FIRMA', 'EN_FIRMA'),
    ('OBSERVADO', 'CORRECCION', 'SUBSANADO'),
    ('SUBSANADO', 'INICIAR_REVISION', 'EN_REVISION'),
    ('EN_FIRMA', 'FIRMA', 'RESUELTO'),
    ('RESUELTO', 'CIERRE', 'ARCHIVADO')
ON CONFLICT (estado_anterior, evento) DO UPDATE
    SET estado_nuevo = EXCLUDED.estado_nuevo;

-- Una PK de tabla particionada debe incluir fecha_hora. La tabla guardiana no
-- particionada garantiza además id_movimiento y (expediente_id, secuencia)
-- globalmente, incluso si el expediente cruza años. La clave idempotente es
-- única por expediente cuando se suministra; NULL significa sin deduplicación.
CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_secuencia (
    expediente_id UUID PRIMARY KEY,
    ultima_secuencia BIGINT NOT NULL CHECK (ultima_secuencia > 0)
);

CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_identidad (
    id_movimiento UUID PRIMARY KEY,
    expediente_id UUID NOT NULL,
    secuencia BIGINT NOT NULL CHECK (secuencia > 0),
    fecha_hora TIMESTAMPTZ(3) NOT NULL,
    clave_idempotencia TEXT,
    UNIQUE (expediente_id, secuencia),
    UNIQUE (expediente_id, clave_idempotencia)
);

CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_tramite (
    id_movimiento UUID NOT NULL DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL,
    secuencia BIGINT NOT NULL,
    estado_anterior TEXT NOT NULL,
    evento TEXT NOT NULL,
    estado_nuevo TEXT NOT NULL,
    usuario_operador_id BIGINT NOT NULL,
    fecha_hora TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    correlation_id UUID,
    clave_idempotencia TEXT,
    datos JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT pk_movimiento_tramite PRIMARY KEY (fecha_hora, id_movimiento),
    CONSTRAINT ck_movimiento_secuencia CHECK (secuencia > 0),
    CONSTRAINT ck_movimiento_datos_objeto CHECK (jsonb_typeof(datos) = 'object'),
    CONSTRAINT fk_movimiento_estado_anterior FOREIGN KEY (estado_anterior)
        REFERENCES sigd_rut.estado_tramite (codigo),
    CONSTRAINT fk_movimiento_evento FOREIGN KEY (evento)
        REFERENCES sigd_rut.accion_tramite (codigo),
    CONSTRAINT fk_movimiento_estado_nuevo FOREIGN KEY (estado_nuevo)
        REFERENCES sigd_rut.estado_tramite (codigo),
    CONSTRAINT fk_movimiento_transicion FOREIGN KEY (estado_anterior, evento, estado_nuevo)
        REFERENCES sigd_rut.transicion_estado_tramite
            (estado_anterior, evento, estado_nuevo)
) PARTITION BY RANGE (fecha_hora);

CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_tramite_2026
    PARTITION OF sigd_rut.movimiento_tramite
    FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_tramite_2027
    PARTITION OF sigd_rut.movimiento_tramite
    FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2028-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_tramite_default
    PARTITION OF sigd_rut.movimiento_tramite DEFAULT;

-- El UPSERT del contador serializa a los escritores del mismo expediente
-- mediante bloqueo de fila ordinario, sin advisory lock. No se acepta una
-- secuencia suministrada por el cliente: la base asigna la siguiente.
CREATE OR REPLACE FUNCTION sigd_rut.registrar_movimiento_identidad()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, sigd_rut AS $func$
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
$func$;

DO $trigger$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_trigger
        WHERE tgrelid = 'sigd_rut.movimiento_tramite'::regclass
          AND tgname = 'tr_registrar_movimiento_identidad'
          AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER tr_registrar_movimiento_identidad
            BEFORE INSERT ON sigd_rut.movimiento_tramite
            FOR EACH ROW EXECUTE FUNCTION sigd_rut.registrar_movimiento_identidad();
    END IF;
END;
$trigger$;

-- Índices B-Tree heredados por las tres particiones.
CREATE INDEX IF NOT EXISTS ix_movimiento_expediente_fecha
    ON sigd_rut.movimiento_tramite (expediente_id, fecha_hora DESC, id_movimiento DESC);
CREATE INDEX IF NOT EXISTS ix_movimiento_fecha_id
    ON sigd_rut.movimiento_tramite (fecha_hora DESC, id_movimiento DESC);
CREATE INDEX IF NOT EXISTS ix_movimiento_estado_fecha
    ON sigd_rut.movimiento_tramite (estado_nuevo, fecha_hora DESC, id_movimiento DESC);
CREATE INDEX IF NOT EXISTS ix_movimiento_expediente_secuencia
    ON sigd_rut.movimiento_tramite (expediente_id, secuencia DESC);

COMMENT ON TABLE sigd_rut.movimiento_tramite IS
    'Historial RutaDoc particionado por año UTC; PK física (fecha_hora,id_movimiento).';
COMMENT ON TABLE sigd_rut.movimiento_identidad IS
    'Reserva transaccional no particionada: identidad, secuencia e idempotencia globales.';
COMMENT ON COLUMN sigd_rut.movimiento_tramite.expediente_id IS
    'UUID canónico de sigd_tra.expediente, con FK física en este baseline.';
COMMENT ON COLUMN sigd_rut.movimiento_tramite.usuario_operador_id IS
    'Identificador externo BIGINT del operador; sin FK física intermodular.';
COMMENT ON COLUMN sigd_rut.movimiento_tramite.clave_idempotencia IS
    'Única por expediente si no es NULL; el reintento devuelve 23505 hasta que un servicio resuelva la clave.';
COMMENT ON COLUMN sigd_rut.movimiento_tramite.fecha_hora IS
    'Instante timestamptz(3); años físicos delimitados en UTC con extremo superior exclusivo.';

-- RD-04: una reversión no es una arista de la FSM ordinaria. Mantener las 13
-- transiciones y su FK intactas exige un historial compensatorio separado.
-- Comparte con movimiento_tramite la tabla guardiana, la secuencia por expediente
-- y el trigger de reserva transaccional; nunca actualiza la actuación original.
CREATE TABLE IF NOT EXISTS sigd_rut.accion_compensatoria (
    codigo TEXT PRIMARY KEY,
    CONSTRAINT ck_accion_compensatoria_codigo
        CHECK (codigo = 'REVERSION_ADMINISTRATIVA')
);
INSERT INTO sigd_rut.accion_compensatoria (codigo)
    VALUES ('REVERSION_ADMINISTRATIVA')
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_compensatorio (
    id_movimiento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL,
    secuencia BIGINT NOT NULL CHECK (secuencia > 0),
    evento TEXT NOT NULL DEFAULT 'REVERSION_ADMINISTRATIVA'
        REFERENCES sigd_rut.accion_compensatoria (codigo),
    estado_anterior TEXT NOT NULL REFERENCES sigd_rut.estado_tramite (codigo),
    estado_nuevo TEXT NOT NULL REFERENCES sigd_rut.estado_tramite (codigo),
    usuario_operador_id BIGINT NOT NULL,
    fecha_hora TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    correlation_id TEXT NOT NULL,
    clave_idempotencia TEXT NOT NULL,
    movimiento_objetivo_fecha_hora TIMESTAMPTZ(3) NOT NULL,
    movimiento_objetivo_id UUID NOT NULL,
    movimiento_objetivo_secuencia BIGINT NOT NULL CHECK (movimiento_objetivo_secuencia > 0),
    huella_comando TEXT NOT NULL,
    motivo TEXT NOT NULL CHECK (char_length(motivo) BETWEEN 10 AND 1000),
    compensacion_folios JSONB NOT NULL CHECK (jsonb_typeof(compensacion_folios) = 'object'),
    datos JSONB NOT NULL CHECK (jsonb_typeof(datos) = 'object'),
    CONSTRAINT ck_movimiento_compensatorio_evento
        CHECK (evento = 'REVERSION_ADMINISTRATIVA'),
    CONSTRAINT fk_compensacion_movimiento_objetivo
        FOREIGN KEY (movimiento_objetivo_fecha_hora, movimiento_objetivo_id)
        REFERENCES sigd_rut.movimiento_tramite (fecha_hora, id_movimiento),
    CONSTRAINT uq_compensacion_objetivo
        UNIQUE (movimiento_objetivo_fecha_hora, movimiento_objetivo_id),
    CONSTRAINT uq_compensacion_idempotencia
        UNIQUE (expediente_id, clave_idempotencia)
);
CREATE INDEX IF NOT EXISTS ix_compensacion_expediente_secuencia
    ON sigd_rut.movimiento_compensatorio (expediente_id, secuencia DESC);

DO $compensacion_trigger$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_trigger
        WHERE tgrelid = 'sigd_rut.movimiento_compensatorio'::regclass
          AND tgname = 'tr_registrar_compensacion_identidad' AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER tr_registrar_compensacion_identidad
            BEFORE INSERT ON sigd_rut.movimiento_compensatorio
            FOR EACH ROW EXECUTE FUNCTION sigd_rut.registrar_movimiento_identidad();
    END IF;
END;
$compensacion_trigger$;

-- Defensa propia del asiento compensatorio; no instala el WORM de otras tareas
-- sobre movimiento_tramite ni sobre tablas de otros módulos.
CREATE OR REPLACE FUNCTION sigd_rut.rechazar_mutacion_compensatoria()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog AS $func$
BEGIN
    RAISE EXCEPTION 'El asiento compensatorio es inmutable'
        USING ERRCODE = '23001';
END;
$func$;
DO $inmutabilidad_compensacion$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_trigger
        WHERE tgrelid = 'sigd_rut.movimiento_compensatorio'::regclass
          AND tgname = 'tr_compensacion_inmutable' AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER tr_compensacion_inmutable
            BEFORE UPDATE OR DELETE ON sigd_rut.movimiento_compensatorio
            FOR EACH ROW EXECUTE FUNCTION sigd_rut.rechazar_mutacion_compensatoria();
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_trigger
        WHERE tgrelid = 'sigd_rut.movimiento_compensatorio'::regclass
          AND tgname = 'tr_compensacion_no_truncar' AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER tr_compensacion_no_truncar
            BEFORE TRUNCATE ON sigd_rut.movimiento_compensatorio
            FOR EACH STATEMENT EXECUTE FUNCTION sigd_rut.rechazar_mutacion_compensatoria();
    END IF;
END;
$inmutabilidad_compensacion$;

COMMENT ON TABLE sigd_rut.movimiento_compensatorio IS
    'Asiento compensatorio append-only, ajeno a las 13 transiciones FSM ordinarias.';
COMMENT ON COLUMN sigd_rut.movimiento_compensatorio.secuencia IS
    'Secuencia global por expediente reservada con el mismo trigger de RD-02.';

-- Solicitud local de integración con DocuCore. El asiento histórico permanece
-- inmutable; el estado mutable de entrega vive aquí. CoreLink puede recibir una
-- copia transaccional en su outbox si el esquema ya está instalado.
CREATE TABLE IF NOT EXISTS sigd_rut.solicitud_compensacion_folios (
    id_solicitud UUID PRIMARY KEY,
    expediente_id UUID NOT NULL,
    movimiento_original_id UUID NOT NULL,
    movimiento_compensatorio_id UUID NOT NULL UNIQUE
        REFERENCES sigd_rut.movimiento_compensatorio (id_movimiento),
    rango_afectado JSONB,
    motivo TEXT NOT NULL,
    actor_id BIGINT NOT NULL,
    correlation_id TEXT NOT NULL,
    clave_idempotencia UUID NOT NULL,
    estado TEXT NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'FALLIDO')),
    id_evento_outbox UUID,
    creado_en TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    actualizado_en TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE (expediente_id, clave_idempotencia),
    CHECK (rango_afectado IS NULL OR jsonb_typeof(rango_afectado) = 'object')
);
CREATE INDEX IF NOT EXISTS ix_solicitud_folios_estado_fecha
    ON sigd_rut.solicitud_compensacion_folios (estado, creado_en);

-- Proyección reconstruible para bandejas. La fuente histórica única permanece
-- en movimiento_tramite más sus asientos compensatorios; esta tabla guarda sólo
-- el último estado por expediente y se actualiza en la misma transacción.
CREATE TABLE IF NOT EXISTS sigd_rut.estado_actual_expediente (
    expediente_id UUID PRIMARY KEY,
    secuencia BIGINT NOT NULL CHECK (secuencia > 0),
    estado_nuevo TEXT NOT NULL REFERENCES sigd_rut.estado_tramite (codigo),
    evento TEXT NOT NULL,
    area_actual_id TEXT,
    id_movimiento UUID NOT NULL,
    fecha_hora TIMESTAMPTZ(3) NOT NULL,
    usuario_operador_id BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_estado_actual_estado_expediente
    ON sigd_rut.estado_actual_expediente (estado_nuevo, expediente_id);
CREATE INDEX IF NOT EXISTS ix_estado_actual_area_estado
    ON sigd_rut.estado_actual_expediente (area_actual_id, estado_nuevo, expediente_id);
CREATE INDEX IF NOT EXISTS ix_estado_actual_expediente_conteo
    ON sigd_rut.estado_actual_expediente (expediente_id)
    INCLUDE (estado_nuevo, area_actual_id);

-- Backfill idempotente para instalaciones que ya tengan historial.
INSERT INTO sigd_rut.estado_actual_expediente
    (expediente_id, secuencia, estado_nuevo, evento, area_actual_id,
     id_movimiento, fecha_hora, usuario_operador_id)
SELECT DISTINCT ON (expediente_id)
    expediente_id, secuencia, estado_nuevo, evento, datos->>'areaId',
    id_movimiento, fecha_hora, usuario_operador_id
FROM (
    SELECT expediente_id, secuencia, estado_nuevo, evento, datos,
           id_movimiento, fecha_hora, usuario_operador_id
      FROM sigd_rut.movimiento_tramite
    UNION ALL
    SELECT expediente_id, secuencia, estado_nuevo, evento, datos,
           id_movimiento, fecha_hora, usuario_operador_id
      FROM sigd_rut.movimiento_compensatorio
) historial
ORDER BY expediente_id, secuencia DESC
ON CONFLICT (expediente_id) DO UPDATE SET
    secuencia = EXCLUDED.secuencia,
    estado_nuevo = EXCLUDED.estado_nuevo,
    evento = EXCLUDED.evento,
    area_actual_id = EXCLUDED.area_actual_id,
    id_movimiento = EXCLUDED.id_movimiento,
    fecha_hora = EXCLUDED.fecha_hora,
    usuario_operador_id = EXCLUDED.usuario_operador_id
WHERE sigd_rut.estado_actual_expediente.secuencia < EXCLUDED.secuencia;

CREATE OR REPLACE FUNCTION sigd_rut.actualizar_estado_actual_expediente()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, sigd_rut AS $func$
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
$func$;

DO $proyeccion_triggers$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
        WHERE tgrelid = 'sigd_rut.movimiento_tramite'::regclass
          AND tgname = 'tr_estado_actual_movimiento' AND NOT tgisinternal) THEN
        CREATE TRIGGER tr_estado_actual_movimiento
            AFTER INSERT ON sigd_rut.movimiento_tramite
            FOR EACH ROW EXECUTE FUNCTION sigd_rut.actualizar_estado_actual_expediente();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
        WHERE tgrelid = 'sigd_rut.movimiento_compensatorio'::regclass
          AND tgname = 'tr_estado_actual_compensacion' AND NOT tgisinternal) THEN
        CREATE TRIGGER tr_estado_actual_compensacion
            AFTER INSERT ON sigd_rut.movimiento_compensatorio
            FOR EACH ROW EXECUTE FUNCTION sigd_rut.actualizar_estado_actual_expediente();
    END IF;
END;
$proyeccion_triggers$;

-- Seis contadores locales reconstruibles. Cuando existe sigd_tra.expediente,
-- incluyen también los expedientes sin movimiento como PENDIENTES.
CREATE TABLE IF NOT EXISTS sigd_rut.contador_pestana_local (
    pestana TEXT PRIMARY KEY CHECK (pestana IN
        ('PENDIENTES', 'EN_TRAMITE', 'DERIVADOS', 'POR_FIRMAR', 'ATENDIDOS', 'ARCHIVADOS')),
    cantidad BIGINT NOT NULL CHECK (cantidad >= 0)
);

CREATE OR REPLACE FUNCTION sigd_rut.pestana_de_estado(p_estado TEXT)
RETURNS TEXT LANGUAGE SQL IMMUTABLE STRICT SET search_path = pg_catalog AS $func$
    SELECT CASE
        WHEN p_estado IN ('REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION') THEN 'PENDIENTES'
        WHEN p_estado IN ('EN_REVISION', 'OBSERVADO', 'SUBSANADO') THEN 'EN_TRAMITE'
        WHEN p_estado = 'DERIVADO' THEN 'DERIVADOS'
        WHEN p_estado = 'EN_FIRMA' THEN 'POR_FIRMAR'
        WHEN p_estado = 'RESUELTO' THEN 'ATENDIDOS'
        WHEN p_estado = 'ARCHIVADO' THEN 'ARCHIVADOS'
    END
$func$;

-- La reconstrucción toma locks de tabla para no pisar escrituras concurrentes.
LOCK TABLE sigd_rut.estado_actual_expediente IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO sigd_rut.contador_pestana_local (pestana, cantidad) VALUES
    ('PENDIENTES', 0), ('EN_TRAMITE', 0), ('DERIVADOS', 0),
    ('POR_FIRMAR', 0), ('ATENDIDOS', 0), ('ARCHIVADOS', 0)
ON CONFLICT (pestana) DO NOTHING;
DO $reconstruir_contadores$
BEGIN
    IF to_regclass('sigd_tra.expediente') IS NOT NULL THEN
        EXECUTE 'LOCK TABLE sigd_tra.expediente IN SHARE ROW EXCLUSIVE MODE';
        WITH totales AS (
            SELECT sigd_rut.pestana_de_estado(
                COALESCE(p.estado_nuevo, 'REGISTRADO')) AS pestana,
                count(*) AS cantidad
              FROM sigd_tra.expediente e
              LEFT JOIN sigd_rut.estado_actual_expediente p
                ON p.expediente_id = e.expediente_id
             GROUP BY 1
        )
        UPDATE sigd_rut.contador_pestana_local c
           SET cantidad = COALESCE(t.cantidad, 0)
          FROM (SELECT c0.pestana, totales.cantidad
                  FROM sigd_rut.contador_pestana_local c0
                  LEFT JOIN totales ON totales.pestana = c0.pestana) t
         WHERE t.pestana = c.pestana;
    ELSE
        WITH totales AS (
            SELECT sigd_rut.pestana_de_estado(estado_nuevo) AS pestana,
                count(*) AS cantidad
              FROM sigd_rut.estado_actual_expediente GROUP BY 1
        )
        UPDATE sigd_rut.contador_pestana_local c
           SET cantidad = COALESCE(t.cantidad, 0)
          FROM (SELECT c0.pestana, totales.cantidad
                  FROM sigd_rut.contador_pestana_local c0
                  LEFT JOIN totales ON totales.pestana = c0.pestana) t
         WHERE t.pestana = c.pestana;
    END IF;
END;
$reconstruir_contadores$;

CREATE OR REPLACE FUNCTION sigd_rut.actualizar_contador_pestana_local()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, sigd_rut AS $func$
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
$func$;

DO $contador_trigger$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
        WHERE tgrelid = 'sigd_rut.estado_actual_expediente'::regclass
          AND tgname = 'tr_contador_pestana_local' AND NOT tgisinternal) THEN
        CREATE TRIGGER tr_contador_pestana_local
            AFTER INSERT OR UPDATE OR DELETE ON sigd_rut.estado_actual_expediente
            FOR EACH ROW EXECUTE FUNCTION sigd_rut.actualizar_contador_pestana_local();
    END IF;
END;
$contador_trigger$;

-- Adaptador síncrono del contrato externo: altas, bajas o cambios de ID del
-- expediente ajustan los contadores en su misma transacción. No toca sus datos.
CREATE OR REPLACE FUNCTION sigd_rut.actualizar_contador_expediente_externo()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, sigd_rut AS $func$
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
$func$;

DO $trigger_expediente_externo$
BEGIN
    IF to_regclass('sigd_tra.expediente') IS NOT NULL AND
       NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
          WHERE tgrelid = to_regclass('sigd_tra.expediente')
            AND tgname = 'tr_rutadoc_contador_expediente' AND NOT tgisinternal) THEN
        EXECUTE 'CREATE TRIGGER tr_rutadoc_contador_expediente
            AFTER INSERT OR UPDATE OR DELETE ON sigd_tra.expediente
            FOR EACH ROW EXECUTE FUNCTION sigd_rut.actualizar_contador_expediente_externo()';
    END IF;
END;
$trigger_expediente_externo$;

-- Contrato de índice de bandeja sobre TramiCore: lo crea la migración propia sólo
-- si la tabla canónica ya existe (01–05 antes del baseline).
DO $indice_expediente$
BEGIN
    IF to_regclass('sigd_tra.expediente') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS ix_rutadoc_expediente_fecha_id
            ON sigd_tra.expediente (fecha_radicacion DESC, expediente_id DESC);
    END IF;
END;
$indice_expediente$;


-- Identidad UUID única: ninguna equivalencia automática con BIGINT legado.
ALTER TABLE sigd_rut.movimiento_secuencia ADD CONSTRAINT fk_rut_secuencia_expediente
    FOREIGN KEY (expediente_id) REFERENCES sigd_tra.expediente (expediente_id);
ALTER TABLE sigd_rut.movimiento_identidad ADD CONSTRAINT fk_rut_identidad_expediente
    FOREIGN KEY (expediente_id) REFERENCES sigd_tra.expediente (expediente_id);
ALTER TABLE sigd_rut.movimiento_tramite ADD CONSTRAINT fk_rut_movimiento_expediente
    FOREIGN KEY (expediente_id) REFERENCES sigd_tra.expediente (expediente_id);
ALTER TABLE sigd_rut.movimiento_compensatorio ADD CONSTRAINT fk_rut_compensacion_expediente
    FOREIGN KEY (expediente_id) REFERENCES sigd_tra.expediente (expediente_id);
ALTER TABLE sigd_rut.solicitud_compensacion_folios ADD CONSTRAINT fk_rut_folios_expediente
    FOREIGN KEY (expediente_id) REFERENCES sigd_tra.expediente (expediente_id);
ALTER TABLE sigd_rut.estado_actual_expediente ADD CONSTRAINT fk_rut_estado_expediente
    FOREIGN KEY (expediente_id) REFERENCES sigd_tra.expediente (expediente_id);
-- Vistas MGD adaptadas al DDL físico 05 y a la proyección UUID.
CREATE OR REPLACE FUNCTION sigd_tra.fn_mgd_horas_habiles(
    p_desde     TIMESTAMPTZ,
    p_hasta     TIMESTAMPTZ,
    p_feriados  DATE[] DEFAULT ARRAY[]::DATE[]
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fn$
    -- Misma regla que horasHabilesEntre(): días UTC completos, menos fines de
    -- semana y feriados. No convertir horas calendario mediante un factor fijo.
    WITH ventanas AS (
        SELECT (g.d AT TIME ZONE 'UTC') AS apertura,
               ((g.d + INTERVAL '1 day') AT TIME ZONE 'UTC') AS cierre
          FROM generate_series(
                   date_trunc('day', p_desde AT TIME ZONE 'UTC'),
                   date_trunc('day', p_hasta AT TIME ZONE 'UTC'),
                   INTERVAL '1 day'
               ) AS g(d)
         WHERE p_desde IS NOT NULL AND p_hasta IS NOT NULL AND p_hasta > p_desde
           AND EXTRACT(ISODOW FROM g.d) <= 5
           AND to_char(g.d, 'MM-DD') NOT IN ('06-24', '10-13')
           AND NOT (g.d::date = ANY (COALESCE(p_feriados, ARRAY[]::DATE[])))
    )
    SELECT COALESCE(ROUND(SUM(
               GREATEST(0, EXTRACT(EPOCH FROM (
                   LEAST(v.cierre, p_hasta) - GREATEST(v.apertura, p_desde)
               )) / 3600.0)
           )::NUMERIC, 4), 0)
      FROM ventanas v;
$fn$;

COMMENT ON FUNCTION sigd_tra.fn_mgd_horas_habiles(TIMESTAMPTZ, TIMESTAMPTZ, DATE[]) IS
    'Horas de días hábiles completos UTC, fórmula actual de kpi.service.ts; no certifica jornada institucional.';

-- -----------------------------------------------------------------------------
-- 2. FUNCIÓN: sigd_tra.fn_mgd_dias_habiles_entre(p_desde, p_hasta, p_feriados)
--
-- Días hábiles de permanencia. Reproduce exactamente la regla de `calcularSla`
-- en `src/domains/rutadoc/sla.service.ts`: el día inicial NO consume plazo y el
-- día final SÍ. Es la MISMA magnitud con la que RutaDoc evalúa el plazo de 30
-- días hábiles, de modo que TRO y el semáforo SLA no pueden discrepar sobre el
-- mismo expediente.
--
-- Para permanencia por días civiles se usa Lima. Esta métrica es distinta
-- de las horas hábiles UTC completas de la función anterior.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_tra.fn_mgd_dias_habiles_entre(
    p_desde     TIMESTAMPTZ,
    p_hasta     TIMESTAMPTZ,
    p_feriados  DATE[] DEFAULT ARRAY[]::DATE[]
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fn$
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
$fn$;

COMMENT ON FUNCTION sigd_tra.fn_mgd_dias_habiles_entre(TIMESTAMPTZ, TIMESTAMPTZ, DATE[]) IS
    'Dias habil entre dos instantes; el dia inicial no consume plazo. Misma regla que calcularSla() de RutaDoc.';

-- -----------------------------------------------------------------------------
-- 3. VISTA ANALÍTICA BASE: una fila por expediente
--
-- Es el único punto donde se juntan `sigd_tra`, `sigd_rut` y el calendario. Las
-- vistas materializadas de las secciones 4 y 5 se apoyan en ella, de modo que el
-- cálculo de horas hábiles existe en UN solo lugar. `sigd_tra.expediente` y
-- `sigd_rut.movimiento_tramite` son tablas vivas: nunca se consultan desde un
-- endpoint, sólo desde el refresco programado.
--
-- La vista se crea dentro de un bloque DO porque la FUENTE del calendario debe
-- decidirse en tiempo de instalación: `sigd_org.calendario_laboral` es una
-- referencia que PostgreSQL resuelve al PLANIFICAR, así que no puede protegerse
-- con `to_regclass` dentro del cuerpo. Se generan dos variantes de la MISMA
-- definición, que sólo difieren en de dónde salen los feriados. No es lógica
-- duplicada: el cálculo de horas hábiles vive íntegro en la sección 1.
--   * Con catálogo de OrganiCore: se leen los feriados reales.
--   * Sin él: calendario vacío, es decir sólo se excluyen sábados y domingos.
--     Es la misma degradación que ya aplica `crearProveedorFeriados`.
-- -----------------------------------------------------------------------------
DO $ddl$
DECLARE
    v_feriados TEXT;
BEGIN
    IF to_regclass('sigd_org.calendario_laboral') IS NOT NULL THEN
        v_feriados :=
            '(SELECT COALESCE(array_agg(c.fecha), ARRAY[]::DATE[]) AS dias
                FROM sigd_org.calendario_laboral c
               WHERE c.es_feriado = TRUE)';
    ELSE
        v_feriados := '(SELECT ARRAY[]::DATE[] AS dias)';
    END IF;

    EXECUTE format($q$
        CREATE OR REPLACE VIEW sigd_tra.vw_mgd_expediente_base AS
        WITH feriados AS (
            %s
        ),
        corte AS (
            SELECT CURRENT_TIMESTAMP AS instante
        ),
        radicaciones AS (
            SELECT e.expediente_id,
                   e.codigo_expediente,
                   e.fecha_radicacion AS fecha_radicacion,
                   -- Mismo intervalo '-05:00' que las secciones 1 y 2, para que el
                   -- módulo no dependa ni de la zona de la sesión ni de la base de
                   -- datos de zonas horarias del host: el corte de mes se define en
                   -- hora de Lima y sólo entonces se agrupa.
                   date_trunc('month',
                       e.fecha_radicacion AT TIME ZONE INTERVAL '-05:00' HOUR TO MINUTE)::date
                       AS periodo,
                   -- Centinela en vez de NULL: un índice UNIQUE de PostgreSQL trata
                   -- cada NULL como distinto, de modo que las filas de expedientes sin
                   -- área NO podrían garantizar unicidad y REFRESH ... CONCURRENTLY
                   -- fallaría con "could not create unique index". El centinela sí.
                   COALESCE(NULLIF(btrim(a.area_actual_id), ''), e.area_destino_id::text, 'SIN_AREA')
                       AS unidad_organica_id,
                   COALESCE(NULLIF(btrim(a.estado_nuevo), ''), 'REGISTRADO')
                       AS estado_actual,
                   COALESCE(
                       sigd_rut.pestana_de_estado(
                           COALESCE(NULLIF(btrim(a.estado_nuevo), ''), 'REGISTRADO')),
                       'PENDIENTES'
                   ) AS pestana
              FROM sigd_tra.expediente e
              LEFT JOIN sigd_rut.estado_actual_expediente a
                ON a.expediente_id = e.expediente_id
        ),
        -- Primer instante terminal del expediente. MIN() porque un expediente que
        -- pasó por RESUELTO y luego por ARCHIVADO tiene dos asientos terminales, y el
        -- que cuenta es el primero: archivar más tarde no debe inflar el TPR.
        resoluciones AS (
            SELECT m.expediente_id,
                   MIN(m.fecha_hora) AS fecha_resolucion
              FROM sigd_rut.movimiento_tramite m
             WHERE m.estado_nuevo IN ('RESUELTO', 'ARCHIVADO')
             GROUP BY m.expediente_id
        ),
        base AS (
            SELECT r.expediente_id,
                   r.codigo_expediente,
                   r.periodo,
                   r.unidad_organica_id,
                   r.estado_actual,
                   r.pestana,
                   r.fecha_radicacion,
                   res.fecha_resolucion,
                   COALESCE(res.fecha_resolucion, c.instante) AS fecha_corte,
                   (r.estado_actual IN ('RESUELTO', 'ARCHIVADO')) AS es_resuelto,
                   (r.estado_actual = 'ARCHIVADO')              AS es_archivado,
                   (r.estado_actual = 'OBSERVADO')             AS es_observado,
                   (r.pestana = 'EN_TRAMITE')                   AS es_en_tramite
              FROM radicaciones r
              CROSS JOIN feriados f
              CROSS JOIN corte c
              LEFT JOIN resoluciones res
                ON res.expediente_id = r.expediente_id
        )
        SELECT b.expediente_id,
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
               -- Un expediente pendiente (`fecha_resolucion IS NULL`) aporta
               -- permanencia para el análisis de cuellos de botella, pero su TIEMPO
               -- DE ATENCIÓN se descarta del numerador de TPR mediante el FILTER de
               -- la sección 4: TPR mide el tiempo de atención real, no el de espera.
               sigd_tra.fn_mgd_horas_habiles(b.fecha_radicacion, b.fecha_corte, f.dias)
                   AS horas_habiles_atencion,
               sigd_tra.fn_mgd_dias_habiles_entre(b.fecha_radicacion, b.fecha_corte, f.dias)
                   AS dias_habiles_permanencia
          FROM base b
          CROSS JOIN feriados f
    $q$, v_feriados);
END;
$ddl$;

COMMENT ON VIEW sigd_tra.vw_mgd_expediente_base IS
    'Grain de una fila por expediente con su tiempo habil de atencion. Fuente unica de las vistas materializadas MGD.';

-- -----------------------------------------------------------------------------
-- 4. VISTA MATERIALIZADA: sigd_tra.mv_kpis_mgd_mensual
--
-- Grain: (periodo, unidad_organica_id). Ambas columnas son NOT NULL por
-- construcción (gracias al centinela 'SIN_AREA' de la vista base), de modo que el
-- índice UNIQUE de la sección 6 es realmente único y REFRESH ... CONCURRENTLY es
-- legal.
--
-- Se almacenan NUMERADORES y DENOMINADORES además de los porcentajes. Motivo: el
-- consolidado institucional y el desglose por área NO pueden obtenerse promediando
-- porcentajes de los grupos; hay que volver a dividir las sumas (media ponderada).
-- Con las columnas crudas, `mgdAnalytics.service.ts` aplica las MISMAS fórmulas
-- puras y testeadas sobre los totales, de modo que la fila consolidada nunca puede
-- discrepar de la media aritmética de sus grupos.
-- -----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS sigd_tra.mv_kpis_mgd_mensual AS
SELECT b.periodo,
       b.unidad_organica_id,
       -- CURRENT_TIMESTAMP es el instante de la transacción: idéntico para todas
       -- las filas de un mismo refresco. No forma parte del índice UNIQUE y, aun
       -- así, no puede romper la unicidad de (periodo, unidad_organica_id).
       CURRENT_TIMESTAMP AS actualizado_en,
       COUNT(*)::BIGINT                                            AS n_radicados,
       COUNT(*) FILTER (WHERE b.estado_actual = 'RESUELTO')::BIGINT AS n_atendidos,
       COUNT(*) FILTER (WHERE b.estado_actual = 'ARCHIVADO')::BIGINT AS n_archivados,
       COUNT(*) FILTER (WHERE b.es_resuelto)::BIGINT               AS n_resueltos,
       COUNT(*) FILTER (WHERE b.es_en_tramite)::BIGINT             AS n_en_tramite,
       COUNT(*) FILTER (WHERE b.es_observado)::BIGINT              AS n_observados,
       COUNT(*) FILTER (
           WHERE b.es_resuelto
             AND b.dias_habiles_permanencia <= 30
       )::BIGINT                                                   AS n_resueltos_dentro_plazo,
       COALESCE(SUM(b.horas_habiles_atencion) FILTER (WHERE b.es_resuelto), 0)
                                                                    AS horas_habiles_suma,
       ROUND(COALESCE(
           (COUNT(*) FILTER (WHERE b.estado_actual = 'RESUELTO')
            + COUNT(*) FILTER (WHERE b.estado_actual = 'ARCHIVADO'))::NUMERIC
               / NULLIF(COUNT(*), 0) * 100,
           0), 2)                                                  AS vtep_porcentaje,
       ROUND(COALESCE(
           SUM(b.horas_habiles_atencion) FILTER (WHERE b.es_resuelto)
               / NULLIF(COUNT(*) FILTER (WHERE b.es_resuelto), 0),
           0), 2)                                                  AS tpr_horas_habiles,
       ROUND(COALESCE(
           COUNT(*) FILTER (
               WHERE b.es_resuelto
                 AND b.dias_habiles_permanencia <= 30
           )::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE b.es_resuelto), 0) * 100,
           0), 2)                                                  AS tro_porcentaje,
       ROUND(COALESCE(
           COUNT(*) FILTER (WHERE b.es_observado)::NUMERIC
               / NULLIF(COUNT(*) FILTER (WHERE b.es_en_tramite), 0) * 100,
           0), 2)                                                  AS teo_porcentaje
  FROM sigd_tra.vw_mgd_expediente_base b
 GROUP BY b.periodo, b.unidad_organica_id;

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_kpis_mgd_mensual IS
    'KPIs MGD-PCM por (periodo, unidad_organica_id) con numeradores y denominadores de auditoria. Fuente: vw_mgd_expediente_base.';

-- -----------------------------------------------------------------------------
-- 5. VISTA MATERIALIZADA: sigd_tra.mv_tiempos_retencion_area
--
-- Grain: (periodo, unidad_organica_id, tramo_permanencia_dias_habiles).
--
-- Se elige el grain POR TRAMO y no "una fila por área con columnas de tramos"
-- porque el objetivo declarado (T-BE-CL-12, endpoint #52) es la DISTRIBUCIÓN y la
-- identificación de cuellos de botella. En una fila por área, representar un tramo
-- sin expedientes obliga a usar NULL y se pierde la distinción entre "cero
-- expedientes" y "celda vacía"; el grain por tramo conserva una fila por hecho
-- observado, y sus tres columnas son NOT NULL por construcción.
--
-- Los tramos están expresados en DÍAS HÁBILES, no en días calendario: un
-- expediente con 43 días calendario y 10 días hábiles de permanencia no es un
-- cuello de botella, y el tablero ejecutivo no debe presentarlo como tal.
-- -----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS sigd_tra.mv_tiempos_retencion_area AS
WITH clasificado AS (
    SELECT c.periodo,
           c.unidad_organica_id,
           c.dias_habiles_permanencia,
           c.horas_habiles_atencion,
           CASE
               WHEN c.dias_habiles_permanencia <= 5  THEN '01_00_05'
               WHEN c.dias_habiles_permanencia <= 10 THEN '02_06_10'
               WHEN c.dias_habiles_permanencia <= 15 THEN '03_11_15'
               WHEN c.dias_habiles_permanencia <= 20 THEN '04_16_20'
               WHEN c.dias_habiles_permanencia <= 30 THEN '05_21_30'
               WHEN c.dias_habiles_permanencia <= 45 THEN '06_31_45'
               WHEN c.dias_habiles_permanencia <= 60 THEN '07_46_60'
               ELSE '08_MAS_60'
           END AS tramo_permanencia_dias_habiles
      FROM sigd_tra.vw_mgd_expediente_base c
),
agregado AS (
    SELECT c.periodo,
           c.unidad_organica_id,
           c.tramo_permanencia_dias_habiles,
           COUNT(*)::BIGINT              AS n_expedientes,
           -- La media de medias pesada por n_expedientes es EXACTAMENTE la media
           -- del área: por eso basta con guardar la media dentro del tramo y el
           -- consolidado se obtiene en `mgdAnalytics.service.ts` sin releer la
           -- tabla de expedientes. Sin esta columna el tablero no podría informar
           -- la permanencia promedio en días hábiles, que es su métrica principal.
           AVG(c.dias_habiles_permanencia) AS promedio_dias_habiles_permanencia,
           AVG(c.horas_habiles_atencion) AS promedio_horas_habiles,
           MIN(c.horas_habiles_atencion) AS minimo_horas_habiles,
           MAX(c.horas_habiles_atencion) AS maximo_horas_habiles
      FROM clasificado c
     GROUP BY c.periodo, c.unidad_organica_id, c.tramo_permanencia_dias_habiles
)
SELECT a.periodo,
       a.unidad_organica_id,
       a.tramo_permanencia_dias_habiles,
       CURRENT_TIMESTAMP                            AS actualizado_en,
       a.n_expedientes,
       ROUND(a.promedio_dias_habiles_permanencia, 4) AS promedio_dias_habiles_permanencia,
       ROUND(a.promedio_horas_habiles, 4)          AS promedio_horas_habiles,
       ROUND(a.minimo_horas_habiles, 4)             AS minimo_horas_habiles,
       ROUND(a.maximo_horas_habiles, 4)             AS maximo_horas_habiles,
       -- Peso por ventana: SUM(...) OVER no necesita subconsulta ni segunda
       -- pasada, y el centinela 'SIN_AREA' participa igual que cualquier área.
       ROUND(COALESCE(
           a.n_expedientes::NUMERIC * 100
               / NULLIF(SUM(a.n_expedientes) OVER (
                   PARTITION BY a.periodo, a.unidad_organica_id), 0),
           0), 2)                                  AS porcentaje_del_area
  FROM agregado a;

COMMENT ON MATERIALIZED VIEW sigd_tra.mv_tiempos_retencion_area IS
    'Distribucion de permanencia en dias habiles por (periodo, unidad_organica_id, tramo). Base del analisis de cuellos de botella.';

-- -----------------------------------------------------------------------------
-- 6. ÍNDICES
--
-- PostgreSQL EXIGE un índice UNIQUE que cubra TODAS las filas de la vista
-- materializada para admitir REFRESH MATERIALIZED VIEW CONCURRENTLY: la vista no
-- puede contener filas duplicadas ni valores NULL en las columnas del índice,
-- porque en la comparación OLD/NEW un NULL no iguala a nada y la fila insertada se
-- consideraría duplicada. El índice debe construirse sólo con nombres de columna,
-- sin expresión y sin cláusula WHERE.
--
-- Por eso la granularidad de las secciones 4 y 5 se eligió con columnas NOT NULL
-- por construcción, y por eso `unidad_organica_id` lleva el centinela 'SIN_AREA'.
-- Estos índices NO son decorativos: son la condición de posibilidad del refresco
-- concurrente, que es el requisito que evita bloquear la mesa de partes.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_kpis_mgd_mensual
    ON sigd_tra.mv_kpis_mgd_mensual (periodo, unidad_organica_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_tiempos_retencion_area
    ON sigd_tra.mv_tiempos_retencion_area
       (periodo, unidad_organica_id, tramo_permanencia_dias_habiles);

-- Índices de acceso del tablero. NO interfieren con los ÚNICOS: el planificador
-- puede combinarlos y jamás pueden sustituir a un UNIQUE.
CREATE INDEX IF NOT EXISTS ix_mv_kpis_mgd_mensual_unidad
    ON sigd_tra.mv_kpis_mgd_mensual (unidad_organica_id, periodo);

CREATE INDEX IF NOT EXISTS ix_mv_tiempos_retencion_area_unidad
    ON sigd_tra.mv_tiempos_retencion_area (unidad_organica_id, periodo);

-- -----------------------------------------------------------------------------
-- 7. COMENTARIOS DE COLUMNA PARA AUDITORÍA
-- -----------------------------------------------------------------------------
COMMENT ON COLUMN sigd_tra.mv_kpis_mgd_mensual.n_radicados IS
    'Denominador de VTEP: total de expedientes radicados en el periodo y area.';
COMMENT ON COLUMN sigd_tra.mv_kpis_mgd_mensual.n_atendidos IS
    'Numerador de VTEP: estado_nuevo = RESUELTO (pestana ATENDIDOS).';
COMMENT ON COLUMN sigd_tra.mv_kpis_mgd_mensual.n_archivados IS
    'Numerador de VTEP: estado_nuevo = ARCHIVADO (pestana ARCHIVADOS).';
COMMENT ON COLUMN sigd_tra.mv_kpis_mgd_mensual.n_resueltos IS
    'Denominador de TPR y de TRO: expedientes con RESUELTO o ARCHIVADO.';
COMMENT ON COLUMN sigd_tra.mv_kpis_mgd_mensual.n_resueltos_dentro_plazo IS
    'Numerador de TRO: resueltos con permanencia de 30 dias habiles o menos.';
COMMENT ON COLUMN sigd_tra.mv_kpis_mgd_mensual.horas_habiles_suma IS
    'Numerador de TPR: suma de horas habil de atencion de los expedientes resueltos.';
COMMENT ON COLUMN sigd_tra.mv_kpis_mgd_mensual.n_en_tramite IS
    'Denominador de TEO: pestana EN_TRAMITE (EN_REVISION + OBSERVADO + SUBSANADO).';
COMMENT ON COLUMN sigd_tra.mv_kpis_mgd_mensual.n_observados IS
    'Numerador de TEO: estado_nuevo = OBSERVADO.';
COMMENT ON COLUMN sigd_tra.mv_tiempos_retencion_area.tramo_permanencia_dias_habiles IS
    'Tramo de permanencia en dias habiles: 01_00_05, 02_06_10, 03_11_15, 04_16_20, 05_21_30, 06_31_45, 07_46_60, 08_MAS_60.';
COMMENT ON COLUMN sigd_tra.mv_tiempos_retencion_area.n_expedientes IS
    'Expedientes del tramo; peso para consolidar la permanencia promedio del area.';
COMMENT ON COLUMN sigd_tra.mv_tiempos_retencion_area.promedio_dias_habiles_permanencia IS
    'Permanencia promedio del tramo en dias habiles. Ponderada por n_expedientes da la permanencia promedio del area.';


CREATE OR REPLACE FUNCTION sigd_tra.refrescar_vistas_mgd()
RETURNS TABLE(vista TEXT, duracion_ms NUMERIC)
LANGUAGE plpgsql AS $fn$
DECLARE v_inicio TIMESTAMPTZ;
BEGIN
    v_inicio := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY sigd_tra.mv_kpis_mgd_mensual;
    vista := 'sigd_tra.mv_kpis_mgd_mensual';
    duracion_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_inicio)) * 1000;
    RETURN NEXT;
    v_inicio := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY sigd_tra.mv_tiempos_retencion_area;
    vista := 'sigd_tra.mv_tiempos_retencion_area';
    duracion_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_inicio)) * 1000;
    RETURN NEXT;
END;
$fn$;
