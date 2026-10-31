/** UUID determinista de fixtures: no convierte identificadores productivos. */
export const uuidPrueba = (numero: number): string =>
  `00000000-0000-4000-8000-${String(numero).padStart(12, '0')}`;

/** Contrato mínimo de lectura de 05, exclusivamente en contenedores de prueba. */
export const contratoLecturaUuid = `
  CREATE SCHEMA sigd_tra;
  CREATE TABLE sigd_tra.expediente (
    expediente_id UUID PRIMARY KEY, codigo_expediente TEXT NOT NULL,
    asunto TEXT NOT NULL, fecha_radicacion TIMESTAMPTZ NOT NULL,
    solicitante_id UUID NOT NULL DEFAULT '${uuidPrueba(80)}',
    numero TEXT NOT NULL DEFAULT 'FIXTURE-UUID'
  );
  -- Proyección del asunto de cada fixture; la prueba pipeline-uuid usa el DDL real.
  CREATE VIEW sigd_tra.tramite AS SELECT expediente_id, asunto FROM sigd_tra.expediente;
  CREATE TABLE sigd_tra.expediente_documento_folio (
    expediente_id UUID NOT NULL, id_documento UUID NOT NULL,
    folio_inicio INT NOT NULL, folio_fin INT NOT NULL
  );
`;
