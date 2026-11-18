-- =============================================================================
-- Migración 33 · Esquema sigd_org · Estructura Orgánica y Responsabilidades Temporales (Fase 5C)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Modelo Canónico de Organización, Cargos y Responsabilidades SIGD 2026
-- Depende de: 03_sigd_org.sql, 31_sigd_vinculos_institucionales.sql, 32_sigd_vinculos_indice_anulado_por.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 33.1 Extensión de sigd_org.area (tipo_unidad configurable DISEÑO_SIGD)
-- -----------------------------------------------------------------------------
ALTER TABLE sigd_org.area
    ADD COLUMN IF NOT EXISTS tipo_unidad VARCHAR(30) NOT NULL DEFAULT 'AREA';

ALTER TABLE sigd_org.area
    DROP CONSTRAINT IF EXISTS chk_area_tipo_unidad;

ALTER TABLE sigd_org.area
    ADD CONSTRAINT chk_area_tipo_unidad
    CHECK (tipo_unidad IN ('DIRECCION', 'UNIDAD', 'AREA', 'OFICINA', 'SECRETARIA', 'SERVICIO', 'OTRO'));

COMMENT ON COLUMN sigd_org.area.tipo_unidad IS
    'Clasificación tipológica de la unidad orgánica conforme a DISEÑO_SIGD (configurable).';

-- -----------------------------------------------------------------------------
-- 33.2 Extensión de sigd_org.asignacion_personal (ciclo de vida e inmutabilidad)
-- -----------------------------------------------------------------------------
ALTER TABLE sigd_org.asignacion_personal
    ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    ADD COLUMN IF NOT EXISTS tipo_documento_sustento VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS numero_documento_sustento VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS fecha_documento_sustento DATE NULL,
    ADD COLUMN IF NOT EXISTS motivo_finalizacion VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS motivo_anulacion VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS anulado_en TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS anulado_por UUID NULL REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE sigd_org.asignacion_personal
    DROP CONSTRAINT IF EXISTS chk_asignacion_estado;

ALTER TABLE sigd_org.asignacion_personal
    ADD CONSTRAINT chk_asignacion_estado
    CHECK (estado IN ('ACTIVO', 'FINALIZADO', 'REVOCADO', 'ANULADO'));

ALTER TABLE sigd_org.asignacion_personal
    DROP CONSTRAINT IF EXISTS chk_asignacion_vigencia;

ALTER TABLE sigd_org.asignacion_personal
    ADD CONSTRAINT chk_asignacion_vigencia
    CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde);

ALTER TABLE sigd_org.asignacion_personal
    DROP CONSTRAINT IF EXISTS chk_asignacion_anulacion;

ALTER TABLE sigd_org.asignacion_personal
    ADD CONSTRAINT chk_asignacion_anulacion
    CHECK (estado <> 'ANULADO' OR (anulado_en IS NOT NULL AND motivo_anulacion IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_asig_personal_anulado_por
    ON sigd_org.asignacion_personal (anulado_por)
    WHERE anulado_por IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 33.3 Tabla unificada de responsabilidades temporales (Fase 5C)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_org.responsabilidad_temporal (
    id_responsabilidad          UUID         NOT NULL DEFAULT gen_random_uuid()
                                             CONSTRAINT pk_responsabilidad_temporal PRIMARY KEY,
    tipo_responsabilidad        VARCHAR(30)  NOT NULL,
    id_usuario                  UUID         NOT NULL
                                             REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE RESTRICT,
    titular_usuario_id          UUID         NULL
                                             REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE RESTRICT,
    cargo_id                    UUID         NOT NULL
                                             REFERENCES sigd_org.cargo (cargo_id) ON DELETE RESTRICT,
    area_id                     UUID         NOT NULL
                                             REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT,
    estado                      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO',
    vigente_desde               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    vigente_hasta               TIMESTAMPTZ  NULL,
    tipo_documento_sustento     VARCHAR(50)  NULL,
    numero_documento_sustento   VARCHAR(100) NULL,
    fecha_documento_sustento    DATE         NULL,
    alcance                     JSONB        NULL,
    motivo_finalizacion         VARCHAR(255) NULL,
    motivo_revocacion           VARCHAR(255) NULL,
    motivo_anulacion            VARCHAR(255) NULL,
    anulado_en                  TIMESTAMPTZ  NULL,
    anulado_por                 UUID         NULL
                                             REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE SET NULL,
    creado_en                   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_resp_temp_tipo CHECK (tipo_responsabilidad IN ('ENCARGATURA', 'SUPLENCIA', 'DELEGACION', 'DESIGNACION_ESPECIFICA')),
    CONSTRAINT chk_resp_temp_estado CHECK (estado IN ('ACTIVO', 'FINALIZADO', 'REVOCADO', 'ANULADO')),
    CONSTRAINT chk_resp_temp_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde),
    CONSTRAINT chk_resp_temp_no_auto CHECK (titular_usuario_id IS NULL OR titular_usuario_id <> id_usuario),
    CONSTRAINT chk_resp_temp_suplencia_titular CHECK (tipo_responsabilidad <> 'SUPLENCIA' OR titular_usuario_id IS NOT NULL),
    CONSTRAINT chk_resp_temp_anulacion CHECK (estado <> 'ANULADO' OR (anulado_en IS NOT NULL AND motivo_anulacion IS NOT NULL))
);

COMMENT ON TABLE sigd_org.responsabilidad_temporal IS
    'Registro histórico y trazable de responsabilidades temporales institucionales (encargaturas, suplencias, delegaciones y designaciones específicas).';

-- -----------------------------------------------------------------------------
-- 33.4 Índices B-Tree para optimización de llaves foráneas y consultas operativas
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_resp_temp_usuario
    ON sigd_org.responsabilidad_temporal (id_usuario);

CREATE INDEX IF NOT EXISTS idx_resp_temp_titular
    ON sigd_org.responsabilidad_temporal (titular_usuario_id)
    WHERE titular_usuario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_resp_temp_cargo
    ON sigd_org.responsabilidad_temporal (cargo_id);

CREATE INDEX IF NOT EXISTS idx_resp_temp_area
    ON sigd_org.responsabilidad_temporal (area_id);

CREATE INDEX IF NOT EXISTS idx_resp_temp_anulado_por
    ON sigd_org.responsabilidad_temporal (anulado_por)
    WHERE anulado_por IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_resp_temp_consulta
    ON sigd_org.responsabilidad_temporal (area_id, cargo_id, estado, vigente_desde, vigente_hasta);

COMMIT;
