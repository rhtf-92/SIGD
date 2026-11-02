-- ==============================================================================
-- MIGRACIÓN 24: Estructuración de Requisitos Documentales por Procedimiento TUPA
-- ARCHIVO: 24_sigd_tupa_requisitos_documentales.sql
-- ==============================================================================

BEGIN;

-- 1. Crear tabla de requisitos documentales por procedimiento TUPA
CREATE TABLE IF NOT EXISTS sigd_doc.tupa_requisito_documental (
    id_requisito UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_procedimiento UUID NOT NULL REFERENCES sigd_doc.tupa_procedimiento(id_procedimiento) ON DELETE CASCADE,
    registro_version_id UUID REFERENCES sigd_doc.tupa_registro_version(registro_version_id) ON DELETE RESTRICT,
    nombre VARCHAR(250) NOT NULL,
    descripcion TEXT,
    tipo_requisito VARCHAR(40) NOT NULL CHECK (tipo_requisito IN ('DOCUMENTAL', 'FINANCIERO', 'DECLARATIVO', 'INTERNO', 'AMBIGUO')),
    es_anexo_digital BOOLEAN NOT NULL DEFAULT false,
    obligatorio BOOLEAN NOT NULL DEFAULT true,
    orden SMALLINT NOT NULL DEFAULT 1,
    formatos_permitidos VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    activo BOOLEAN NOT NULL DEFAULT true,
    fuente_original TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices en llaves foráneas y tipos de datos (Regla 4)
CREATE INDEX IF NOT EXISTS idx_tupa_req_procedimiento 
    ON sigd_doc.tupa_requisito_documental(id_procedimiento, orden);

CREATE INDEX IF NOT EXISTS idx_tupa_req_registro_version 
    ON sigd_doc.tupa_requisito_documental(registro_version_id);

CREATE INDEX IF NOT EXISTS idx_tupa_req_tipo 
    ON sigd_doc.tupa_requisito_documental(tipo_requisito);

CREATE INDEX IF NOT EXISTS idx_tupa_req_anexo_activo 
    ON sigd_doc.tupa_requisito_documental(id_procedimiento, es_anexo_digital) 
    WHERE activo = true;

-- 3. Vincular documentos adjuntos al requisito documental específico (opcional/nullable)
ALTER TABLE sigd_doc.documento_adjunto
    ADD COLUMN IF NOT EXISTS id_requisito UUID REFERENCES sigd_doc.tupa_requisito_documental(id_requisito) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_doc_adjunto_requisito 
    ON sigd_doc.documento_adjunto(id_requisito) 
    WHERE id_requisito IS NOT NULL;

-- 4. Semilla controlada a partir de los 72 procedimientos existentes en sigd_doc.tupa_procedimiento
INSERT INTO sigd_doc.tupa_requisito_documental (
    id_procedimiento,
    registro_version_id,
    nombre,
    descripcion,
    tipo_requisito,
    es_anexo_digital,
    obligatorio,
    orden,
    fuente_original
)
SELECT
    p.id_procedimiento,
    p.registro_version_id,
    TRIM(elem.req) AS nombre,
    CASE 
        WHEN LOWER(elem.req) LIKE '%solicitud%' OR LOWER(elem.req) LIKE '%fut%' OR LOWER(elem.req) LIKE '%ficha%' OR LOWER(elem.req) LIKE '%informe%' OR LOWER(elem.req) LIKE '%papeleta%'
            THEN 'Documento o anexo probatorio requerido en formato PDF.'
        WHEN LOWER(elem.req) LIKE '%pago%' OR LOWER(elem.req) LIKE '%uit vigente%' OR LOWER(elem.req) LIKE '%precio%'
            THEN 'Requisito financiero liquidado mediante orden de pago oficial de Tesorería.'
        WHEN LOWER(elem.req) LIKE '%emisi%' OR LOWER(elem.req) LIKE '%resoluci%' OR LOWER(elem.req) LIKE '%control%' OR LOWER(elem.req) LIKE '%prove%' OR LOWER(elem.req) LIKE '%supervisi%'
            THEN 'Actuación o verificación interna del despacho o secretaría técnica.'
        WHEN LOWER(elem.req) LIKE '%vacante%' OR LOWER(elem.req) LIKE '%contrato%'
            THEN 'Condición declarativa o contractual previa requerida por la institución.'
        ELSE 'Requisito administrativo del catálogo TUPA 2026.'
    END AS descripcion,
    CASE
        WHEN LOWER(elem.req) LIKE '%solicitud%' OR LOWER(elem.req) LIKE '%fut%' OR LOWER(elem.req) LIKE '%ficha%' OR LOWER(elem.req) LIKE '%informe%' OR LOWER(elem.req) LIKE '%papeleta%'
            THEN 'DOCUMENTAL'
        WHEN LOWER(elem.req) LIKE '%pago%' OR LOWER(elem.req) LIKE '%uit vigente%' OR LOWER(elem.req) LIKE '%precio%' OR LOWER(elem.req) LIKE '%kg:%' OR LOWER(elem.req) LIKE '%en pie:%' OR LOWER(elem.req) LIKE '%pichones%' OR LOWER(elem.req) LIKE '%reproductor%' OR LOWER(elem.req) LIKE '%carne:%'
            THEN 'FINANCIERO'
        WHEN LOWER(elem.req) LIKE '%emisi%' OR LOWER(elem.req) LIKE '%resoluci%' OR LOWER(elem.req) LIKE '%control%' OR LOWER(elem.req) LIKE '%prove%' OR LOWER(elem.req) LIKE '%supervisi%' OR LOWER(elem.req) LIKE '%unidad administrativa deriva%'
            THEN 'INTERNO'
        WHEN LOWER(elem.req) LIKE '%vacante%' OR LOWER(elem.req) LIKE '%suscripción del contrato%'
            THEN 'DECLARATIVO'
        ELSE 'AMBIGUO'
    END AS tipo_requisito,
    CASE
        WHEN LOWER(elem.req) LIKE '%solicitud%' OR LOWER(elem.req) LIKE '%fut%' OR LOWER(elem.req) LIKE '%ficha%' OR LOWER(elem.req) LIKE '%informe%' OR LOWER(elem.req) LIKE '%papeleta%'
            THEN true
        ELSE false
    END AS es_anexo_digital,
    true AS obligatorio,
    elem.ord::smallint AS orden,
    TRIM(elem.req) AS fuente_original
FROM sigd_doc.tupa_procedimiento p
CROSS JOIN LATERAL jsonb_array_elements_text(p.requisitos) WITH ORDINALITY AS elem(req, ord)
WHERE NOT EXISTS (
    SELECT 1 FROM sigd_doc.tupa_requisito_documental r WHERE r.id_procedimiento = p.id_procedimiento
);

COMMIT;
