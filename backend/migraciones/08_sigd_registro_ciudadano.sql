-- Persistencia de todos los datos recibidos por el Registro Ciudadano.
-- La migración es aditiva para conservar las cuentas y personas existentes.

INSERT INTO sigd_auth.tipos_documento (codigo, descripcion, requiere_ruc, largo, vigente)
VALUES
    ('DNI', 'Documento Nacional de Identidad', FALSE, 8, TRUE),
    ('CE', 'Carné de Extranjería', FALSE, 12, TRUE),
    ('RUC', 'Registro Único de Contribuyentes', TRUE, 11, TRUE)
ON CONFLICT (codigo) DO UPDATE
    SET vigente = TRUE;

ALTER TABLE sigd_auth.persona
    ADD COLUMN IF NOT EXISTS id_tipo_documento SMALLINT
        REFERENCES sigd_auth.tipos_documento (id_tipo_documento),
    ADD COLUMN IF NOT EXISTS direccion VARCHAR(255),
    ADD COLUMN IF NOT EXISTS ubigeo_distrito VARCHAR(6),
    ADD COLUMN IF NOT EXISTS referencia_domicilio VARCHAR(200);

ALTER TABLE sigd_auth.persona_juridica
    ADD COLUMN IF NOT EXISTS partida_registral_sunarp VARCHAR(18),
    ADD COLUMN IF NOT EXISTS representante_tipo_documento VARCHAR(10),
    ADD COLUMN IF NOT EXISTS representante_documento VARCHAR(20),
    ADD COLUMN IF NOT EXISTS representante_cargo VARCHAR(120),
    ADD COLUMN IF NOT EXISTS correo_contacto VARCHAR(160),
    ADD COLUMN IF NOT EXISTS telefono_contacto VARCHAR(20),
    ADD COLUMN IF NOT EXISTS ubigeo_distrito VARCHAR(6);

CREATE INDEX IF NOT EXISTS idx_persona_documento_tipo
    ON sigd_auth.persona (id_tipo_documento, id_documento);
