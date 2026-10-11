import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Pool } from 'pg';

const MIGRACIONES = [
  '01_sigd_audit.sql', '02_sigd_auth.sql', '03_sigd_org.sql',
  '04_sigd_doc.sql', '05_sigd_tra.sql',
] as const;

/** UUID explícitos y exclusivos del fixture; no representa una conversión de IDs legados. */
export function expedienteDePrueba(numero: number): string {
  if (!Number.isInteger(numero) || numero < 1 || numero > 999_999_999_999) {
    throw new RangeError('Número de fixture inválido');
  }
  return `00000000-0000-4000-8000-${String(numero).padStart(12, '0')}`;
}

export async function instalarBaselineRutaDoc(pool: Pool): Promise<string> {
  for (const nombre of MIGRACIONES) {
    await pool.query(readFileSync(path.resolve(process.cwd(), 'migraciones', nombre), 'utf8'));
  }
  await pool.query(readFileSync(path.resolve(process.cwd(), 'baselines/BASELINE_2026_V1.sql'), 'utf8'));
  const persona = await pool.query<{ id_persona: string }>(
    "INSERT INTO sigd_auth.persona (tipo, id_documento) VALUES ('NATURAL', 'FIXTURE_RUTADOC') RETURNING id_persona",
  );
  return persona.rows[0].id_persona;
}

export async function crearExpedienteRutaDoc(pool: Pool, numero: number, personaId: string,
  fechaRadicacion: string, asunto: string): Promise<string> {
  const id = expedienteDePrueba(numero);
  await pool.query(`INSERT INTO sigd_tra.expediente
    (expediente_id, codigo_expediente, numero, tipo_documental_id, solicitante_id, fecha_radicacion)
    VALUES ($1::uuid, $2, $3, $4::uuid, $5::uuid, $6::timestamptz)`,
  [id, `EXP-2026-${String(numero).padStart(6, '0')}`, `TEST-${numero}`,
    '11111111-1111-4111-8111-111111111111', personaId, fechaRadicacion]);
  await pool.query('INSERT INTO sigd_tra.tramite (expediente_id, asunto) VALUES ($1::uuid, $2)', [id, asunto]);
  return id;
}
