-- =============================================================================
-- Migración 31 · Esquema sigd_auth · Vínculos Institucionales (Fase 5B)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Modelo Canónico de Identidad y Vínculos Institucionales SIGD 2026
-- Depende de: 02_sigd_auth.sql, 30_sigd_devolucion_monto_autorizado_check.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 31.1 Catálogo extensible de tipos de vínculos institucionales (DISEÑO_SIGD)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_auth.tipo_vinculo_institucional (
    id_tipo_vinculo   SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo            VARCHAR(30)  NOT NULL UNIQUE,
    nombre            VARCHAR(100) NOT NULL,
    categoria_actor   VARCHAR(30)  NOT NULL,
    descripcion       TEXT         NULL,
    vigente           BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_tipo_vinculo_categoria CHECK (categoria_actor IN ('COMUNIDAD_ACADEMICA', 'PERSONAL_INSTITUCIONAL', 'EXTERNO'))
);

COMMENT ON TABLE sigd_auth.tipo_vinculo_institucional IS
    'Catálogo extensible de tipos de vínculos institucionales. Clasificación funcional conforme al diseño de arquitectura SIGD (DISEÑO_SIGD).';

-- Semillas iniciales del catálogo funcional (DISEÑO_SIGD)
INSERT INTO sigd_auth.tipo_vinculo_institucional (codigo, nombre, categoria_actor, descripcion)
VALUES
    ('POSTULANTE', 'Postulante', 'COMUNIDAD_ACADEMICA', 'Persona registrada en proceso de admisión o postulación académica institucional'),
    ('ESTUDIANTE_ACTIVO', 'Estudiante Activo', 'COMUNIDAD_ACADEMICA', 'Estudiante con matrícula o vinculación académica regular activa'),
    ('EGRESADO', 'Egresado', 'COMUNIDAD_ACADEMICA', 'Estudiante que culminó el plan de estudios sin titulación'),
    ('TITULADO', 'Titulado', 'COMUNIDAD_ACADEMICA', 'Egresado que obtuvo título profesional institucional'),
    ('DOCENTE', 'Docente', 'PERSONAL_INSTITUCIONAL', 'Miembro del personal docente del instituto'),
    ('ADMINISTRATIVO', 'Personal Administrativo', 'PERSONAL_INSTITUCIONAL', 'Personal administrativo de apoyo y gestión institucional'),
    ('DIRECTIVO', 'Personal Directivo', 'PERSONAL_INSTITUCIONAL', 'Personal directivo y de alta dirección institucional')
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 31.2 Tabla relacional de vínculos institucionales por persona
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_auth.vinculo_institucional (
    id_vinculo          UUID         NOT NULL DEFAULT gen_random_uuid()
                                     CONSTRAINT pk_vinculo_institucional PRIMARY KEY,
    id_persona          UUID         NOT NULL
                                     REFERENCES sigd_auth.persona (id_persona) ON DELETE RESTRICT,
    id_tipo_vinculo     SMALLINT     NOT NULL
                                     REFERENCES sigd_auth.tipo_vinculo_institucional (id_tipo_vinculo) ON DELETE RESTRICT,
    estado              VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO',
    vigente_desde       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    vigente_hasta       TIMESTAMPTZ  NULL,
    motivo_finalizacion VARCHAR(255) NULL,
    motivo_anulacion    VARCHAR(255) NULL,
    anulado_en          TIMESTAMPTZ  NULL,
    anulado_por         UUID         NULL
                                     REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE SET NULL,
    creado_en           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_vinculo_inst_estado CHECK (estado IN ('ACTIVO', 'FINALIZADO', 'ANULADO')),
    CONSTRAINT chk_vinculo_inst_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde),
    CONSTRAINT chk_vinculo_inst_anulacion CHECK (estado <> 'ANULADO' OR (anulado_en IS NOT NULL AND motivo_anulacion IS NOT NULL))
);

COMMENT ON TABLE sigd_auth.vinculo_institucional IS
    'Relación institucional histórica y temporal entre una persona civil y el IESTP Suiza.';

-- -----------------------------------------------------------------------------
-- 31.3 Índices para optimización de consultas operativas y foráneas
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vinculo_inst_persona
    ON sigd_auth.vinculo_institucional (id_persona);

CREATE INDEX IF NOT EXISTS idx_vinculo_inst_tipo
    ON sigd_auth.vinculo_institucional (id_tipo_vinculo);

CREATE INDEX IF NOT EXISTS idx_vinculo_inst_consulta
    ON sigd_auth.vinculo_institucional (id_persona, estado, vigente_desde, vigente_hasta);

COMMIT;
