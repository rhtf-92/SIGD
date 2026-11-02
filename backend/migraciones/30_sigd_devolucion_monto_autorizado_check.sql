-- Migración 30 · Exigir autorización para registrar un monto devuelto.
-- No modifica la migración histórica 26 ni sus checksums.

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sigd_tra.solicitud_devolucion
        WHERE monto_devuelto IS NOT NULL
          AND monto_autorizado IS NULL
    ) THEN
        RAISE EXCEPTION 'Migración 30 abortada: existen devoluciones registradas sin monto autorizado.';
    END IF;
END $$;

ALTER TABLE sigd_tra.solicitud_devolucion
    DROP CONSTRAINT IF EXISTS chk_tra_solicitud_devolucion_monto_dev;

ALTER TABLE sigd_tra.solicitud_devolucion
    ADD CONSTRAINT chk_tra_solicitud_devolucion_monto_dev
    CHECK (
        monto_devuelto IS NULL
        OR (
            monto_autorizado IS NOT NULL
            AND monto_devuelto > 0
            AND monto_devuelto <= monto_autorizado
        )
    );

COMMIT;
