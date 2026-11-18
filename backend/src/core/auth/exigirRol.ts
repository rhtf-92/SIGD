import type { Request, RequestHandler, Response } from 'express';
import { resolverIdentidad } from './auth.guard.js';

function enviarError(res: Response, status: number, codigo: string, mensaje: string): void {
  res.status(status).json({ code: codigo, title: mensaje, detail: mensaje, error: { codigo, mensaje } });
}

export function exigirRoles(...rolesPermitidos: string[]): RequestHandler {
  return (req, res, next): void => {
    try {
      const identidad = resolverIdentidad(req);
      if (identidad.via !== 'bearer') {
        enviarError(res, 401, 'NO_AUTENTICADO', 'Debe iniciar sesion.');
        return;
      }
      if (!identidad.roles.some((rol) => rolesPermitidos.includes(rol))) {
        enviarError(res, 403, 'SIN_PERMISO', 'No tiene permiso para esta operacion.');
        return;
      }
      res.locals['idOperador'] = identidad.idUsuario;
    } catch {
      enviarError(res, 401, 'NO_AUTENTICADO', 'Debe iniciar sesion.');
      return;
    }

    next();
  };
}
