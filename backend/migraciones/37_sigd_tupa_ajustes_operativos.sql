-- =============================================================================
-- Migración 37 · Esquema sigd_doc · Ajustes Operativos TUPA 5E
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Tri-estado de genera_expediente y proveniencia canónica por campo
-- Depende de: 36_sigd_tupa_versionamiento_operativo.sql
-- =============================================================================

BEGIN;

-- 1. Tri-estado para genera_expediente (SI = true, NO = false, NO_DETERMINADO = NULL)
ALTER TABLE sigd_doc.tupa_procedimiento
    ALTER COLUMN genera_expediente DROP NOT NULL,
    ALTER COLUMN genera_expediente SET DEFAULT NULL;

COMMENT ON COLUMN sigd_doc.tupa_procedimiento.genera_expediente IS
    'Indicador de generación de expediente documentario: true (SI), false (NO), NULL (NO_DETERMINADO).';

-- 2. Actualización de constraint de proveniencia en tupa_campo_procedencia
ALTER TABLE sigd_doc.tupa_campo_procedencia
    DROP CONSTRAINT IF EXISTS chk_tupa_campo_proc_fuente;

ALTER TABLE sigd_doc.tupa_campo_procedencia
    ADD CONSTRAINT chk_tupa_campo_proc_fuente
    CHECK (fuente IN ('OFICIAL_SUIZA', 'REFERENCIA_EXTERNA', 'DISEÑO_SIGD', 'NO_DETERMINADO'));

-- 3. Permitir que id_registro_version sea opcional en tupa_campo_procedencia para nuevos procedimientos
ALTER TABLE sigd_doc.tupa_campo_procedencia
    ALTER COLUMN id_registro_version DROP NOT NULL;

COMMIT;
