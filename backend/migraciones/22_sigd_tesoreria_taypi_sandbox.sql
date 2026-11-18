-- =============================================================================
-- Migración 22 · Soporte para Pagos QR Automático Sandbox (TAYPI) y Webhook
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)
-- =============================================================================

-- 1. Ampliar restricción de método de pago para admitir QR_AUTOMATICO_SANDBOX
ALTER TABLE sigd_tra.orden_pago
    DROP CONSTRAINT IF EXISTS chk_tra_orden_pago_metodo;

ALTER TABLE sigd_tra.orden_pago
    ADD CONSTRAINT chk_tra_orden_pago_metodo
    CHECK (metodo_pago IS NULL OR metodo_pago IN ('EFECTIVO', 'YAPE', 'QR_AUTOMATICO_SANDBOX'));

-- 2. Incorporar campos para integración con proveedores de pago automatizado (TAYPI)
ALTER TABLE sigd_tra.orden_pago
    ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(30) NULL DEFAULT 'MANUAL',
    ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS provider_checkout_token VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS provider_qr_image TEXT NULL,
    ADD COLUMN IF NOT EXISTS provider_checkout_url TEXT NULL,
    ADD COLUMN IF NOT EXISTS provider_status VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS provider_expires_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS confirmed_source VARCHAR(30) NULL,
    ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(100) NULL;

-- 3. Restricción para origen de confirmación
ALTER TABLE sigd_tra.orden_pago
    DROP CONSTRAINT IF EXISTS chk_tra_orden_pago_confirmed_source;

ALTER TABLE sigd_tra.orden_pago
    ADD CONSTRAINT chk_tra_orden_pago_confirmed_source
    CHECK (confirmed_source IS NULL OR confirmed_source IN ('TESORERIA', 'WEBHOOK'));

-- 4. Índice para resolución rápida e idempotente de webhooks por payment_id del proveedor
CREATE INDEX IF NOT EXISTS idx_tra_orden_pago_provider_payment_id
    ON sigd_tra.orden_pago (provider_payment_id)
    WHERE provider_payment_id IS NOT NULL;
