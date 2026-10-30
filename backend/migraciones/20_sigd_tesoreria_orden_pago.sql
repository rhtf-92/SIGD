-- =============================================================================
-- Migración 20 · Módulo Tesorería, Órdenes de Pago, Recaudación y Desbloqueo FSM
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS sigd_tra.seq_orden_pago_correlativo START 1;
CREATE SEQUENCE IF NOT EXISTS sigd_tra.seq_recibo_pago_correlativo START 1;

CREATE TABLE IF NOT EXISTS sigd_tra.orden_pago (
    orden_pago_id          UUID NOT NULL DEFAULT gen_random_uuid()
                           CONSTRAINT pk_tra_orden_pago PRIMARY KEY,
    codigo_pago            VARCHAR(30) NOT NULL
                           CONSTRAINT uq_tra_orden_pago_codigo UNIQUE,
    expediente_id          UUID NOT NULL
                           CONSTRAINT fk_tra_orden_pago_expediente
                           REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    registro_version_id    UUID NULL
                           CONSTRAINT fk_tra_orden_pago_tupa_version
                           REFERENCES sigd_doc.tupa_registro_version (registro_version_id) ON DELETE RESTRICT,
    solicitante_id         UUID NOT NULL
                           CONSTRAINT fk_tra_orden_pago_solicitante
                           REFERENCES sigd_auth.persona (id_persona) ON DELETE RESTRICT,
    -- Snapshot inmutable del concepto y costo TUPA al momento de la orden
    concepto               VARCHAR(255) NOT NULL,
    codigo_tupa            VARCHAR(50) NULL,
    monto                  NUMERIC(10, 2) NOT NULL
                           CONSTRAINT chk_tra_orden_pago_monto CHECK (monto > 0),
    moneda                 VARCHAR(3) NOT NULL DEFAULT 'PEN',
    -- Estado de la orden conforme a la FSM de cobros
    estado                 VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
                           CONSTRAINT chk_tra_orden_pago_estado
                           CHECK (estado IN ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO', 'VENCIDO', 'ANULADO')),
    -- Liquidación y medio de pago
    metodo_pago            VARCHAR(20) NULL
                           CONSTRAINT chk_tra_orden_pago_metodo
                           CHECK (metodo_pago IS NULL OR metodo_pago IN ('EFECTIVO', 'YAPE')),
    referencia_operacion   VARCHAR(100) NULL,
    monto_recibido         NUMERIC(10, 2) NULL,
    vuelto                 NUMERIC(10, 2) NULL,
    -- Constancia / Recibo interno
    codigo_recibo          VARCHAR(30) NULL
                           CONSTRAINT uq_tra_orden_pago_recibo UNIQUE,
    fecha_creacion         TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_vencimiento      TIMESTAMPTZ NOT NULL,
    fecha_pago             TIMESTAMPTZ NULL,
    tesorero_id            UUID NULL
                           CONSTRAINT fk_tra_orden_pago_tesorero
                           REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE RESTRICT,
    motivo_rechazo         TEXT NULL,
    observacion            TEXT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices en llaves foráneas y consultas operacionales de Tesorería
CREATE INDEX IF NOT EXISTS idx_tra_orden_pago_expediente
    ON sigd_tra.orden_pago (expediente_id);

CREATE INDEX IF NOT EXISTS idx_tra_orden_pago_solicitante
    ON sigd_tra.orden_pago (solicitante_id);

CREATE INDEX IF NOT EXISTS idx_tra_orden_pago_estado_vencimiento
    ON sigd_tra.orden_pago (estado, fecha_vencimiento);

CREATE INDEX IF NOT EXISTS idx_tra_orden_pago_codigo
    ON sigd_tra.orden_pago (codigo_pago);

CREATE INDEX IF NOT EXISTS idx_tra_orden_pago_recibo
    ON sigd_tra.orden_pago (codigo_recibo)
    WHERE codigo_recibo IS NOT NULL;

-- Incorporación formal del rol TESORERIA en el padrón orgánico de roles
ALTER TABLE sigd_org.rol_sistema
    DROP CONSTRAINT IF EXISTS chk_rol_codigo;

ALTER TABLE sigd_org.rol_sistema
    ADD CONSTRAINT chk_rol_codigo CHECK (codigo IN (
        'ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'MESA_PARTES', 'CIUDADANO', 'TESORERIA'
    ));

INSERT INTO sigd_org.rol_sistema (codigo, nombre, descripcion)
VALUES ('TESORERIA', 'Tesorería', 'Gestión, recaudación y confirmación de pagos de trámites y aranceles TUPA')
ON CONFLICT (codigo) DO NOTHING;
