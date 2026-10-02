-- =============================================================================
-- Migración 06 · Esquema sigd_rut
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Ricardo Arévalo Villacorta (B_AREVALO) · Grupo 6 CoreLink
-- Marco     : TUO Ley 27444 Art. 143 (SLA 30 días hábiles), Art. 160
-- Depende de: 01..05 (todas las FKs apuntan a sigd_auth/sigd_org/sigd_tra)
-- Contenido : FSM de 10 estados, matriz de transiciones y movimiento particionado
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS sigd_rut;

-- -----------------------------------------------------------------------------
-- 6.1 accion_tramite — catálogo de acciones
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_rut.accion_tramite (
    accion_id     SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo        VARCHAR(30) NOT NULL UNIQUE,
    nombre        VARCHAR(160) NOT NULL,
    requiere_motivo BOOLEAN   NOT NULL DEFAULT FALSE,
    sla_dias      SMALLINT    NULL,
    CONSTRAINT chk_accion_codigo CHECK (codigo IN (
        'RADICAR', 'DERIVAR', 'OBSERVAR', 'SUBSANAR', 'ATENDER',
        'RESOLVER', 'NOTIFICAR', 'ARCHIVAR', 'ANULAR', 'REABRIR'
    ))
);

INSERT INTO sigd_rut.accion_tramite (codigo, nombre, requiere_motivo, sla_dias)
VALUES
    ('RADICAR',    'Radicar',             FALSE, 0),
    ('DERIVAR',    'Derivar a otra área', TRUE,  3),
    ('OBSERVAR',   'Observar',            TRUE,  10),
    ('SUBSANAR',   'Subsanar observación', FALSE, 10),
    ('ATENDER',    'Atender',             FALSE, 30),
    ('RESOLVER',   'Resolver',            TRUE,  30),
    ('NOTIFICAR',  'Notificar',           FALSE, 5),
    ('ARCHIVAR',   'Archivar',             FALSE, 0),
    ('ANULAR',     'Anular',              TRUE,  0),
    ('REABRIR',    'Reabrir',             TRUE,  0)
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6.2 estado_tramite — los 10 estados institucionales de la FSM
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_rut.estado_tramite (
    estado_id   SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo      VARCHAR(30) NOT NULL UNIQUE,
    nombre      VARCHAR(160) NOT NULL,
    terminal    BOOLEAN     NOT NULL DEFAULT FALSE,
    sla_dias    SMALLINT    NOT NULL DEFAULT 30,
    CONSTRAINT chk_estado_codigo CHECK (codigo IN (
        'REGISTRADO', 'ADMITIDO', 'EN_TRAMITE', 'OBSERVADO', 'SUBSANADO',
        'DERIVADO', 'RESUELTO', 'NOTIFICADO', 'ARCHIVADO', 'ANULADO'
    ))
);

INSERT INTO sigd_rut.estado_tramite (codigo, nombre, terminal, sla_dias)
VALUES
    ('REGISTRADO', 'Registrado',            FALSE, 30),
    ('ADMITIDO',   'Admitido a trámite',    FALSE, 30),
    ('EN_TRAMITE', 'En trámite',           FALSE, 30),
    ('OBSERVADO',  'Observado',             FALSE, 30),
    ('SUBSANADO',  'Subsanado',             FALSE, 30),
    ('DERIVADO',   'Derivado',              FALSE, 30),
    ('RESUELTO',   'Resuelto',              TRUE,  30),
    ('NOTIFICADO', 'Notificado',            TRUE,  30),
    ('ARCHIVADO',  'Archivado',             TRUE,  30),
    ('ANULADO',    'Anulado',               TRUE,  30)
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6.3 transicion_estado_tramite — matriz de transiciones permitidas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_rut.transicion_estado_tramite (
    transicion_id   UUID     NOT NULL DEFAULT gen_random_uuid()
                              CONSTRAINT pk_transicion_estado_tramite PRIMARY KEY,
    estado_origen   VARCHAR(30) NOT NULL
                              REFERENCES sigd_rut.estado_tramite (codigo) ON DELETE CASCADE,
    estado_destino  VARCHAR(30) NOT NULL
                              REFERENCES sigd_rut.estado_tramite (codigo) ON DELETE RESTRICT,
    accion_codigo   VARCHAR(30) NOT NULL
                              REFERENCES sigd_rut.accion_tramite (codigo) ON DELETE RESTRICT,
    requiere_motivo BOOLEAN   NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_transicion_estado_accion UNIQUE (estado_origen, estado_destino, accion_codigo),
    CONSTRAINT chk_transicion_no_autoloop CHECK (estado_origen <> estado_destino)
);

INSERT INTO sigd_rut.transicion_estado_tramite (estado_origen, estado_destino, accion_codigo, requiere_motivo)
VALUES
    ('REGISTRADO', 'ADMITIDO',   'ATENDER',   FALSE),
    ('REGISTRADO', 'ANULADO',    'ANULAR',    TRUE),
    ('ADMITIDO',   'EN_TRAMITE', 'ATENDER',   FALSE),
    ('ADMITIDO',   'DERIVADO',   'DERIVAR',   TRUE),
    ('ADMITIDO',   'ANULADO',    'ANULAR',    TRUE),
    ('EN_TRAMITE', 'DERIVADO',   'DERIVAR',   TRUE),
    ('EN_TRAMITE', 'OBSERVADO',  'OBSERVAR',  TRUE),
    ('EN_TRAMITE', 'RESUELTO',   'RESOLVER',  TRUE),
    ('EN_TRAMITE', 'ARCHIVADO',  'ARCHIVAR',  FALSE),
    ('OBSERVADO',  'SUBSANADO',  'SUBSANAR',  FALSE),
    ('OBSERVADO',  'ANULADO',    'ANULAR',    TRUE),
    ('DERIVADO',   'EN_TRAMITE', 'ATENDER',   FALSE),
    ('SUBSANADO',  'EN_TRAMITE', 'ATENDER',   FALSE),
    ('RESUELTO',   'NOTIFICADO', 'NOTIFICAR', FALSE),
    ('ARCHIVADO',  'REGISTRADO', 'REABRIR',   TRUE)
ON CONFLICT (estado_origen, estado_destino, accion_codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6.4 catalogs de relación y observaciones
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_rut.tipo_relacion_movimiento (
    tipo_relacion_id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo           VARCHAR(30) NOT NULL UNIQUE,
    nombre           VARCHAR(160) NOT NULL,
    unidireccional   BOOLEAN     NOT NULL DEFAULT TRUE
);

INSERT INTO sigd_rut.tipo_relacion_movimiento (codigo, nombre, unidireccional)
VALUES
    ('CAUSAL',   'Causal',            TRUE),
    ('CUMPLIMIENTO', 'Cumplimiento', TRUE),
    ('CONFORMIDAD', 'Conformidad',   TRUE),
    ('SUBSIDIO', 'Subsidio',         FALSE)
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS sigd_rut.observacion_tramite (
    observacion_id      UUID        NOT NULL DEFAULT gen_random_uuid()
                                   CONSTRAINT pk_observacion_tramite PRIMARY KEY,
    movimiento_id       UUID        NULL,
    expediente_id       UUID        NOT NULL
                                   REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    motivo              TEXT        NOT NULL,
    plazo_subsanacion_dias SMALLINT NOT NULL DEFAULT 10,
    fecha_observacion   TIMESTAMPTZ NOT NULL DEFAULT now(),
    levantada_en        TIMESTAMPTZ NULL,
    CONSTRAINT chk_observacion_plazo CHECK (plazo_subsanacion_dias > 0)
);

CREATE INDEX IF NOT EXISTS idx_observacion_expediente ON sigd_rut.observacion_tramite (expediente_id);

-- -----------------------------------------------------------------------------
-- 6.5 movimiento_tramite — tabla particionada por rango anual
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_tramite (
    movimiento_id     UUID        NOT NULL DEFAULT gen_random_uuid(),
    expediente_id     UUID        NOT NULL
                                  REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    area_origen_id    UUID        NULL
                                  REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT,
    area_destino_id   UUID        NULL
                                  REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT,
    estado_origen     VARCHAR(30) NULL,
    estado_destino    VARCHAR(30) NULL,
    accion_codigo     VARCHAR(30) NULL,
    usuario_id        UUID        NULL,
    correlation_id    UUID        NULL,
    motivo            TEXT        NULL,
    fecha_movimiento  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_movimiento_tramite PRIMARY KEY (movimiento_id, fecha_movimiento)
) PARTITION BY RANGE (fecha_movimiento);

COMMENT ON TABLE sigd_rut.movimiento_tramite IS
    'Histórico de movimientos particionado por rango anual (Riesgo C1: transición de año fiscal sin caída del motor).';

-- Particiones físicas por ejercicio fiscal y partición por defecto.
CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_tramite_2026
    PARTITION OF sigd_rut.movimiento_tramite
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_tramite_2027
    PARTITION OF sigd_rut.movimiento_tramite
    FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_tramite_default
    PARTITION OF sigd_rut.movimiento_tramite DEFAULT;

COMMENT ON TABLE sigd_rut.movimiento_tramite_default IS
    'Partición por defecto: absorbe cualquier fecha fuera de 2026-2027 para preservar la disponibilidad de radicaciones y derivaciones.';

CREATE INDEX IF NOT EXISTS idx_movimiento_expediente
    ON sigd_rut.movimiento_tramite (expediente_id);
CREATE INDEX IF NOT EXISTS idx_movimiento_fecha
    ON sigd_rut.movimiento_tramite (fecha_movimiento DESC);
CREATE INDEX IF NOT EXISTS idx_movimiento_area_destino
    ON sigd_rut.movimiento_tramite (area_destino_id, fecha_movimiento DESC);

-- -----------------------------------------------------------------------------
-- 6.6 Inmutabilidad histórica del movimiento (WORM, SQLSTATE 23001)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigd_rut.fn_rechazar_mutacion_historica()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'RutaDoc: % rechazado sobre el histórico %.%; registre un nuevo hecho de tramitación',
        TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
        USING ERRCODE = '23001';
END;
$$;

DROP TRIGGER IF EXISTS tr_movimiento_append_only ON sigd_rut.movimiento_tramite;
CREATE TRIGGER tr_movimiento_append_only
    BEFORE UPDATE OR DELETE ON sigd_rut.movimiento_tramite
    FOR EACH ROW EXECUTE FUNCTION sigd_rut.fn_rechazar_mutacion_historica();

-- -----------------------------------------------------------------------------
-- 6.7 Tablas dependientes del movimiento
-- -----------------------------------------------------------------------------
-- NOTA DE INTEGRIDAD (Riesgo C1): `movimiento_tramite` es particionada por
-- `fecha_movimiento`, por lo que su clave primaria es compuesta
-- (movimiento_id, fecha_movimiento). PostgreSQL sólo admite como destino de
-- FK un conjunto de columnas con restricción UNIQUE, y en tablas
-- particionadas ese UNIQUE debe incluir la clave de partición. En consecuencia,
-- las tablas dependientes replican `fecha_movimiento` y referencian la FK
-- compuesta. Así se conserva la integridad referencial real en lugar de
-- dejarla sólo a la disciplina del servicio RouteDoc.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_rut.derivacion_tramite (
    derivacion_id     UUID        NOT NULL DEFAULT gen_random_uuid()
                                    CONSTRAINT pk_derivacion_tramite PRIMARY KEY,
    movimiento_id     UUID        NOT NULL,
    fecha_movimiento  TIMESTAMPTZ NOT NULL,
    area_origen_id    UUID        NOT NULL
                                    REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT,
    area_destino_id   UUID        NOT NULL
                                    REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT,
    plazo_dias        SMALLINT    NOT NULL DEFAULT 3,
    fecha_limite      TIMESTAMPTZ NOT NULL,
    CONSTRAINT chk_derivacion_plazo CHECK (plazo_dias > 0),
    CONSTRAINT fk_derivacion_movimiento FOREIGN KEY (movimiento_id, fecha_movimiento)
        REFERENCES sigd_rut.movimiento_tramite (movimiento_id, fecha_movimiento) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sigd_rut.recepcion_tramite (
    recepcion_id     UUID        NOT NULL DEFAULT gen_random_uuid()
                                   CONSTRAINT pk_recepcion_tramite PRIMARY KEY,
    movimiento_id    UUID        NOT NULL,
    fecha_movimiento TIMESTAMPTZ NOT NULL,
    usuario_recibe   UUID        NOT NULL,
    fecha_recepcion  TIMESTAMPTZ NOT NULL DEFAULT now(),
    sello_recepcion  VARCHAR(120) NULL,
    CONSTRAINT fk_recepcion_movimiento FOREIGN KEY (movimiento_id, fecha_movimiento)
        REFERENCES sigd_rut.movimiento_tramite (movimiento_id, fecha_movimiento) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sigd_rut.atencion_tramite (
    atencion_id       UUID        NOT NULL DEFAULT gen_random_uuid()
                                     CONSTRAINT pk_atencion_tramite PRIMARY KEY,
    movimiento_id     UUID        NOT NULL,
    fecha_movimiento  TIMESTAMPTZ NOT NULL,
    usuario_atencion  UUID        NOT NULL,
    resultado         VARCHAR(30) NOT NULL,
    detalle           TEXT        NULL,
    CONSTRAINT chk_atencion_resultado CHECK (resultado IN ('ATENDIDO', 'OBSERVADO', 'RESUELTO')),
    CONSTRAINT fk_atencion_movimiento FOREIGN KEY (movimiento_id, fecha_movimiento)
        REFERENCES sigd_rut.movimiento_tramite (movimiento_id, fecha_movimiento) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_documento (
    movimiento_id      UUID        NOT NULL,
    fecha_movimiento   TIMESTAMPTZ NOT NULL,
    documento_adjunto_id UUID      NOT NULL,
    generado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_movimiento_documento PRIMARY KEY (movimiento_id, documento_adjunto_id),
    CONSTRAINT fk_movimiento_documento_movimiento FOREIGN KEY (movimiento_id, fecha_movimiento)
        REFERENCES sigd_rut.movimiento_tramite (movimiento_id, fecha_movimiento) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sigd_rut.relacion_movimiento (
    relacion_id             UUID        NOT NULL DEFAULT gen_random_uuid()
                                        CONSTRAINT pk_relacion_movimiento PRIMARY KEY,
    movimiento_origen       UUID        NOT NULL,
    fecha_origen            TIMESTAMPTZ NOT NULL,
    movimiento_destino      UUID        NOT NULL,
    fecha_destino           TIMESTAMPTZ NOT NULL,
    tipo_relacion_codigo    VARCHAR(30) NOT NULL
                                        REFERENCES sigd_rut.tipo_relacion_movimiento (codigo) ON DELETE RESTRICT,
    CONSTRAINT chk_relacion_no_autoloop CHECK (movimiento_origen <> movimiento_destino),
    CONSTRAINT uq_relacion_movimiento UNIQUE (movimiento_origen, movimiento_destino),
    CONSTRAINT fk_relacion_movimiento_origen FOREIGN KEY (movimiento_origen, fecha_origen)
        REFERENCES sigd_rut.movimiento_tramite (movimiento_id, fecha_movimiento) ON DELETE RESTRICT,
    CONSTRAINT fk_relacion_movimiento_destino FOREIGN KEY (movimiento_destino, fecha_destino)
        REFERENCES sigd_rut.movimiento_tramite (movimiento_id, fecha_movimiento) ON DELETE RESTRICT
);

-- -----------------------------------------------------------------------------
-- 6.8 Proyección optimizada de lectura del estado actual
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_rut.estado_actual_tramite (
    expediente_id     UUID        NOT NULL
                                   CONSTRAINT pk_estado_actual_tramite PRIMARY KEY
                                   REFERENCES sigd_tra.expediente (expediente_id) ON DELETE CASCADE,
    estado_codigo     VARCHAR(30) NOT NULL
                                   REFERENCES sigd_rut.estado_tramite (codigo) ON DELETE RESTRICT,
    area_actual_id    UUID        NULL
                                   REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT,
    movimiento_actual UUID        NULL,
    fecha_estado      TIMESTAMPTZ NOT NULL DEFAULT now(),
    dias_habiles_restantes SMALLINT NOT NULL DEFAULT 30,
    semaforo_sla      VARCHAR(10) NOT NULL DEFAULT 'VERDE',
    CONSTRAINT chk_estado_actual_semaforo CHECK (semaforo_sla IN ('VERDE', 'AMARILLO', 'ROJO'))
);

CREATE INDEX IF NOT EXISTS idx_estado_actual_semaforo ON sigd_rut.estado_actual_tramite (semaforo_sla);
CREATE INDEX IF NOT EXISTS idx_estado_actual_area ON sigd_rut.estado_actual_tramite (area_actual_id);
