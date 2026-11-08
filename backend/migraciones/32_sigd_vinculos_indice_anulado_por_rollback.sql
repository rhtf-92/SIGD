-- =============================================================================
-- Rollback 32 · Esquema sigd_auth · Índice FK anulado_por en Vínculos (Fase 5B)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- =============================================================================

BEGIN;

DROP INDEX IF EXISTS sigd_auth.idx_vinculo_inst_anulado_por;

COMMIT;
