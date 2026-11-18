-- =============================================================================
-- Rollback de Migración 26 · Devoluciones de Pago, Ticket DEV y Pagos Adicionales
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)
-- =============================================================================

BEGIN;

-- El rollback solo es admisible si no hay historia financiera de Fase 3.
-- Ninguna estructura ni índice se elimina antes de esta comprobación.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM sigd_tra.solicitud_devolucion) THEN
        RAISE EXCEPTION 'ROLLBACK_ABORTADO: existen solicitudes DEV o constancias CDEV; conservar historia financiera';
    END IF;
    IF EXISTS (SELECT 1 FROM sigd_tra.orden_pago WHERE tipo_orden = 'ADICIONAL') THEN
        RAISE EXCEPTION 'ROLLBACK_ABORTADO: existen órdenes ADICIONALES; conservar PAG y REC';
    END IF;
    IF (SELECT is_called FROM sigd_tra.seq_devolucion_correlativo)
       OR (SELECT is_called FROM sigd_tra.seq_constancia_devolucion_correlativo) THEN
        RAISE EXCEPTION 'ROLLBACK_ABORTADO: correlativos DEV/CDEV ya emitidos; conservar secuencias e historia financiera';
    END IF;
END $$;

-- 1. Validar si existen órdenes adicionales activas que violarían uq_tra_orden_pago_activa_expediente
DO $$
BEGIN
    IF EXISTS (
        SELECT expediente_id
        FROM sigd_tra.orden_pago
        WHERE estado IN ('PENDIENTE', 'CONFIRMADO')
        GROUP BY expediente_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'ROLLBACK_ABORTADO: Existen múltiples órdenes activas por expediente (órdenes adicionales confirmadas o pendientes). Restaurar uq_tra_orden_pago_activa_expediente causaría violación de integridad sin intervención manual.';
    END IF;
END $$;

-- 2. Eliminar tabla sigd_tra.solicitud_devolucion y sus secuencias
DROP TABLE IF EXISTS sigd_tra.solicitud_devolucion;
DROP SEQUENCE IF EXISTS sigd_tra.seq_constancia_devolucion_correlativo;
DROP SEQUENCE IF EXISTS sigd_tra.seq_devolucion_correlativo;

-- 3. Restaurar índice original en orden_pago
DROP INDEX IF EXISTS sigd_tra.uq_tra_orden_pago_adicional_pendiente;
DROP INDEX IF EXISTS sigd_tra.uq_tra_orden_pago_principal_activa;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tra_orden_pago_activa_expediente
    ON sigd_tra.orden_pago (expediente_id)
    WHERE estado IN ('PENDIENTE', 'CONFIRMADO');

-- 4. Eliminar columnas de tipo_orden y motivo_adicional
ALTER TABLE sigd_tra.orden_pago
    DROP COLUMN IF EXISTS motivo_adicional,
    DROP COLUMN IF EXISTS tipo_orden;

COMMIT;
