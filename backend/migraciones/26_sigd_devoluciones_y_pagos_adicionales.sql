-- =============================================================================
-- Migración 26 · Devoluciones de Pago, Ticket DEV, Prevención de Duplicados y Sobrepagos
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)
-- =============================================================================

BEGIN;

-- 1. Extender sigd_tra.orden_pago para soportar pagos principales y adicionales explícitos
ALTER TABLE sigd_tra.orden_pago
    ADD COLUMN IF NOT EXISTS tipo_orden VARCHAR(20) NOT NULL DEFAULT 'PRINCIPAL'
        CONSTRAINT chk_tra_orden_pago_tipo CHECK (tipo_orden IN ('PRINCIPAL', 'ADICIONAL')),
    ADD COLUMN IF NOT EXISTS motivo_adicional TEXT NULL;

-- 2. Sustituir índice único global por índices parciales por tipo y estado
-- Permite máximo 1 orden PRINCIPAL activa (PENDIENTE o CONFIRMADO)
-- Permite máximo 1 orden ADICIONAL en PENDIENTE
-- Permite múltiples órdenes ADICIONAL en CONFIRMADO (eventos económicos distintos auditados)
DROP INDEX IF EXISTS sigd_tra.uq_tra_orden_pago_activa_expediente;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tra_orden_pago_principal_activa
    ON sigd_tra.orden_pago (expediente_id)
    WHERE tipo_orden = 'PRINCIPAL' AND estado IN ('PENDIENTE', 'CONFIRMADO');

CREATE UNIQUE INDEX IF NOT EXISTS uq_tra_orden_pago_adicional_pendiente
    ON sigd_tra.orden_pago (expediente_id)
    WHERE tipo_orden = 'ADICIONAL' AND estado = 'PENDIENTE';

-- 3. Secuencias correlativas para Solicitudes de Devolución (DEV) y Constancias (CDEV)
CREATE SEQUENCE IF NOT EXISTS sigd_tra.seq_devolucion_correlativo START 1;
CREATE SEQUENCE IF NOT EXISTS sigd_tra.seq_constancia_devolucion_correlativo START 1;

-- 4. Crear entidad de Solicitudes y Autorizaciones de Devolución
CREATE TABLE IF NOT EXISTS sigd_tra.solicitud_devolucion (
    solicitud_devolucion_id UUID NOT NULL DEFAULT gen_random_uuid()
        CONSTRAINT pk_tra_solicitud_devolucion PRIMARY KEY,
    codigo_dev VARCHAR(30) NOT NULL
        CONSTRAINT uq_tra_solicitud_devolucion_codigo UNIQUE,
    expediente_id UUID NOT NULL
        CONSTRAINT fk_tra_solicitud_devolucion_expediente
        REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    orden_pago_id UUID NOT NULL
        CONSTRAINT fk_tra_solicitud_devolucion_orden_pago
        REFERENCES sigd_tra.orden_pago (orden_pago_id) ON DELETE RESTRICT,
    solicitante_id UUID NOT NULL
        CONSTRAINT fk_tra_solicitud_devolucion_solicitante
        REFERENCES sigd_auth.persona (id_persona) ON DELETE RESTRICT,
    cuenta_usuario_id UUID NULL
        CONSTRAINT fk_tra_solicitud_devolucion_cuenta
        REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE RESTRICT,
    canal_registro VARCHAR(30) NOT NULL DEFAULT 'VIRTUAL'
        CONSTRAINT chk_tra_solicitud_devolucion_canal
        CHECK (canal_registro IN ('VIRTUAL', 'PRESENCIAL', 'MESA_PARTES')),
    causal VARCHAR(50) NOT NULL
        CONSTRAINT chk_tra_solicitud_devolucion_causal
        CHECK (causal IN ('SOBREPAGO', 'PAGO_INDEBIDO', 'DESISTIMIENTO', 'TRAMITE_DENEGADO', 'OTRO')),
    motivo TEXT NOT NULL,
    monto_original NUMERIC(10, 2) NOT NULL
        CONSTRAINT chk_tra_solicitud_devolucion_monto_orig CHECK (monto_original > 0),
    monto_solicitado NUMERIC(10, 2) NOT NULL
        CONSTRAINT chk_tra_solicitud_devolucion_monto_sol CHECK (monto_solicitado > 0 AND monto_solicitado <= monto_original),
    monto_autorizado NUMERIC(10, 2) NULL
        CONSTRAINT chk_tra_solicitud_devolucion_monto_aut CHECK (monto_autorizado IS NULL OR (monto_autorizado > 0 AND monto_autorizado <= monto_original)),
    monto_devuelto NUMERIC(10, 2) NULL
        CONSTRAINT chk_tra_solicitud_devolucion_monto_dev CHECK (monto_devuelto IS NULL OR (monto_devuelto > 0 AND monto_devuelto <= monto_autorizado)),
    estado VARCHAR(30) NOT NULL DEFAULT 'SOLICITADA'
        CONSTRAINT chk_tra_solicitud_devolucion_estado
        CHECK (estado IN ('SOLICITADA', 'EN_REVISION', 'OBSERVADA', 'SUBSANADA', 'APROBADA', 'PENDIENTE_TESORERIA', 'DEVUELTA', 'RECHAZADA', 'ANULADA')),
    fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_aprobacion TIMESTAMPTZ NULL,
    aprobado_por_id UUID NULL
        CONSTRAINT fk_tra_solicitud_devolucion_aprobador
        REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE RESTRICT,
    fecha_devolucion TIMESTAMPTZ NULL,
    procesado_por_id UUID NULL
        CONSTRAINT fk_tra_solicitud_devolucion_procesador
        REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE RESTRICT,
    metodo_devolucion VARCHAR(30) NULL
        CONSTRAINT chk_tra_solicitud_devolucion_metodo
        CHECK (metodo_devolucion IS NULL OR metodo_devolucion IN ('EFECTIVO', 'TRANSFERENCIA', 'YAPE', 'CHEQUE')),
    constancia_devolucion_codigo VARCHAR(30) NULL
        CONSTRAINT uq_tra_solicitud_devolucion_cdev UNIQUE,
    motivo_observacion TEXT NULL,
    motivo_rechazo TEXT NULL,
    observacion_resolucion TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Índices en todas las llaves foráneas y campos de consulta frecuente (Regla 4)
CREATE INDEX IF NOT EXISTS idx_tra_solicitud_devolucion_expediente
    ON sigd_tra.solicitud_devolucion (expediente_id);

CREATE INDEX IF NOT EXISTS idx_tra_solicitud_devolucion_orden_pago
    ON sigd_tra.solicitud_devolucion (orden_pago_id);

CREATE INDEX IF NOT EXISTS idx_tra_solicitud_devolucion_solicitante
    ON sigd_tra.solicitud_devolucion (solicitante_id);

CREATE INDEX IF NOT EXISTS idx_tra_solicitud_devolucion_cuenta
    ON sigd_tra.solicitud_devolucion (cuenta_usuario_id)
    WHERE cuenta_usuario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tra_solicitud_devolucion_aprobador
    ON sigd_tra.solicitud_devolucion (aprobado_por_id)
    WHERE aprobado_por_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tra_solicitud_devolucion_procesador
    ON sigd_tra.solicitud_devolucion (procesado_por_id)
    WHERE procesado_por_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tra_solicitud_devolucion_estado
    ON sigd_tra.solicitud_devolucion (estado);

CREATE INDEX IF NOT EXISTS idx_tra_solicitud_devolucion_codigo
    ON sigd_tra.solicitud_devolucion (codigo_dev);

CREATE INDEX IF NOT EXISTS idx_tra_solicitud_devolucion_cdev
    ON sigd_tra.solicitud_devolucion (constancia_devolucion_codigo)
    WHERE constancia_devolucion_codigo IS NOT NULL;

-- 6. Unicidad parcial: solo una solicitud activa en trámite o en tesorería por orden de pago
CREATE UNIQUE INDEX IF NOT EXISTS uq_tra_solicitud_devolucion_activa_por_orden
    ON sigd_tra.solicitud_devolucion (orden_pago_id)
    WHERE estado IN ('SOLICITADA', 'EN_REVISION', 'OBSERVADA', 'SUBSANADA', 'APROBADA', 'PENDIENTE_TESORERIA');

COMMIT;
