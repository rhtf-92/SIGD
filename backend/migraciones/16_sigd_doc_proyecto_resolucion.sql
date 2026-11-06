-- DocuCore | Proyección de Resoluciones Directorales (A4)
-- Complementa sigd_doc.resolucion con el contenido narrativo y la secuencia anual
-- atómica usada por resoluciones.service.ts.

BEGIN;

CREATE TABLE IF NOT EXISTS sigd_doc.secuencia_anual_resolucion (
    anio_fiscal INTEGER PRIMARY KEY,
    secuencia INTEGER NOT NULL DEFAULT 0 CHECK (secuencia >= 0),
    ultimo_numero_generado VARCHAR(40),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sigd_doc.proyecto_resolucion (
    id_proyecto UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_resolucion VARCHAR(40) NOT NULL UNIQUE,
    tipo_resolucion VARCHAR(40) NOT NULL,
    id_expediente UUID NOT NULL
        REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    estado VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
    visto TEXT NOT NULL,
    considerandos JSONB NOT NULL DEFAULT '[]'::jsonb,
    articulos JSONB NOT NULL DEFAULT '[]'::jsonb,
    distribucion JSONB NOT NULL DEFAULT '[]'::jsonb,
    html_renderizado TEXT NOT NULL,
    id_usuario_creador UUID NULL
        REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE SET NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_proyecto_resolucion_tipo CHECK (tipo_resolucion IN (
        'DIRECTORAL_TITULACION', 'DIRECTORAL_CONVALIDACION', 'DIRECTORAL_ADMINISTRATIVA'
    )),
    CONSTRAINT chk_proyecto_resolucion_estado CHECK (estado IN (
        'BORRADOR', 'EN_FIRMA', 'FIRMADO', 'ANULADO'
    )),
    CONSTRAINT chk_proyecto_resolucion_considerandos
        CHECK (jsonb_typeof(considerandos) = 'array'),
    CONSTRAINT chk_proyecto_resolucion_articulos
        CHECK (jsonb_typeof(articulos) = 'array'),
    CONSTRAINT chk_proyecto_resolucion_distribucion
        CHECK (jsonb_typeof(distribucion) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_proyecto_resolucion_expediente
    ON sigd_doc.proyecto_resolucion (id_expediente);
CREATE INDEX IF NOT EXISTS idx_proyecto_resolucion_creacion
    ON sigd_doc.proyecto_resolucion (fecha_creacion DESC);

COMMIT;
