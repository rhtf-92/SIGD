-- Durable idempotency for anonymous submissions, in the same transaction as CUT.
-- The capability is stored only as SHA-256. It is not an institutional account.
CREATE TABLE IF NOT EXISTS sigd_tra.radicacion_publica (
    sesion_hash CHAR(64) PRIMARY KEY CHECK (sesion_hash ~ '^[0-9a-f]{64}$'),
    payload_hash CHAR(64) NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
    datos_declarados JSONB NOT NULL,
    expediente_id UUID UNIQUE REFERENCES sigd_doc.expediente(expediente_id) ON DELETE RESTRICT,
    respuesta JSONB,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((expediente_id IS NULL) = (respuesta IS NULL))
);
