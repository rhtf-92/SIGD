import { randomUUID, randomInt } from 'node:crypto';
import { obtenerPool } from './database.helper.js';

async function asegurarSolicitante(): Promise<string> {
  const persona = await obtenerPool().query(
    `INSERT INTO sigd_auth.persona (tipo, id_documento)
     VALUES ('NATURAL', $1)
     RETURNING id_persona`,
    [`DOC-${randomInt(1_000_000, 9_999_999)}`],
  );
  return persona.rows[0].id_persona as string;
}

async function asegurarArea(): Promise<string> {
  const area = await obtenerPool().query(
    `INSERT INTO sigd_org.area (nombre, vigente)
     VALUES ($1, true)
     RETURNING area_id`,
    [`Área E2E ${randomInt(1_000, 9_999)}`],
  );
  return area.rows[0].area_id as string;
}

export async function payloadRadicacionValido() {
  return {
    numero: `EXP-${randomInt(1_000_000, 9_999_999)}`,
    dni_solicitante: String(randomInt(10_000_000, 99_999_999)),
    numero_documento: `DOC-${randomInt(1_000, 9999)}`,
    folios: randomInt(1, 50),
    tipo_documental_id: randomUUID(),
    solicitante_id: await asegurarSolicitante(),
    area_destino_id: await asegurarArea(),
  };
}

export function correlationIdFijo(): string {
  return randomUUID();
}
