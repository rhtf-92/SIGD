-- Migración 35 (Aditiva y Reversible): Procedimiento TUPA SUZ26-034 — Certificado de Estudios Superiores (6 semestres)
-- Alcance: configuración documental operativa de SUZ26-034, antecedentes académicos de estudios superiores
-- (6 semestres) cursados en el IESTP "Suiza", verificación académica formal por Secretaría Académica
-- y entidad oficial Certificado de Estudios Superiores con firma digital y CVD.
-- Reglas DDL B_JACOBO: sin BEGIN/COMMIT de nivel superior ni INSERT en public.sigd_migraciones.

-- ============================================================================
-- 1. Tipo documental institucional para emisión del Certificado de Estudios Superiores
-- ============================================================================
INSERT INTO sigd_doc.tipo_documento (
    codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente
)
VALUES (
    'CERTIFICADO_ESTUDIOS',
    'Certificado Oficial de Estudios Superiores (6 semestres) — IESTP Suiza',
    'pdf',
    'application/pdf',
    20,
    TRUE,
    TRUE
)
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================================
-- 2. Configuración institucional del procedimiento SUZ26-034 en catálogo
-- ============================================================================
UPDATE sigd_doc.tipo_tramite_tupa
   SET denominacion = 'Certificado de Estudios Superiores (6 semestres)',
       tupa_fuente = jsonb_set(
         jsonb_set(
           COALESCE(tupa_fuente, '{}'::jsonb),
           '{referenciasInternas}',
           '["SUZ26-034", "SUZ26-035"]'::jsonb
         ),
         '{codigoVisible}',
         '"SUZ26-034"'::jsonb
       )
 WHERE tipo_tramite_id = '3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd';

-- Requisitos oficiales: FUT obligatorio (orden 1) y comprobante de pago de Tesorería (S/ 124.00, orden 2)
INSERT INTO sigd_doc.requisito (tipo_tramite_id, codigo, denominacion, obligatorio, orden, version_id)
SELECT '3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd'::uuid,
       v.codigo,
       v.denominacion,
       v.obligatorio,
       v.orden,
       t.version_id
  FROM sigd_doc.tipo_tramite_tupa t
  CROSS JOIN (
    VALUES
      (
        'FUT',
        'Solicitud Formal Única de Trámite (FUT) por estudios superiores culminados (6 semestres) en el IESTP Suiza',
        TRUE,
        1
      ),
      (
        'COMPROBANTE_PAGO',
        'Pago del derecho de tramitación en Tesorería (S/ 124.00 — Emisión de Boleta de Venta / Recibo de Caja)',
        TRUE,
        2
      )
  ) AS v(codigo, denominacion, obligatorio, orden)
 WHERE t.tipo_tramite_id = '3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd'
ON CONFLICT (tipo_tramite_id, codigo) DO NOTHING;

-- Vinculación con tipos documentales
INSERT INTO sigd_doc.tipo_documento_requisito (requisito_id, tipo_documental_id)
SELECT r.requisito_id, td.tipo_documental_id
  FROM sigd_doc.requisito r
  JOIN sigd_doc.tipo_documento td ON td.codigo = r.codigo
 WHERE r.tipo_tramite_id = '3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd'
   AND r.codigo IN ('FUT', 'COMPROBANTE_PAGO')
ON CONFLICT (requisito_id, tipo_documental_id) DO NOTHING;

-- ============================================================================
-- 3. Configuración de regla de cierre institucional en Dirección General
-- ============================================================================
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
    '3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd'::uuid,
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
  FROM sigd_org.area area_dg
 WHERE area_dg.codigo = 'DG' AND area_dg.vigente = TRUE
   AND NOT EXISTS (
     SELECT 1
       FROM sigd_doc.procedimiento_cierre_regla c
      WHERE c.tipo_tramite_id = '3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd'::uuid
        AND c.area_responsable_id = area_dg.area_id
        AND c.vigente = TRUE
   );

-- ============================================================================
-- 4. Repositorio institucional de antecedentes de estudios superiores (6 semestres)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sigd_doc.registro_estudios_superiores (
    registro_estudio_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_documento_identidad varchar(20) NOT NULL DEFAULT 'DNI',
    numero_documento_identidad varchar(20) NOT NULL,
    persona_id uuid REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT,
    apellidos_nombres varchar(250) NOT NULL,
    codigo_matricula varchar(40),
    programa_estudios varchar(180) NOT NULL,
    plan_estudios varchar(80) NOT NULL DEFAULT 'Plan Modular Institucional IESTP Suiza',
    periodo_ingreso varchar(20) NOT NULL,
    periodo_egreso varchar(20),
    total_semestres integer NOT NULL DEFAULT 6 CHECK (total_semestres > 0),
    semestres_aprobados jsonb NOT NULL DEFAULT '[]'::jsonb,
    horas_academicas_totales integer NOT NULL CHECK (horas_academicas_totales > 0),
    creditos_totales numeric(5,2) NOT NULL CHECK (creditos_totales > 0),
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
    CONSTRAINT uq_registro_estudios_superiores_dni_acta UNIQUE (numero_documento_identidad, numero_acta_final),
    CONSTRAINT chk_registro_estudios_superiores_coherencia CHECK (
        (estado_academico = 'CULMINADO_APROBADO' AND culminado = TRUE AND aprobado = TRUE AND total_semestres = 6 AND promedio_final >= nota_minima_aprobatoria AND fecha_termino IS NOT NULL)
        OR (estado_academico <> 'CULMINADO_APROBADO')
    )
);

CREATE INDEX IF NOT EXISTS idx_registro_estudios_superiores_dni
    ON sigd_doc.registro_estudios_superiores (numero_documento_identidad);
CREATE INDEX IF NOT EXISTS idx_registro_estudios_superiores_persona
    ON sigd_doc.registro_estudios_superiores (persona_id);

-- Semilla de antecedentes verificables para pruebas institucionales (IESTP Suiza)
INSERT INTO sigd_doc.registro_estudios_superiores (
    registro_estudio_id,
    tipo_documento_identidad,
    numero_documento_identidad,
    persona_id,
    apellidos_nombres,
    codigo_matricula,
    programa_estudios,
    plan_estudios,
    periodo_ingreso,
    periodo_egreso,
    total_semestres,
    semestres_aprobados,
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
    'a3500001-0000-4000-8000-000000000050',
    'DNI',
    '00000050',
    '00000000-0000-0000-0000-000000000050',
    'Sr. Ciudadano Administrado Demo',
    'MAT-2021-DSI-0050',
    'Desarrollo de Sistemas de Información',
    'Plan Modular 2021-2023',
    '2021-I',
    '2023-II',
    6,
    '[
      {
        "semestre": "I",
        "periodo": "2021-I",
        "creditos": 22,
        "horas": 480,
        "promedioSemestre": 16.50,
        "asignaturas": [
          {"codigo": "DSI-101", "nombre": "Fundamentos de Programación", "creditos": 4, "horas": 90, "nota": 17, "estado": "APROBADO"},
          {"codigo": "DSI-102", "nombre": "Sistemas Operativos y Redes", "creditos": 4, "horas": 90, "nota": 16, "estado": "APROBADO"},
          {"codigo": "DSI-103", "nombre": "Arquitectura de Computadoras", "creditos": 4, "horas": 80, "nota": 16, "estado": "APROBADO"},
          {"codigo": "DSI-104", "nombre": "Lógica y Funciones Matemáticas", "creditos": 3, "horas": 60, "nota": 17, "estado": "APROBADO"},
          {"codigo": "DSI-105", "nombre": "Comunicación Efectiva", "creditos": 3, "horas": 60, "nota": 16, "estado": "APROBADO"},
          {"codigo": "DSI-106", "nombre": "Ofimática Profesional", "creditos": 4, "horas": 100, "nota": 17, "estado": "APROBADO"}
        ]
      },
      {
        "semestre": "II",
        "periodo": "2021-II",
        "creditos": 22,
        "horas": 480,
        "promedioSemestre": 17.00,
        "asignaturas": [
          {"codigo": "DSI-201", "nombre": "Estructuras de Datos y Algoritmos", "creditos": 4, "horas": 90, "nota": 18, "estado": "APROBADO"},
          {"codigo": "DSI-202", "nombre": "Modelamiento de Base de Datos", "creditos": 4, "horas": 90, "nota": 17, "estado": "APROBADO"},
          {"codigo": "DSI-203", "nombre": "Análisis y Diseño de Sistemas", "creditos": 4, "horas": 80, "nota": 17, "estado": "APROBADO"},
          {"codigo": "DSI-204", "nombre": "Estadística Aplicada", "creditos": 3, "horas": 60, "nota": 16, "estado": "APROBADO"},
          {"codigo": "DSI-205", "nombre": "Inglés Técnico para TI", "creditos": 3, "horas": 60, "nota": 17, "estado": "APROBADO"},
          {"codigo": "DSI-206", "nombre": "Metodologías de Desarrollo de Software", "creditos": 4, "horas": 100, "nota": 17, "estado": "APROBADO"}
        ]
      },
      {
        "semestre": "III",
        "periodo": "2022-I",
        "creditos": 22,
        "horas": 480,
        "promedioSemestre": 16.80,
        "asignaturas": [
          {"codigo": "DSI-301", "nombre": "Programación Orientada a Objetos", "creditos": 4, "horas": 90, "nota": 17, "estado": "APROBADO"},
          {"codigo": "DSI-302", "nombre": "Gestión y Administración de BD (SQL Server / PostgreSQL)", "creditos": 4, "horas": 90, "nota": 17, "estado": "APROBADO"},
          {"codigo": "DSI-303", "nombre": "Desarrollo Web Frontend (HTML5, CSS3, JS)", "creditos": 4, "horas": 80, "nota": 18, "estado": "APROBADO"},
          {"codigo": "DSI-304", "nombre": "Legislación e Inserción Laboral", "creditos": 3, "horas": 60, "nota": 15, "estado": "APROBADO"},
          {"codigo": "DSI-305", "nombre": "Medio Ambiente y Desarrollo Sostenible", "creditos": 3, "horas": 60, "nota": 16, "estado": "APROBADO"},
          {"codigo": "DSI-306", "nombre": "Taller de Práctica Preprofesional Modular I", "creditos": 4, "horas": 100, "nota": 18, "estado": "APROBADO"}
        ]
      },
      {
        "semestre": "IV",
        "periodo": "2022-II",
        "creditos": 22,
        "horas": 480,
        "promedioSemestre": 17.20,
        "asignaturas": [
          {"codigo": "DSI-401", "nombre": "Desarrollo de Aplicaciones Web Backend (Node.js / Java)", "creditos": 4, "horas": 90, "nota": 18, "estado": "APROBADO"},
          {"codigo": "DSI-402", "nombre": "Diseño de Interfaces de Usuario (UI/UX)", "creditos": 4, "horas": 90, "nota": 17, "estado": "APROBADO"},
          {"codigo": "DSI-403", "nombre": "Seguridad Informática y Ciberseguridad", "creditos": 4, "horas": 80, "nota": 17, "estado": "APROBADO"},
          {"codigo": "DSI-404", "nombre": "Investigación Tecnológica e Innovación", "creditos": 3, "horas": 60, "nota": 17, "estado": "APROBADO"},
          {"codigo": "DSI-405", "nombre": "Liderazgo y Trabajo en Equipo", "creditos": 3, "horas": 60, "nota": 16, "estado": "APROBADO"},
          {"codigo": "DSI-406", "nombre": "Taller de Práctica Preprofesional Modular II", "creditos": 4, "horas": 100, "nota": 18, "estado": "APROBADO"}
        ]
      },
      {
        "semestre": "V",
        "periodo": "2023-I",
        "creditos": 21,
        "horas": 480,
        "promedioSemestre": 16.60,
        "asignaturas": [
          {"codigo": "DSI-501", "nombre": "Desarrollo de Aplicaciones Móviles", "creditos": 4, "horas": 90, "nota": 17, "estado": "APROBADO"},
          {"codigo": "DSI-502", "nombre": "Servicios Web y Arquitectura de Microservicios", "creditos": 4, "horas": 90, "nota": 17, "estado": "APROBADO"},
          {"codigo": "DSI-503", "nombre": "Pruebas de Calidad de Software (QA)", "creditos": 4, "horas": 80, "nota": 16, "estado": "APROBADO"},
          {"codigo": "DSI-504", "nombre": "Gestión de Proyectos de TI (Scrum / PMBOK)", "creditos": 3, "horas": 60, "nota": 16, "estado": "APROBADO"},
          {"codigo": "DSI-505", "nombre": "Ética Profesional y Deontología", "creditos": 2, "horas": 40, "nota": 16, "estado": "APROBADO"},
          {"codigo": "DSI-506", "nombre": "Emprendimiento y Creación de Empresas", "creditos": 4, "horas": 120, "nota": 17, "estado": "APROBADO"}
        ]
      },
      {
        "semestre": "VI",
        "periodo": "2023-II",
        "creditos": 21,
        "horas": 480,
        "promedioSemestre": 17.00,
        "asignaturas": [
          {"codigo": "DSI-601", "nombre": "Inteligencia de Negocios y Analítica de Datos", "creditos": 4, "horas": 90, "nota": 17, "estado": "APROBADO"},
          {"codigo": "DSI-602", "nombre": "Cloud Computing y DevOps", "creditos": 4, "horas": 90, "nota": 17, "estado": "APROBADO"},
          {"codigo": "DSI-603", "nombre": "Auditoría de Sistemas de Información", "creditos": 4, "horas": 80, "nota": 16, "estado": "APROBADO"},
          {"codigo": "DSI-604", "nombre": "Proyecto Integrador de Titulación", "creditos": 5, "horas": 120, "nota": 18, "estado": "APROBADO"},
          {"codigo": "DSI-605", "nombre": "Taller de Práctica Preprofesional Modular III", "creditos": 4, "horas": 100, "nota": 18, "estado": "APROBADO"}
        ]
      }
    ]'::jsonb,
    2880,
    130.00,
    16.85,
    13.00,
    DATE '2021-03-22',
    DATE '2023-12-22',
    TRUE,
    TRUE,
    'ACT-DSI-IESTPS-2023-0088',
    'CULMINADO_APROBADO',
    'Estudiante egresado con plan de 6 semestres académicos culminado y aprobado satisfactoriamente en el IESTP Suiza. Apto para certificación oficial (SUZ26-034).'
),
(
    'a3500002-0000-4000-8000-000000000051',
    'DNI',
    '99000051',
    NULL,
    'Caso Control Estudios Incompletos Demo',
    'MAT-2022-DSI-0051',
    'Desarrollo de Sistemas de Información',
    'Plan Modular 2021-2023',
    '2022-I',
    NULL,
    4,
    '[
      {"semestre":"I","periodo":"2022-I","creditos":22,"horas":480,"promedioSemestre":15.00,"asignaturas":[]},
      {"semestre":"II","periodo":"2022-II","creditos":22,"horas":480,"promedioSemestre":15.50,"asignaturas":[]},
      {"semestre":"III","periodo":"2023-I","creditos":22,"horas":480,"promedioSemestre":14.80,"asignaturas":[]},
      {"semestre":"IV","periodo":"2023-II","creditos":22,"horas":480,"promedioSemestre":15.20,"asignaturas":[]}
    ]'::jsonb,
    1920,
    88.00,
    15.12,
    13.00,
    DATE '2022-03-21',
    NULL,
    FALSE,
    FALSE,
    'ACT-DSI-IESTPS-2023-0145',
    'INCOMPLETO',
    'Registro de control negativo: plan de estudios incompleto (solo 4 semestres cursados de 6 requeridos).'
),
(
    'a3500003-0000-4000-8000-000000000052',
    'DNI',
    '99000052',
    NULL,
    'Caso Control Estudios Desaprobados Demo',
    'MAT-2020-DSI-0052',
    'Desarrollo de Sistemas de Información',
    'Plan Modular 2021-2023',
    '2020-I',
    DATE '2022-12-16',
    6,
    '[
      {"semestre":"I","periodo":"2020-I","creditos":22,"horas":480,"promedioSemestre":13.00,"asignaturas":[]},
      {"semestre":"II","periodo":"2020-II","creditos":22,"horas":480,"promedioSemestre":11.00,"asignaturas":[]},
      {"semestre":"III","periodo":"2021-I","creditos":22,"horas":480,"promedioSemestre":10.50,"asignaturas":[]},
      {"semestre":"IV","periodo":"2021-II","creditos":22,"horas":480,"promedioSemestre":11.80,"asignaturas":[]},
      {"semestre":"V","periodo":"2022-I","creditos":21,"horas":480,"promedioSemestre":10.20,"asignaturas":[]},
      {"semestre":"VI","periodo":"2022-II","creditos":21,"horas":480,"promedioSemestre":10.80,"asignaturas":[]}
    ]'::jsonb,
    2880,
    130.00,
    11.22,
    13.00,
    DATE '2020-03-16',
    DATE '2022-12-16',
    TRUE,
    FALSE,
    'ACT-DSI-IESTPS-2022-0211',
    'DESAPROBADO',
    'Registro de control negativo: promedio general desaprobatorio (11.22 < 13.00), no cumple condición de aprobación.'
)
ON CONFLICT (numero_documento_identidad, numero_acta_final) DO NOTHING;

-- ============================================================================
-- 5. Verificación formal de antecedentes ejecutada por Secretaría Académica
-- ============================================================================
CREATE TABLE IF NOT EXISTS sigd_doc.verificacion_academica_estudios (
    verificacion_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id uuid NOT NULL REFERENCES sigd_doc.expediente(expediente_id) ON DELETE CASCADE,
    registro_estudio_id uuid REFERENCES sigd_doc.registro_estudios_superiores(registro_estudio_id) ON DELETE RESTRICT,
    dni_verificado varchar(20) NOT NULL,
    semestres_verificados integer NOT NULL DEFAULT 0,
    culminado_verificado boolean NOT NULL,
    aprobado_verificado boolean NOT NULL,
    pago_tesoreria_verificado boolean NOT NULL,
    numero_recibo_tesoreria varchar(60),
    numero_acta_referencia varchar(80),
    programa_acreditado varchar(180),
    horas_academicas integer,
    creditos_totales numeric(5,2),
    promedio_final numeric(4,2),
    detalle_semestres_verificados jsonb NOT NULL DEFAULT '[]'::jsonb,
    resultado varchar(20) NOT NULL CHECK (resultado IN ('FAVORABLE', 'OBSERVADO', 'IMPROCEDENTE')),
    observaciones_academicas text NOT NULL,
    verificado_por uuid NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT,
    verificado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
    vigente boolean NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_verif_estudios_favorable CHECK (
        resultado <> 'FAVORABLE'
        OR (semestres_verificados = 6 AND culminado_verificado = TRUE AND aprobado_verificado = TRUE AND pago_tesoreria_verificado = TRUE AND registro_estudio_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_verificacion_academica_estudios_vigente
    ON sigd_doc.verificacion_academica_estudios (expediente_id)
    WHERE vigente = TRUE;

CREATE INDEX IF NOT EXISTS idx_verificacion_academica_estudios_expediente
    ON sigd_doc.verificacion_academica_estudios (expediente_id, verificado_en DESC);

-- ============================================================================
-- 6. Entidad oficial Certificado de Estudios Superiores (Borrador -> Firma DG -> Emitido)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sigd_doc.certificado_estudios_superiores (
    certificado_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id uuid NOT NULL REFERENCES sigd_doc.expediente(expediente_id) ON DELETE RESTRICT,
    verificacion_id uuid NOT NULL REFERENCES sigd_doc.verificacion_academica_estudios(verificacion_id) ON DELETE RESTRICT,
    numero_borrador varchar(60) NOT NULL UNIQUE,
    numero_certificado varchar(60) UNIQUE,
    titular_persona_id uuid NOT NULL REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT,
    titular_nombre varchar(250) NOT NULL,
    titular_documento varchar(30) NOT NULL,
    programa_estudios varchar(180) NOT NULL,
    plan_estudios varchar(80) NOT NULL DEFAULT 'Plan Modular Institucional IESTP Suiza',
    semestres_acreditados jsonb NOT NULL DEFAULT '[]'::jsonb,
    horas_academicas integer NOT NULL CHECK (horas_academicas > 0),
    creditos_totales numeric(5,2) NOT NULL CHECK (creditos_totales > 0),
    promedio_final numeric(4,2) NOT NULL CHECK (promedio_final >= 0 AND promedio_final <= 20),
    periodo_estudios varchar(120) NOT NULL,
    numero_acta varchar(80) NOT NULL,
    asunto varchar(500) NOT NULL,
    cvd varchar(40),
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
    CONSTRAINT chk_certificado_estudios_firma CHECK (
        estado NOT IN ('EMITIDO_FIRMADO', 'NOTIFICADO')
        OR (numero_certificado IS NOT NULL AND firmado_en IS NOT NULL AND hash_pades IS NOT NULL AND cvd IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_certificado_estudios_activo
    ON sigd_doc.certificado_estudios_superiores (expediente_id)
    WHERE estado <> 'ANULADO';

CREATE INDEX IF NOT EXISTS idx_certificado_estudios_expediente
    ON sigd_doc.certificado_estudios_superiores (expediente_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_certificado_estudios_cvd
    ON sigd_doc.certificado_estudios_superiores (cvd);
