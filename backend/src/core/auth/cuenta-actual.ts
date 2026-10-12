import type { Request } from 'express';
import type { Pool } from 'pg';
import { extraerTokenBearer, verificarTokenAcceso } from './jwt.service.js';
import { UnauthorizedError } from '../../shared/domain/errors/index.js';

export const rolCanonico = (codigo: string): string => ({ ADMINISTRADOR: 'SUPER_ADMIN',
 SECRETARIO: 'DOCENTE', ESPECIALISTA: 'DOCENTE', CIUDADANO: 'ESTUDIANTE' }[codigo] ?? codigo);

export async function cuentaActual(pool: Pool, req: Request) {
 const token = extraerTokenBearer(req.get('authorization'));
 if (!token) throw new UnauthorizedError();
 const claims = verificarTokenAcceso(token);
 const {rows} = await pool.query(`SELECT c.id_usuario, c.id_persona, p.area_id,
  ARRAY(SELECT DISTINCT r.codigo FROM sigd_org.usuario_rol ur
   JOIN sigd_org.rol_sistema r USING(rol_id) WHERE ur.id_usuario=c.id_usuario
   AND ur.vigente_desde<=now() AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta>now())) AS roles,
  ARRAY(SELECT DISTINCT ps.codigo FROM sigd_org.usuario_rol ur
   JOIN sigd_org.rol_permiso rp USING(rol_id) JOIN sigd_org.permiso_sistema ps USING(permiso_id)
   WHERE ur.id_usuario=c.id_usuario AND ur.vigente_desde<=now()
   AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta>now())
   AND (ur.area_id IS NULL OR ur.area_id=p.area_id)) AS permisos
  FROM sigd_auth.cuenta_usuario c LEFT JOIN sigd_auth.perfil_usuario p USING(id_usuario)
  WHERE c.id_usuario=$1 AND c.activo`,[claims.sub]);
 if(!rows[0]) throw new UnauthorizedError();
 return {...rows[0], roles:(rows[0].roles as string[]).map(rolCanonico)};
}
