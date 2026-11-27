
import { Router } from "express";
import type { Pool } from "pg";

import { crearUsuariosAdminService } from "./usuariosAdmin.service.js";
import { crearUsuariosAdminController } from "./usuariosAdmin.controller.js";
import { resolverIdentidad } from "../../core/auth/auth.guard.js";
import { AppError } from "../../shared/domain/errors/index.js";

function exigirRolAdmin(req: import("express").Request): void {
  const identidad = resolverIdentidad(req);
  const roles = identidad.roles ?? [];
  const permitido = roles.some((r) => r === "ADMIN" || r === "SUPER_ADMIN" || r === "ADMINISTRADOR");
  if (!permitido) {
    throw new AppError({
      status: 403,
      code: "FORBIDDEN",
      message: "No autorizado.",
      detail: "Se requiere rol administrativo.",
    });
  }
}

export function crearUsuariosAdminRouter(pool: Pool): Router {
  const router = Router();

  const service = crearUsuariosAdminService(pool);

  const controller = crearUsuariosAdminController(service);

  router.get("/", (req, res, next) => {
    try {
      exigirRolAdmin(req);
      return controller.listarUsuarios(req, res, next);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", (req, res, next) => {
    try {
      exigirRolAdmin(req);
      return controller.crearUsuario(req, res, next);
    } catch (error) {
      return next(error);
    }
  });

  router.put("/:id", (req, res, next) => {
    try {
      exigirRolAdmin(req);
      return controller.actualizarUsuario(req, res, next);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}