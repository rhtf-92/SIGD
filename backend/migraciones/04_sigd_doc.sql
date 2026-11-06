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

-- -----------------------------------------------------------------------------
-- 4.10 Semillas canónicas tipo_documento IESTP Suiza
-- -----------------------------------------------------------------------------
INSERT INTO sigd_doc.tipo_documento (
    tipo_documental_id, codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente
) VALUES
('00000000-0000-0000-0000-000000000001', 'SOLICITUD', 'Solicitud', 'pdf', 'application/pdf', 25, FALSE, TRUE),
('00000000-0000-0000-0000-000000000002', 'OFICIO', 'Oficio', 'pdf', 'application/pdf', 25, TRUE, TRUE),
('00000000-0000-0000-0000-000000000003', 'MEMORANDO', 'Memorando', 'pdf', 'application/pdf', 25, TRUE, TRUE),
('00000000-0000-0000-0000-000000000004', 'INFORME', 'Informe Técnico', 'pdf', 'application/pdf', 25, TRUE, TRUE),
('00000000-0000-0000-0000-000000000005', 'RESOLUCION', 'Resolución Directoral', 'pdf', 'application/pdf', 25, TRUE, TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4.11 Semillas canónicas TUPA IESTP Suiza (48 Procedimientos + LIBRE-01)
-- -----------------------------------------------------------------------------
INSERT INTO sigd_doc.tipo_tramite_tupa (
    tipo_tramite_id, codigo, denominacion, descripcion, unidad_organica, plazo_dias, silencio_administrativo, base_legal, vigente
) VALUES
('00000000-0000-0000-0001-000000000001', 'TUPA-01', 'Certificado de estudios', 'Expedición de certificados oficiales por semestre o ciclo completo', 'Secretaría Académica', 5, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('00000000-0000-0000-0001-000000000002', 'TUPA-02', 'Convalidación de estudios interna y externa', 'Convalidación de asignaturas y unidades didácticas internas y externas', 'Unidad Académica', 30, 'NEGATIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000003', 'TUPA-03', 'Constancia de aprobación de prácticas', 'Constancia institucional de aprobación de prácticas pre-profesionales', 'Secretaría Académica', 1, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('00000000-0000-0000-0001-000000000004', 'TUPA-04', 'Carta de presentación', 'Carta formal de presentación para prácticas formativas en empresas', 'Mesa de Partes', 1, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('00000000-0000-0000-0001-000000000005', 'TUPA-05', 'Aprobación de borrador de informe de práctica profesional', 'Revisión y aprobación de borrador de informe de prácticas', 'Área Académica', 7, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('00000000-0000-0000-0001-000000000006', 'TUPA-06', 'Calificación de informe de práctica', 'Evaluación y calificación docente del informe de práctica', 'Área Académica', 2, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('00000000-0000-0000-0001-000000000007', 'TUPA-07', 'Convalidación de informes de prácticas empresariales', 'Convalidación de informes de prácticas empresariales e institucionales', 'Área Académica', 3, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('00000000-0000-0000-0001-000000000008', 'TUPA-08', 'Módulo I-A al VI-A / Módulo I-B al VI-B', 'Evaluación y certificación modular técnico-profesional', 'Área Académica', 30, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000009', 'TUPA-09', 'Derecho de titulación', 'Trámite de titulación profesional técnica a nombre de la Nación', 'Secretaría General', 15, 'NEGATIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000010', 'TUPA-10', 'Constancia de no adeudar', 'Constancia institucional de no adeudar bienes, dinero ni libros', 'Administración', 1, 'POSITIVO', 'TUO Ley N° 27444', TRUE),
('00000000-0000-0000-0001-000000000011', 'TUPA-11', 'Constancia de egresado', 'Expedición de constancia oficial de egresado', 'Secretaría Académica', 2, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('00000000-0000-0000-0001-000000000012', 'TUPA-12', 'Carné de estudiante', 'Trámite y expedición de carné de educación superior tecnológica', 'Biblioteca', 30, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000013', 'TUPA-13', 'Evaluación extraordinaria / subsanación de asignatura', 'Examen extraordinario de subsanación de unidades didácticas pendientes', 'Secretaría Académica', 2, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('00000000-0000-0000-0001-000000000014', 'TUPA-14', 'Pago al momento de matricularse', 'Conceptos complementarios de matrícula por repitencia o examen de cargo', 'Secretaría Académica', 2, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('00000000-0000-0000-0001-000000000015', 'TUPA-15', 'Examen extraordinario de asignaturas y/o unidad didáctica', 'Examen extraordinario por unidad didáctica no cursada regularmente', 'Unidad Académica', 30, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('00000000-0000-0000-0001-000000000016', 'TUPA-16', 'Traslado interno', 'Traslado de programa de estudios dentro del instituto', 'Mesa de Partes', 30, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000017', 'TUPA-17', 'Traslado externo', 'Traslado externo proveniente de otra institución superior', 'Mesa de Partes', 30, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000018', 'TUPA-18', 'Record de notas', 'Expedición de récord de notas semestrales oficiales', 'Secretaría Académica', 1, 'POSITIVO', 'TUO Ley N° 27444', TRUE),
('00000000-0000-0000-0001-000000000019', 'TUPA-19', 'Constancia de haber sustentado examen T/práctico', 'Constancia oficial de sustentación de examen de titulación', 'Secretaría Académica', 1, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('00000000-0000-0000-0001-000000000020', 'TUPA-20', 'Constancia de aprobación de examen teórico práctico antes del 2016', 'Constancia histórica de examen teórico práctico anterior al 2016', 'Secretaría Académica', 1, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000021', 'TUPA-21', 'Aprobación del plan de proyecto, reparación, mantenimiento, implementación, producción, servicio e investigación', 'Aprobación resolutiva de planes y proyectos institucionales', 'Área Académica', 5, 'POSITIVO', 'R.D. N.º 048', TRUE),
('00000000-0000-0000-0001-000000000022', 'TUPA-22', 'Examen teórico práctico', 'Evaluación de competencias técnico-profesionales para titulación', 'Mesa de Partes', 30, 'NEGATIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('00000000-0000-0000-0001-000000000023', 'TUPA-23', 'Constancia de expedito', 'Constancia institucional de hallarse expedito para titulación', 'Abastecimientos / Áreas Académicas', 1, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('00000000-0000-0000-0001-000000000024', 'TUPA-24', 'Certificación por módulo semestral y anual', 'Emisión de certificados oficiales modulares formativos', 'Secretaría Académica', 30, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000025', 'TUPA-25', 'Certificados de estudios urgentes', 'Emisión preferencial de certificados de estudio en 24 horas', 'Secretaría Académica', 1, 'POSITIVO', 'TUO Ley N° 27444', TRUE),
('00000000-0000-0000-0001-000000000026', 'TUPA-26', 'Actualización de matrícula - reentrante', 'Reingreso y actualización de matrícula para estudiantes reentrantes', 'Mesa de Partes', 30, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000027', 'TUPA-27', 'Certificado de egresado', 'Documento formal de certificación de egresado institucional', 'Dirección General', 1, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('00000000-0000-0000-0001-000000000028', 'TUPA-28', 'Constancia de ingreso', 'Constancia de haber alcanzado vacante en examen de admisión', 'Secretaría Académica', 1, 'POSITIVO', 'TUO Ley N° 27444', TRUE),
('00000000-0000-0000-0001-000000000029', 'TUPA-29', 'Devolución de expediente - estudiantes semestre I', 'Devolución formal de documentos de admisión de ingresantes semestre I', 'Secretaría Académica', 1, 'POSITIVO', 'TUO Ley N° 27444', TRUE),
('00000000-0000-0000-0001-000000000030', 'TUPA-30', 'Autorización de titulación de otras instituciones', 'Autorización para titulación de egresados de otras entidades de educación superior', 'Secretaría Académica', 7, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000031', 'TUPA-31', 'Reserva de matrícula, ingreso y/o vacante', 'Suspensión temporal justificada de estudios con derecho a reserva de vacante', 'Secretaría Académica', 15, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000032', 'TUPA-32', 'Traslado de matrícula externa a otras instituciones', 'Expedición de legajo para traslado a otra institución superior', 'Secretaría Académica', 7, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000033', 'TUPA-33', 'Traslado externo de otras instituciones', 'Admisión por traslado procedente de otros institutos tecnológicos', 'Secretaría Académica', 30, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000034', 'TUPA-34', 'Traslado interno', 'Cambio formal de especialidad técnica dentro del IESTP', 'Secretaría Académica', 30, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000035', 'TUPA-35', 'Matrícula regular - invicto', 'Inscripción semestral regular de estudiantes invictos', 'Secretaría Académica', 30, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000036', 'TUPA-36', 'Matrícula repitente - reentrante', 'Matrícula de estudiantes repitentes o autorizados a reingreso', 'Secretaría Académica', 30, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000037', 'TUPA-37', 'Matrícula con unidad a cargo', 'Inscripción semestral regular con hasta dos unidades didácticas desaprobadas', 'Secretaría Académica', 30, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000038', 'TUPA-38', 'Matrícula becada IESTP Pasco - primer puesto', 'Exoneración de arancel de matrícula por haber obtenido el primer puesto académico', 'Secretaría Académica', 30, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('00000000-0000-0000-0001-000000000039', 'TUPA-39', 'Matrícula semi beca IESTP - segundo puesto', 'Media beca de matrícula por segundo puesto de rendimiento académico', 'Secretaría Académica', 30, 'POSITIVO', 'RVM N° 277-2019-MINEDU', TRUE),
('00000000-0000-0000-0001-000000000040', 'TUPA-40', 'Matrícula becado externo', 'Matrícula de beneficiarios de programas de becas PRONABEC o convenios', 'Secretaría Académica', 30, 'POSITIVO', 'Ley N° 29837', TRUE),
('00000000-0000-0000-0001-000000000041', 'TUPA-41', 'Examen de admisión ordinario', 'Inscripción al concurso público ordinario de admisión anual', 'Secretaría Académica', 30, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000042', 'TUPA-42', 'Examen de admisión - modalidad primeros puestos', 'Inscripción por exoneración para egresados de secundaria en primeros puestos', 'Secretaría Académica', 30, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000043', 'TUPA-43', 'Examen de admisión - modalidad titulados / segunda carrera', 'Admisión especial para titulados de nivel superior o segunda carrera técnica', 'Secretaría Académica', 30, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000044', 'TUPA-44', 'Examen de admisión - modalidad convenios institucionales', 'Admisión por convenios de cooperación interinstitucional vigentes', 'Secretaría Académica', 30, 'POSITIVO', 'Ley N° 30512', TRUE),
('00000000-0000-0000-0001-000000000045', 'TUPA-45', 'Examen de admisión - modalidad servicio militar, víctimas de violencia y personas con discapacidad', 'Admisión reservada por ley para licenciados de FF.AA., PIR y CONADIS', 'Secretaría Académica', 30, 'POSITIVO', 'Ley N° 29248 / Ley N° 29973', TRUE),
('00000000-0000-0000-0001-000000000046', 'TUPA-46', 'Examen de admisión - modalidad deportistas destacados', 'Admisión preferencial para deportistas calificados de alto rendimiento (IPD)', 'Secretaría Académica', 30, 'POSITIVO', 'Ley N° 28036', TRUE),
('00000000-0000-0000-0001-000000000047', 'TUPA-47', 'Examen médico odontológico / tratamiento consultorio odontológico', 'Atención odontológica preventiva, curativa y diagnóstica institucional', 'Tópico', 1, 'POSITIVO', 'TUPA Institucional', TRUE),
('00000000-0000-0000-0001-000000000048', 'TUPA-48', 'Otros servicios y alquileres', 'Alquiler de infraestructura, auditorio, laboratorios, cochera y equipos', 'Administración', 5, 'POSITIVO', 'TUPA Institucional', TRUE),
('00000000-0000-0000-0001-000000000099', 'LIBRE-01', 'Solicitud Formal General / Trámite Libre Institucional', 'Ingreso documentario de solicitudes libres, memoriales y oficios externos', 'Mesa de Partes General', 30, 'POSITIVO', 'TUO Ley N° 27444', TRUE)
ON CONFLICT (codigo) DO UPDATE SET
    tipo_tramite_id = EXCLUDED.tipo_tramite_id,
    denominacion = EXCLUDED.denominacion,
    descripcion = EXCLUDED.descripcion,
    unidad_organica = EXCLUDED.unidad_organica,
    plazo_dias = EXCLUDED.plazo_dias,
    silencio_administrativo = EXCLUDED.silencio_administrativo,
    base_legal = EXCLUDED.base_legal,
    vigente = EXCLUDED.vigente;

-- -----------------------------------------------------------------------------
-- 4.12 Requisitos canónicos por procedimiento TUPA
-- -----------------------------------------------------------------------------
INSERT INTO sigd_doc.requisito (
    tipo_tramite_id, codigo, denominacion, obligatorio, orden
) VALUES
-- TUPA-01
('00000000-0000-0000-0001-000000000001', 'REQ-01-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000001', 'REQ-01-02', 'Constancia de No Adeudar', TRUE, 2),
('00000000-0000-0000-0001-000000000001', 'REQ-01-03', 'Una fotografía tamaño pasaporte', TRUE, 3),
('00000000-0000-0000-0001-000000000001', 'REQ-01-04', 'Derecho de trámite (recibo)', TRUE, 4),

-- TUPA-02
('00000000-0000-0000-0001-000000000002', 'REQ-02-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000002', 'REQ-02-02', 'Certificados de Estudios Original', TRUE, 2),
('00000000-0000-0000-0001-000000000002', 'REQ-02-03', 'Recibo por Derecho de convalidación', TRUE, 3),
('00000000-0000-0000-0001-000000000002', 'REQ-02-04', 'Sílabo', TRUE, 4),

-- TUPA-03
('00000000-0000-0000-0001-000000000003', 'REQ-03-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000003', 'REQ-03-02', 'Recibo de pago por formato', TRUE, 2),

-- TUPA-04
('00000000-0000-0000-0001-000000000004', 'REQ-04-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000004', 'REQ-04-02', 'Constancia de Aprobación de Prácticas', TRUE, 2),
('00000000-0000-0000-0001-000000000004', 'REQ-04-03', 'Pago por Formato (03 ejemplares)', TRUE, 3),

-- TUPA-05
('00000000-0000-0000-0001-000000000005', 'REQ-05-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000005', 'REQ-05-02', 'Un ejemplar - borrador', TRUE, 2),
('00000000-0000-0000-0001-000000000005', 'REQ-05-03', 'Recibo de pago por derecho', TRUE, 3),
('00000000-0000-0000-0001-000000000005', 'REQ-05-04', 'Revisión de informe y/o Monografía', TRUE, 4),

-- TUPA-06
('00000000-0000-0000-0001-000000000006', 'REQ-06-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000006', 'REQ-06-02', 'Ficha de Evaluación del Informe (P. Inicial, Intermedia o Final)', TRUE, 2),

-- TUPA-07
('00000000-0000-0000-0001-000000000007', 'REQ-07-01', 'Carpeta de práctica debidamente rellenada', TRUE, 1),
('00000000-0000-0000-0001-000000000007', 'REQ-07-02', 'Solicitud FUT', TRUE, 2),
('00000000-0000-0000-0001-000000000007', 'REQ-07-03', 'Ficha de Evaluación de Prácticas Profesionales', TRUE, 3),
('00000000-0000-0000-0001-000000000007', 'REQ-07-04', 'Ficha de Evaluación Individual y de Supervisión', TRUE, 4),
('00000000-0000-0000-0001-000000000007', 'REQ-07-05', 'Resolución Directoral y Recibo de Pago', TRUE, 5),

-- TUPA-08
('00000000-0000-0000-0001-000000000008', 'REQ-08-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000008', 'REQ-08-02', 'Ficha de Evaluación de Prácticas Profesionales (Consolidado)', TRUE, 2),
('00000000-0000-0000-0001-000000000008', 'REQ-08-03', 'Resolución Directoral y Recibo de Pago', TRUE, 3),

-- TUPA-09
('00000000-0000-0000-0001-000000000009', 'REQ-09-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000009', 'REQ-09-02', 'Certificado de Estudios Secundaria - Original', TRUE, 2),
('00000000-0000-0000-0001-000000000009', 'REQ-09-03', 'Partida de Nacimiento Original', TRUE, 3),
('00000000-0000-0000-0001-000000000009', 'REQ-09-04', 'Certificado de Estudios Superiores – Original', TRUE, 4),
('00000000-0000-0000-0001-000000000009', 'REQ-09-05', 'Certificado de Estudios Inglés', TRUE, 5),
('00000000-0000-0000-0001-000000000009', 'REQ-09-06', 'Constancias de Aprobación de Prácticas Profesionales', TRUE, 6),
('00000000-0000-0000-0001-000000000009', 'REQ-09-07', 'Constancia de Egresado y No Adeudar', TRUE, 7),
('00000000-0000-0000-0001-000000000009', 'REQ-09-08', '02 Fotografías Pasaporte - Fondo Blanco', TRUE, 8),
('00000000-0000-0000-0001-000000000009', 'REQ-09-09', 'Recibo de Pago de Titulación', TRUE, 9),

-- TUPA-10
('00000000-0000-0000-0001-000000000010', 'REQ-10-01', 'Recibo de Pago', TRUE, 1),

-- TUPA-11
('00000000-0000-0000-0001-000000000011', 'REQ-11-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000011', 'REQ-11-02', 'Recibo de Pago', TRUE, 2),

-- TUPA-12
('00000000-0000-0000-0001-000000000012', 'REQ-12-01', 'Recibo de Pago', TRUE, 1),
('00000000-0000-0000-0001-000000000012', 'REQ-12-02', 'Fotografía tamaño carné', TRUE, 2),

-- TUPA-13
('00000000-0000-0000-0001-000000000013', 'REQ-13-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000013', 'REQ-13-02', 'Recibo de Pago', TRUE, 2),

-- TUPA-14
('00000000-0000-0000-0001-000000000014', 'REQ-14-01', 'Solicitud FUT / Ficha de Matrícula', TRUE, 1),
('00000000-0000-0000-0001-000000000014', 'REQ-14-02', 'Recibo de Pago correspondiente', TRUE, 2),

-- TUPA-15
('00000000-0000-0000-0001-000000000015', 'REQ-15-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000015', 'REQ-15-02', 'Recibo de Pago', TRUE, 2),

-- TUPA-16
('00000000-0000-0000-0001-000000000016', 'REQ-16-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000016', 'REQ-16-02', 'Derecho de Pago', TRUE, 2),
('00000000-0000-0000-0001-000000000016', 'REQ-16-03', 'Certificado de Estudios Originales', TRUE, 3),

-- TUPA-17
('00000000-0000-0000-0001-000000000017', 'REQ-17-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000017', 'REQ-17-02', 'Constancia de Vacante', TRUE, 2),
('00000000-0000-0000-0001-000000000017', 'REQ-17-03', 'Recibo de Derecho de Pago y Certificados', TRUE, 3),

-- TUPA-18
('00000000-0000-0000-0001-000000000018', 'REQ-18-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000018', 'REQ-18-02', 'Recibo de Pago por Semestre', TRUE, 2),

-- TUPA-19
('00000000-0000-0000-0001-000000000019', 'REQ-19-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000019', 'REQ-19-02', 'Recibo de Pago', TRUE, 2),

-- TUPA-20
('00000000-0000-0000-0001-000000000020', 'REQ-20-01', 'Solicitud', TRUE, 1),
('00000000-0000-0000-0001-000000000020', 'REQ-20-02', 'Recibo de Pago', TRUE, 2),

-- TUPA-21
('00000000-0000-0000-0001-000000000021', 'REQ-21-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000021', 'REQ-21-02', 'Plan de Proyecto y Formato de Resolución', TRUE, 2),
('00000000-0000-0000-0001-000000000021', 'REQ-21-03', 'Recibo de Pago', TRUE, 3),

-- TUPA-22
('00000000-0000-0000-0001-000000000022', 'REQ-22-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000022', 'REQ-22-02', 'Derecho de Examen Teórico Práctico - Jurados', TRUE, 2),
('00000000-0000-0000-0001-000000000023', 'REQ-23-01', 'Formato de Expedito - Abastecimientos', TRUE, 1),
('00000000-0000-0000-0001-000000000023', 'REQ-23-02', 'Solicitud FUT', TRUE, 2),

-- TUPA-24
('00000000-0000-0000-0001-000000000024', 'REQ-24-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000024', 'REQ-24-02', 'Constancia de Aprobación de Módulo y Recibo', TRUE, 2),

-- TUPA-25
('00000000-0000-0000-0001-000000000025', 'REQ-25-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000025', 'REQ-25-02', 'Constancia de No Adeudar y 01 foto pasaporte', TRUE, 2),
('00000000-0000-0000-0001-000000000025', 'REQ-25-03', 'Derecho de trámite', TRUE, 3),

-- TUPA-26
('00000000-0000-0000-0001-000000000026', 'REQ-26-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000026', 'REQ-26-02', 'Record de Notas', TRUE, 2),

-- TUPA-27
('00000000-0000-0000-0001-000000000027', 'REQ-27-01', 'Solicitud FUT', TRUE, 1),
('00000000-0000-0000-0001-000000000027', 'REQ-27-02', 'Recibo de Pago', TRUE, 2),

-- TUPA-28
('00000000-0000-0000-0001-000000000028', 'REQ-28-01', 'Recibo de Pago', TRUE, 1),

-- TUPA-29
('00000000-0000-0000-0001-000000000029', 'REQ-29-01', 'Recibo de Pago', TRUE, 1),
('00000000-0000-0000-0001-000000000029', 'REQ-29-02', 'Solicitud', TRUE, 2),

-- TUPA-30
('00000000-0000-0000-0001-000000000030', 'REQ-30-01', 'Solicitud', TRUE, 1),
('00000000-0000-0000-0001-000000000030', 'REQ-30-02', 'Constancia de Prácticas y Certificado de Estudios', TRUE, 2),
('00000000-0000-0000-0001-000000000030', 'REQ-30-03', 'Recibo de Pago', TRUE, 3),

-- TUPA-31
('00000000-0000-0000-0001-000000000031', 'REQ-31-01', 'Solicitud', TRUE, 1),
('00000000-0000-0000-0001-000000000031', 'REQ-31-02', 'Constancia de Matrícula y Recibo de Pago', TRUE, 2),

-- TUPA-32
('00000000-0000-0000-0001-000000000032', 'REQ-32-01', 'Solicitud', TRUE, 1),
('00000000-0000-0000-0001-000000000032', 'REQ-32-02', 'Certificado de Estudios Superiores y Recibo', TRUE, 2),

-- TUPA-33
('00000000-0000-0000-0001-000000000033', 'REQ-33-01', 'Solicitud', TRUE, 1),
('00000000-0000-0000-0001-000000000033', 'REQ-33-02', 'Certificado de Estudios Superiores y Recibo', TRUE, 2),

-- TUPA-34
('00000000-0000-0000-0001-000000000034', 'REQ-34-01', 'Solicitud', TRUE, 1),
('00000000-0000-0000-0001-000000000034', 'REQ-34-02', 'Certificado de Estudios y Recibo de Pago', TRUE, 2),

-- TUPA-35 a 40 (Matrículas)
('00000000-0000-0000-0001-000000000035', 'REQ-35-01', 'Boleta de Notas, 02 Fotos y Recibo de Pago', TRUE, 1),
('00000000-0000-0000-0001-000000000036', 'REQ-36-01', 'Resolución de Autorización, Recibo y 02 fotos', TRUE, 1),
('00000000-0000-0000-0001-000000000037', 'REQ-37-01', 'Boleta de Notas, Recibo y 02 fotos', TRUE, 1),
('00000000-0000-0000-0001-000000000038', 'REQ-38-01', 'Resolución Directoral, Recibo y 02 fotos', TRUE, 1),
('00000000-0000-0000-0001-000000000039', 'REQ-39-01', 'Resolución Directoral, Recibo y 02 fotos', TRUE, 1),
('00000000-0000-0000-0001-000000000040', 'REQ-40-01', 'Boleta de Notas, 02 fotos y Recibo de Pago', TRUE, 1),

-- TUPA-41 a 46 (Admisión)
('00000000-0000-0000-0001-000000000041', 'REQ-41-01', 'Inscripción y Recibo de Pago', TRUE, 1),
('00000000-0000-0000-0001-000000000042', 'REQ-42-01', 'Inscripción, Acta de Primeros Puestos y Recibo', TRUE, 1),
('00000000-0000-0000-0001-000000000043', 'REQ-43-01', 'Inscripción, Título Profesional y Recibo', TRUE, 1),
('00000000-0000-0000-0001-000000000044', 'REQ-44-01', 'Inscripción, Constancia de Convenio y Recibo', TRUE, 1),
('00000000-0000-0000-0001-000000000045', 'REQ-45-01', 'Inscripción, Constancia CONADIS/PIR/FF.AA. y Recibo', TRUE, 1),
('00000000-0000-0000-0001-000000000046', 'REQ-46-01', 'Inscripción, Acreditación IPD y Recibo', TRUE, 1),

-- TUPA-47 y 48 (Servicios)
('00000000-0000-0000-0001-000000000047', 'REQ-47-01', 'Recibo de Pago de atención odontológica', TRUE, 1),
('00000000-0000-0000-0001-000000000048', 'REQ-48-01', 'Solicitud de Servicio / Alquiler y Recibo', TRUE, 1),

-- LIBRE-01
('00000000-0000-0000-0001-000000000099', 'REQ-99-01', 'Solicitud o Memorial formal dirigido a la Dirección General', TRUE, 1),
('00000000-0000-0000-0001-000000000099', 'REQ-99-02', 'Documentación sustentatoria del petitorio', FALSE, 2)
ON CONFLICT (tipo_tramite_id, codigo) DO NOTHING;


