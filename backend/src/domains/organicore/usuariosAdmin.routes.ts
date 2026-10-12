
import { Router } from "express";
import type { Pool } from "pg";

import { crearUsuariosAdminService } from "./usuariosAdmin.service.js";
import { crearUsuariosAdminController } from "./usuariosAdmin.controller.js";
import { autenticarJwt, autorizarPermisos, PERMISOS_RBAC } from "../../core/auth/auth.guard.js";

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

export function crearUsuariosAdminRouter(pool: Pool): Router {
  const router = Router();

  const service = crearUsuariosAdminService(pool);

  const controller = crearUsuariosAdminController(service);
  const autenticar = autenticarJwt;
  const permisoLectura = autorizarPermisos(PERMISOS_RBAC.USUARIOS_LEER);
  const permisoGestion = autorizarPermisos(PERMISOS_RBAC.USUARIOS_GESTIONAR);

  /**
   * Directorio institucional paginado.
   */
  router.get(
    "/",
    autenticar,
    permisoLectura,
    controller.listarUsuarios,
  );

  /**
   * Alta de usuario institucional.
   */
  router.post(
    "/",
    autenticar,
    permisoGestion,
    controller.crearUsuario,
  );

  /**
   * Actualización de usuario institucional.
   */
  router.put(
    "/:id",
    autenticar,
    permisoGestion,
    controller.actualizarUsuario,
  );

  return router;
}