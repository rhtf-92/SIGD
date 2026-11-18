-- =============================================================================
-- MIGRACIÓN 29: OBSERVACIONES, SUBSANACIONES, RONDAS Y PRECLUSIÓN EN RUTADOC
-- PROYECTO: SIGD — Sistema Integral de Gestión Documentaria
-- INSTITUCIÓN: IESTP «Suiza» — Pucallpa, Ucayali
-- INTERVENCIÓN: TSK-DEV-04 — Microtarea 4.1
-- NORMATIVA: TUO Ley N° 27444 (LPAG), Arts. 136 y 142 (Pliego único, Preclusión y Suspensión de Plazos)
-- ALCANCE:
--   1. Creación de tabla sigd_rut.expediente_observacion (pliegos de observación y rondas).
--   2. Creación de tabla sigd_rut.observacion_requisito (detalle de requisitos TUPA observados).
--   3. Creación de tabla sigd_rut.expediente_subsanacion (pliegos de subsanación y descargos).
--   4. Índices relacionales de rendimiento y búsquedas por expediente, ronda y estado.
--   5. Asignación de privilegios DCL a roles operativos del sistema.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabla de Observaciones Procesales y Técnicas (Pliegos por Ronda)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_rut.expediente_observacion (
    id_observacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL,
    ronda SMALLINT NOT NULL CHECK (ronda >= 1 AND ronda <= 10),
    tipo_observacion VARCHAR(30) NOT NULL CHECK (tipo_observacion IN ('ADMINISTRATIVA', 'TECNICA')),
    motivo TEXT NOT NULL,
    sustento_tecnico TEXT,
    plazo_dias INTEGER NOT NULL DEFAULT 5 CHECK (plazo_dias >= 1 AND plazo_dias <= 30),
    fecha_limite TIMESTAMPTZ,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'SUBSANADA', 'VENCIDA', 'ANULADA')),
    usuario_observador_id BIGINT NOT NULL,
    usuario_cuenta_id UUID,
    area_origen_id UUID,
    id_movimiento UUID,
    fecha_observacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_subsanacion TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_exp_obs_expediente FOREIGN KEY (expediente_id)
        REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    CONSTRAINT fk_exp_obs_area FOREIGN KEY (area_origen_id)
        REFERENCES sigd_org.area (area_id) ON DELETE RESTRICT
);

COMMENT ON TABLE sigd_rut.expediente_observacion IS
'Pliegos formales y técnicos de observaciones por ronda en el trámite documentario (LPAG Arts. 136 y 142).';

CREATE INDEX IF NOT EXISTS idx_exp_obs_expediente_ronda
    ON sigd_rut.expediente_observacion (expediente_id, ronda);

CREATE INDEX IF NOT EXISTS idx_exp_obs_estado
    ON sigd_rut.expediente_observacion (estado);

CREATE INDEX IF NOT EXISTS idx_exp_obs_usuario
    ON sigd_rut.expediente_observacion (usuario_observador_id);

CREATE INDEX IF NOT EXISTS idx_exp_obs_movimiento
    ON sigd_rut.expediente_observacion (id_movimiento);

-- -----------------------------------------------------------------------------
-- 2. Tabla de Detalle de Requisitos TUPA Observados (Regla de Preclusión)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_rut.observacion_requisito (
    id_detalle UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_observacion UUID NOT NULL,
    requisito_id UUID NOT NULL,
    descripcion_incumplimiento TEXT NOT NULL,
    subsanado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_subsanacion TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_obs_req_observacion FOREIGN KEY (id_observacion)
        REFERENCES sigd_rut.expediente_observacion (id_observacion) ON DELETE CASCADE,
    CONSTRAINT fk_obs_req_requisito FOREIGN KEY (requisito_id)
        REFERENCES sigd_doc.requisito (requisito_id) ON DELETE RESTRICT,
    CONSTRAINT uq_obs_requisito UNIQUE (id_observacion, requisito_id)
);

COMMENT ON TABLE sigd_rut.observacion_requisito IS
'Detalle individual de requisitos TUPA observados por cada pliego para control de preclusión procesal.';

CREATE INDEX IF NOT EXISTS idx_obs_req_observacion
    ON sigd_rut.observacion_requisito (id_observacion);

CREATE INDEX IF NOT EXISTS idx_obs_req_requisito
    ON sigd_rut.observacion_requisito (requisito_id);

-- -----------------------------------------------------------------------------
-- 3. Tabla de Subsanaciones Procesales Presentadas por el Administrado
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_rut.expediente_subsanacion (
    id_subsanacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_observacion UUID NOT NULL,
    expediente_id UUID NOT NULL,
    ronda SMALLINT NOT NULL CHECK (ronda >= 1 AND ronda <= 10),
    descripcion_respuesta TEXT NOT NULL,
    canal_recepcion VARCHAR(30) NOT NULL CHECK (canal_recepcion IN ('VENTANILLA_MESA_PARTES', 'PORTAL_ESTUDIANTE', 'CASILLA_ELECTRONICA')),
    documento_adjunto_id UUID,
    usuario_subsanador_id BIGINT,
    usuario_cuenta_id UUID,
    es_titular BOOLEAN NOT NULL DEFAULT TRUE,
    id_movimiento UUID,
    fecha_subsanacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_exp_sub_observacion FOREIGN KEY (id_observacion)
        REFERENCES sigd_rut.expediente_observacion (id_observacion) ON DELETE RESTRICT,
    CONSTRAINT fk_exp_sub_expediente FOREIGN KEY (expediente_id)
        REFERENCES sigd_tra.expediente (expediente_id) ON DELETE RESTRICT,
    CONSTRAINT fk_exp_sub_doc_adjunto FOREIGN KEY (documento_adjunto_id)
        REFERENCES sigd_doc.documento_adjunto (documento_adjunto_id) ON DELETE SET NULL
);

COMMENT ON TABLE sigd_rut.expediente_subsanacion IS
'Registro formal de subsanaciones y descargos presentados por el administrado o por ventanilla presencial.';

CREATE INDEX IF NOT EXISTS idx_exp_sub_observacion
    ON sigd_rut.expediente_subsanacion (id_observacion);

CREATE INDEX IF NOT EXISTS idx_exp_sub_expediente_ronda
    ON sigd_rut.expediente_subsanacion (expediente_id, ronda);

CREATE INDEX IF NOT EXISTS idx_exp_sub_documento
    ON sigd_rut.expediente_subsanacion (documento_adjunto_id);

CREATE INDEX IF NOT EXISTS idx_exp_sub_movimiento
    ON sigd_rut.expediente_subsanacion (id_movimiento);

-- -----------------------------------------------------------------------------
-- 4. Asignación de Privilegios DCL a Roles Operativos
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_app') THEN
        GRANT SELECT, INSERT, UPDATE ON sigd_rut.expediente_observacion TO sigd_app;
        GRANT SELECT, INSERT, UPDATE ON sigd_rut.observacion_requisito TO sigd_app;
        GRANT SELECT, INSERT, UPDATE ON sigd_rut.expediente_subsanacion TO sigd_app;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_jacobo_user') THEN
        GRANT SELECT, INSERT, UPDATE ON sigd_rut.expediente_observacion TO sigd_jacobo_user;
        GRANT SELECT, INSERT, UPDATE ON sigd_rut.observacion_requisito TO sigd_jacobo_user;
        GRANT SELECT, INSERT, UPDATE ON sigd_rut.expediente_subsanacion TO sigd_jacobo_user;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_auditor') THEN
        GRANT SELECT ON sigd_rut.expediente_observacion TO sigd_auditor;
        GRANT SELECT ON sigd_rut.observacion_requisito TO sigd_auditor;
        GRANT SELECT ON sigd_rut.expediente_subsanacion TO sigd_auditor;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_test_ro') THEN
        GRANT SELECT ON sigd_rut.expediente_observacion TO sigd_test_ro;
        GRANT SELECT ON sigd_rut.observacion_requisito TO sigd_test_ro;
        GRANT SELECT ON sigd_rut.expediente_subsanacion TO sigd_test_ro;
    END IF;
END $$;
