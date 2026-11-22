-- =============================================================================
-- Migración 52: Flujo de Negocio Certificado de Inglés (Extensible) y Excepciones
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Objetivo:
--   Soporta el circuito completo de negocio de Certificado de Inglés y otros
--   trámites documentarios con sub-etapas de evaluación, firma académica SDA,
--   Visto Bueno (V/B) + Firma Digital de Dirección General y flujos de
--   excepción (Inasistencia NSP -> IMPROCEDENTE / ARCHIVADO_POR_INASISTENCIA,
--   Entrega Digital -> ATENDIDO_NOTIFICADO y Entrega Presencial ->
--   LISTO_PARA_ENTREGA -> ARCHIVADO_NO_RECOGIDO en custodia sin invalidar doc).
--
-- Invariante preservada:
--   NO altera sigd_rut.estado_tramite (10 estados) ni
--   sigd_rut.transicion_estado_tramite (13 transiciones) ni
--   sigd_rut.workflow_procedimiento_config (18 mapeos TUPA).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Estado de Flujo de Negocio Detallado por Expediente
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_rut.expediente_flujo_certificado (
    id_flujo                           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id                      UUID         NOT NULL UNIQUE
                                                    REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
    codigo_procedimiento               VARCHAR(60)  NOT NULL DEFAULT 'p1-fila-06',
    nombre_tramite                     VARCHAR(250) NOT NULL DEFAULT 'Certificado de Inglés',
    estado_flujo                       VARCHAR(50)  NOT NULL DEFAULT 'SOLICITUD_INICIADA',
    canal_entrega                      VARCHAR(20)  NOT NULL DEFAULT 'DIGITAL',

    -- Paso 2: Mesa de Partes (Recepción y validación de requisitos)
    requisitos_validados               BOOLEAN      NOT NULL DEFAULT false,
    validado_mp_por                    UUID         NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    validado_mp_en                     TIMESTAMPTZ  NULL,

    -- Paso 3: Subdirección Académica -> Especialista del Centro de Idiomas
    especialista_asignado_usuario_id   UUID         NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    especialista_asignado_persona_id   UUID         NULL REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT,
    derivado_especialista_por          UUID         NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    derivado_especialista_en           TIMESTAMPTZ  NULL,

    -- Paso 4.1: Programación de evaluación
    fecha_evaluacion                   TIMESTAMPTZ  NULL,
    modalidad_evaluacion               VARCHAR(20)  NULL,
    lugar_enlace_evaluacion            TEXT         NULL,
    evaluacion_observaciones           TEXT         NULL,
    evaluacion_programada_por          UUID         NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    evaluacion_programada_en           TIMESTAMPTZ  NULL,

    -- Paso 4.2: Calificación o inasistencia (NSP)
    asistencia_evaluacion              VARCHAR(20)  NULL,
    nota_evaluacion                    NUMERIC(5,2) NULL,
    nivel_mcer                         VARCHAR(10)  NULL,
    resultado_evaluacion               VARCHAR(20)  NULL,
    calificacion_observaciones         TEXT         NULL,
    calificado_por                     UUID         NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    calificado_en                      TIMESTAMPTZ  NULL,

    -- Paso 4.3: Informe de resultados o NSP devuelto a Sub D. Acad.
    numero_informe                     VARCHAR(80)  NULL,
    tipo_informe                       VARCHAR(30)  NULL,
    informe_resumen                    TEXT         NULL,
    informe_documento_id               UUID         NULL,
    informe_emitido_por                UUID         NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    informe_emitido_en                 TIMESTAMPTZ  NULL,

    -- Paso 5: Subdirección Académica (Emisión y firma del certificado)
    codigo_certificado                 VARCHAR(80)  NULL,
    sello_firma_sda                    TEXT         NULL,
    certificado_documento_id           UUID         NULL,
    certificado_emitido_por            UUID         NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    certificado_emitido_en             TIMESTAMPTZ  NULL,

    -- Paso 6: Dirección General (Visto Bueno V/B + Firma Digital)
    visto_bueno_direccion              BOOLEAN      NOT NULL DEFAULT false,
    visto_bueno_por                    UUID         NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    visto_bueno_en                     TIMESTAMPTZ  NULL,
    firma_digital_cvd                  VARCHAR(60)  NULL,
    firma_digital_sha256               CHAR(64)     NULL,
    firma_digital_documento_id         UUID         NULL,
    firma_digital_s3_key               VARCHAR(500) NULL,
    firmado_digital_por                UUID         NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    firmado_digital_en                 TIMESTAMPTZ  NULL,

    -- Entrega Digital / Presencial y Custodia (Excepciones)
    documento_valido                   BOOLEAN      NOT NULL DEFAULT false,
    descarga_habilitada                BOOLEAN      NOT NULL DEFAULT false,
    notificado_en                      TIMESTAMPTZ  NULL,
    plazo_recojo_dias                  INTEGER      NOT NULL DEFAULT 30,
    fecha_limite_recojo                TIMESTAMPTZ  NULL,
    fecha_entrega_presencial           TIMESTAMPTZ  NULL,
    entregado_a_dni                    VARCHAR(20)  NULL,
    entregado_a_nombre                 VARCHAR(200) NULL,
    en_custodia                        BOOLEAN      NOT NULL DEFAULT false,
    custodia_ubicacion                 JSONB        NULL,
    motivo_cierre                      TEXT         NULL,

    creado_en                          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en                     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finalizado_en                      TIMESTAMPTZ  NULL,

    CONSTRAINT chk_flujo_cert_estado CHECK (estado_flujo IN (
        'SOLICITUD_INICIADA',
        'VALIDADO_MESA_PARTES',
        'DERIVADO_SUBDIRECCION',
        'EN_EVALUACION_ESPECIALISTA',
        'EVALUACION_PROGRAMADA',
        'EVALUACION_CALIFICADA',
        'INASISTENCIA_REGISTRADA',
        'INFORME_DEVUELTO_SUBDIRECCION',
        'INFORME_NSP_DEVUELTO_SUBDIRECCION',
        'CERTIFICADO_EMITIDO_SDA',
        'IMPROCEDENTE',
        'ARCHIVADO_POR_INASISTENCIA',
        'ATENDIDO_NOTIFICADO',
        'LISTO_PARA_ENTREGA',
        'ARCHIVADO_NO_RECOGIDO'
    )),
    CONSTRAINT chk_flujo_cert_canal CHECK (canal_entrega IN ('DIGITAL', 'PRESENCIAL')),
    CONSTRAINT chk_flujo_cert_modalidad CHECK (
        modalidad_evaluacion IS NULL OR modalidad_evaluacion IN ('PRESENCIAL', 'VIRTUAL', 'MIXTA')
    ),
    CONSTRAINT chk_flujo_cert_asistencia CHECK (
        asistencia_evaluacion IS NULL OR asistencia_evaluacion IN ('ASISTIO', 'NO_SE_PRESENTO')
    ),
    CONSTRAINT chk_flujo_cert_nota CHECK (
        nota_evaluacion IS NULL OR (nota_evaluacion >= 0 AND nota_evaluacion <= 100)
    ),
    CONSTRAINT chk_flujo_cert_nivel CHECK (
        nivel_mcer IS NULL OR nivel_mcer IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
    ),
    CONSTRAINT chk_flujo_cert_resultado CHECK (
        resultado_evaluacion IS NULL OR resultado_evaluacion IN ('APROBADO', 'DESAPROBADO', 'NSP')
    ),
    CONSTRAINT chk_flujo_cert_tipo_informe CHECK (
        tipo_informe IS NULL OR tipo_informe IN ('RESULTADOS', 'INASISTENCIA_NSP')
    ),
    CONSTRAINT chk_flujo_cert_plazo CHECK (plazo_recojo_dias > 0)
);

CREATE INDEX IF NOT EXISTS idx_flujo_cert_estado
    ON sigd_rut.expediente_flujo_certificado (estado_flujo);
CREATE INDEX IF NOT EXISTS idx_flujo_cert_especialista
    ON sigd_rut.expediente_flujo_certificado (especialista_asignado_usuario_id);
CREATE INDEX IF NOT EXISTS idx_flujo_cert_recojo_vencimiento
    ON sigd_rut.expediente_flujo_certificado (estado_flujo, fecha_limite_recojo)
    WHERE estado_flujo = 'LISTO_PARA_ENTREGA';

-- -----------------------------------------------------------------------------
-- 2. Historial WORM / Auditoría de Movimientos del Flujo de Negocio
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sigd_rut.expediente_flujo_historial (
    id_historial            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id           UUID         NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT,
    secuencia               INTEGER      NOT NULL CHECK (secuencia > 0),
    estado_anterior         VARCHAR(50)  NULL,
    evento                  VARCHAR(60)  NOT NULL,
    estado_nuevo            VARCHAR(50)  NOT NULL,
    estado_rutadoc_anterior VARCHAR(30)  NULL,
    estado_rutadoc_nuevo    VARCHAR(30)  NOT NULL,
    rol_actor               VARCHAR(40)  NOT NULL,
    usuario_actor_id        UUID         NOT NULL,
    area_origen_id          VARCHAR(60)  NULL,
    area_destino_id         VARCHAR(60)  NULL,
    id_movimiento_rutadoc   UUID         NULL,
    detalle                 TEXT         NULL,
    metadatos               JSONB        NOT NULL DEFAULT '{}'::jsonb,
    creado_en               TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_exp_flujo_hist_seq UNIQUE (expediente_id, secuencia),
    CONSTRAINT chk_flujo_hist_metadatos CHECK (jsonb_typeof(metadatos) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_flujo_hist_expediente
    ON sigd_rut.expediente_flujo_historial (expediente_id, secuencia ASC);
CREATE INDEX IF NOT EXISTS idx_flujo_hist_mov_rutadoc
    ON sigd_rut.expediente_flujo_historial (id_movimiento_rutadoc)
    WHERE id_movimiento_rutadoc IS NOT NULL;

CREATE OR REPLACE FUNCTION sigd_rut.fn_rechazar_mutacion_flujo_historial()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'sigd_rut.expediente_flujo_historial es un registro WORM inmutable'
        USING ERRCODE = '23001';
END;
$$;

DROP TRIGGER IF EXISTS tr_flujo_historial_inmutable ON sigd_rut.expediente_flujo_historial;
CREATE TRIGGER tr_flujo_historial_inmutable
    BEFORE UPDATE OR DELETE ON sigd_rut.expediente_flujo_historial
    FOR EACH ROW EXECUTE FUNCTION sigd_rut.fn_rechazar_mutacion_flujo_historial();

DROP TRIGGER IF EXISTS tr_flujo_historial_no_truncar ON sigd_rut.expediente_flujo_historial;
CREATE TRIGGER tr_flujo_historial_no_truncar
    BEFORE TRUNCATE ON sigd_rut.expediente_flujo_historial
    FOR EACH STATEMENT EXECUTE FUNCTION sigd_rut.fn_rechazar_mutacion_flujo_historial();

COMMIT;
