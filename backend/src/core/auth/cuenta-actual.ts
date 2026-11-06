import type { Request } from 'express';
import type { Pool } from 'pg';
import { extraerTokenBearer } from './jwt.service.js';
import { UnauthorizedError } from '../../shared/domain/errors/index.js';
import { rolCanonico } from './roles-activos.js';
import { verificarSesionActiva } from './sesion-activa.js';

export { rolCanonico } from './roles-activos.js';

export async function cuentaActual(pool: Pool, req: Request) {
 const token = extraerTokenBearer(req.get('authorization'));
 if (!token) throw new UnauthorizedError();
 const claims = await verificarSesionActiva(pool, token);
 const {rows} = await pool.query(`SELECT c.id_usuario, c.id_persona, p.area_id
  FROM sigd_auth.cuenta_usuario c LEFT JOIN sigd_auth.perfil_usuario p USING(id_usuario)
  WHERE c.id_usuario=$1 AND c.activo`,[claims.sub]);
 if(!rows[0]) throw new UnauthorizedError();
 const rolActivo = claims.rolActivo || claims.roles[0];
 const permisos = await pool.query<{ permiso_codigo: string }>(
  `SELECT DISTINCT ps.codigo AS permiso_codigo
     FROM sigd_org.usuario_rol ur
     JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente
     JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
     JOIN sigd_org.permiso_sistema ps ON ps.permiso_id = rp.permiso_id
    WHERE ur.id_usuario = $1
      AND ur.vigente_desde <= now()
      AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
      AND CASE r.codigo WHEN 'ADMINISTRADOR' THEN 'SUPER_ADMIN' WHEN 'SECRETARIO' THEN 'DOCENTE'
        WHEN 'ESPECIALISTA' THEN 'DOCENTE' WHEN 'CIUDADANO' THEN 'ESTUDIANTE' ELSE r.codigo END = $2`,
  [claims.sub, rolActivo],
 );
 if (!rolActivo) throw new UnauthorizedError({ detail: 'El perfil activo ya no está vigente.' });
 return {
  ...rows[0],
  roles: [rolActivo],
  rolesAutorizados: claims.rolesAutorizados,
  permisos: permisos.rows.map((fila) => fila.permiso_codigo),
 };
}
