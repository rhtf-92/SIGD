-- ==============================================================================
-- MIGRACIÓN 42: Ajuste de Proveniencia Segura y Modelo de Homologación de Requisitos TUPA (Fase 5F)
-- ARCHIVO: 42_sigd_tupa_proveniencia_y_homologacion_requisitos.sql
-- ==============================================================================

BEGIN;

-- 1. Modificar el DEFAULT de proveniencia en tupa_requisito_documental a NO_DETERMINADO
ALTER TABLE sigd_doc.tupa_requisito_documental
    ALTER COLUMN proveniencia SET DEFAULT 'NO_DETERMINADO';

-- 2. Incorporar estado de homologación institucional para desacoplar requisitos de diseño de obligaciones de radicación
ALTER TABLE sigd_doc.tupa_requisito_documental
    ADD COLUMN IF NOT EXISTS estado_homologacion VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_HOMOLOGACION'
        CHECK (estado_homologacion IN ('PENDIENTE_HOMOLOGACION', 'HOMOLOGADO', 'HISTORICO', 'ANULADO'));

CREATE INDEX IF NOT EXISTS idx_tupa_req_estado_homologacion
    ON sigd_doc.tupa_requisito_documental(estado_homologacion);

-- 3. Extender sigd_doc.tupa_anexo con trazabilidad de procedencia y fuente original
ALTER TABLE sigd_doc.tupa_anexo
    ADD COLUMN IF NOT EXISTS proveniencia VARCHAR(30) NOT NULL DEFAULT 'NO_DETERMINADO'
        CHECK (proveniencia IN ('OFICIAL_SUIZA', 'REFERENCIA_EXTERNA', 'DISEÑO_SIGD', 'NO_DETERMINADO')),
    ADD COLUMN IF NOT EXISTS fuente_original VARCHAR(250) NOT NULL DEFAULT 'NO_DETERMINADO';

CREATE INDEX IF NOT EXISTS idx_tupa_anexo_proveniencia
    ON sigd_doc.tupa_anexo(proveniencia);

-- 4. Reclasificar los formatos base preliminares como DISEÑO_SIGD y desactivar descarga pública hasta existencia de archivo real en storage
UPDATE sigd_doc.tupa_anexo
   SET proveniencia = 'DISEÑO_SIGD',
       fuente_original = 'Propuesta de diseño SIGD 2026 (Pendiente de verificación institucional y carga de archivo en MinIO)',
       activo = false,
       es_descargable = false
 WHERE codigo IN ('FUT_OFICIAL_2026', 'DJ_REPRESENTACION_2026');

COMMIT;
