-- =============================================================================
-- Migración 27 · Rollback: remover causal PAGO_DUPLICADO de devoluciones de pago
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)
-- =============================================================================

BEGIN;

-- 1. Restaurar el CHECK de causal sin PAGO_DUPLICADO
ALTER TABLE sigd_tra.solicitud_devolucion
    DROP CONSTRAINT IF EXISTS chk_tra_solicitud_devolucion_causal;

ALTER TABLE sigd_tra.solicitud_devolucion
    ADD CONSTRAINT chk_tra_solicitud_devolucion_causal
    CHECK (causal IN ('SOBREPAGO', 'PAGO_INDEBIDO', 'DESISTIMIENTO', 'TRAMITE_DENEGADO', 'OTRO'));

COMMIT;
