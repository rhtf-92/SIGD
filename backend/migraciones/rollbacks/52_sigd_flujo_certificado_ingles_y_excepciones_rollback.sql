-- =============================================================================
-- ROLLBACK MIGRACIÓN 52: Flujo de Negocio Certificado de Inglés y Excepciones
-- SIGD 2026
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS tr_flujo_historial_no_truncar ON sigd_rut.expediente_flujo_historial;
DROP TRIGGER IF EXISTS tr_flujo_historial_inmutable ON sigd_rut.expediente_flujo_historial;
DROP FUNCTION IF EXISTS sigd_rut.fn_rechazar_mutacion_flujo_historial();

DROP TABLE IF EXISTS sigd_rut.expediente_flujo_historial CASCADE;
DROP TABLE IF EXISTS sigd_rut.expediente_flujo_certificado CASCADE;

COMMIT;
