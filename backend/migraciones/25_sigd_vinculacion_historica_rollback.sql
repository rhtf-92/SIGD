-- ==============================================================================
-- ROLLBACK MIGRACIÓN 25: Revertir Solicitudes de Vinculación y Creador
-- ARCHIVO: 25_sigd_vinculacion_historica_rollback.sql
-- ==============================================================================

BEGIN;

DO $$
BEGIN
    IF to_regclass('sigd_tra.solicitud_vinculacion_expediente') IS NOT NULL
       AND EXISTS (SELECT 1 FROM sigd_tra.solicitud_vinculacion_expediente) THEN
        RAISE EXCEPTION 'Rollback 25 abortado: existen solicitudes de vinculación que deben conservarse.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM sigd_tra.expediente
        WHERE id_usuario_creador IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Rollback 25 abortado: existen atribuciones de creador que deben conservarse.';
    END IF;
END $$;

DROP TABLE IF EXISTS sigd_tra.solicitud_vinculacion_expediente;

DROP INDEX IF EXISTS sigd_tra.idx_tra_expediente_creador;

ALTER TABLE sigd_tra.expediente
    DROP COLUMN IF EXISTS id_usuario_creador;

COMMIT;
