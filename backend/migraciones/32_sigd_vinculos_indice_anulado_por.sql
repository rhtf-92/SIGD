-- =============================================================================
-- Migración 32 · Esquema sigd_auth · Índice FK anulado_por en Vínculos (Fase 5B)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Optimización de índices en llaves foráneas (Regla 4 Workspace)
-- Depende de: 31_sigd_vinculos_institucionales.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 32.1 Índice en llave foránea anulado_por (sigd_auth.vinculo_institucional)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vinculo_inst_anulado_por
    ON sigd_auth.vinculo_institucional (anulado_por)
    WHERE anulado_por IS NOT NULL;

COMMIT;
