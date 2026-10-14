import type { Request } from 'express';
import type { Pool } from 'pg';
import { extraerTokenBearer, verificarTokenAcceso } from './jwt.service.js';
import { UnauthorizedError } from '../../shared/domain/errors/index.js';
import { obtenerPerfilesActivos, rolCanonico } from './roles-activos.js';

export { rolCanonico } from './roles-activos.js';

export async function cuentaActual(pool: Pool, req: Request) {
 const token = extraerTokenBearer(req.get('authorization'));
 if (!token) throw new UnauthorizedError();
 const claims = verificarTokenAcceso(token);
 const {rows} = await pool.query(`SELECT c.id_usuario, c.id_persona, p.area_id
  FROM sigd_auth.cuenta_usuario c LEFT JOIN sigd_auth.perfil_usuario p USING(id_usuario)
  WHERE c.id_usuario=$1 AND c.activo`,[claims.sub]);
 if(!rows[0]) throw new UnauthorizedError();
 const perfiles = await obtenerPerfilesActivos(pool, claims.sub);
 const rolActivo = claims.rolActivo || claims.roles[0];
 const perfilActivo = perfiles.find((perfil) => perfil.rol === rolActivo);
 if (!perfilActivo) throw new UnauthorizedError({ detail: 'El perfil activo ya no está vigente.' });
 return {
  ...rows[0],
  roles: [perfilActivo.rol],
  rolesAutorizados: perfiles.map((perfil) => perfil.rol),
  permisos: perfilActivo.permisos,
 };
}
