import type { PoolClient } from 'pg';
import type { OperacionBitacora } from '../shared/types/index.js';
import { getRequestContext } from '../shared/request-context/request-context.js';

export interface RegistrarMutacionParams {
  esquema: string;
  tabla: string;
  operacion: OperacionBitacora;
  datos_antes?: unknown | null;
  datos_despues: unknown;
}

export async function registrarMutacion(
  cliente: PoolClient,
  params: RegistrarMutacionParams,
): Promise<string> {
  const contexto = getRequestContext();

  const resultado = await cliente.query<{ id_auditoria: string }>(
    `INSERT INTO sigd_audit.bitacora_auditoria
       (correlation_id, usuario_id, ip_origen, user_agent, esquema, tabla, operacion, datos_antes, datos_despues)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id_auditoria`,
    [
      contexto?.correlation_id ?? null,
      contexto?.usuario_id ?? null,
      contexto?.ip_origen ?? null,
      contexto?.user_agent ?? null,
      params.esquema,
      params.tabla,
      params.operacion,
      JSON.stringify(params.datos_antes ?? null),
      JSON.stringify(params.datos_despues),
    ],
  );

  return resultado.rows[0].id_auditoria;
}