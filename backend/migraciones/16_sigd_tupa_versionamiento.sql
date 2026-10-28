-- =============================================================================
-- Migración 16 · Versiones del TUPA y Procedimientos Data-Driven
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)
-- =============================================================================

CREATE TABLE IF NOT EXISTS sigd_doc.tupa_version (
    id_version           UUID NOT NULL DEFAULT gen_random_uuid()
                         CONSTRAINT pk_tupa_version PRIMARY KEY,
    codigo               VARCHAR(30) NOT NULL
                         CONSTRAINT uq_tupa_version_codigo UNIQUE,
    denominacion         VARCHAR(150) NOT NULL,
    anio                 INTEGER NOT NULL
                         CONSTRAINT uq_tupa_version_anio UNIQUE,
    estado               VARCHAR(20) NOT NULL DEFAULT 'BORRADOR'
                         CONSTRAINT chk_tupa_version_estado
                         CHECK (estado IN ('BORRADOR', 'VIGENTE', 'HISTORICO')),
    resolucion_aprobacion VARCHAR(100) NULL,
    fecha_aprobacion     DATE NULL,
    total_procedimientos INTEGER NOT NULL DEFAULT 0,
    creado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tupa_version_estado_anio
    ON sigd_doc.tupa_version (estado, anio DESC);

CREATE TABLE IF NOT EXISTS sigd_doc.tupa_procedimiento (
    id_procedimiento     UUID NOT NULL DEFAULT gen_random_uuid()
                         CONSTRAINT pk_tupa_procedimiento PRIMARY KEY,
    id_version           UUID NOT NULL
                         CONSTRAINT fk_tupa_proc_version
                         REFERENCES sigd_doc.tupa_version (id_version) ON DELETE RESTRICT,
    codigo_ref           VARCHAR(50) NOT NULL,
    codigo_externo       VARCHAR(50) NULL,
    denominacion         TEXT NOT NULL
                         CONSTRAINT chk_tupa_proc_denominacion CHECK (btrim(denominacion) <> ''),
    categoria            VARCHAR(50) NOT NULL,
    tipo_formulario      VARCHAR(30) NOT NULL DEFAULT 'DOCUMENTARIO'
                         CONSTRAINT chk_tupa_proc_tipo_formulario
                         CHECK (tipo_formulario IN ('DOCUMENTARIO', 'ACADEMICO', 'SERVICIO', 'VENTA_BIEN', 'ALQUILER', 'ACTUACION_INTERNA', 'OTRO')),
    monto                NUMERIC(10, 2) NOT NULL DEFAULT 0.00
                         CONSTRAINT chk_tupa_proc_monto CHECK (monto >= 0),
    unidad_cobro         VARCHAR(50) NOT NULL DEFAULT 'PEN',
    plazo_dias           INTEGER NOT NULL DEFAULT 30
                         CONSTRAINT chk_tupa_proc_plazo CHECK (plazo_dias >= 0),
    requisitos           JSONB NOT NULL DEFAULT '[]'::jsonb,
    genera_expediente    BOOLEAN NOT NULL DEFAULT true,
    calificacion         VARCHAR(40) NOT NULL DEFAULT 'EVALUACION_PREVIA_POSITIVA'
                         CONSTRAINT chk_tupa_proc_calificacion
                         CHECK (calificacion IN ('AUTOMATICA', 'EVALUACION_PREVIA_POSITIVA', 'EVALUACION_PREVIA_NEGATIVA', 'NO_APLICA')),
    registro_version_id  UUID NULL
                         CONSTRAINT fk_tupa_proc_registro_version
                         REFERENCES sigd_doc.tupa_registro_version (registro_version_id) ON DELETE SET NULL,
    activo               BOOLEAN NOT NULL DEFAULT true,
    orden                INTEGER NOT NULL DEFAULT 0,
    creado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tupa_proc_version_ref UNIQUE (id_version, codigo_ref)
);

CREATE INDEX IF NOT EXISTS idx_tupa_proc_version_cat
    ON sigd_doc.tupa_procedimiento (id_version, categoria, activo);

CREATE INDEX IF NOT EXISTS idx_tupa_proc_version_expediente
    ON sigd_doc.tupa_procedimiento (id_version, genera_expediente);

CREATE INDEX IF NOT EXISTS idx_tupa_proc_registro_version
    ON sigd_doc.tupa_procedimiento (registro_version_id)
    WHERE registro_version_id IS NOT NULL;

-- Inserción inicial de TUPA 2026 Vigente
INSERT INTO sigd_doc.tupa_version (codigo, denominacion, anio, estado, resolucion_aprobacion, fecha_aprobacion, total_procedimientos)
VALUES ('TUPA-2026', 'Texto Único de Procedimientos Administrativos 2026', 2026, 'VIGENTE', 'R.D. N° 045-2026-IESTP-SUIZA', '2026-01-15', 72)
ON CONFLICT (codigo) DO UPDATE
  SET total_procedimientos = 72, estado = 'VIGENTE';

DO $$
DECLARE
    v_id_version UUID;
BEGIN
    SELECT id_version INTO v_id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026';

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p1-fila-01', 'p1-fila-01', 'Prácticas Iniciales', 'ACTUACION_INTERNA', 'ACTUACION_INTERNA',
        35.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Control en el Área Académica","Comprobante de Pago 0.64 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p1-fila-01' LIMIT 1),
        true, 1
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p1-fila-02', 'p1-fila-02', 'Prácticas Intermedias', 'ACTUACION_INTERNA', 'ACTUACION_INTERNA',
        45.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Control en el Área Académica","Comprobante de Pago 0.82 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p1-fila-02' LIMIT 1),
        true, 2
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p1-fila-03', 'p1-fila-03', 'Prácticas Finales', 'ACTUACION_INTERNA', 'ACTUACION_INTERNA',
        60.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Control en el Área Académica","Comprobante de Pago 1.09 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p1-fila-03' LIMIT 1),
        true, 3
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p1-fila-04', 'p1-fila-04', 'Experiencias Formativas en Situaciones Reales de Trabajo (I, II, III y IV) Por cada Módulo', 'ACTUACION_INTERNA', 'ACTUACION_INTERNA',
        46.50, 'PEN', 30, '["Informe del Área Académica designando los Docentes responsables para las Supervisiones de Experiencias Formativas en Situaciones Reales de Trabajo","Pago del Derecho en Tesorería","Comprobante de Pago 0.84 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p1-fila-04' LIMIT 1),
        true, 4
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p1-fila-05', 'p1-fila-05', 'Certificado Modular (I, II, III y IV) Por cada Módulo', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        100.00, 'PEN', 15, '["Pago en el Área de Tesorería","Emisión de la B/V"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p1-fila-05' LIMIT 1),
        true, 5
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p1-fila-06', 'p1-fila-06', 'Certificado de Inglés', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        100.00, 'PEN', 15, '["Pago en el Área de Tesorería","Emisión de la B/V"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p1-fila-06' LIMIT 1),
        true, 6
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p1-fila-07', 'p1-fila-07', 'Centro de Idiomas: Inglés, Portugués, Japonés Nivel Básico Paquete: 04 meses para Alumnos del IESTP "SUIZA"', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        300.00, 'PEN', 30, '["Pago en el Área de Tesorería","Emisión de la B/V"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p1-fila-07' LIMIT 1),
        true, 7
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p1-fila-08', 'p1-fila-08', 'Centro de Idiomas: Inglés, Portugués, Japonés Nivel Básico Paquete: 04 meses para Alumnos Externos del IESTP "SUIZA"', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        350.00, 'PEN', 30, '["Pago en el Área de Tesorería","Emisión de la B/V"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p1-fila-08' LIMIT 1),
        true, 8
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p1-fila-09', 'p1-fila-09', 'Examen de Suficiencia de Inglés y/o Portugués', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        300.00, 'PEN', 30, '["Pago en el Área de Tesorería","Emisión de la B/V"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p1-fila-09' LIMIT 1),
        true, 9
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p1-fila-10', 'p1-fila-10', 'CEPRETEC 2026', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        400.00, 'PEN', 30, '["Pago en el Área de Tesorería","Emisión de la B/V"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p1-fila-10' LIMIT 1),
        true, 10
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p2-fila-01', 'p2-fila-01', 'Alquiler del Galpón Agrícola Para la Crianza de Pollos (Por Campaña)', 'SERVICIO_COMERCIAL', 'SERVICIO',
        500.00, 'PEN', 30, '["Solicitud dirigida al Director del IESTP SUIZA.","Suscripción del Contrato.","Pago en tesorería de acuerdo al Contrato","Precio por Campaña"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p2-fila-01' LIMIT 1),
        true, 11
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p2-fila-02', 'p2-fila-02', 'Alquiler de Retroproyector', 'SERVICIO_COMERCIAL', 'SERVICIO',
        100.00, 'PEN', 30, '["Pago en tesorería."]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p2-fila-02' LIMIT 1),
        true, 12
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p2-fila-03', 'p2-fila-03', 'Alquiler de Aulas - Diario', 'SERVICIO_COMERCIAL', 'SERVICIO',
        150.00, 'PEN', 30, '["Solicitud dirigida al Director del IESTP SUIZA","Proveído a la Unidad Administrativa para su Autorización","Pago en tesorería.","Emisión de B/V."]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p2-fila-03' LIMIT 1),
        true, 13
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p2-fila-04', 'p2-fila-04', 'Alquiler de la Cancha de Fútbol - Diario', 'SERVICIO_COMERCIAL', 'SERVICIO',
        100.00, 'PEN', 30, '["Solicitud dirigida al Director del IESTP SUIZA","Proveído a la Unidad Administrativa para su Autorización","Pago en tesorería.","Emisión de B/V."]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p2-fila-04' LIMIT 1),
        true, 14
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p2-fila-05', 'p2-fila-05', 'Alquiler de Ambientes para servicio de alimentación.', 'SERVICIO_COMERCIAL', 'SERVICIO',
        1.00, 'PEN', 30, '["Solicitud dirigida al Director del IESTP SUIZA.","Suscripción del Contrato.","Pago en tesorería de acuerdo al Contrato","Precios de acuerdo al Contrato S/. 50.00 a S/. 350.00"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p2-fila-05' LIMIT 1),
        true, 15
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p2-fila-06', 'p2-fila-06', 'Alquiler del Auditorio.', 'SERVICIO_COMERCIAL', 'SERVICIO',
        300.00, 'PEN', 30, '["Solicitud dirigida al Director del IESTP SUIZA.","Proveído a la Unidad Administrativa para su Autorización","Pago en tesorería.","Emisión de B/V."]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p2-fila-06' LIMIT 1),
        true, 16
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p2-fila-07', 'p2-fila-07', 'Alquiler de Laboratorio de Cómputo a Terceros', 'SERVICIO_COMERCIAL', 'SERVICIO',
        20.00, 'PEN', 30, '["Por hora y por cada equipo"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p2-fila-07' LIMIT 1),
        true, 17
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p2-fila-08', 'p2-fila-08', 'Venta Ambulatoria Diaria', 'SERVICIO_COMERCIAL', 'SERVICIO',
        20.00, 'PEN', 30, '["Solicitud dirigida al Director.","Proveído a la Unidad Administrativa para su Autorización.","Pago en Tesorería.","Emisión de la B/V"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p2-fila-08' LIMIT 1),
        true, 18
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p2-fila-09', 'p2-fila-09', 'Venta de Mangos (Ciento)', 'BIEN_PRODUCTIVO', 'VENTA_BIEN',
        15.00, 'PEN', 30, '["Pago en Tesorería","Entrega del bien en proyectos","Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.","Supervisión de salida del bien-vigilancia","Emisión de Boleta de Venta"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p2-fila-09' LIMIT 1),
        true, 19
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p2-fila-10', 'p2-fila-10', 'Venta de Patos BB', 'BIEN_PRODUCTIVO', 'VENTA_BIEN',
        15.00, 'PEN', 30, '["Pago en Tesorería","Entrega del bien en Proyectos","Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.","Supervisión de salida del bien-vigilancia","Emisión de Boleta de Venta"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p2-fila-10' LIMIT 1),
        true, 20
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p3-fila-01', 'p3-fila-01', 'Venta de Patos Pichones, de acuerdo al Tamaño.', 'BIEN_PRODUCTIVO', 'VENTA_BIEN',
        30.00, 'PEN', 30, '["Pago en Tesorería","Entrega del bien en Proyectos","Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.","Supervisión de salida del bien-vigilancia","Emisión de Boleta de Venta","PICHONES HEMBRAS: S/ 30.00","PICHONES MACHOS: S/ 40.00"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p3-fila-01' LIMIT 1),
        true, 21
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p3-fila-02', 'p3-fila-02', 'Venta de Pati Pollos', 'BIEN_PRODUCTIVO', 'VENTA_BIEN',
        15.00, 'PEN', 30, '["Pago en Tesorería","Entrega del bien en Proyectos","Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.","Supervisión de salida del bien-vigilancia","Emisión de Boleta de Venta"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p3-fila-02' LIMIT 1),
        true, 22
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p3-fila-03', 'p3-fila-03', 'Venta de Patos adultos hembras', 'BIEN_PRODUCTIVO', 'VENTA_BIEN',
        40.00, 'PEN', 30, '["Pago en Tesorería","Entrega del bien en Proyectos","Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.","Supervisión de salida del bien-vigilancia","Emisión de Boleta de Venta"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p3-fila-03' LIMIT 1),
        true, 23
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p3-fila-04', 'p3-fila-04', 'Venta de Patos adultos machos', 'BIEN_PRODUCTIVO', 'VENTA_BIEN',
        50.00, 'PEN', 30, '["Pago en Tesorería","Entrega del bien en Proyectos","Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.","Supervisión de salida del bien-vigilancia","Emisión de Boleta de Venta"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p3-fila-04' LIMIT 1),
        true, 24
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p3-fila-05', 'p3-fila-05', 'Venta de Porcino para consumo Kg', 'BIEN_PRODUCTIVO', 'VENTA_BIEN',
        20.00, 'PEN', 30, '["Pago en Tesorería","Entrega del bien en Proyectos","Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.","Supervisión de salida del bien-vigilancia","Emisión de Boleta de Venta"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p3-fila-05' LIMIT 1),
        true, 25
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p3-fila-06', 'p3-fila-06', 'Venta de Porcino en Pie Kg', 'BIEN_PRODUCTIVO', 'VENTA_BIEN',
        25.00, 'PEN', 30, '["Emisión de B/V.","REPRODUCTOR: S/ 25.00","CARNE: S/ 15.00"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p3-fila-06' LIMIT 1),
        true, 26
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p3-fila-07', 'p3-fila-07', 'Venta de Ganado Vacuno en pie Kg; EN', 'BIEN_PRODUCTIVO', 'VENTA_BIEN',
        20.00, 'PEN', 30, '["Pago en Tesorería","Entrega del bien en Proyectos","Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.","Supervisión de salida del bien-vigilancia","Emisión de B/V.","CARCASA (SIN PATA, SIN CABEZA) KG: S/ 20.00","EN PIE: S/ 15.00"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p3-fila-07' LIMIT 1),
        true, 27
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p3-fila-08', 'p3-fila-08', 'Servicio de Empadre', 'SERVICIO_COMERCIAL', 'SERVICIO',
        50.00, 'PEN', 30, '["Ejecución del Servicio","Pago en Tesorería","Emisión de B/V."]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p3-fila-08' LIMIT 1),
        true, 28
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p4-fila-01', 'p4-fila-01', 'FUT', 'OTRO_NO_RADICABLE', 'DOCUMENTARIO',
        4.00, 'PEN', 30, '["Pago del Derecho en Tesorería 3 FUT","Comprobante de Pago 0.07 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p4-fila-01' LIMIT 1),
        true, 29
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p4-fila-02', 'p4-fila-02', 'Constancia de No Adeudar (Para fines de Titulación)', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        16.50, 'PEN', 7, '["Pago del Derecho en Tesorería","Comprobante de Pago 0.30 % UIT Vigente"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p4-fila-02' LIMIT 1),
        true, 30
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p4-fila-03', 'p4-fila-03', 'Trabajo de Aplicación Profesional (Examen Teórico Práctico)', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        57.00, 'PEN', 30, '["Pago del Derecho en Tesorería, 1.03 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p4-fila-03' LIMIT 1),
        true, 31
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p4-fila-04', 'p4-fila-04', 'Examen de Suficiencia Profesional (Examen Teórico Práctico)', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        57.00, 'PEN', 30, '["Pago del Derecho en Tesorería, 1.03 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p4-fila-04' LIMIT 1),
        true, 32
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p4-fila-05', 'p4-fila-05', 'Expedición de Título', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        105.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Comprobante de Pago 1.90 % UIT Vigente"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p4-fila-05' LIMIT 1),
        true, 33
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p4-fila-06', 'p4-fila-06', 'Certificado de Estudios Superiores (6 Semestres)', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        124.00, 'PEN', 15, '["Pago del Derecho en Tesorería","Comprobante de Pago 2.24 % UIT Vigente"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p4-fila-06' LIMIT 1),
        true, 34
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p4-fila-07', 'p4-fila-07', 'Visación de Certificado de Estudios Superiores', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        16.00, 'PEN', 7, '["Pago del Derecho en Tesorería","Comprobante de Pago 0.29 % UIT Vigente"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p4-fila-07' LIMIT 1),
        true, 35
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p4-fila-08', 'p4-fila-08', 'Caligrafiado de Título', 'OTRO_NO_RADICABLE', 'DOCUMENTARIO',
        26.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Comprobante de Pago 0.47 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p4-fila-08' LIMIT 1),
        true, 36
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p4-fila-09', 'p4-fila-09', 'Derecho de Formato de Título', 'OTRO_NO_RADICABLE', 'DOCUMENTARIO',
        42.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Comprobante de Pago 0.75 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p4-fila-09' LIMIT 1),
        true, 37
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p4-fila-10', 'p4-fila-10', 'Inscripción de Título', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        120.00, 'PEN', 15, '["Pago del Derecho en Tesorería","Comprobante de Pago"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p4-fila-10' LIMIT 1),
        true, 38
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p4-fila-11', 'p4-fila-11', 'Medallas', 'OTRO_NO_RADICABLE', 'DOCUMENTARIO',
        100.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Comprobante de Pago"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p4-fila-11' LIMIT 1),
        true, 39
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p4-fila-12', 'p4-fila-12', 'Protector de Título', 'OTRO_NO_RADICABLE', 'DOCUMENTARIO',
        100.00, 'PEN', 30, '["Pago del Derecho en Tesorería"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p4-fila-12' LIMIT 1),
        true, 40
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p4-fila-13', 'p4-fila-13', 'Colación', 'ACTUACION_INTERNA', 'ACTUACION_INTERNA',
        100.00, 'PEN', 30, '["Pago del Derecho en Tesorería"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p4-fila-13' LIMIT 1),
        true, 41
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p4-fila-14', 'p4-fila-14', 'Protector de Certificado Modular', 'OTRO_NO_RADICABLE', 'DOCUMENTARIO',
        50.00, 'PEN', 30, '["Pago del Derecho en Tesorería"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p4-fila-14' LIMIT 1),
        true, 42
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p4-fila-15', 'p4-fila-15', 'Modificación de Datos del Título', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        269.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Comprobante de Pago 4.88 % UIT Vigente"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p4-fila-15' LIMIT 1),
        true, 43
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p4-fila-16', 'p4-fila-16', 'Derecho de duplicado de Título.', 'PROCEDIMIENTO_PENDIENTE', 'DOCUMENTARIO',
        309.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Comprobante de Pago 5.61 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p4-fila-16' LIMIT 1),
        true, 44
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-01', 'p5-fila-01', 'Matrículas', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        200.00, 'PEN', 30, '["Ficha de matrícula","Pago de adeudos en Tesorería","Pago de derecho de matrícula en tesorería"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-01' LIMIT 1),
        true, 45
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-02', 'p5-fila-02', 'ADMISIÓN 2026', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        250.00, 'PEN', 30, '["Pago en el Área de Tesorería"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-02' LIMIT 1),
        true, 46
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-03', 'p5-fila-03', 'Guías del postulante', 'OTRO_NO_RADICABLE', 'DOCUMENTARIO',
        50.00, 'PEN', 30, '["Pago en el Área de Tesorería"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-03' LIMIT 1),
        true, 47
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-04', 'p5-fila-04', 'Ingreso ADMISIÓN 2026 - Titulados', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        500.00, 'PEN', 30, '["Pago en el Área de Tesorería"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-04' LIMIT 1),
        true, 48
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-05', 'p5-fila-05', 'Derecho de Reincorporación (Reingreso)', 'PROCEDIMIENTO_PENDIENTE', 'DOCUMENTARIO',
        300.00, 'PEN', 30, '["Pago en el Área de Tesorería"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-05' LIMIT 1),
        true, 49
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-06', 'p5-fila-06', 'Constancia de Egresado', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        31.00, 'PEN', 7, '["Pago del Derecho en Tesorería"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-06' LIMIT 1),
        true, 50
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-07', 'p5-fila-07', 'Certificado de Bachillerato', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        42.00, 'PEN', 15, '["Pago del Derecho en Tesorería","Comprobante de Pago 0.75 % UIT Vigente"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-07' LIMIT 1),
        true, 51
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-08', 'p5-fila-08', 'Constancias (Otros: de Título, estudios, de Matrícula)', 'PROCEDIMIENTO_PENDIENTE', 'DOCUMENTARIO',
        23.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Comprobante de Pago 0.41 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-08' LIMIT 1),
        true, 52
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-09', 'p5-fila-09', 'Convalidación entre Planes de Estudios', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        46.50, 'PEN', 20, '["Pago del Derecho en Tesorería, 0.84% UIT Vigente"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-09' LIMIT 1),
        true, 53
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-10', 'p5-fila-10', 'Convalidación por Unidades de Competencia', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        46.50, 'PEN', 20, '["Pago del Derecho en Tesorería","Comprobante de Pago 0.84 % UIT Vigente"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-10' LIMIT 1),
        true, 54
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-11', 'p5-fila-11', 'Devolución de Expediente', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        21.00, 'PEN', 7, '["Pago del Derecho en Tesorería","Comprobante de Pago 0.37 % UIT Vigente"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-11' LIMIT 1),
        true, 55
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-12', 'p5-fila-12', 'Evaluación Extraordinaria (A)', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        93.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Comprobante de Pago 1.68 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-12' LIMIT 1),
        true, 56
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-13', 'p5-fila-13', 'Evaluación Extraordinaria (RM 069)', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        70.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Comprobante de Pago 1.27 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-13' LIMIT 1),
        true, 57
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-14', 'p5-fila-14', 'Examen de Recuperación', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        70.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Comprobante de Pago 1.27 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-14' LIMIT 1),
        true, 58
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-15', 'p5-fila-15', 'Examen de Cargo', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        70.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Comprobante de Pago 1.27 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-15' LIMIT 1),
        true, 59
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-16', 'p5-fila-16', 'Repitencia de Unidad Didáctica', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        86.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Comprobante de Pago 1.56 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-16' LIMIT 1),
        true, 60
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-17', 'p5-fila-17', 'Repitencia de Semestre', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        80.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Comprobante de Pago 1.45 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-17' LIMIT 1),
        true, 61
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-18', 'p5-fila-18', 'Reserva de Matrícula - Ingresantes', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        66.00, 'PEN', 7, '["Pago del Derecho en Tesorería","Resolución Directoral-Secretaría Académica","Comprobante de Pago 1.20 % UIT Vigente"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-18' LIMIT 1),
        true, 62
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-19', 'p5-fila-19', 'Licencia de Estudios - Estudiantes Antiguos', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        66.00, 'PEN', 7, '["Pago del Derecho en Tesorería","Resolución Directoral-Secretaría - Académica","Comprobante de Pago 1.20 % UIT Vigente"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-19' LIMIT 1),
        true, 63
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-20', 'p5-fila-20', 'Traslado Interno', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        309.00, 'PEN', 15, '["Vacante en la Carrera","Resolución Directoral-Secretaría Académica","Pago del Derecho en Tesorería","Comprobante de Pago 5.61 % UIT Vigente"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-20' LIMIT 1),
        true, 64
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p5-fila-21', 'p5-fila-21', 'Traslado Externo', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        412.00, 'PEN', 20, '["Solicitud en FUT dirigida al Director.","Vacante en la Carrera","Resolución Directoral-Secretaría - Académica","Pago del Derecho en Tesorería","Comprobante de Pago 7.48 % UIT Vigente"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p5-fila-21' LIMIT 1),
        true, 65
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p6-fila-01', 'p6-fila-01', 'Demora Devolución Libro Biblioteca', 'OTRO_NO_RADICABLE', 'DOCUMENTARIO',
        10.00, 'PEN', 30, '["Informe a la Unidad Administrativa de deudores de Libros","Unidad Administrativa deriva a Tesorería","Pago del Derecho en Tesorería","Comprobante de Pago 0.19 % UIT Vigente (Costo por día)"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p6-fila-01' LIMIT 1),
        true, 66
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p6-fila-02', 'p6-fila-02', 'Acceso a la Información Pública. S/. 10.00 por C/Hoja', 'PROCEDIMIENTO_PENDIENTE', 'DOCUMENTARIO',
        10.50, 'PEN', 10, '["Solicitud dirigida a Dirección en FUT","Pago del Derecho en Tesorería 0.19 % de la UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p6-fila-02' LIMIT 1),
        true, 67
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p6-fila-03', 'p6-fila-03', 'Búsqueda y Duplicados de Boletas (C/U) Síllabus (C/U) Otros Trámites', 'PROCEDIMIENTO_PENDIENTE', 'DOCUMENTARIO',
        10.50, 'PEN', 30, '["Pago del Derecho en Tesorería","Otros Trámites Administrativos","Comprobante de Pago 0.19% UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p6-fila-03' LIMIT 1),
        true, 68
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p6-fila-04', 'p6-fila-04', 'Titulación de Otros Institutos Tecnológicos', 'PROCEDIMIENTO_APROBADO', 'DOCUMENTARIO',
        515.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Comprobante de Pago 9.35 % UIT Vigente","Resolución Directoral-Secretaría Académica"]'::jsonb, true, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p6-fila-04' LIMIT 1),
        true, 69
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p6-fila-05', 'p6-fila-05', 'Examen de Subsanación con Jurado', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        33.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Comprobante de Pago 0.60 % UIT Vigente","Resolución Directoral-Secretaría Académica"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p6-fila-05' LIMIT 1),
        true, 70
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p6-fila-06', 'p6-fila-06', 'Prueba de Suficiencia Académica', 'SERVICIO_ACADEMICO', 'ACADEMICO',
        105.00, 'PEN', 30, '["Pago del Derecho en Tesorería","Comprobante de Pago 1.90 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p6-fila-06' LIMIT 1),
        true, 71
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

    INSERT INTO sigd_doc.tupa_procedimiento (
        id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
        monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
        registro_version_id, activo, orden
    )
    SELECT
        v_id_version, 'p6-fila-07', 'p6-fila-07', 'Carnets, Insignia y Distintivos', 'OTRO_NO_RADICABLE', 'DOCUMENTARIO',
        50.00, 'PEN', 30, '["Pago en el Área de Tesorería","Emisión de la B/V","0.93 % UIT Vigente"]'::jsonb, false, 'EVALUACION_PREVIA_POSITIVA',
        (SELECT registro_version_id FROM sigd_doc.tupa_registro_version WHERE referencia_fila = 'p6-fila-07' LIMIT 1),
        true, 72
    ON CONFLICT (id_version, codigo_ref) DO UPDATE
      SET denominacion = EXCLUDED.denominacion,
          monto = EXCLUDED.monto,
          plazo_dias = EXCLUDED.plazo_dias,
          requisitos = EXCLUDED.requisitos,
          genera_expediente = EXCLUDED.genera_expediente,
          categoria = EXCLUDED.categoria,
          tipo_formulario = EXCLUDED.tipo_formulario,
          registro_version_id = EXCLUDED.registro_version_id,
          activo = true,
          orden = EXCLUDED.orden;

END $$;
