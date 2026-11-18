-- =============================================================================
-- Migración 15 · Solicitudes de Acceso al TUPA y Trámites Dinámicos No Documentarios
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Política Institucional SIGD 2026 / TUO Ley 27444 / Ley N° 29733
-- Depende de: 08_sigd_tupa_acoplamiento.sql, 14_sigd_registro_ubigeo.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Solicitudes de Acceso al Catálogo TUPA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_doc.tupa_solicitud_acceso (
    id_solicitud           UUID NOT NULL DEFAULT gen_random_uuid()
                           CONSTRAINT pk_tupa_solicitud_acceso PRIMARY KEY,
    id_persona             UUID NOT NULL
                           CONSTRAINT fk_tupa_solicitud_persona
                           REFERENCES sigd_auth.persona (id_persona) ON DELETE RESTRICT,
    correo                 VARCHAR(160) NOT NULL,
    motivo                 TEXT NOT NULL,
    fecha_solicitud        TIMESTAMPTZ NOT NULL DEFAULT now(),
    estado                 VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    fecha_resolucion       TIMESTAMPTZ NULL,
    resuelto_por           UUID NULL
                           CONSTRAINT fk_tupa_solicitud_resuelto_por
                           REFERENCES sigd_auth.cuenta_usuario (id_usuario) ON DELETE SET NULL,
    observacion_resolucion TEXT NULL,
    vigencia_hasta         TIMESTAMPTZ NULL,
    CONSTRAINT chk_tupa_solicitud_estado
        CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'EXPIRADA')),
    CONSTRAINT chk_tupa_solicitud_motivo
        CHECK (btrim(motivo) <> ''),
    CONSTRAINT chk_tupa_solicitud_correo
        CHECK (correo ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE sigd_doc.tupa_solicitud_acceso IS
    'Registro de solicitudes ciudadanas de acceso al catálogo institucional TUPA.';

-- Índices en llaves foráneas y búsquedas por estado / persona
CREATE INDEX IF NOT EXISTS idx_tupa_solicitud_persona_estado
    ON sigd_doc.tupa_solicitud_acceso (id_persona, estado);

CREATE INDEX IF NOT EXISTS idx_tupa_solicitud_estado
    ON sigd_doc.tupa_solicitud_acceso (estado, fecha_solicitud DESC);

CREATE INDEX IF NOT EXISTS idx_tupa_solicitud_resuelto_por
    ON sigd_doc.tupa_solicitud_acceso (resuelto_por)
    WHERE resuelto_por IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Trazabilidad de Trámites Dinámicos No Documentarios (SOL-2026-XXXXXX)
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS sigd_doc.secuencia_solicitud_dinamica_2026
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO CYCLE;

CREATE TABLE IF NOT EXISTS sigd_doc.solicitud_tramite_dinamico (
    id_solicitud        UUID NOT NULL DEFAULT gen_random_uuid()
                        CONSTRAINT pk_solicitud_tramite_dinamico PRIMARY KEY,
    codigo_solicitud    VARCHAR(30) NOT NULL
                        CONSTRAINT uq_solicitud_dinamica_codigo UNIQUE,
    tipo_formulario     VARCHAR(30) NOT NULL,
    codigo_tupa         VARCHAR(50) NOT NULL,
    denominacion        TEXT NOT NULL,
    id_persona          UUID NOT NULL
                        CONSTRAINT fk_solicitud_dinamica_persona
                        REFERENCES sigd_auth.persona (id_persona) ON DELETE RESTRICT,
    nombre_solicitante  VARCHAR(255) NOT NULL,
    correo              VARCHAR(160) NOT NULL,
    telefono            VARCHAR(30) NULL,
    monto_total         NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    datos_formulario    JSONB NOT NULL DEFAULT '{}'::jsonb,
    estado              VARCHAR(30) NOT NULL DEFAULT 'SOLICITADO',
    observacion         TEXT NULL,
    fecha_solicitud     TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_solicitud_dinamica_tipo
        CHECK (tipo_formulario IN ('DOCUMENTARIO', 'ACADEMICO', 'SERVICIO', 'VENTA_BIEN', 'ALQUILER', 'ACTUACION_INTERNA', 'OTRO')),
    CONSTRAINT chk_solicitud_dinamica_estado
        CHECK (estado IN ('SOLICITADO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'ATENDIDO', 'CANCELADO')),
    CONSTRAINT chk_solicitud_dinamica_monto
        CHECK (monto_total >= 0.00)
);

COMMENT ON TABLE sigd_doc.solicitud_tramite_dinamico IS
    'Trazabilidad de solicitudes no documentarias derivadas del catálogo TUPA (bienes, alquileres, servicios, académicos).';

-- Índices en llaves foráneas y consultas ciudadanas / institucionales
CREATE INDEX IF NOT EXISTS idx_sol_dinamica_persona_fecha
    ON sigd_doc.solicitud_tramite_dinamico (id_persona, fecha_solicitud DESC);

CREATE INDEX IF NOT EXISTS idx_sol_dinamica_tipo_estado
    ON sigd_doc.solicitud_tramite_dinamico (tipo_formulario, estado);

CREATE INDEX IF NOT EXISTS idx_sol_dinamica_codigo
    ON sigd_doc.solicitud_tramite_dinamico (codigo_solicitud);
