-- ==============================================================================
-- ROLLBACK 45: Casillero Electrónico, Trazabilidad WORM e Idempotencia
-- ARCHIVO: 45_sigd_casillero_notificaciones_trazabilidad_rollback.sql
-- ==============================================================================

BEGIN;

-- 1. Control de seguridad fail-safe: Prohibido destruir evidencia de acceso/notificación existente
DO $$
DECLARE
    v_total_trazabilidad INT;
    v_total_5j_notif INT;
BEGIN
    SELECT count(*) INTO v_total_trazabilidad
      FROM sigd_auth.notificacion_trazabilidad_evento;

    SELECT count(*) INTO v_total_5j_notif
      FROM sigd_auth.notificacion_casilla
     WHERE idempotency_key IS NOT NULL
        OR estado IN ('GENERADA', 'PUESTA_A_DISPOSICION', 'VISUALIZADA', 'DESCARGADA', 'ERROR_ENVIO');

    IF v_total_trazabilidad > 0 OR v_total_5j_notif > 0 THEN
        RAISE EXCEPTION 'ROLLBACK_ABORTADO: Existen registros de trazabilidad de casillero (%) o notificaciones 5J (%) que impiden revertir la migración sin destruir historia.',
            v_total_trazabilidad, v_total_5j_notif;
    END IF;
END $$;

-- 2. Eliminar trigger y función WORM
DROP TRIGGER IF EXISTS trg_notificacion_trazabilidad_worm ON sigd_auth.notificacion_trazabilidad_evento;
DROP FUNCTION IF EXISTS sigd_auth.fn_notificacion_trazabilidad_worm();

-- 3. Eliminar tabla de trazabilidad
DROP TABLE IF EXISTS sigd_auth.notificacion_trazabilidad_evento;

-- 4. Revertir índices y columnas en sigd_auth.notificacion_casilla
DROP INDEX IF EXISTS sigd_auth.uq_notif_casilla_idempotency;
DROP INDEX IF EXISTS sigd_auth.idx_notif_casilla_persona;

ALTER TABLE sigd_auth.notificacion_casilla
    DROP CONSTRAINT IF EXISTS chk_notificacion_casilla_estado;

ALTER TABLE sigd_auth.notificacion_casilla
    ADD CONSTRAINT chk_notificacion_casilla_estado CHECK (
        estado IN ('NO_LEIDO', 'LEIDO', 'PENDIENTE', 'NOTIFICADO')
    );

ALTER TABLE sigd_auth.notificacion_casilla
    DROP COLUMN IF EXISTS idempotency_key,
    DROP COLUMN IF EXISTS fecha_descarga,
    DROP COLUMN IF EXISTS persona_id;

COMMIT;
