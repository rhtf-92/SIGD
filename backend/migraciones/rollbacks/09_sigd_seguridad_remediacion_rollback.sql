-- =============================================================================
-- SIGD 2026 — SCRIPT DE ROLLBACK PARA MIGRACIÓN 09
-- Archivo: rollbacks/09_sigd_seguridad_remediacion_rollback.sql
-- Propósito: Revertir de manera segura y limpia los cambios de 09.
-- Ubicación: Subdirectorio 'rollbacks/' (aislado del runner forward-only).
-- =============================================================================

BEGIN;

-- Revertir SEC-06 (Privilegios y roles)
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA sigd_tra, sigd_rut, sigd_doc, sigd_auth FROM sigd_app;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA sigd_auth, sigd_org, sigd_doc, sigd_tra, sigd_rut, sigd_audit FROM sigd_app;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA sigd_auth, sigd_org, sigd_doc, sigd_tra, sigd_rut, sigd_audit FROM sigd_app;
REVOKE ALL PRIVILEGES ON SCHEMA sigd_auth, sigd_org, sigd_doc, sigd_tra, sigd_rut, sigd_audit FROM sigd_app;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sigd_reportes') THEN
        EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA sigd_reportes FROM sigd_app';
        EXECUTE 'REVOKE ALL PRIVILEGES ON SCHEMA sigd_reportes FROM sigd_app';
    END IF;
END $$;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA sigd_audit FROM sigd_worker;
REVOKE ALL PRIVILEGES ON TABLE sigd_audit.evento_outbox FROM sigd_worker;
REVOKE ALL PRIVILEGES ON SCHEMA sigd_audit FROM sigd_worker;

-- Revertir SEC-08 (Salvaguarda de Evidencias LPDP)
DROP TRIGGER IF EXISTS tr_prevenir_borrado_persona_con_evidencia ON sigd_auth.persona;
DROP TRIGGER IF EXISTS tr_prevenir_borrado_persona_con_expedientes ON sigd_auth.persona;
DROP FUNCTION IF EXISTS sigd_auth.fn_prevenir_borrado_persona_con_evidencia();
DROP FUNCTION IF EXISTS sigd_auth.fn_prevenir_borrado_persona_con_expedientes();

-- Revertir DAT-01 (Triggers WORM)
DROP TRIGGER IF EXISTS tr_bloquear_truncate_movimiento ON sigd_rut.movimiento_tramite;
DROP FUNCTION IF EXISTS sigd_rut.fn_rechazar_truncate_movimiento();
DROP TRIGGER IF EXISTS tr_bloquear_mutacion_movimiento ON sigd_rut.movimiento_tramite;
DROP FUNCTION IF EXISTS sigd_rut.fn_rechazar_mutacion_movimiento();

COMMIT;
