import type { PoolClient } from 'pg';
import { getRequestContext } from '../shared/request-context/request-context.js';

export interface InsertarEventoParams {
  agregado: string;
  tipo_evento: string;
  payload: Record<string, unknown>;
}

export async function insertarEvento(
  cliente: PoolClient,
  params: InsertarEventoParams,
): Promise<string> {
  const contexto = getRequestContext();

  const resultado = await cliente.query<{ id_evento: string }>(
    `INSERT INTO sigd_audit.evento_outbox
       (correlation_id, agregado, tipo_evento, payload, estado)
     VALUES ($1, $2, $3, $4, 'PENDIENTE')
     RETURNING id_evento`,
    [
      contexto?.correlation_id ?? null,
      params.agregado,
      params.tipo_evento,
      JSON.stringify(params.payload),
    ],
  );

  return resultado.rows[0].id_evento;
}