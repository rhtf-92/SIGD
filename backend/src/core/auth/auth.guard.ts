import type { Request } from 'express';
import type { Pool } from 'pg';
import { AppError } from '../../shared/domain/errors/index.js';
import { extraerTokenBearer, verificarTokenAcceso, type ClaimsJwt } from './jwt.service.js';

export interface IdentidadAutenticada {
  idUsuario: string;
  roles: string[];
 via: 'bearer' | 'query' | 'cabecera-interna';
}

/**
 * Resuelve la identidad del solicitante para los endpoints de streamed (SSE) y
 * de la cola de firma.
 *
 * Orden de precedencia (§4.8 de los endpoints #55 y #56):
 *   1. `Authorization: Bearer <jwt>` — vía autenticada.
 *   2. `?token=<jwt>` — compatibilidad con la API nativa `EventSource(url)`.
 *   3. `x-usuario-id` — ONLY la acepta si `ALLOW_HEADER_IDENTITY=true`, porque
 *      la API de `EventSource` no permite cabeceras personalizadas. En producción
 *      el valor por defecto es `false` para no aceptar identidades afirmadas por
 *      el cliente sin verificación criptográfica.
 */
export function resolverIdentidad(req: Request): IdentidadAutenticada {
  const bearer = extraerTokenBearer(req.get('authorization'));
  if (bearer) {
    const claims: ClaimsJwt = verificarTokenAcceso(bearer);
    return { idUsuario: claims.sub, roles: claims.roles, via: 'bearer' };
  }

  const tokenQuery = typeof req.query.token === 'string' ? req.query.token : undefined;
  if (tokenQuery) {
    const claims = verificarTokenAcceso(tokenQuery);
    return { idUsuario: claims.sub, roles: claims.roles, via: 'query' };
  }

  const cabecera = req.get('x-usuario-id');
  const cabeceraPermitida = (process.env.ALLOW_HEADER_IDENTITY ?? 'false') === 'true';
  if (cabecera && cabecera.trim() !== '' && cabeceraPermitida) {
    return { idUsuario: cabecera.trim(), roles: [], via: 'cabecera-interna' };
  }

  throw new AppError({
    status: 401,
    code: 'UNAUTHORIZED',
    message: 'No autenticado.',
    detail: 'Debe autenticarse con Authorization: Bearer <jwt> o ?token=<jwt>.',
  });
}

export const ROLES_FIRMA = ['DIRECTOR', 'ADMINISTRADOR'] as const;

export interface FacultadFirma {
  puedeFirmar: boolean;
  roles: string[];
  facultadGlobal: boolean;
  tiposAutorizados: string[];
  motivo: string | null;
}

/**
 * Verifica las facultades legales de despacho del funcionario (Art. 5 del
 * Reglamento de Firmas): rol institucional DIRECTOR/ADMINISTRADOR o facultad de
 * despacho vigente en `sigd_org.facultad_despacho`, incluidas las suplencias
 * registradas en `sigd_org.encargatura_despacho`.
 */
export async function verificarFacultadFirma(
  pool: Pool,
  idUsuario: string,
  rolesDeclarados: string[] = [],
): Promise<FacultadFirma> {
  const resultado = await pool.query<{
    rol_codigo: string | null;
    tipo_resolucion: string | null;
    vigente: boolean;
    motivo_no_habilitado: string | null;
  }>(
    `SELECT r.codigo AS rol_codigo, f.tipo_resolucion, f.vigente, f.motivo_no_habilitado
       FROM sigd_org.usuario_rol ur
       JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
       LEFT JOIN sigd_org.facultad_despacho f
              ON f.usuario_id = ur.id_usuario
             AND f.cargo_id IS NOT NULL
      WHERE ur.id_usuario = $1
        AND ur.vigente_desde <= now()
        AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
     UNION ALL
     SELECT NULL AS rol_codigo, e.tipo_resolucion, e.vigente, e.motivo_no_habilitado
       FROM sigd_org.encargatura_despacho e
      WHERE e.usuario_id = $1
        AND e.vigente
        AND e.inicio <= now()
        AND (e.fin IS NULL OR e.fin > now())`,
    [idUsuario],
  );

  const roles = new Set<string>(rolesDeclarados);
  const tipos = new Set<string>();
  let facultadGlobal = false;
  let motivo: string | null = null;

  for (const fila of resultado.rows) {
    if (fila.rol_codigo) roles.add(fila.rol_codigo);
    if (!fila.vigente) {
      motivo ??= fila.motivo_no_habilitado;
      continue;
    }
    if (fila.tipo_resolucion === null) facultadGlobal = true;
    else tipos.add(fila.tipo_resolucion);
  }

  const rolFirmante = [...roles].some((rol) => (ROLES_FIRMA as readonly string[]).includes(rol));

  return {
    puedeFirmar: rolFirmante || facultadGlobal || tipos.size > 0,
    roles: [...roles],
    facultadGlobal: facultadGlobal || rolFirmante,
    tiposAutorizados: [...tipos],
    motivo,
  };
}