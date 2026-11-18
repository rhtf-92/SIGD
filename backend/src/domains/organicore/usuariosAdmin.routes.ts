
import { Router } from "express";
import type { Pool } from "pg";

import { crearUsuariosAdminService } from "./usuariosAdmin.service.js";
import { crearUsuariosAdminController } from "./usuariosAdmin.controller.js";

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