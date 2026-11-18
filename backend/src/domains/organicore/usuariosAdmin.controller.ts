import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  listarUsuariosQuerySchema,
  crearUsuarioAdminSchema,
  actualizarUsuarioAdminSchema,
  usuarioIdParamSchema,
} from "./dto/usuarioAdmin.dto.js";

import type {
  UsuariosAdminService,
} from "./usuariosAdmin.service.js";

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
   *
   * Directorio institucional paginado.
   */
  async function listarUsuarios(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const filtros =
        listarUsuariosQuerySchema.parse(
          req.query,
        );

      const resultado =
        await service.listarUsuarios(
          filtros,
        );

      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/usuarios
   *
   * Valida los datos del usuario institucional
   * y delega las reglas de negocio al servicio.
   */
  async function crearUsuario(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const datos =
        crearUsuarioAdminSchema.parse(
          req.body,
        );

      const resultado =
        await service.crearUsuario(
          datos,
        );

      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/admin/usuarios/:id
   *
   * Valida el identificador y los datos
   * enviados para la actualización.
   */
  async function actualizarUsuario(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } =
        usuarioIdParamSchema.parse(
          req.params,
        );

      const datos =
        actualizarUsuarioAdminSchema.parse(
          req.body,
        );

      const resultado =
        await service.actualizarUsuario(
          id,
          datos,
        );

      res.status(200).json(resultado);
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
  ReturnType<
    typeof crearUsuariosAdminController
  >;