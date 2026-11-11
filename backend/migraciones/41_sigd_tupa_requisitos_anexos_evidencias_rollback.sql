-- ==============================================================================
-- ROLLBACK MIGRACIÓN 41: Requisitos, Anexos, Evidencias y Subsanación TUPA (Fase 5F)
-- ARCHIVO: 41_sigd_tupa_requisitos_anexos_evidencias_rollback.sql
-- ==============================================================================

BEGIN;

-- 0. GUARDA FAIL-SAFE (Protección de Evidencias y Anexos Legítimos)
DO $$
BEGIN
    -- Si la tabla de evidencias existe y tiene filas reales, ABORTAR para impedir pérdida de datos
    IF EXISTS (
        SELECT 1
          FROM information_schema.tables
         WHERE table_schema = 'sigd_doc'
           AND table_name = 'expediente_evidencia_requisito'
    ) THEN
        IF EXISTS (SELECT 1 FROM sigd_doc.expediente_evidencia_requisito LIMIT 1) THEN
            RAISE EXCEPTION 'ROLLBACK ABORTADO (FAIL-SAFE): Existen evidencias reales registradas en sigd_doc.expediente_evidencia_requisito. El rollback destructivo está bloqueado para preservar la integridad probatoria y la cadena de custodia.';
        END IF;
    END IF;

    -- Si la tabla de anexos contiene formatos institucionales personalizados más allá de los iniciales sembrados
    IF EXISTS (
        SELECT 1
          FROM information_schema.tables
         WHERE table_schema = 'sigd_doc'
           AND table_name = 'tupa_anexo'
    ) THEN
        IF EXISTS (
            SELECT 1
              FROM sigd_doc.tupa_anexo a
             WHERE a.codigo NOT IN ('FUT_OFICIAL_2026', 'DJ_REPRESENTACION_2026')
             LIMIT 1
        ) THEN
            RAISE EXCEPTION 'ROLLBACK ABORTADO (FAIL-SAFE): Existen anexos institucionales en uso que no corresponden a la semilla base. El rollback destructivo está bloqueado.';
        END IF;
    END IF;
END $$;

-- 1. Eliminar tabla de evidencias por expediente (únicamente si está vacía)
DROP TABLE IF EXISTS sigd_doc.expediente_evidencia_requisito CASCADE;

-- 2. Revertir columnas agregadas en sigd_doc.tupa_requisito_documental
ALTER TABLE sigd_doc.tupa_requisito_documental
    DROP CONSTRAINT IF EXISTS tupa_requisito_documental_tipo_requisito_check,
    DROP COLUMN IF EXISTS id_anexo,
    DROP COLUMN IF EXISTS codigo,
    DROP COLUMN IF EXISTS regla_condicional,
    DROP COLUMN IF EXISTS proveniencia;

-- Restaurar el check constraint original
ALTER TABLE sigd_doc.tupa_requisito_documental
    ADD CONSTRAINT tupa_requisito_documental_tipo_requisito_check
    CHECK (tipo_requisito IN ('DOCUMENTAL', 'FINANCIERO', 'DECLARATIVO', 'INTERNO', 'AMBIGUO'));

-- 3. Eliminar tabla de anexos y formatos institucionales
DROP TABLE IF EXISTS sigd_doc.tupa_anexo CASCADE;

COMMIT;
