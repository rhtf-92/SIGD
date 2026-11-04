import type { Pool } from 'pg';
import { UnauthorizedError } from '../../shared/domain/errors/index.js';
import { obtenerPerfilesActivos } from './roles-activos.js';
import { verificarTokenAcceso, type ClaimsJwt } from './jwt.service.js';

/** Verifica que el JWT de acceso siga asociado a una sesión y perfil vigentes. */
export async function verificarSesionActiva(pool: Pool, token: string): Promise<ClaimsJwt> {
  const claims = verificarTokenAcceso(token);
  if (!claims.sid) throw new UnauthorizedError({ detail: 'La sesión del token no es válida.' });

  const sesionRes = await pool.query<{
    id_usuario: string;
    expira_en: Date | string;
    revocado_en: Date | string | null;
    activo: boolean;
  }>(
    `SELECT s.id_usuario, s.expira_en, s.revocado_en, c.activo
       FROM sigd_auth.sesion_usuario s
       JOIN sigd_auth.cuenta_usuario c ON c.id_usuario = s.id_usuario
      WHERE s.refresh_token = $1
      LIMIT 1`,
    [claims.sid],
  );
  const sesion = sesionRes.rows[0];
  if (!sesion || sesion.id_usuario !== claims.sub || !sesion.activo || sesion.revocado_en !== null ||
      new Date(sesion.expira_en).getTime() <= Date.now()) {
    throw new UnauthorizedError({ detail: 'La sesión no está vigente.' });
  }

  const perfiles = await obtenerPerfilesActivos(pool, claims.sub);
  if (!claims.rolActivo || !perfiles.some((perfil) => perfil.rol === claims.rolActivo)) {
    throw new UnauthorizedError({ detail: 'El perfil activo ya no está vigente.' });
  }
  return claims;
}
