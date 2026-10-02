import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../shared/domain/errors/index.js';
import { setUsuarioId } from '../shared/request-context/request-context.js';
import { resolverIdentidad, type IdentidadAutenticada } from '../core/auth/auth.guard.js';
import { RbacService, type RolPermiso } from '../domains/organicore/rbac.service.js';

/**
 * Se mantiene el nombre del encabezado por compatibilidad con clientes existentes,
 * pero ya NO es una identidad confiable: `resolverIdentidad()` solo lo acepta si
 * `ALLOW_HEADER_IDENTITY=true`, y por detras exige el JWT.
 */
export const USUARIO_HEADER = 'x-usuario-id';

const ACTOR: unique symbol = Symbol('sigd.rbac.actor');

export interface ActorAutenticado {
  /** Columna canonica de `sigd_org.usuario_rol` (NO `cuenta_id`). */
  id_usuario: string;
  roles: RolPermiso[];
  /** Como se resolvio la identidad: JWT en cabecera, JWT en query o cabecera interna. */
  via: IdentidadAutenticada['via'];
}

export interface RequestConActor extends Request {
  [ACTOR]?: ActorAutenticado;
}

export function actorDe(req: Request): ActorAutenticado | undefined {
  return (req as RequestConActor)[ACTOR];
}

export function conectarActor(req: Request, actor: ActorAutenticado): void {
  (req as RequestConActor)[ACTOR] = actor;
}

/**
 * Identidad efectiva: se delega en `resolverIdentidad()` (JWT `Authorization:
 * Bearer`, luego `?token=` y por ultimo `x-usuario-id` unicamente si
 * `ALLOW_HEADER_IDENTITY=true`). Confiar en la cabecera sola permitiria suplantar
 * cualquier cuenta con un `for` simple; ahora el rol se resuelve contra
 * `sigd_org.usuario_rol` partiendo de una identidad verificada, de modo que un
 * `x-rol` falso tampoco otorga privilegio alguno.
 */
export function crearAutenticacionRbac(rbac: RbacService): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Lanza AppError 401 si no hay identidad verificable.
      const identidad = resolverIdentidad(req);
      const id_usuario = identidad.idUsuario.trim();
      if (id_usuario === '') {
        throw new UnauthorizedError({ detail: 'No se recibió una identidad de cuenta válida.' });
      }

      const roles = await rbac.rolesDeUsuario(id_usuario);
      if (roles.length === 0) {
        throw new ForbiddenError({
          detail: 'La cuenta no tiene ningún rol vigente asignado.',
        });
      }

      setUsuarioId(id_usuario);
      conectarActor(req, { id_usuario, roles, via: identidad.via });
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Autorización efectiva contra la matriz almacenada en PostgreSQL.
 *
 * El orden es deliberado y no admite atajos: primero la identidad (401) y después el
 * permiso (403). Si falta la identidad, la petición se rechaza siempre; nunca se
 * concede acceso por ausencia de rol, por error de caché o por caché caído.
 */
export function requirePermission(permiso: string, rbac?: RbacService): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (typeof permiso !== 'string' || permiso.trim() === '') {
        throw new Error('requirePermission requiere un código de permiso no vacío.');
      }

      const actor = actorDe(req);
      if (!actor) {
        throw new UnauthorizedError({
          detail: 'La solicitud no atraviesa el middleware de autenticación RBAC.',
        });
      }

      const servicio = rbac ?? (req.app.locals.rbac as RbacService | undefined);
      if (!servicio) {
        throw new Error('RbacService no disponible: falta inyectarlo o definir app.locals.rbac.');
      }

      const autorizado = await servicio.usuarioTienePermiso(actor.id_usuario, permiso, {
        area_id: areaDeLaSolicitud(req),
      });
      if (!autorizado) {
        throw new ForbiddenError({
          detail: `La cuenta no posee el permiso requerido: ${permiso}.`,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Area de contexto de la peticion, si la ruta o el cuerpo la declaran. Solo
 * importa para permisos con alcance por subareas; en el resto no cambia el
 * resultado de `usuarioTienePermiso`.
 */
function areaDeLaSolicitud(req: Request): string | undefined {
  const desdeParams = (req.params as Record<string, string | undefined>).area_id;
  if (typeof desdeParams === 'string' && desdeParams !== '') {
    return desdeParams;
  }
  const desdeQuery = req.query.area_id;
  if (typeof desdeQuery === 'string' && desdeQuery !== '') {
    return desdeQuery;
  }
  const desdeCuerpo = (req.body as Record<string, unknown> | undefined)?.area_id;
  return typeof desdeCuerpo === 'string' && desdeCuerpo !== '' ? desdeCuerpo : undefined;
}
