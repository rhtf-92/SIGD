-- M04 / DocuCore: persistencia canónica de la FSM académica.
-- El JSONB conserva el contrato de transporte del frontend, mientras que la
-- columna version permite control optimista y la API bloquea la fila FOR UPDATE.
CREATE TABLE IF NOT EXISTS sigd_doc.workflow_academico (
    id_tramite BIGINT PRIMARY KEY,
    workflow JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_workflow_id_consistente
      CHECK ((workflow ->> 'idTramite')::BIGINT = id_tramite),
    CONSTRAINT chk_workflow_etapas
      CHECK (jsonb_typeof(workflow -> 'etapas') = 'array'
             AND jsonb_array_length(workflow -> 'etapas') = 5)
);

CREATE INDEX IF NOT EXISTS idx_workflow_academico_estado
    ON sigd_doc.workflow_academico ((workflow ->> 'estado'));

WITH base AS (
  SELECT '{
    "idTramite": 412,
    "cut": "EXP-2026-000412",
    "codigoProcedimiento": "PROC-ACA-01",
    "nombreTramite": "Solicitud de Título Profesional Técnico",
    "programa": "Desarrollo de Sistemas de Información (DSI)",
    "solicitante": {"idPersona": 2941, "numeroDocumento": "45217893", "nombres": "Carlos Eduardo", "apellidos": "Mendoza Ríos", "correoElectronico": "cmendoza@alumno.institutosuiza.edu.pe"},
    "estado": "EN_TRAMITE",
    "etapaActualId": 1,
    "slaDiasTotales": 30,
    "fechaRegistro": "2026-09-05T16:05:00.000Z",
    "fechaLimiteSla": "2026-10-16T22:00:00.000Z",
    "etapas": [
      {"idEtapa":1,"orden":1,"codigo":"ETAPA-01","nombreEtapa":"Expedito","unidadOrganica":"Secretaría Académica","rolResponsable":"responsable","plazoSlaDias":5,"descripcion":"Declaratoria de expedito y constancia de egreso.","fechaInicio":"2026-09-05T17:00:00.000Z","requisitos":[{"idRequisito":101,"descripcion":"Créditos del plan de estudios aprobados al 100%","cumplido":true,"fechaCumplimiento":"2026-08-28T15:00:00.000Z"},{"idRequisito":102,"descripcion":"Constancia de egreso emitida por Secretaría Académica","cumplido":true,"fechaCumplimiento":"2026-09-01T14:30:00.000Z"}]},
      {"idEtapa":2,"orden":2,"codigo":"ETAPA-02","nombreEtapa":"Prácticas Preprofesionales (EFSRT)","unidadOrganica":"Coordinación de la Carrera DSI","rolResponsable":"responsable","plazoSlaDias":5,"descripcion":"Acreditación de experiencias formativas en situaciones reales de trabajo.","requisitos":[{"idRequisito":201,"descripcion":"Acreditación de EFSRT / Prácticas Preprofesionales (384 horas)","cumplido":false},{"idRequisito":202,"descripcion":"Conformidad técnica de malla curricular y notas aprobatorias","cumplido":false},{"idRequisito":203,"descripcion":"No adeudo de libros, materiales o instrumentos de taller","cumplido":false}]},
      {"idEtapa":3,"orden":3,"codigo":"ETAPA-03","nombreEtapa":"Jurado y Sustentación","unidadOrganica":"Secretaría Académica / Jurado Evaluador","rolResponsable":"operador","plazoSlaDias":10,"descripcion":"Designación de jurado, sustentación y dictamen favorable.","requisitos":[{"idRequisito":301,"descripcion":"Resolución de designación de jurado evaluador","cumplido":false},{"idRequisito":302,"descripcion":"Acta de examen profesional firmada por el jurado","cumplido":false},{"idRequisito":303,"descripcion":"Dictamen favorable del jurado con nota mayor o igual a 13","cumplido":false}]},
      {"idEtapa":4,"orden":4,"codigo":"ETAPA-04","nombreEtapa":"Emisión de Resolución","unidadOrganica":"Dirección General","rolResponsable":"admin","plazoSlaDias":5,"descripcion":"Proyección y emisión del acto resolutivo institucional.","requisitos":[{"idRequisito":401,"descripcion":"Borrador RD con bloques Visto / Considerando / Se Resuelve","cumplido":false},{"idRequisito":402,"descripcion":"Dictamen favorable conjunto de las áreas precedentes","cumplido":false}]},
      {"idEtapa":5,"orden":5,"codigo":"ETAPA-05","nombreEtapa":"Registro MinEdu, Diploma y Asiento","unidadOrganica":"Dirección General","rolResponsable":"admin","plazoSlaDias":5,"descripcion":"Firma PAdES-BES, CVD, asiento oficial y registro ante MinEdu.","requisitos":[{"idRequisito":501,"descripcion":"Firma digital PAdES-BES con sellado de tiempo TSA","cumplido":false},{"idRequisito":502,"descripcion":"Estampa de Código de Verificación Digital (CVD) y QR","cumplido":false},{"idRequisito":503,"descripcion":"Asiento en el Libro Oficial y registro del título ante MinEdu","cumplido":false}]}
    ]
  }'::jsonb AS workflow
), semillas(id_tramite, cut, nombre, programa, solicitante, estado, etapa) AS (
  VALUES
    (412::bigint, 'EXP-2026-000412', 'Solicitud de Título Profesional Técnico', 'Desarrollo de Sistemas de Información (DSI)', '{"idPersona":2941,"numeroDocumento":"45217893","nombres":"Carlos Eduardo","apellidos":"Mendoza Ríos","correoElectronico":"cmendoza@alumno.institutosuiza.edu.pe"}'::jsonb, 'EN_TRAMITE', 1),
    (413::bigint, 'EXP-2026-000413', 'Expedición de Certificado de Estudios', 'Desarrollo de Sistemas de Información (DSI)', '{"idPersona":2952,"numeroDocumento":"47120358","nombres":"Lucía Fernanda","apellidos":"Torres Vega","correoElectronico":"ltorres@alumno.institutosuiza.edu.pe"}'::jsonb, 'EN_TRAMITE', 1),
    (414::bigint, 'EXP-2026-000414', 'Convalidación de Estudios Previos', 'Contabilidad', '{"idPersona":2963,"numeroDocumento":"48931027","nombres":"Miguel Ángel","apellidos":"Ríos Paredes","correoElectronico":"mrios@alumno.institutosuiza.edu.pe"}'::jsonb, 'REGISTRADO', 1),
    (415::bigint, 'EXP-2026-000415', 'Emisión de Grado de Bachiller Técnico', 'Enfermería Técnica', '{"idPersona":2974,"numeroDocumento":"50219436","nombres":"Rosa Amelia","apellidos":"García López","correoElectronico":"rgarcia@alumno.institutosuiza.edu.pe"}'::jsonb, 'EN_REVISION', 2)
)
INSERT INTO sigd_doc.workflow_academico(id_tramite, workflow)
SELECT s.id_tramite,
       jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
         b.workflow,
         '{idTramite}', to_jsonb(s.id_tramite)),
         '{cut}', to_jsonb(s.cut)),
         '{nombreTramite}', to_jsonb(s.nombre)),
         '{programa}', to_jsonb(s.programa)),
         '{solicitante}', s.solicitante),
         '{estado}', to_jsonb(s.estado)) || jsonb_build_object('etapaActualId', s.etapa)
FROM base b CROSS JOIN semillas s
ON CONFLICT (id_tramite) DO NOTHING;

