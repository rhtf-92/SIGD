BEGIN;

CREATE TABLE IF NOT EXISTS sigd_rut.expediente_clasificacion_ccd (
    expediente_id UUID NOT NULL
        CONSTRAINT pk_expediente_clasificacion_ccd PRIMARY KEY
        REFERENCES sigd_tra.expediente (expediente_id) ON DELETE CASCADE,
    codigo_fondo VARCHAR(30) NOT NULL DEFAULT 'IESTP_SUIZA',
    codigo_seccion VARCHAR(60) NOT NULL,
    codigo_serie VARCHAR(60) NOT NULL,
    nombre_serie VARCHAR(160) NOT NULL,
    asignado_por UUID NULL,
    asignado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_expediente_ccd_fondo CHECK (codigo_fondo = 'IESTP_SUIZA')
);

CREATE INDEX IF NOT EXISTS idx_expediente_clasificacion_ccd_serie
    ON sigd_rut.expediente_clasificacion_ccd (codigo_serie);

COMMIT;