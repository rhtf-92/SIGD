-- Migración 34 (Aditiva y Reversible): Procedimiento TUPA SUZ26-006 — Certificado de Inglés (Opción A)
-- Alcance exclusivo: configuración documental operativa de SUZ26-006, antecedentes académicos de inglés
-- cursados en el IESTP "Suiza", verificación académica formal y entidad Certificado de Inglés.
-- Reglas DDL B_JACOBO: sin BEGIN/COMMIT de nivel superior ni INSERT en public.sigd_migraciones.

-- ============================================================================
-- 1. Tipo documental institucional para emisión del Certificado de Inglés
-- ============================================================================
INSERT INTO sigd_doc.tipo_documento (
    codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente
)
VALUES (
    'CERTIFICADO_INGLES',
    'Certificado Oficial de Idioma Inglés — IESTP Suiza',
    'pdf',
    'application/pdf',
    20,
    TRUE,
    TRUE
)
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================================
-- 2. Requisitos documentales oficiales de SUZ26-006 y mapeo documental
-- Nota: trg_tupa_requisito_inmutable permite INSERT (solo protege UPDATE/DELETE).
-- COMPROBANTE_PAGO se evalúa vía Tesorería (S/ 100.00) sin carga manual ciudadana.
-- ============================================================================
WITH proc AS (
    SELECT tipo_tramite_id, version_id
      FROM sigd_doc.tipo_tramite_tupa
     WHERE codigo = 'SUZ26-006' AND vigente = TRUE
     LIMIT 1
)
INSERT INTO sigd_doc.requisito (tipo_tramite_id, codigo, denominacion, obligatorio, orden, version_id)
SELECT proc.tipo_tramite_id, v.codigo, v.denominacion, v.obligatorio, v.orden, proc.version_id
  FROM proc
  CROSS JOIN (
    VALUES
      (
        'FUT',
        'Solicitud Formal Única de Trámite (FUT) por estudios de inglés culminados y aprobados en el IESTP Suiza',
        TRUE,
        1
      ),
      (
        'COMPROBANTE_PAGO',
        'Pago del derecho de tramitación en Tesorería (S/ 100.00 — Emisión de Boleta de Venta)',
        TRUE,
        2
      )
  ) AS v(codigo, denominacion, obligatorio, orden)
ON CONFLICT (tipo_tramite_id, codigo) DO NOTHING;

WITH proc AS (
    SELECT tipo_tramite_id
      FROM sigd_doc.tipo_tramite_tupa
     WHERE codigo = 'SUZ26-006' AND vigente = TRUE
     LIMIT 1
)
INSERT INTO sigd_doc.tipo_documento_requisito (requisito_id, tipo_documental_id)
SELECT r.requisito_id, td.tipo_documental_id
  FROM proc
  JOIN sigd_doc.requisito r ON r.tipo_tramite_id = proc.tipo_tramite_id
  JOIN sigd_doc.tipo_documento td ON td.codigo = r.codigo
 WHERE r.codigo IN ('FUT', 'COMPROBANTE_PAGO')
ON CONFLICT (requisito_id, tipo_documental_id) DO NOTHING;

-- ============================================================================
-- 3. Configuración de cierre y flujo institucional de SUZ26-006 en Dirección General
-- ============================================================================
WITH proc AS (
    SELECT tipo_tramite_id
      FROM sigd_doc.tipo_tramite_tupa
     WHERE codigo = 'SUZ26-006' AND vigente = TRUE
     LIMIT 1
),
area_dg AS (
    SELECT area_id
      FROM sigd_org.area
     WHERE codigo = 'DG' AND vigente = TRUE
     LIMIT 1
)
INSERT INTO sigd_doc.procedimiento_cierre_regla (
    tipo_tramite_id,
    area_responsable_id,
    etapa_habilitante,
    rol_cierre_codigo,
    permiso_requerido_codigo,
    requiere_atencion_tecnica,
    requiere_resolucion_aprobada,
    requiere_firma_director,
    requiere_notificacion_previa,
    requiere_pago_verificado,
    requiere_documento_final,
    permite_reapertura,
    vigente
)
SELECT
    proc.tipo_tramite_id,
    area_dg.area_id,
    'RESUELTO',
    'DIRECTOR',
    'EXPEDIENTE_CERRAR',
    TRUE,
    FALSE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE
  FROM proc, area_dg
 WHERE NOT EXISTS (
    SELECT 1
      FROM sigd_doc.procedimiento_cierre_regla c
     WHERE c.tipo_tramite_id = proc.tipo_tramite_id
       AND c.area_responsable_id = area_dg.area_id
       AND c.vigente = TRUE
 );

-- ============================================================================
-- 4. Repositorio institucional de antecedentes de estudios de inglés en IESTP Suiza (Opción A)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sigd_doc.registro_estudios_ingles (
    registro_estudio_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_documento_identidad varchar(20) NOT NULL DEFAULT 'DNI',
    numero_documento_identidad varchar(20) NOT NULL,
    persona_id uuid REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT,
    apellidos_nombres varchar(250) NOT NULL,
    codigo_matricula varchar(40),
    programa_estudios varchar(180) NOT NULL,
    modalidad_estudio varchar(80) NOT NULL DEFAULT 'ESTUDIOS_INGLES_IESTP_SUIZA',
    nivel_alcanzado varchar(120) NOT NULL,
    ciclos_modulos_aprobados jsonb NOT NULL DEFAULT '[]'::jsonb,
    horas_academicas_totales integer NOT NULL CHECK (horas_academicas_totales > 0),
    creditos_totales numeric(5,2),
    promedio_final numeric(4,2) NOT NULL CHECK (promedio_final >= 0 AND promedio_final <= 20),
    nota_minima_aprobatoria numeric(4,2) NOT NULL DEFAULT 13.00,
    fecha_inicio date NOT NULL,
    fecha_termino date,
    culminado boolean NOT NULL DEFAULT FALSE,
    aprobado boolean NOT NULL DEFAULT FALSE,
    numero_acta_final varchar(80),
    estado_academico varchar(30) NOT NULL CHECK (
        estado_academico IN ('CULMINADO_APROBADO', 'INCOMPLETO', 'DESAPROBADO', 'ANULADO')
    ),
    observaciones text,
    creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_registro_estudios_ingles_dni_acta UNIQUE (numero_documento_identidad, numero_acta_final),
    CONSTRAINT chk_registro_estudios_ingles_coherencia CHECK (
        (estado_academico = 'CULMINADO_APROBADO' AND culminado = TRUE AND aprobado = TRUE AND promedio_final >= nota_minima_aprobatoria AND fecha_termino IS NOT NULL)
        OR (estado_academico <> 'CULMINADO_APROBADO')
    )
);

CREATE INDEX IF NOT EXISTS idx_registro_estudios_ingles_dni
    ON sigd_doc.registro_estudios_ingles (numero_documento_identidad);
CREATE INDEX IF NOT EXISTS idx_registro_estudios_ingles_persona
    ON sigd_doc.registro_estudios_ingles (persona_id);

-- Datos institucionales de respaldo verificables para Opción A (solo cuentas y casos de prueba)
INSERT INTO sigd_doc.registro_estudios_ingles (
    registro_estudio_id,
    tipo_documento_identidad,
    numero_documento_identidad,
    persona_id,
    apellidos_nombres,
    codigo_matricula,
    programa_estudios,
    modalidad_estudio,
    nivel_alcanzado,
    ciclos_modulos_aprobados,
    horas_academicas_totales,
    creditos_totales,
    promedio_final,
    nota_minima_aprobatoria,
    fecha_inicio,
    fecha_termino,
    culminado,
    aprobado,
    numero_acta_final,
    estado_academico,
    observaciones
)
VALUES
(
    'a3400001-0000-4000-8000-000000000050',
    'DNI',
    '00000050',
    '00000000-0000-0000-0000-000000000050',
    'Sr. Ciudadano Administrado Demo',
    'EST-IDI-2024-0050',
    'Centro de Idiomas / Plan de Estudios Institucional IESTP Suiza',
    'ESTUDIOS_INGLES_IESTP_SUIZA',
    'Inglés Básico I-III e Intermedio I-III',
    '[
      {"modulo":"Inglés Básico I","periodo":"2024-I","horas":60,"nota":17,"estado":"APROBADO"},
      {"modulo":"Inglés Básico II","periodo":"2024-I","horas":60,"nota":18,"estado":"APROBADO"},
      {"modulo":"Inglés Básico III","periodo":"2024-II","horas":60,"nota":17,"estado":"APROBADO"},
      {"modulo":"Inglés Intermedio I","periodo":"2024-II","horas":60,"nota":17,"estado":"APROBADO"},
      {"modulo":"Inglés Intermedio II","periodo":"2025-I","horas":60,"nota":18,"estado":"APROBADO"},
      {"modulo":"Inglés Intermedio III","periodo":"2025-I","horas":60,"nota":18,"estado":"APROBADO"}
    ]'::jsonb,
    360,
    18.00,
    17.50,
    13.00,
    DATE '2024-03-18',
    DATE '2025-07-25',
    TRUE,
    TRUE,
    'ACT-IDI-IESTPS-2025-0142',
    'CULMINADO_APROBADO',
    'Estudios de idioma inglés culminados y aprobados en el IESTP Suiza. Apto para certificación (Opción A).'
),
(
    'a3400002-0000-4000-8000-000000000051',
    'DNI',
    '99000051',
    NULL,
    'Caso Control Estudios Incompletos Demo',
    'EST-IDI-2025-0051',
    'Centro de Idiomas IESTP Suiza',
    'ESTUDIOS_INGLES_IESTP_SUIZA',
    'Inglés Básico II (En curso / Incompleto)',
    '[
      {"modulo":"Inglés Básico I","periodo":"2025-I","horas":60,"nota":15,"estado":"APROBADO"},
      {"modulo":"Inglés Básico II","periodo":"2025-II","horas":60,"nota":0,"estado":"EN_CURSO"}
    ]'::jsonb,
    120,
    6.00,
    15.00,
    13.00,
    DATE '2025-04-01',
    NULL,
    FALSE,
    FALSE,
    'ACT-IDI-IESTPS-2025-0188',
    'INCOMPLETO',
    'Registro de control negativo: estudios inconclusos, no cumple culminación requerida por Opción A.'
),
(
    'a3400003-0000-4000-8000-000000000052',
    'DNI',
    '99000052',
    NULL,
    'Caso Control Estudios Desaprobados Demo',
    'EST-IDI-2024-0052',
    'Centro de Idiomas IESTP Suiza',
    'ESTUDIOS_INGLES_IESTP_SUIZA',
    'Inglés Básico I-III (Desaprobado)',
    '[
      {"modulo":"Inglés Básico I","periodo":"2024-I","horas":60,"nota":14,"estado":"APROBADO"},
      {"modulo":"Inglés Básico II","periodo":"2024-II","horas":60,"nota":10,"estado":"DESAPROBADO"},
      {"modulo":"Inglés Básico III","periodo":"2024-II","horas":60,"nota":11,"estado":"DESAPROBADO"}
    ]'::jsonb,
    180,
    9.00,
    11.67,
    13.00,
    DATE '2024-03-18',
    DATE '2024-12-15',
    TRUE,
    FALSE,
    'ACT-IDI-IESTPS-2024-0199',
    'DESAPROBADO',
    'Registro de control negativo: promedio e historial desaprobado, no apto para emisión de certificado.'
)
ON CONFLICT (numero_documento_identidad, numero_acta_final) DO NOTHING;

-- ============================================================================
-- 5. Verificación formal de antecedentes académicos ejecutada por Secretaría Académica
-- ============================================================================
CREATE TABLE IF NOT EXISTS sigd_doc.verificacion_academica_ingles (
    verificacion_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id uuid NOT NULL REFERENCES sigd_doc.expediente(expediente_id) ON DELETE CASCADE,
    registro_estudio_id uuid REFERENCES sigd_doc.registro_estudios_ingles(registro_estudio_id) ON DELETE RESTRICT,
    dni_verificado varchar(20) NOT NULL,
    culminado_verificado boolean NOT NULL,
    aprobado_verificado boolean NOT NULL,
    pago_tesoreria_verificado boolean NOT NULL,
    numero_recibo_tesoreria varchar(60),
    numero_acta_referencia varchar(80),
    nivel_acreditado varchar(120),
    horas_academicas integer,
    promedio_final numeric(4,2),
    detalle_modulos_verificados jsonb NOT NULL DEFAULT '[]'::jsonb,
    resultado varchar(20) NOT NULL CHECK (resultado IN ('FAVORABLE', 'OBSERVADO', 'IMPROCEDENTE')),
    observaciones_academicas text NOT NULL,
    verificado_por uuid NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    verificado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
    vigente boolean NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_verif_ingles_favorable CHECK (
        resultado <> 'FAVORABLE'
        OR (culminado_verificado = TRUE AND aprobado_verificado = TRUE AND pago_tesoreria_verificado = TRUE AND registro_estudio_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_verificacion_academica_ingles_vigente
    ON sigd_doc.verificacion_academica_ingles (expediente_id)
    WHERE vigente = TRUE;

CREATE INDEX IF NOT EXISTS idx_verificacion_academica_ingles_expediente
    ON sigd_doc.verificacion_academica_ingles (expediente_id, verificado_en DESC);

-- ============================================================================
-- 6. Entidad oficial Certificado de Inglés (Borrador -> Firma Digital DG -> Emitido)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sigd_doc.certificado_ingles (
    certificado_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id uuid NOT NULL REFERENCES sigd_doc.expediente(expediente_id) ON DELETE RESTRICT,
    verificacion_id uuid NOT NULL REFERENCES sigd_doc.verificacion_academica_ingles(verificacion_id) ON DELETE RESTRICT,
    numero_borrador varchar(60) NOT NULL UNIQUE,
    numero_certificado varchar(60) UNIQUE,
    titular_persona_id uuid NOT NULL REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT,
    titular_nombre varchar(250) NOT NULL,
    titular_documento varchar(30) NOT NULL,
    programa_o_centro varchar(200) NOT NULL,
    nivel_estudios varchar(120) NOT NULL,
    modulos_acreditados jsonb NOT NULL DEFAULT '[]'::jsonb,
    horas_academicas integer NOT NULL CHECK (horas_academicas > 0),
    promedio_final numeric(4,2) NOT NULL CHECK (promedio_final >= 0 AND promedio_final <= 20),
    periodo_estudios varchar(120) NOT NULL,
    numero_acta varchar(80) NOT NULL,
    asunto varchar(500) NOT NULL,
    estado varchar(35) NOT NULL CHECK (
        estado IN ('BORRADOR_PENDIENTE_FIRMA', 'EN_FIRMA', 'EMITIDO_FIRMADO', 'NOTIFICADO', 'ANULADO')
    ),
    documento_adjunto_id uuid REFERENCES sigd_doc.documento_adjunto(documento_adjunto_id) ON DELETE RESTRICT,
    proyectado_por uuid NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    fecha_proyeccion date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Lima')::date,
    firmado_por uuid REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    firmado_en timestamptz,
    hash_pades varchar(64),
    creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_certificado_ingles_firma CHECK (
        estado NOT IN ('EMITIDO_FIRMADO', 'NOTIFICADO')
        OR (numero_certificado IS NOT NULL AND firmado_en IS NOT NULL AND hash_pades IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_certificado_ingles_activo
    ON sigd_doc.certificado_ingles (expediente_id)
    WHERE estado <> 'ANULADO';

CREATE INDEX IF NOT EXISTS idx_certificado_ingles_expediente
    ON sigd_doc.certificado_ingles (expediente_id, creado_en DESC);

-- Reversibilidad documentada:
-- DROP INDEX IF EXISTS sigd_doc.idx_certificado_ingles_expediente, sigd_doc.uq_certificado_ingles_activo;
-- DROP TABLE IF EXISTS sigd_doc.certificado_ingles, sigd_doc.verificacion_academica_ingles, sigd_doc.registro_estudios_ingles;
-- DELETE FROM sigd_doc.procedimiento_cierre_regla WHERE tipo_tramite_id = (SELECT tipo_tramite_id FROM sigd_doc.tipo_tramite_tupa WHERE codigo='SUZ26-006' LIMIT 1);
-- DELETE FROM sigd_doc.tipo_documento WHERE codigo='CERTIFICADO_INGLES';
