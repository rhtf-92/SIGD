-- =============================================================================
-- Migración 04 · Esquema sigd_doc
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Ricardo Arévalo Villacorta (B_AREVALO) · Grupo 6 CoreLink
-- Marco     : TUO Ley 27444 (silencio administrativo), Ley N° 27269
-- Depende de: 02_sigd_auth.sql, 03_sigd_org.sql
-- Contenido : TUPA, formularios JSON Schema 2020-12, expedientes y adjuntos S3
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS sigd_doc;

-- -----------------------------------------------------------------------------
-- 4.1 tipo_tramite_tupa (Ley del Procedimiento Administrativo General)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.tipo_tramite_tupa (
    tipo_tramite_id UUID        NOT NULL DEFAULT gen_random_uuid()
                              CONSTRAINT pk_tipo_tramite_tupa PRIMARY KEY,
    codigo          VARCHAR(30) NOT NULL UNIQUE,
    denominacion    VARCHAR(300) NOT NULL,
    descripcion     TEXT        NULL,
    unidad_organica VARCHAR(160) NOT NULL,
    plazo_dias      SMALLINT    NOT NULL DEFAULT 30,
    silencio_administrativo VARCHAR(30) NOT NULL DEFAULT 'POSITIVO',
    base_legal      VARCHAR(500) NULL,
    vigente         BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_tupa_silencio CHECK (silencio_administrativo IN ('POSITIVO', 'NEGATIVO')),
    CONSTRAINT chk_tupa_plazo CHECK (plazo_dias > 0)
);

COMMENT ON COLUMN sigd_doc.tipo_tramite_tupa.plazo_dias IS
    'Plazo máximo legal supletorio de 30 días hábiles (TUO Ley N° 27444, Art. 143).';

-- -----------------------------------------------------------------------------
-- 4.2 tipo_documento (tipos documentales oficiales)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.tipo_documento (
    tipo_documental_id UUID        NOT NULL DEFAULT gen_random_uuid()
                                CONSTRAINT pk_tipo_documento PRIMARY KEY,
    codigo             VARCHAR(30) NOT NULL UNIQUE,
    nombre             VARCHAR(160) NOT NULL,
    extension          VARCHAR(10) NOT NULL DEFAULT 'pdf',
    mime_type          VARCHAR(120) NOT NULL DEFAULT 'application/pdf',
    tamano_maximo_mb   SMALLINT    NOT NULL DEFAULT 25,
    exige_firma        BOOLEAN     NOT NULL DEFAULT FALSE,
    vigente            BOOLEAN     NOT NULL DEFAULT TRUE
);

-- -----------------------------------------------------------------------------
-- 4.3 formulario_version (JSON Schema 2020-12, inmutable)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.formulario_version (
    formulario_version_id UUID        NOT NULL DEFAULT gen_random_uuid()
                                    CONSTRAINT pk_formulario_version PRIMARY KEY,
    tipo_tramite_id       UUID        NOT NULL
                                    REFERENCES sigd_doc.tipo_tramite_tupa (tipo_tramite_id) ON DELETE RESTRICT,
    version              SMALLINT    NOT NULL,
    json_schema          JSONB       NOT NULL,
    vigente_desde        DATE        NOT NULL DEFAULT CURRENT_DATE,
    vigente_hasta        DATE        NULL,
    publicado_por        UUID        NULL,
    CONSTRAINT uq_formulario_version UNIQUE (tipo_tramite_id, version),
    CONSTRAINT chk_formulario_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

CREATE OR REPLACE FUNCTION sigd_doc.fn_proteger_formulario_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'sigd_doc.formulario_version es inmutable: % rechazado sobre la versión %',
        TG_OP, OLD.version
        USING ERRCODE = '23001',
              HINT = 'Cree una nueva versión del formulario en lugar de alterar una publicada.';
END;
$$;

DROP TRIGGER IF EXISTS tr_proteger_formulario_version ON sigd_doc.formulario_version;
CREATE TRIGGER tr_proteger_formulario_version
    BEFORE UPDATE OR DELETE ON sigd_doc.formulario_version
    FOR EACH ROW EXECUTE FUNCTION sigd_doc.fn_proteger_formulario_version();

-- -----------------------------------------------------------------------------
-- 4.4 expediente (instancia documental con ciclo de vida)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.expediente (
    expediente_id      UUID        NOT NULL DEFAULT gen_random_uuid()
                                 CONSTRAINT pk_doc_expediente PRIMARY KEY,
    tipo_tramite_id    UUID        NOT NULL
                                 REFERENCES sigd_doc.tipo_tramite_tupa (tipo_tramite_id) ON DELETE RESTRICT,
    formulario_version_id UUID    NULL
                                 REFERENCES sigd_doc.formulario_version (formulario_version_id) ON DELETE RESTRICT,
    codigo_expediente  VARCHAR(20) NOT NULL UNIQUE,
    asunto             VARCHAR(500) NOT NULL,
    area_actual_id     UUID        NULL
                                 REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT,
    solicitante_id     UUID        NOT NULL
                                 REFERENCES sigd_auth.persona (id_persona) ON DELETE RESTRICT,
    estado             VARCHAR(30) NOT NULL DEFAULT 'REGISTRADO',
    fecha_registro     TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_limite       TIMESTAMPTZ NULL,
    CONSTRAINT chk_doc_expediente_estado CHECK (estado IN (
        'REGISTRADO', 'EN_TRAMITE', 'OBSERVADO', 'RESUELTO', 'ANULADO'
    )),
    CONSTRAINT chk_doc_expediente_cut CHECK (codigo_expediente ~ '^EXP-[0-9]{4}-[0-9]{6}$')
);

CREATE INDEX IF NOT EXISTS idx_doc_expediente_tramite ON sigd_doc.expediente (tipo_tramite_id);
CREATE INDEX IF NOT EXISTS idx_doc_expediente_area ON sigd_doc.expediente (area_actual_id);
CREATE INDEX IF NOT EXISTS idx_doc_expediente_solicitante ON sigd_doc.expediente (solicitante_id);

-- -----------------------------------------------------------------------------
-- 4.5 expediente_formulario_respuesta (payloads JSONB)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.expediente_formulario_respuesta (
    id_respuesta        UUID        NOT NULL DEFAULT gen_random_uuid()
                                   CONSTRAINT pk_expediente_formulario_respuesta PRIMARY KEY,
    expediente_id       UUID        NOT NULL
                                   REFERENCES sigd_doc.expediente (expediente_id) ON DELETE CASCADE,
    formulario_version_id UUID      NOT NULL
                                   REFERENCES sigd_doc.formulario_version (formulario_version_id) ON DELETE RESTRICT,
    datos               JSONB       NOT NULL,
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_expediente_formulario UNIQUE (expediente_id, formulario_version_id)
);

-- -----------------------------------------------------------------------------
-- 4.6 requisito y su relación con el tipo documental
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.requisito (
    requisito_id  UUID        NOT NULL DEFAULT gen_random_uuid()
                             CONSTRAINT pk_requisito PRIMARY KEY,
    tipo_tramite_id UUID      NOT NULL
                             REFERENCES sigd_doc.tipo_tramite_tupa (tipo_tramite_id) ON DELETE CASCADE,
    codigo        VARCHAR(30) NOT NULL,
    denominacion  VARCHAR(300) NOT NULL,
    obligatorio   BOOLEAN     NOT NULL DEFAULT TRUE,
    orden         SMALLINT    NOT NULL DEFAULT 0,
    CONSTRAINT uq_requisito_tramite_codigo UNIQUE (tipo_tramite_id, codigo)
);

CREATE TABLE IF NOT EXISTS sigd_doc.tipo_documento_requisito (
    id_relacion       UUID        NOT NULL DEFAULT gen_random_uuid()
                                   CONSTRAINT pk_tipo_documento_requisito PRIMARY KEY,
    requisito_id      UUID        NOT NULL
                                   REFERENCES sigd_doc.requisito (requisito_id) ON DELETE CASCADE,
    tipo_documental_id UUID       NOT NULL
                                   REFERENCES sigd_doc.tipo_documento (tipo_documental_id) ON DELETE RESTRICT,
    condicion_json_pointer VARCHAR(200) NULL,
    CONSTRAINT uq_tipo_documento_requisito UNIQUE (requisito_id, tipo_documental_id)
);

CREATE TABLE IF NOT EXISTS sigd_doc.expediente_requisito (
    id_expediente_requisito UUID        NOT NULL DEFAULT gen_random_uuid()
                                         CONSTRAINT pk_expediente_requisito PRIMARY KEY,
    expediente_id  UUID        NOT NULL
                             REFERENCES sigd_doc.expediente (expediente_id) ON DELETE CASCADE,
    requisito_id   UUID        NOT NULL
                             REFERENCES sigd_doc.requisito (requisito_id) ON DELETE RESTRICT,
    cumplido       BOOLEAN     NOT NULL DEFAULT FALSE,
    documento_adjunto_id UUID NULL,
    verificado_en  TIMESTAMPTZ NULL,
    CONSTRAINT uq_expediente_requisito UNIQUE (expediente_id, requisito_id)
);

-- -----------------------------------------------------------------------------
-- 4.7 documento_adjunto (metadatos MinIO S3 + SHA-256)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.documento_adjunto (
    documento_adjunto_id UUID        NOT NULL DEFAULT gen_random_uuid()
                                   CONSTRAINT pk_documento_adjunto PRIMARY KEY,
    expediente_id  UUID        NOT NULL
                             REFERENCES sigd_doc.expediente (expediente_id) ON DELETE CASCADE,
    tipo_documental_id UUID    NOT NULL
                             REFERENCES sigd_doc.tipo_documento (tipo_documental_id) ON DELETE RESTRICT,
    nombre_archivo VARCHAR(255) NOT NULL,
    s3_bucket      VARCHAR(120) NOT NULL,
    s3_key         VARCHAR(500) NOT NULL,
    sha256         CHAR(64)    NOT NULL,
    tamano_bytes   BIGINT      NOT NULL,
    mime_type      VARCHAR(120) NOT NULL,
    magic_bytes    VARCHAR(16) NULL,
    subido_por     UUID        NULL,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_documento_adjunto_s3 UNIQUE (s3_bucket, s3_key),
    CONSTRAINT uq_documento_adjunto_sha UNIQUE (s3_bucket, sha256),
    CONSTRAINT chk_documento_adjunto_tamano CHECK (tamano_bytes > 0)
);

COMMENT ON COLUMN sigd_doc.documento_adjunto.sha256 IS
    'SHA-256 del binario. La restricción de unicidad por bucket habilita la deduplicación de objetos idénticos.';
COMMENT ON COLUMN sigd_doc.documento_adjunto.magic_bytes IS
    'Prefijo hexadecimal de los Magic Bytes (PDF = 25504446) verificados en la carga presignada.';

CREATE INDEX IF NOT EXISTS idx_documento_adjunto_expediente ON sigd_doc.documento_adjunto (expediente_id);
CREATE INDEX IF NOT EXISTS idx_documento_adjunto_sha ON sigd_doc.documento_adjunto (sha256);

-- -----------------------------------------------------------------------------
-- 4.8 resolucion (borradores y actos administrativos firmados)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.resolucion (
    resolucion_id  UUID        NOT NULL DEFAULT gen_random_uuid()
                              CONSTRAINT pk_resolucion PRIMARY KEY,
    expediente_id  UUID        NOT NULL
                              REFERENCES sigd_doc.expediente (expediente_id) ON DELETE RESTRICT,
    numero_borrador VARCHAR(40) NOT NULL,
    numero_resolucion VARCHAR(40) NULL,
    tipo_resolucion VARCHAR(40) NOT NULL,
    asunto         VARCHAR(500) NOT NULL,
    estado         VARCHAR(40) NOT NULL DEFAULT 'BORRADOR_PENDIENTE_FIRMA',
    fecha_proyeccion DATE      NOT NULL,
    proyectado_por UUID        NULL,
    firmado_por    UUID        NULL,
    firmado_en     TIMESTAMPTZ NULL,
    hash_pades     VARCHAR(128) NULL,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_resolucion_borrador UNIQUE (expediente_id, numero_borrador),
    CONSTRAINT chk_resolucion_tipo CHECK (tipo_resolucion IN (
        'DIRECTORAL_TITULACION', 'DIRECTORAL_CONVALIDACION', 'DIRECTORAL_ADMINISTRATIVA'
    )),
    CONSTRAINT chk_resolucion_estado CHECK (estado IN (
        'BORRADOR_PENDIENTE_FIRMA', 'EN_FIRMA', 'FIRMADA', 'NOTIFICADA', 'ANULADA'
    )),
    CONSTRAINT chk_resolucion_firma CHECK (estado NOT IN ('FIRMADA', 'NOTIFICADA') OR firmado_en IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_resolucion_estado ON sigd_doc.resolucion (estado);
CREATE INDEX IF NOT EXISTS idx_resolucion_proyeccion ON sigd_doc.resolucion (fecha_proyeccion);

-- -----------------------------------------------------------------------------
-- 4.9 firma_digital_documento (Evidencia legal de firma Refirma y Validador CVD)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.firma_digital_documento (
    documento_id       UUID         PRIMARY KEY
                                    REFERENCES sigd_doc.documento_adjunto (documento_adjunto_id) ON DELETE CASCADE,
    cvd                VARCHAR(40)  NOT NULL UNIQUE DEFAULT (
        'CVD-' ||
        to_char(current_date, 'YYYY') ||
        '-' ||
        upper(substr(md5(gen_random_uuid()::text), 1, 16))
    ),
    sha256_firmado     CHAR(64)     NOT NULL
                                    CONSTRAINT chk_firma_sha256 CHECK (sha256_firmado ~ '^[0-9a-fA-F]{64}$'),
    firmante           TEXT         NOT NULL,
    fecha_sello_tsa    TIMESTAMPTZ  NOT NULL,
    s3_bucket          VARCHAR(100) NOT NULL,
    s3_key             VARCHAR(500) NOT NULL,
    estado             VARCHAR(30)  NOT NULL DEFAULT 'FIRMADO_DIGITALMENTE'
                                    CONSTRAINT chk_firma_estado CHECK (estado = 'FIRMADO_DIGITALMENTE'),
    fecha_registro     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_firma_digital_cvd
    ON sigd_doc.firma_digital_documento (cvd);
CREATE INDEX IF NOT EXISTS idx_firma_digital_sha256
    ON sigd_doc.firma_digital_documento (sha256_firmado);

-- ============================================================================
-- 4.10 SEMILLAS CANÓNICAS TUPA IESTP SUIZA (ACTUALIZADO 2026)
-- ============================================================================
INSERT INTO sigd_doc.tipo_tramite_tupa (
    codigo, denominacion, descripcion, unidad_organica, plazo_dias, silencio_administrativo, base_legal, vigente
) VALUES
('TUPA-01', 'Expedición de Título Profesional Técnico', 'Requisitos: Pago del derecho en Tesorería (1.90% UIT Vigente - S/ 105.00), FUT, constancia de no adeudar y carpeta completa.', 'Dirección General', 30, 'NEGATIVO', 'Ley N° 30512', TRUE),
('TUPA-02', 'Certificado de Estudios Superiores (6 Semestres)', 'Requisitos: Pago del derecho en Tesorería (2.24% UIT Vigente - S/ 124.00) y FUT dirigido a Secretaría Académica.', 'Secretaría Académica', 7, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('TUPA-03', 'Visación de Certificado de Estudios Superiores', 'Requisitos: Pago del derecho en Tesorería (0.29% UIT Vigente - S/ 16.00) y presentación de certificados originales.', 'Secretaría Académica', 5, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('TUPA-04', 'Constancia de No Adeudar (Para Fines de Titulación)', 'Requisitos: Pago del derecho en Tesorería (0.30% UIT Vigente - S/ 16.50).', 'Unidad Administrativa', 3, 'POSITIVO', 'Ley N° 28693', TRUE),
('TUPA-05', 'Constancia de Egresado', 'Requisitos: Pago del derecho en Tesorería (S/ 31.00) y verificación de récord académico.', 'Secretaría Académica', 5, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('TUPA-06', 'Constancias Varias (Título, Estudios o Matrícula)', 'Requisitos: Pago del derecho en Tesorería (0.41% UIT Vigente - S/ 23.00) y FUT.', 'Secretaría Académica', 5, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('TUPA-07', 'Certificado Modular (I, II, III y IV)', 'Requisitos: Pago en Tesorería (S/ 100.00 por módulo) y emisión de B/V.', 'Secretaría Académica', 10, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('TUPA-08', 'Certificado de Bachillerato', 'Requisitos: Pago del derecho en Tesorería (0.75% UIT Vigente - S/ 42.00) y comprobante de pago.', 'Secretaría Académica', 15, 'POSITIVO', 'Ley N° 30512', TRUE),
('TUPA-09', 'Derecho de Duplicado de Título', 'Requisitos: Pago del derecho en Tesorería (5.61% UIT Vigente - S/ 309.00), publicación en diario y denuncia policial.', 'Dirección General', 30, 'NEGATIVO', 'Ley N° 30512', TRUE),
('TUPA-10', 'Modificación de Datos del Título', 'Requisitos: Pago del derecho en Tesorería (4.88% UIT Vigente - S/ 269.00) y partida/DNI rectificado.', 'Dirección General', 20, 'POSITIVO', 'Ley N° 30512', TRUE),
('TUPA-11', 'Convalidación entre Planes de Estudios', 'Requisitos: Pago del derecho en Tesorería (0.84% UIT Vigente - S/ 46.50) y sílabos visados.', 'Jefatura de Unidad Académica', 15, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('TUPA-12', 'Convalidación por Unidades de Competencia', 'Requisitos: Pago del derecho en Tesorería (0.84% UIT Vigente - S/ 46.50) y portafolio de evidencias.', 'Jefatura de Unidad Académica', 15, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('TUPA-13', 'Traslado Interno', 'Requisitos: Solicitud en FUT, vacante en carrera, Resolución Directoral (5.61% UIT Vigente - S/ 309.00).', 'Secretaría Académica', 10, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('TUPA-14', 'Traslado Externo', 'Requisitos: Solicitud en FUT dirigida al Director, vacante en carrera, Resolución Directoral (7.48% UIT Vigente - S/ 412.00).', 'Dirección General', 15, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('TUPA-15', 'Reserva de Matrícula - Ingresantes', 'Requisitos: Pago en Tesorería (1.20% UIT Vigente - S/ 66.00) y Resolución Directoral de Secretaría Académica.', 'Secretaría Académica', 5, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('TUPA-16', 'Licencia de Estudios - Estudiantes Antiguos', 'Requisitos: Pago en Tesorería (1.20% UIT Vigente - S/ 66.00) y Resolución Directoral de Secretaría Académica.', 'Secretaría Académica', 5, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('TUPA-17', 'Derecho de Reincorporación (Reingreso)', 'Requisitos: Pago en el Área de Tesorería (S/ 300.00) y FUT dirigido a Dirección.', 'Secretaría Académica', 10, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('TUPA-18', 'Examen de Recuperación / Subsanación con Jurado', 'Requisitos: Resolución Directoral, pago en Tesorería (0.60% UIT Vigente - S/ 33.00 a 1.27% UIT Vigente - S/ 70.00).', 'Jefatura de Unidad Académica', 5, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('TUPA-19', 'Evaluación Extraordinaria', 'Requisitos: Pago en Tesorería (1.27% a 1.68% UIT Vigente - S/ 70.00 a S/ 93.00) según RM 069.', 'Jefatura de Unidad Académica', 7, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('TUPA-20', 'Prueba de Suficiencia Académica', 'Requisitos: Resolución Directoral, pago en Tesorería (1.90% UIT Vigente - S/ 105.00).', 'Jefatura de Unidad Académica', 10, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('TUPA-21', 'Devolución de Expediente', 'Requisitos: Pago del derecho en Tesorería (0.37% UIT Vigente - S/ 21.00) y FUT de solicitud.', 'Mesa de Partes', 3, 'POSITIVO', 'TUO Ley N° 27444', TRUE),
('TUPA-22', 'Acceso a la Información Pública', 'Requisitos: Solicitud dirigida a Dirección en FUT (Costo de reproducción: 0.19% UIT Vigente - S/ 10.50).', 'Dirección General', 10, 'POSITIVO', 'Ley N° 27806', TRUE),
('TUPA-23', 'Búsqueda y Duplicados de Boletas / Sílabos', 'Requisitos: Pago del derecho en Tesorería (0.19% UIT Vigente - S/ 10.50).', 'Secretaría Académica', 3, 'POSITIVO', 'Ley N° 28693', TRUE)
ON CONFLICT (codigo) DO UPDATE SET
    denominacion = EXCLUDED.denominacion,
    descripcion = EXCLUDED.descripcion,
    unidad_organica = EXCLUDED.unidad_organica,
    plazo_dias = EXCLUDED.plazo_dias,
    silencio_administrativo = EXCLUDED.silencio_administrativo,
    base_legal = EXCLUDED.base_legal,
    vigente = EXCLUDED.vigente;

