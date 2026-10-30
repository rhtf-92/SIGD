import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Pool } from 'pg';
import { setUsuarioId } from '../../shared/request-context/request-context.js';
import { ForbiddenError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import { extraerTokenBearer, verificarTokenAcceso } from './jwt.service.js';

/** JWT y permisos vigentes en PostgreSQL; los permisos no se confian al token. */
export function requerirPermiso(pool: Pool, permiso: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = extraerTokenBearer(req.get('authorization'));
      if (!token) throw new UnauthorizedError();
      const claims = verificarTokenAcceso(token);
      const resultado = await pool.query<{ activo: boolean; permitido: boolean }>(
        `SELECT c.activo, EXISTS(SELECT 1 FROM sigd_org.usuario_rol ur JOIN sigd_org.rol_sistema r ON r.rol_id=ur.rol_id AND r.vigente JOIN sigd_org.rol_permiso rp ON rp.rol_id=r.rol_id JOIN sigd_org.permiso_sistema p ON p.permiso_id=rp.permiso_id WHERE ur.id_usuario=c.id_usuario AND ur.vigente_desde<=now() AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta>now()) AND p.codigo=$2) permitido FROM sigd_auth.cuenta_usuario c WHERE c.id_usuario=$1`,
        [claims.sub, permiso],
      );
      const estado = resultado.rows[0];
      if (!estado) throw new UnauthorizedError({ detail: 'La cuenta del token no existe.' });
      if (!estado.activo || !estado.permitido) throw new ForbiddenError();
      setUsuarioId(claims.sub); res.locals.identidad = { idUsuario: claims.sub }; next();
    } catch (error) { next(error); }
  };
}
