import type { Request, Response, NextFunction } from "express";

import {
  listarUsuariosQuerySchema,
  crearUsuarioAdminSchema,
  actualizarUsuarioAdminSchema,
  usuarioIdParamSchema,
} from "./dto/usuarioAdmin.dto.js";

import type { UsuariosAdminService } from "./usuariosAdmin.service.js";

/**
 * OrganiCore - Controller de administración de usuarios
 * Responsable: Leonardo
 * Rama: B_LEONARDO
 *
 * Endpoints:
 * - GET  /api/v1/admin/usuarios
 * - POST /api/v1/admin/usuarios
 * - PUT  /api/v1/admin/usuarios/:id
 */

export function crearUsuariosAdminController(
  service: UsuariosAdminService,
) {
  /**
   * GET /api/v1/admin/usuarios
   */
  async function listarUsuarios(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const filtros = listarUsuariosQuerySchema.parse(req.query);

      const resultado = await service.listarUsuarios(filtros);

      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/usuarios
   *
   * El método queda preparado para conectarse con
   * service.crearUsuario cuando implementemos la siguiente fase.
   */
  async function crearUsuario(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const datos = crearUsuarioAdminSchema.parse(req.body);

      res.status(501).json({
        code: "NOT_IMPLEMENTED",
        message:
          "La creación de usuarios será habilitada al integrar IdentiCore y OrganiCore.",
        datosValidados: {
          numeroDocumento: datos.numeroDocumento,
          correo: datos.correo,
          username: datos.username,
          puestoLaboralId: datos.puestoLaboralId,
          rolId: datos.rolId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/admin/usuarios/:id
   *
   * El método queda preparado para conectarse con
   * service.actualizarUsuario cuando se unifique
   * el contrato de identificadores.
   */
  async function actualizarUsuario(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = usuarioIdParamSchema.parse(req.params);

      const datos =
        actualizarUsuarioAdminSchema.parse(req.body);

      res.status(501).json({
        code: "NOT_IMPLEMENTED",
        message:
          "La actualización de usuarios será habilitada al integrar IdentiCore y OrganiCore.",
        usuarioId: id,
        datosValidados: datos,
      });
    } catch (error) {
      next(error);
    }
  }

  return {
    listarUsuarios,
    crearUsuario,
    actualizarUsuario,
  };
}

export type UsuariosAdminController =
  ReturnType<typeof crearUsuariosAdminController>;