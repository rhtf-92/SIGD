import { Router, type Request, type Response, type NextFunction } from "express";
import type { Pool } from "pg";

import { crearUsuariosAdminService } from "./usuariosAdmin.service.js";
import { crearUsuariosAdminController } from "./usuariosAdmin.controller.js";
import { extraerTokenBearer, verificarTokenAcceso } from "../../core/auth/jwt.service.js";
import { UnauthorizedError, ForbiddenError } from "../../shared/domain/errors/index.js";

/**
 * OrganiCore - Rutas de administración de usuarios
 * Responsable: Leonardo
 * Rama: B_LEONARDO
 *
 * Endpoints:
 * GET  /api/v1/admin/usuarios
 * POST /api/v1/admin/usuarios
 * PUT  /api/v1/admin/usuarios/:id
 */

export const ROLES_ADMIN_USUARIOS_PERMITIDOS = ['ADMINISTRADOR'] as const;

/**
 * Middleware de guarda: autenticación y autorización para administración de usuarios (N-01).
 * Exige Bearer Token válido con rol institucional canónico ADMINISTRADOR.
 */
export function requireAdminUsuarios(req: Request, _res: Response, next: NextFunction): void {
  const token = extraerTokenBearer(req.get("authorization"));
  if (!token) {
    throw new UnauthorizedError({
      detail: "Debe autenticarse con Authorization: Bearer <jwt> para acceder a la administración de usuarios.",
    });
  }

  const claims = verificarTokenAcceso(token);

  const tieneRol = claims.roles.some((r) =>
    (ROLES_ADMIN_USUARIOS_PERMITIDOS as readonly string[]).includes(r.toUpperCase()),
  );

  if (!tieneRol) {
    throw new ForbiddenError({
      message: "Acceso denegado.",
      detail: "Se requiere rol institucional ADMINISTRADOR para gestionar usuarios.",
    });
  }

  next();
}

export function crearUsuariosAdminRouter(pool: Pool): Router {
  const router = Router();

  const service = crearUsuariosAdminService(pool);

  const controller = crearUsuariosAdminController(service);

  // Guarda estricta aplicada a todas las rutas de administración de usuarios
  router.use(requireAdminUsuarios);

  /**
   * Directorio institucional paginado.
   */
  router.get(
    "/",
    controller.listarUsuarios,
  );

  /**
   * Alta de usuario institucional.
   */
  router.post(
    "/",
    controller.crearUsuario,
  );

  /**
   * Actualización de usuario institucional.
   */
  router.put(
    "/:id",
    controller.actualizarUsuario,
  );

  return router;
}
