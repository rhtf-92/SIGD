import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../shared/domain/errors/index.js';
import { setUsuarioId } from '../shared/request-context/request-context.js';
import { RbacService, type RolPermiso } from '../domains/organicore/rbac.service.js';

export const USUARIO_HEADER = 'x-usuario-id';

const ACTOR: unique symbol = Symbol('sigd.rbac.actor');

export interface ActorAutenticado {
  cuenta_id: string;
  roles: RolPermiso[];
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
 * Identidad provisional: el proyecto todavía no tiene emisor de tokens, por lo que la
 * cuenta se toma del encabezado `x-usuario-id`. El rol NUNCA se toma del cliente:
 * se resuelve contra `sigd_org.usuario_rol`, de modo que un encabezado `x-rol` falso
 * no otorga ningún privilegio.
 */
export function crearAutenticacionRbac(rbac: RbacService): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const cuenta_id = (req.get(USUARIO_HEADER) ?? '').trim();
      if (cuenta_id === '') {
        throw new UnauthorizedError({ detail: 'No se recibió una identidad de cuenta válida.' });
      }

      const roles = await rbac.rolesDeUsuario(cuenta_id);
      if (roles.length === 0) {
        throw new ForbiddenError({
          detail: 'La cuenta no tiene ningún rol vigente asignado.',
        });
      }

      setUsuarioId(cuenta_id);
      conectarActor(req, { cuenta_id, roles });
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

      const autorizado = await servicio.usuarioTienePermiso(actor.cuenta_id, permiso);
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
