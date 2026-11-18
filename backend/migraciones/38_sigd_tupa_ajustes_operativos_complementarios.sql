-- =============================================================================
-- Migración 38 · Esquema sigd_doc · Ajustes Operativos TUPA Complementarios
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Compatibilidad de valores de proveniencia canónica y legado
-- Depende de: 37_sigd_tupa_ajustes_operativos.sql
-- =============================================================================

BEGIN;

-- Actualización del constraint de fuentes de proveniencia para abarcar valores canónicos y de compatibilidad
ALTER TABLE sigd_doc.tupa_campo_procedencia
    DROP CONSTRAINT IF EXISTS chk_tupa_campo_proc_fuente;

ALTER TABLE sigd_doc.tupa_campo_procedencia
    ADD CONSTRAINT chk_tupa_campo_proc_fuente
    CHECK (fuente IN (
        'OFICIAL_SUIZA',
        'REFERENCIA_EXTERNA',
        'DISEÑO_SIGD',
        'NO_DETERMINADO',
        'OFICIAL',
        'DEFAULT',
        'PROPUESTA',
        'REFERENCIA'
    ));

COMMENT ON CONSTRAINT chk_tupa_campo_proc_fuente ON sigd_doc.tupa_campo_procedencia IS
    'Valores permitidos de proveniencia de campos TUPA (fuentes canónicas 5E y legado compatible).';

COMMIT;
