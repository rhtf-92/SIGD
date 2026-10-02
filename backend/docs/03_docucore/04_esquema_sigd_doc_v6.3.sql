-- =============================================================================
-- SIGD · Grupo 5 "DocuCore" — Esquema Fase 2 (DDL ADITIVO)
-- Documentos con metadatos heterogéneos JSONB + Almacenamiento MinIO/S3
-- + Asociación TUPA ↔ Esquema de Validación Versionado
-- =============================================================================
-- Autor: Christian Jhoel Rodríguez Cari (Sublíder — B_CHRISTIAN)
-- Rama Git: B_CHRISTIAN
-- Entregable: Sprint 4 · T-BE-DC-01 (10 SP)
-- Motor objetivo: PostgreSQL 18+
-- Fecha: 2026-09-30
--
-- PROBLEMA RESUELTO:
--   Cada procedimiento TUPA exige campos heterogéneos (Titulación: carrera y
--   año de egreso; Rectificación de nota: código de asignatura y período
--   lectivo). Un esquema rígido obligaría a columnas nulas en la tabla
--   principal. Solución: columna `metadatos jsonb NOT NULL DEFAULT '{}'` en
--   `sigd_doc.documento`, complementada con índice
--   `USING gin (metadatos jsonb_path_ops)`.
--
-- NATURALEZA DEL ARCHIVO:
--   DDL ADITIVO sobre el esquema canónico de DocuCore. Las tablas
--   fundacionales `tipo_tramite_tupa`, `tipo_documento` y
--   `formulario_version` se consideran PREREQUISITO (consolidado DDL v6.3 de
--   Piero — `05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql`) y NO se
--   recrean aquí para no duplicar objetos de otro integrante. Este archivo
--   agrega la tabla `documento` (metadatos JSONB), la política de
--   almacenamiento MinIO/S3 y los índices GIN requeridos.
--
-- INSTALACIÓN CONTROLADA:
--   Ejecutar en una base de laboratorio PostgreSQL 18 con ON_ERROR_STOP=1.
--   El esquema se crea con IF NOT EXISTS; es re-ejecutable (idempotente).
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS sigd_doc;

COMMENT ON SCHEMA sigd_doc IS
    'Esquema del módulo DocuCore del Sistema Integral de Gestión Documentaria (SIGD).';

SET LOCAL TIME ZONE 'America/Lima';

-- =============================================================================
-- 1. DOCUMENTO — registro documental con metadatos polimórficos por TUPA
-- =============================================================================
-- Cada fila representa el documento de un procedimiento TUPA concretado por
-- un administrado. Los campos específicos de cada trámite (Titulación:
-- carrera/año de egreso; Rectificación de nota: código de asignatura/período
-- lectivo, etc.) viven en `metadatos` y se validan contra el esquema JSON
-- versionado del formulario correspondiente (capa de aplicación, Ajv).
-- =============================================================================
CREATE TABLE IF NOT EXISTS sigd_doc.documento (
    id_documento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Código oficial del documento (asignado en radicación/emisión).
    codigo_documento VARCHAR(30),
    -- Procedimiento TUPA asociado (catálogo legal — Valentín/Piero).
    id_tipo_tramite_tupa UUID NOT NULL,
    -- Esquema de validación versionado (JSON Schema Draft 2020-12) usado
    -- al capturar la solicitud. Conserva la versión exacta inmutable.
    id_formulario_version UUID,
    -- Actor que crea/registra el documento (referencia externa sigd_auth;
    -- sin FK local, patrón DocuCore confirmado).
    id_usuario_creador UUID,
    -- Campos heterogéneos por procedimiento TUPA (JSONB). Estructura
    -- validada por la aplicación contra id_formulario_version.
    metadatos JSONB NOT NULL DEFAULT '{}',
    -- Estado del ciclo de vida documental (alineado a la taxonomía DocuCore).
    estado VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
    -- Ticket / URL prefirmada de lectura para el objeto físico en MinIO/S3
    -- (no expone la clave permanente de almacenamiento).
    url_presignada_lectura VARCHAR(1000),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_documento_codigo UNIQUE (codigo_documento),
    CONSTRAINT fk_documento_tramite_tupa
        FOREIGN KEY (id_tipo_tramite_tupa)
        REFERENCES sigd_doc.tipo_tramite_tupa(id_tipo_tramite_tupa)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_documento_formulario_version
        FOREIGN KEY (id_formulario_version)
        REFERENCES sigd_doc.formulario_version(id_formulario_version)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_documento_estado CHECK (
        estado IN ('BORRADOR', 'EN_REVISION', 'OBSERVADO', 'SUBSANACION', 'APROBADO', 'RECHAZADO_POR_CADUCIDAD', 'INACTIVO')
    ),
    -- El metadato debe ser un objeto JSON, nunca un arreglo o escalar.
    CONSTRAINT ck_documento_metadatos_objeto CHECK (
        jsonb_typeof(metadatos) = 'object'
    ),
    CONSTRAINT ck_documento_codigo_no_vacio CHECK (
        codigo_documento IS NULL OR btrim(codigo_documento) <> ''
    )
);

COMMENT ON TABLE sigd_doc.documento IS
    'Registro documental de DocuCore con metadatos heterogéneos por procedimiento TUPA almacenados en JSONB.';
COMMENT ON COLUMN sigd_doc.documento.metadatos IS
    'Campos específicos del procedimiento TUPA (JSONB). Validados por la aplicación contra el JSON Schema versionado de formulario_version.';
COMMENT ON COLUMN sigd_doc.documento.id_formulario_version IS
    'Versión exacta e inmutable del esquema de validación aplicado a los metadatos.';
COMMENT ON COLUMN sigd_doc.documento.id_tipo_tramite_tupa IS
    'Procedimiento TUPA (o servicio interno) al que pertenece el documento.';

-- =============================================================================
-- 2. ÍNDICES GIN sobre la columna JSONB (doD / EXPLAIN)
-- =============================================================================
-- jsonb_path_ops permite consultas por camino de acceso:
--   WHERE metadatos @> '{"codigo_asignatura":"MATE-101"}';
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_documento_metadatos_gin
    ON sigd_doc.documento
    USING GIN (metadatos jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_documento_tramite_tupa
    ON sigd_doc.documento (id_tipo_tramite_tupa);

CREATE INDEX IF NOT EXISTS idx_documento_formulario_version
    ON sigd_doc.documento (id_formulario_version);

-- =============================================================================
-- 3. BUCKET_POLICY — políticas de almacenamiento documental MinIO/S3
-- =============================================================================
-- Configura declarativa de los buckets/ubicaciones S3 usados por DocuCore.
-- Cada categoría define bucket, prefijo, expiración de presigned URLs,
-- validación de Magic Bytes, retención de huérfanos y extensiones admitidas.
-- =============================================================================
CREATE TABLE IF NOT EXISTS sigd_doc.bucket_policy (
    id_bucket_policy UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria VARCHAR(50) NOT NULL UNIQUE,
    bucket VARCHAR(100) NOT NULL,
    prefijo_s3 VARCHAR(200) NOT NULL,
    url_presignada_expira_min INTEGER NOT NULL DEFAULT 15,
    magic_bytes_validacion BOOLEAN NOT NULL DEFAULT TRUE,
    magic_bytes_hint VARCHAR(300),
    max_tamanio_bytes BIGINT NOT NULL,
    formatos_permitidos VARCHAR(200) NOT NULL,
    lifecycle_huérfanos_min INTEGER NOT NULL DEFAULT 1440,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_bucket_policy_categoria UNIQUE (categoria),
    CONSTRAINT ck_bucket_policy_expira_min CHECK (url_presignada_expira_min > 0),
    CONSTRAINT ck_bucket_policy_max_tamanio CHECK (max_tamanio_bytes > 0),
    CONSTRAINT ck_bucket_policy_lifecycle CHECK (lifecycle_huérfanos_min > 0)
);

COMMENT ON TABLE sigd_doc.bucket_policy IS
    'Política declarativa de almacenamiento documental en MinIO/S3 por categoría documental.';
COMMENT ON COLUMN sigd_doc.bucket_policy.magic_bytes_hint IS
    'Firma binaria esperada (ej. %PDF-) para validación de Magic Bytes (RN-ADJ-001).';
COMMENT ON COLUMN sigd_doc.bucket_policy.lifecycle_huérfanos_min IS
    'Tiempo (minutos) tras el cual MinIO elimina binarios huérfanos sin confirmación (EX-009).';

-- =============================================================================
-- 4. DOCUMENTO_BUCKET — vínculo documento ↔ política de almacenamiento
-- =============================================================================
CREATE TABLE IF NOT EXISTS sigd_doc.documento_bucket (
    id_documento UUID NOT NULL,
    id_bucket_policy UUID NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    sha256_hash CHAR(64) NOT NULL,
    magic_bytes_validado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_documento_bucket PRIMARY KEY (id_documento, id_bucket_policy),
    CONSTRAINT uq_documento_bucket_s3_key UNIQUE (s3_key),
    CONSTRAINT fk_db_documento
        FOREIGN KEY (id_documento)
        REFERENCES sigd_doc.documento(id_documento)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_db_bucket_policy
        FOREIGN KEY (id_bucket_policy)
        REFERENCES sigd_doc.bucket_policy(id_bucket_policy)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_db_hash CHECK (sha256_hash ~ '^[0-9a-fA-F]{64}$')
);

COMMENT ON TABLE sigd_doc.documento_bucket IS
    'Vínculo entre un documento y su objeto físico en MinIO/S3 (metadatos de almacenamiento desacoplado).';
COMMENT ON COLUMN sigd_doc.documento_bucket.s3_key IS
    'Clave S3 del objeto físico. Nunca se expone públicamente; solo a través de URLs prefirmadas.';

-- =============================================================================
-- 6. SECUENCIA_ANUAL_RESOLUCION — correlativo anual atómico de resoluciones
-- =============================================================================
-- Garantiza numeración correlativa anual segura ante concurrencia. El avance
-- del correlativo se hace con un UPDATE que bloquea la fila del año (patrón
-- FOR UPDATE heredado de sigd_tra.secuencia_anual_cut): dos proyecciones
-- simultáneas jamás obtienen el mismo número. Los correlativos reinician en
-- 000001 cada año fiscal.
-- =============================================================================
CREATE TABLE IF NOT EXISTS sigd_doc.secuencia_anual_resolucion (
    id_secuencia BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    anio_fiscal INT NOT NULL UNIQUE,
    secuencia BIGINT NOT NULL DEFAULT 0,
    ultimo_numero_generado VARCHAR(30),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_sar_anio_positivo CHECK (anio_fiscal > 2000),
    CONSTRAINT ck_sar_secuencia_positiva CHECK (secuencia >= 0)
);

COMMENT ON TABLE sigd_doc.secuencia_anual_resolucion IS
    'Correlativo anual de Resoluciones Directorales gestionado de forma atómica (T-BE-DC-03).';
COMMENT ON COLUMN sigd_doc.secuencia_anual_resolucion.ultimo_numero_generado IS
    'Último número emitido, formato RD-AAAA-NNNNNN, para trazabilidad y auditoría.';

-- =============================================================================
-- 7. PROYECTO_RESOLUCION — borrador de Resolución Directoral A4
-- =============================================================================
-- Proyecto de acto resolutivo con membrete del IESTP "Suiza", número
-- correlativo anual y secciones normativas. `html_renderizado` conserva la
-- vista tipográfica A4 normalizada generada por el servicio (T-BE-DC-03).
-- La firma (cianuro/certificado) y el PDF sellado son responsabilidad de
-- Azareño (B_AZAREÑO), por lo que aquí solo se gestiona el borrador.
-- =============================================================================
CREATE TABLE IF NOT EXISTS sigd_doc.proyecto_resolucion (
    id_proyecto UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_resolucion VARCHAR(30) NOT NULL,
    tipo_resolucion VARCHAR(32) NOT NULL,
    id_expediente UUID NOT NULL,
    id_usuario_creador UUID,
    estado VARCHAR(16) NOT NULL DEFAULT 'BORRADOR',
    visto TEXT NOT NULL,
    considerandos JSONB NOT NULL DEFAULT '[]',
    articulos JSONB NOT NULL DEFAULT '[]',
    distribucion JSONB NOT NULL DEFAULT '[]',
    html_renderizado TEXT NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_proyecto_numero UNIQUE (numero_resolucion),
    CONSTRAINT ck_proyecto_tipo CHECK (
        tipo_resolucion IN ('DIRECTORAL_TITULACION', 'DIRECTORAL_CONVALIDACION', 'DIRECTORAL_ADMINISTRATIVA')
    ),
    CONSTRAINT ck_proyecto_estado CHECK (estado IN ('BORRADOR', 'EN_VISADO', 'APROBADO', 'FIRMADO'))
);

COMMENT ON TABLE sigd_doc.proyecto_resolucion IS
    'Borrador de Resolución Directoral con proyección tipográfica A4 normalizada (T-BE-DC-03).';

CREATE INDEX IF NOT EXISTS idx_proyecto_resolucion_expediente
    ON sigd_doc.proyecto_resolucion (id_expediente);

-- =============================================================================
-- 5. VERIFICACIÓN CON EXPLAIN (evidencia documental — ejecutar en laboratorio)
-- =============================================================================
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT id_documento, metadatos
--   FROM sigd_doc.documento
--  WHERE metadatos @> '{"codigo_asignatura": "MATE-101"}';
-- Debe desplegar "Bitmap Index Scan on idx_documento_metadatos_gin"
-- confirmando el uso del índice GIN jsonb_path_ops.

COMMIT;