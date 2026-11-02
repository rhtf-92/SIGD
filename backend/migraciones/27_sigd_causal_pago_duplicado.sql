-- =============================================================================
-- Migración 27 · Agregar causal PAGO_DUPLICADO a devoluciones de pago
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)
-- =============================================================================

BEGIN;

-- 1. Ampliar el CHECK de causal en sigd_tra.solicitud_devolucion para incluir PAGO_DUPLICADO
-- PAGO_DUPLICADO: el mismo trámite recibió más de un pago confirmado.
-- SOBREPAGO: el monto total pagado excede el monto requerido.
-- PAGO_INDEBIDO: el pago fue realizado cuando no correspondía la obligación.
-- (Se mantienen las causales existentes; PAGO_DUPLICADO es independiente.)
ALTER TABLE sigd_tra.solicitud_devolucion
    DROP CONSTRAINT IF EXISTS chk_tra_solicitud_devolucion_causal;

ALTER TABLE sigd_tra.solicitud_devolucion
    ADD CONSTRAINT chk_tra_solicitud_devolucion_causal
    CHECK (causal IN ('SOBREPAGO', 'PAGO_DUPLICADO', 'PAGO_INDEBIDO', 'DESISTIMIENTO', 'TRAMITE_DENEGADO', 'OTRO'));

COMMIT;
