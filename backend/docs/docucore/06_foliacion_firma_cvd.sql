-- Migración DocuCore: ejecutar después de crear sigd_tra.expediente.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS sigd_doc;

CREATE TABLE IF NOT EXISTS sigd_doc.foliacion_documento (
  expediente_id UUID NOT NULL
    REFERENCES sigd_tra.expediente(expediente_id)
    ON DELETE RESTRICT,

  documento_id UUID NOT NULL,

  folio_desde INTEGER NOT NULL
    CHECK (folio_desde > 0),

  folio_hasta INTEGER NOT NULL
    CHECK (folio_hasta >= folio_desde),

  total_folios INTEGER NOT NULL
    CHECK (total_folios = folio_hasta - folio_desde + 1),

  fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (expediente_id, documento_id),
  UNIQUE (expediente_id, folio_desde),
  UNIQUE (expediente_id, folio_hasta)
);

CREATE TABLE IF NOT EXISTS sigd_doc.firma_digital_documento (
  documento_id UUID PRIMARY KEY,

  cvd VARCHAR(40) NOT NULL UNIQUE DEFAULT (
    'CVD-' ||
    to_char(current_date, 'YYYY') ||
    '-' ||
    upper(substr(md5(gen_random_uuid()::text), 1, 16))
  ),

  sha256_firmado CHAR(64) NOT NULL
    CHECK (sha256_firmado ~ '^[0-9a-fA-F]{64}$'),

  firmante TEXT NOT NULL,

  fecha_sello_tsa TIMESTAMPTZ NOT NULL,

  s3_bucket VARCHAR(100) NOT NULL,

  s3_key VARCHAR(500) NOT NULL,

  estado VARCHAR(30) NOT NULL
    CHECK (estado = 'FIRMADO_DIGITALMENTE'),

  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now()
);