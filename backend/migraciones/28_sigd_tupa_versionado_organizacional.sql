-- =============================================================================
-- Migración 28 · Estructura TUPA Versionado + Organizacional + Tarifas
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)
-- =============================================================================
-- SOLO ESTRUCTURA. Sin datos, sin inferencias, sin seeds.
-- Compatible con migraciones 08, 16, 24, 25, 26, 27 ya aplicadas.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 28.1 Metadatos de versión TUPA (sigd_doc.tupa_version)
-- -----------------------------------------------------------------------------

ALTER TABLE sigd_doc.tupa_version
    ADD COLUMN IF NOT EXISTS periodo_documento CHAR(7) NULL
        CONSTRAINT chk_tupa_version_periodo CHECK (periodo_documento ~ '^[0-9]{4}-[0-9]{2}$');

ALTER TABLE sigd_doc.tupa_version
    ADD COLUMN IF NOT EXISTS uit_vigente NUMERIC(10, 2) NULL
        CONSTRAINT chk_tupa_version_uit CHECK (uit_vigente IS NULL OR uit_vigente >= 0);

ALTER TABLE sigd_doc.tupa_version
    ADD COLUMN IF NOT EXISTS fuente_documental VARCHAR(255) NULL;

-- Índice de unicidad: máximo una versión VIGENTE a la vez
CREATE UNIQUE INDEX IF NOT EXISTS uq_tupa_version_unica_vigente
    ON sigd_doc.tupa_version (estado)
    WHERE estado = 'VIGENTE';

-- -----------------------------------------------------------------------------
-- 28.2 Campos de procedimiento y organizacionales (sigd_doc.tupa_procedimiento)
-- -----------------------------------------------------------------------------

ALTER TABLE sigd_doc.tupa_procedimiento
    ADD COLUMN IF NOT EXISTS plazo_fuente VARCHAR(20) NULL
        CONSTRAINT chk_tupa_proc_plazo_fuente CHECK (plazo_fuente IN ('OFICIAL', 'DEFAULT', 'PROPUESTA', 'REFERENCIA'));

ALTER TABLE sigd_doc.tupa_procedimiento
    ADD COLUMN IF NOT EXISTS calificacion_fuente VARCHAR(20) NULL
        CONSTRAINT chk_tupa_proc_calificacion_fuente CHECK (calificacion_fuente IN ('OFICIAL', 'DEFAULT', 'PROPUESTA', 'REFERENCIA'));

ALTER TABLE sigd_doc.tupa_procedimiento
    ADD COLUMN IF NOT EXISTS canal_presentacion VARCHAR(30) NULL
        CONSTRAINT chk_tupa_proc_canal_presentacion CHECK (canal_presentacion IN ('MESA_PARTES', 'FUT', 'DIRECCION', 'VENTANILLA', 'DIGITAL', 'OTRO', 'NO_DETERMINADO'));

ALTER TABLE sigd_doc.tupa_procedimiento
    ADD COLUMN IF NOT EXISTS unidad_receptora_id UUID NULL
        CONSTRAINT fk_tupa_proc_unidad_receptora REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT;

ALTER TABLE sigd_doc.tupa_procedimiento
    ADD COLUMN IF NOT EXISTS unidad_responsable_id UUID NULL
        CONSTRAINT fk_tupa_proc_unidad_responsable REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT;

ALTER TABLE sigd_doc.tupa_procedimiento
    ADD COLUMN IF NOT EXISTS unidad_resolutiva_id UUID NULL
        CONSTRAINT fk_tupa_proc_unidad_resolutiva REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT;

ALTER TABLE sigd_doc.tupa_procedimiento
    ADD COLUMN IF NOT EXISTS unidad_financiera_id UUID NULL
        CONSTRAINT fk_tupa_proc_unidad_financiera REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT;

ALTER TABLE sigd_doc.tupa_procedimiento
    ADD COLUMN IF NOT EXISTS intervencion_financiera VARCHAR(20) NULL
        CONSTRAINT chk_tupa_proc_intervencion_financiera CHECK (intervencion_financiera IN ('REQUIERE_PAGO', 'NO_REQUIERE_PAGO'));

-- Índices en FKs organizacionales (Regla 4 del proyecto)
CREATE INDEX IF NOT EXISTS idx_tupa_proc_unidad_receptora
    ON sigd_doc.tupa_procedimiento (unidad_receptora_id)
    WHERE unidad_receptora_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tupa_proc_unidad_responsable
    ON sigd_doc.tupa_procedimiento (unidad_responsable_id)
    WHERE unidad_responsable_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tupa_proc_unidad_resolutiva
    ON sigd_doc.tupa_procedimiento (unidad_resolutiva_id)
    WHERE unidad_resolutiva_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tupa_proc_unidad_financiera
    ON sigd_doc.tupa_procedimiento (unidad_financiera_id)
    WHERE unidad_financiera_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 28.3 Procedencia de datos (sigd_doc.tupa_campo_procedencia)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sigd_doc.tupa_campo_procedencia (
    id_procedencia UUID NOT NULL DEFAULT gen_random_uuid()
        CONSTRAINT pk_tupa_campo_procedencia PRIMARY KEY,
    id_procedimiento UUID NOT NULL
        CONSTRAINT fk_tupa_campo_proc_procedimiento REFERENCES sigd_doc.tupa_procedimiento (id_procedimiento) ON DELETE RESTRICT,
    id_registro_version UUID NOT NULL
        CONSTRAINT fk_tupa_campo_proc_registro_version REFERENCES sigd_doc.tupa_registro_version (registro_version_id) ON DELETE RESTRICT,
    campo_nombre VARCHAR(50) NOT NULL,
    valor TEXT NULL,
    fuente VARCHAR(20) NOT NULL
        CONSTRAINT chk_tupa_campo_proc_fuente CHECK (fuente IN ('OFICIAL', 'DEFAULT', 'PROPUESTA', 'REFERENCIA')),
    evidencia TEXT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tupa_campo_proc_proc_registro_campo
    ON sigd_doc.tupa_campo_procedencia (id_procedimiento, id_registro_version, campo_nombre);

CREATE INDEX IF NOT EXISTS idx_tupa_campo_proc_procedimiento
    ON sigd_doc.tupa_campo_procedencia (id_procedimiento);

CREATE INDEX IF NOT EXISTS idx_tupa_campo_proc_registro
    ON sigd_doc.tupa_campo_procedencia (id_registro_version);

-- -----------------------------------------------------------------------------
-- 28.4 Tarifas variantes (sigd_doc.tupa_tarifa_variante)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sigd_doc.tupa_tarifa_variante (
    id_tarifa_variante UUID NOT NULL DEFAULT gen_random_uuid()
        CONSTRAINT pk_tupa_tarifa_variante PRIMARY KEY,
    id_procedimiento UUID NOT NULL
        CONSTRAINT fk_tupa_tarifa_proc_ref REFERENCES sigd_doc.tupa_procedimiento (id_procedimiento) ON DELETE RESTRICT,
    id_registro_version UUID NOT NULL
        CONSTRAINT fk_tupa_tarifa_proc_registro_ref REFERENCES sigd_doc.tupa_registro_version (registro_version_id) ON DELETE RESTRICT,
    codigo_variante VARCHAR(30) NOT NULL,
    nombre_variante VARCHAR(160) NOT NULL,
    descripcion TEXT NULL,
    monto NUMERIC(10, 2) NOT NULL
        CONSTRAINT chk_tupa_tarifa_monto CHECK (monto > 0),
    moneda VARCHAR(10) NOT NULL DEFAULT 'PEN',
    orden SMALLINT NOT NULL DEFAULT 0,
    fuente VARCHAR(20) NOT NULL
        CONSTRAINT chk_tupa_tarifa_fuente CHECK (fuente IN ('OFICIAL', 'DEFAULT', 'PROPUESTA', 'REFERENCIA')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tupa_tarifa_proc_registro_variante
    ON sigd_doc.tupa_tarifa_variante (id_procedimiento, id_registro_version, codigo_variante);

CREATE INDEX IF NOT EXISTS idx_tupa_tarifa_proc
    ON sigd_doc.tupa_tarifa_variante (id_procedimiento);

CREATE INDEX IF NOT EXISTS idx_tupa_tarifa_registro
    ON sigd_doc.tupa_tarifa_variante (id_registro_version);

-- -----------------------------------------------------------------------------
-- 28.5 Snapshot histórico en expediente_tupa_vinculo (sigd_doc.expediente_tupa_vinculo)
-- -----------------------------------------------------------------------------

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS tupa_codigo VARCHAR(30) NULL;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS tupa_anio INTEGER NULL;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS codigo_ref VARCHAR(50) NULL;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS denominacion_snapshot TEXT NULL;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS monto_efectivo NUMERIC(10, 2) NULL;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS tarifa_variante_codigo VARCHAR(30) NULL;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS tarifa_variante_nombre VARCHAR(160) NULL;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS plazo_dias_snapshot INTEGER NULL;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS calificacion_snapshot VARCHAR(40) NULL;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS canal_presentacion VARCHAR(30) NULL;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS unidad_receptora_id UUID NULL
        CONSTRAINT fk_vinculo_unidad_receptora REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS unidad_receptora_codigo VARCHAR(20) NULL;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS unidad_receptora_nombre VARCHAR(160) NULL;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS unidad_responsable_id UUID NULL
        CONSTRAINT fk_vinculo_unidad_responsable REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS unidad_responsable_codigo VARCHAR(20) NULL;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS unidad_responsable_nombre VARCHAR(160) NULL;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS unidad_resolutiva_id UUID NULL
        CONSTRAINT fk_vinculo_unidad_resolutiva REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS unidad_resolutiva_codigo VARCHAR(20) NULL;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS unidad_resolutiva_nombre VARCHAR(160) NULL;

ALTER TABLE sigd_doc.expediente_tupa_vinculo
    ADD COLUMN IF NOT EXISTS fuente_datos JSONB NULL;

-- Índices en FKs de snapshot
CREATE INDEX IF NOT EXISTS idx_vinculo_unidad_receptora
    ON sigd_doc.expediente_tupa_vinculo (unidad_receptora_id)
    WHERE unidad_receptora_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vinculo_unidad_responsable
    ON sigd_doc.expediente_tupa_vinculo (unidad_responsable_id)
    WHERE unidad_responsable_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vinculo_unidad_resolutiva
    ON sigd_doc.expediente_tupa_vinculo (unidad_resolutiva_id)
    WHERE unidad_resolutiva_id IS NOT NULL;

COMMENT ON TABLE sigd_doc.expediente_tupa_vinculo IS
    'Vínculo expediente-TUPA con snapshot histórico de unidades y metadatos. WORM: inmutable tras creación.';

COMMENT ON COLUMN sigd_doc.tupa_version.periodo_documento IS
    'Periodo del documento fuente en formato YYYY-MM (ej. 2026-01). No inventar día.';

COMMENT ON COLUMN sigd_doc.tupa_version.uit_vigente IS
    'Unidad Impositiva Tributaria vigente al momento del documento fuente.';

COMMENT ON COLUMN sigd_doc.tupa_procedimiento.canal_presentacion IS
    'Canal de presentación del expediente. Tesorería NO es canal de presentación por el solo hecho de cobrar.';

COMMENT ON COLUMN sigd_doc.tupa_procedimiento.intervencion_financiera IS
    'Indica si el procedimiento requiere intervención financiera (pago). Fuente autoritativa, no derivada de monto>0.';

COMMENT ON TABLE sigd_doc.tupa_campo_procedencia IS
    'Procedencia de campos por procedimiento y versión de registro. Permite distinguir OFICIAL/DEFAULT/PROPUESTA/REFERENCIA.';

COMMENT ON TABLE sigd_doc.tupa_tarifa_variante IS
    'Tarifas variantes por procedimiento y versión de registro. Permite múltiples montos por procedimiento (ej. HEMBRAS/MACHOS).';

COMMIT;
