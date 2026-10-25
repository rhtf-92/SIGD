-- =============================================================================
-- Rollback 15 · Solicitudes de Acceso al TUPA y Trámites Dinámicos No Documentarios
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- =============================================================================

DROP TABLE IF EXISTS sigd_doc.solicitud_tramite_dinamico CASCADE;
DROP SEQUENCE IF EXISTS sigd_doc.secuencia_solicitud_dinamica_2026;
DROP TABLE IF EXISTS sigd_doc.tupa_solicitud_acceso CASCADE;
