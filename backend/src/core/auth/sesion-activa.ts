import type { Pool } from 'pg';
import { UnauthorizedError } from '../../shared/domain/errors/index.js';
import { obtenerPerfilesActivos } from './roles-activos.js';
import { verificarTokenAcceso, type ClaimsJwt } from './jwt.service.js';

/** Revalida en PostgreSQL la sesión, el estado de cuenta y el perfil del JWT. */
export async function verificarSesionActiva(pool: Pool, token: string): Promise<ClaimsJwt> {
  const claims = verificarTokenAcceso(token);
  if (!claims.sid) throw new UnauthorizedError({ detail: 'La sesión asociada al token no es válida.' });

  const { rows } = await pool.query<{
    id_usuario: string;
    activo: boolean;
    revocado_en: Date | string | null;
    expira_en: Date | string;
  }>(
    `SELECT s.id_usuario, s.revocado_en, s.expira_en, c.activo
       FROM sigd_auth.sesion_usuario s
       JOIN sigd_auth.cuenta_usuario c ON c.id_usuario = s.id_usuario
      WHERE s.refresh_token = $1
        AND s.id_usuario = $2
        AND s.revocado_en IS NULL
        AND s.expira_en > now()
        AND c.activo = TRUE
        AND (c.bloqueado_hasta IS NULL OR c.bloqueado_hasta <= now())
      LIMIT 1`,
    [claims.sid, claims.sub],
  );
  if (!rows[0] || rows[0].id_usuario !== claims.sub || !rows[0].activo || rows[0].revocado_en !== null) {
    throw new UnauthorizedError({ detail: 'La sesión no está vigente.' });
  }

  const perfiles = await obtenerPerfilesActivos(pool, claims.sub);
  if (!claims.rolActivo || !perfiles.some((perfil) => perfil.rol === claims.rolActivo)) {
    throw new UnauthorizedError({ detail: 'El perfil activo ya no está vigente.' });
  }
  return claims;
}
