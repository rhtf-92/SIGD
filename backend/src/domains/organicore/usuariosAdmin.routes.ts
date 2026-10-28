import { Router } from "express";
import type { Pool } from "pg";

import { crearUsuariosAdminService } from "./usuariosAdmin.service.js";
import { crearUsuariosAdminController } from "./usuariosAdmin.controller.js";

export function crearUsuariosAdminRouter(pool: Pool): Router {
  const router = Router();

  const service = crearUsuariosAdminService(pool);
  const controller = crearUsuariosAdminController(service);

  router.get("/", controller.listarUsuarios);

  router.post("/", controller.crearUsuario);

  router.put("/:id", controller.actualizarUsuario);

  router.delete("/:id", controller.eliminarUsuario);

  return router;
}
