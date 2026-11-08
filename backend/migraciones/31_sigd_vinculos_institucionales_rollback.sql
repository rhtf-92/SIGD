-- =============================================================================
-- Rollback 31 · Esquema sigd_auth · Vínculos Institucionales (Fase 5B)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS sigd_auth.vinculo_institucional CASCADE;
DROP TABLE IF EXISTS sigd_auth.tipo_vinculo_institucional CASCADE;

COMMIT;
