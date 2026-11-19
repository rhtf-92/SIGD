import type { PoolClient } from 'pg';
import type { OperacionBitacora } from '../shared/types/index.js';
import { getRequestContext } from '../shared/request-context/request-context.js';

export interface RegistrarMutacionParams {
  esquema: string;
  tabla: string;
  operacion: OperacionBitacora;
  datos_antes?: unknown | null;
  datos_despues: unknown;
  correlation_id?: string | null;
  usuario_id?: string | null;
}

export async function registrarMutacion(
  cliente: Pick<PoolClient, 'query'>,
  params: RegistrarMutacionParams,
): Promise<string> {
  const contexto = getRequestContext();
  const correlationId = params.correlation_id ?? contexto?.correlation_id ?? crypto.randomUUID();
  const rawUsuarioId = params.usuario_id ?? contexto?.usuario_id ?? null;
  const isUuid = rawUsuarioId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawUsuarioId);
  const usuarioId = isUuid ? rawUsuarioId : null;
  const ipOrigen = contexto?.ip_origen && contexto.ip_origen.trim() !== '' ? contexto.ip_origen.trim() : null;
  const userAgent = contexto?.user_agent && contexto.user_agent.trim() !== '' ? contexto.user_agent.trim() : null;

  const resultado = await cliente.query<{ id_auditoria: string }>(
    `INSERT INTO sigd_audit.bitacora_auditoria
       (correlation_id, usuario_id, ip_origen, user_agent, esquema, tabla, operacion, datos_antes, datos_despues)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id_auditoria`,
    [
      correlationId,
      usuarioId,
      ipOrigen,
      userAgent,
      params.esquema,
      params.tabla,
      params.operacion,
      JSON.stringify(params.datos_antes ?? null),
      JSON.stringify(params.datos_despues),
    ],
  );

  return resultado.rows[0]?.id_auditoria ?? '';
}
