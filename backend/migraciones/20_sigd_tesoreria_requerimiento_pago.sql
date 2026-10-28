-- =============================================================================
-- Migración 20: Módulo de Tesorería — Requerimiento de Pago (Pool / B_POOL)
-- Autor: Pool Angelo Carranza Pereyra (B_POOL) - G6-01
-- Perfil: BASELINE_2026_V1 (01-05 -> BASELINE -> 08) - NO ejecuta 06/07
-- Estado: Integración autorizada por Geric; sin tocar 06_sigd_rut.sql ni 07
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS sigd_doc;

CREATE TABLE IF NOT EXISTS sigd_doc.requerimiento_pago (
    id                  UUID         NOT NULL DEFAULT gen_random_uuid()
                         CONSTRAINT pk_requerimiento_pago PRIMARY KEY,
    codigo              VARCHAR(30)  NOT NULL UNIQUE
                         CONSTRAINT uq_requerimiento_pago_codigo UNIQUE,
    id_expediente       UUID         NOT NULL
                         CONSTRAINT fk_requerimiento_pago_expediente
                         REFERENCES sigd_doc.expediente (expediente_id) ON DELETE RESTRICT,
    id_tupa_procedimiento UUID       NOT NULL
                         CONSTRAINT fk_requerimiento_pago_tupa
                         REFERENCES sigd_doc.tupa_procedimiento (id_procedimiento) ON DELETE RESTRICT,
    id_solicitante      UUID         NOT NULL
                         CONSTRAINT fk_requerimiento_pago_solicitante
                         REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE RESTRICT,
    concepto            VARCHAR(255) NOT NULL,
    monto_esperado      NUMERIC(10,2) NOT NULL
                         CONSTRAINT chk_requerimiento_pago_monto CHECK (monto_esperado >= 0),
    moneda              VARCHAR(3)  NOT NULL DEFAULT 'PEN',
    estado              VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_PAGO'
                         CONSTRAINT chk_requerimiento_pago_estado
                         CHECK (estado IN ('PENDIENTE_PAGO', 'PAGO_EN_VERIFICACION', 'PAGO_CONFIRMADO', 'PAGO_RECHAZADO', 'ANULADO')),
    creado_en           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    confirmado_en       TIMESTAMPTZ  NULL,
    rechazado_en        TIMESTAMPTZ  NULL,
    id_confirmador      UUID         NULL
                         CONSTRAINT fk_requerimiento_pago_confirmador
                         REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE SET NULL,
    observacion         TEXT         NULL,
    version_tupa        UUID         NULL
                         CONSTRAINT fk_requerimiento_pago_version_tupa
                         REFERENCES sigd_doc.tupa_version (id_version) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_requerimiento_pago_estado ON sigd_doc.requerimiento_pago (estado);
CREATE INDEX IF NOT EXISTS idx_requerimiento_pago_expediente ON sigd_doc.requerimiento_pago (id_expediente);
CREATE INDEX IF NOT EXISTS idx_requerimiento_pago_tupa ON sigd_doc.requerimiento_pago (id_tupa_procedimiento);
CREATE INDEX IF NOT EXISTS idx_requerimiento_pago_solicitante ON sigd_doc.requerimiento_pago (id_solicitante);
CREATE INDEX IF NOT EXISTS idx_requerimiento_pago_creado ON sigd_doc.requerimiento_pago (creado_en DESC);
