-- T-BE-RD-02 | RutaDoc | PostgreSQL 18
-- Fuente de los catálogos: rutadoc.fsm.ts, commit eba677c.
-- Este archivo se instala después de 01..05 cuando exista el runner general.
-- Los límites anuales son instantes UTC con extremo superior exclusivo.
BEGIN;

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
    expediente_id BIGINT PRIMARY KEY,
    ultima_secuencia BIGINT NOT NULL CHECK (ultima_secuencia > 0)
);

CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_identidad (
    id_movimiento UUID PRIMARY KEY,
    expediente_id BIGINT NOT NULL,
    secuencia BIGINT NOT NULL CHECK (secuencia > 0),
    fecha_hora TIMESTAMPTZ(3) NOT NULL,
    clave_idempotencia TEXT,
    UNIQUE (expediente_id, secuencia),
    UNIQUE (expediente_id, clave_idempotencia)
);

CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_tramite (
    id_movimiento UUID NOT NULL DEFAULT gen_random_uuid(),
    expediente_id BIGINT NOT NULL,
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
    'Identificador externo BIGINT de TramiCore; sin FK física intermodular.';
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
    expediente_id BIGINT NOT NULL,
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
    expediente_id BIGINT NOT NULL,
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
    expediente_id BIGINT PRIMARY KEY,
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
                ON p.expediente_id = e.id_expediente
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
    v_expediente BIGINT;
    v_visible BOOLEAN;
BEGIN
    v_expediente := CASE WHEN TG_OP = 'DELETE' THEN OLD.expediente_id
                         ELSE NEW.expediente_id END;
    PERFORM pg_advisory_xact_lock(hashtext('exp_' || v_expediente::text));
    IF to_regclass('sigd_tra.expediente') IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM sigd_tra.expediente
            WHERE id_expediente = v_expediente) INTO v_visible;
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
    IF TG_OP = 'UPDATE' AND OLD.id_expediente = NEW.id_expediente THEN
        RETURN NULL;
    END IF;
    IF TG_OP <> 'INSERT' THEN
        PERFORM pg_advisory_xact_lock(hashtext('exp_' || OLD.id_expediente::text));
        SELECT sigd_rut.pestana_de_estado(COALESCE(p.estado_nuevo, 'REGISTRADO'))
          INTO v_vieja FROM (SELECT 1) base
          LEFT JOIN sigd_rut.estado_actual_expediente p
            ON p.expediente_id = OLD.id_expediente;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        PERFORM pg_advisory_xact_lock(hashtext('exp_' || NEW.id_expediente::text));
        SELECT sigd_rut.pestana_de_estado(COALESCE(p.estado_nuevo, 'REGISTRADO'))
          INTO v_nueva FROM (SELECT 1) base
          LEFT JOIN sigd_rut.estado_actual_expediente p
            ON p.expediente_id = NEW.id_expediente;
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
-- si la tabla externa ya existe (runner institucional: 03 antes de 06).
DO $indice_expediente$
BEGIN
    IF to_regclass('sigd_tra.expediente') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS ix_rutadoc_expediente_fecha_id
            ON sigd_tra.expediente (creado_en DESC, id_expediente DESC);
    END IF;
END;
$indice_expediente$;

COMMIT;
