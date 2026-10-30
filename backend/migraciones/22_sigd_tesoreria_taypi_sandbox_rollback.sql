-- =============================================================================
-- Rollback Migración 22 · Reversión de Campos de Integración TAYPI Sandbox
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- =============================================================================

DROP INDEX IF EXISTS sigd_tra.idx_tra_orden_pago_provider_payment_id;

ALTER TABLE sigd_tra.orden_pago
    DROP CONSTRAINT IF EXISTS chk_tra_orden_pago_confirmed_source;

ALTER TABLE sigd_tra.orden_pago
    DROP COLUMN IF EXISTS provider_reference,
    DROP COLUMN IF EXISTS confirmed_source,
    DROP COLUMN IF EXISTS provider_expires_at,
    DROP COLUMN IF EXISTS provider_status,
    DROP COLUMN IF EXISTS provider_checkout_url,
    DROP COLUMN IF EXISTS provider_qr_image,
    DROP COLUMN IF EXISTS provider_checkout_token,
    DROP COLUMN IF EXISTS provider_payment_id,
    DROP COLUMN IF EXISTS payment_provider;

ALTER TABLE sigd_tra.orden_pago
    DROP CONSTRAINT IF EXISTS chk_tra_orden_pago_metodo;

ALTER TABLE sigd_tra.orden_pago
    ADD CONSTRAINT chk_tra_orden_pago_metodo
    CHECK (metodo_pago IS NULL OR metodo_pago IN ('EFECTIVO', 'YAPE'));
