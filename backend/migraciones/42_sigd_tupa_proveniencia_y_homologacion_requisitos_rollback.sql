-- ==============================================================================
-- ROLLBACK MIGRACIÓN 42: Ajuste de Proveniencia Segura y Modelo de Homologación de Requisitos TUPA (Fase 5F)
-- ARCHIVO: 42_sigd_tupa_proveniencia_y_homologacion_requisitos_rollback.sql
-- ==============================================================================

BEGIN;

-- 0. GUARDA FAIL-SAFE: Abortar si algún requisito ha sido formalmente homologado
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'sigd_doc'
           AND table_name = 'tupa_requisito_documental'
           AND column_name = 'estado_homologacion'
    ) THEN
        IF EXISTS (
            SELECT 1
              FROM sigd_doc.tupa_requisito_documental
             WHERE estado_homologacion = 'HOMOLOGADO'
             LIMIT 1
        ) THEN
            RAISE EXCEPTION 'ROLLBACK ABORTADO (FAIL-SAFE): Existen requisitos con estado HOMOLOGADO. No se permite revertir la gobernanza de homologación sin proceso de des-homologación formal.';
        END IF;
    END IF;
END $$;

-- 1. Revertir cambios en sigd_doc.tupa_anexo
DROP INDEX IF EXISTS sigd_doc.idx_tupa_anexo_proveniencia;

ALTER TABLE sigd_doc.tupa_anexo
    DROP COLUMN IF EXISTS proveniencia,
    DROP COLUMN IF EXISTS fuente_original;

UPDATE sigd_doc.tupa_anexo
   SET activo = true,
       es_descargable = true
 WHERE codigo IN ('FUT_OFICIAL_2026', 'DJ_REPRESENTACION_2026');

-- 2. Revertir columnas e índices en sigd_doc.tupa_requisito_documental
DROP INDEX IF EXISTS sigd_doc.idx_tupa_req_estado_homologacion;

ALTER TABLE sigd_doc.tupa_requisito_documental
    DROP COLUMN IF EXISTS estado_homologacion;

ALTER TABLE sigd_doc.tupa_requisito_documental
    ALTER COLUMN proveniencia SET DEFAULT 'DISEÑO_SIGD';

COMMIT;
