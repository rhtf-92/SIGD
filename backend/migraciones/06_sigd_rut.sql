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

COMMIT;
