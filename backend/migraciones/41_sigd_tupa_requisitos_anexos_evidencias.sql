-- ==============================================================================
-- MIGRACIÓN 41: Requisitos, Anexos, Evidencias y Subsanación por Procedimiento TUPA (Fase 5F)
-- ARCHIVO: 41_sigd_tupa_requisitos_anexos_evidencias.sql
-- ==============================================================================

BEGIN;

-- 1. Tabla de Anexos y Formatos Institucionales Suministrados por el IESTP Suiza
CREATE TABLE IF NOT EXISTS sigd_doc.tupa_anexo (
    id_anexo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(250) NOT NULL,
    descripcion TEXT,
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    nombre_archivo VARCHAR(250) NOT NULL,
    s3_bucket VARCHAR(100) NOT NULL DEFAULT 'sigd-expedientes',
    s3_key VARCHAR(500) NOT NULL,
    sha256 CHAR(64),
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    tamano_bytes BIGINT NOT NULL DEFAULT 0,
    es_descargable BOOLEAN NOT NULL DEFAULT true,
    activo BOOLEAN NOT NULL DEFAULT true,
    id_procedimiento UUID REFERENCES sigd_doc.tupa_procedimiento(id_procedimiento) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices en llaves foráneas y consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_tupa_anexo_proc 
    ON sigd_doc.tupa_anexo(id_procedimiento) 
    WHERE id_procedimiento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tupa_anexo_codigo 
    ON sigd_doc.tupa_anexo(codigo);

-- 2. Ampliación canónica de sigd_doc.tupa_requisito_documental
-- A. Actualizar CHECK constraint para incluir tipología ampliada (DOCUMENTAL, DECLARATIVO, FINANCIERO, DATO_INTERNO, GENERADO_INSTITUCION, CONDICIONAL, INTERNO, AMBIGUO)
ALTER TABLE sigd_doc.tupa_requisito_documental 
    DROP CONSTRAINT IF EXISTS tupa_requisito_documental_tipo_requisito_check;

ALTER TABLE sigd_doc.tupa_requisito_documental 
    ADD CONSTRAINT tupa_requisito_documental_tipo_requisito_check 
    CHECK (tipo_requisito IN ('DOCUMENTAL', 'DECLARATIVO', 'FINANCIERO', 'DATO_INTERNO', 'GENERADO_INSTITUCION', 'CONDICIONAL', 'INTERNO', 'AMBIGUO'));

-- B. Agregar columnas de anexo referenciado, código, reglas condicionales y proveniencia
ALTER TABLE sigd_doc.tupa_requisito_documental
    ADD COLUMN IF NOT EXISTS id_anexo UUID REFERENCES sigd_doc.tupa_anexo(id_anexo) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS codigo VARCHAR(50) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS regla_condicional JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS proveniencia VARCHAR(30) NOT NULL DEFAULT 'DISEÑO_SIGD'
        CHECK (proveniencia IN ('OFICIAL_SUIZA', 'REFERENCIA_EXTERNA', 'DISEÑO_SIGD', 'NO_DETERMINADO'));

CREATE INDEX IF NOT EXISTS idx_tupa_req_anexo 
    ON sigd_doc.tupa_requisito_documental(id_anexo) 
    WHERE id_anexo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tupa_req_proveniencia 
    ON sigd_doc.tupa_requisito_documental(proveniencia);

-- 3. Tabla de Evidencias Presentadas y Subsanación por Expediente
CREATE TABLE IF NOT EXISTS sigd_doc.expediente_evidencia_requisito (
    id_evidencia UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE CASCADE,
    id_requisito UUID NOT NULL REFERENCES sigd_doc.tupa_requisito_documental(id_requisito) ON DELETE RESTRICT,
    tipo_evidencia VARCHAR(30) NOT NULL 
        CHECK (tipo_evidencia IN ('DOCUMENTO', 'PAGO', 'DECLARACION', 'DATO_INTERNO', 'GENERADO_INSTITUCION')),
    documento_adjunto_id UUID REFERENCES sigd_doc.documento_adjunto(documento_adjunto_id) ON DELETE SET NULL,
    orden_pago_id UUID REFERENCES sigd_tra.orden_pago(orden_pago_id) ON DELETE SET NULL,
    datos_declaracion JSONB DEFAULT NULL,
    id_persona UUID NOT NULL REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT,
    id_usuario UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE SET NULL,
    canal VARCHAR(20) NOT NULL DEFAULT 'VIRTUAL' 
        CHECK (canal IN ('VIRTUAL', 'PRESENCIAL')),
    estado_validacion VARCHAR(30) NOT NULL DEFAULT 'PRESENTADO' 
        CHECK (estado_validacion IN ('PENDIENTE', 'PRESENTADO', 'VALIDADO', 'OBSERVADO', 'SUBSANADO', 'NO_APLICA')),
    es_subsanacion BOOLEAN NOT NULL DEFAULT false,
    evidencia_previa_id UUID REFERENCES sigd_doc.expediente_evidencia_requisito(id_evidencia) ON DELETE SET NULL,
    observacion TEXT,
    validado_por UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE SET NULL,
    validado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices en llaves foráneas y búsquedas de estado y subsanación (Regla 4)
CREATE INDEX IF NOT EXISTS idx_evid_req_expediente 
    ON sigd_doc.expediente_evidencia_requisito(expediente_id, id_requisito);

CREATE INDEX IF NOT EXISTS idx_evid_req_persona 
    ON sigd_doc.expediente_evidencia_requisito(id_persona);

CREATE INDEX IF NOT EXISTS idx_evid_req_usuario 
    ON sigd_doc.expediente_evidencia_requisito(id_usuario) 
    WHERE id_usuario IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evid_req_doc 
    ON sigd_doc.expediente_evidencia_requisito(documento_adjunto_id) 
    WHERE documento_adjunto_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evid_req_pago 
    ON sigd_doc.expediente_evidencia_requisito(orden_pago_id) 
    WHERE orden_pago_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evid_req_previa 
    ON sigd_doc.expediente_evidencia_requisito(evidencia_previa_id) 
    WHERE evidencia_previa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evid_req_estado 
    ON sigd_doc.expediente_evidencia_requisito(expediente_id, estado_validacion);

-- 4. Semilla Canónica de Formatos Institucionales Base (Anexos Oficiales IESTP Suiza)
INSERT INTO sigd_doc.tupa_anexo (
    codigo,
    nombre,
    descripcion,
    version,
    nombre_archivo,
    s3_bucket,
    s3_key,
    sha256,
    mime_type,
    tamano_bytes,
    es_descargable,
    activo
) VALUES 
(
    'FUT_OFICIAL_2026',
    'Formulario Único de Trámite (FUT)',
    'Formato oficial institucional para la presentación de solicitudes ante el IESTP Suiza.',
    '2026.1',
    'FUT_OFICIAL_IESTP_SUIZA_2026.pdf',
    'sigd-expedientes',
    'tupa/formatos/FUT_OFICIAL_IESTP_SUIZA_2026.pdf',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'application/pdf',
    45120,
    true,
    true
),
(
    'DJ_REPRESENTACION_2026',
    'Declaración Jurada de Representación Legal / Apoderado',
    'Formato institucional para acreditar representación cuando el trámite lo suscribe un tercero apoderado.',
    '2026.1',
    'DJ_REPRESENTACION_IESTP_SUIZA_2026.pdf',
    'sigd-expedientes',
    'tupa/formatos/DJ_REPRESENTACION_IESTP_SUIZA_2026.pdf',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'application/pdf',
    38400,
    true,
    true
)
ON CONFLICT (codigo) DO NOTHING;

-- Asociar el anexo FUT a los requisitos documentales que mencionan expresamente "FUT" o "Solicitud"
UPDATE sigd_doc.tupa_requisito_documental r
   SET id_anexo = a.id_anexo,
       codigo = 'REQ-' || LPAD(r.orden::text, 2, '0')
  FROM sigd_doc.tupa_anexo a
 WHERE a.codigo = 'FUT_OFICIAL_2026'
   AND (LOWER(r.nombre) LIKE '%fut%' OR LOWER(r.nombre) LIKE '%solicitud%')
   AND r.id_anexo IS NULL;

-- Asignar códigos correlativos por procedimiento para el resto de requisitos
UPDATE sigd_doc.tupa_requisito_documental
   SET codigo = 'REQ-' || LPAD(orden::text, 2, '0')
 WHERE codigo IS NULL;

COMMIT;
