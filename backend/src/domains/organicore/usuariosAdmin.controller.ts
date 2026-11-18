import type {
  Request,
  Response,
  NextFunction,
} from "express";
import type { Pool } from "pg";

import {
  listarUsuariosQuerySchema,
  crearUsuarioAdminSchema,
  actualizarUsuarioAdminSchema,
  usuarioIdParamSchema,
  nuevoUsuarioInstitucionalSchema,
} from "./dto/usuarioAdmin.dto.js";

import {
  crearUsuariosAdminService,
  type UsuariosAdminService,
} from "./usuariosAdmin.service.js";

// Re-exportar para compatibilidad con módulos consumidores
export { nuevoUsuarioInstitucionalSchema };

export function crearUsuariosAdminController(
  service: UsuariosAdminService,
  pool?: Pool,
) {
  // Asegurar servicio funcional incluso si se instancia con service vacío en pruebas unitarias
  const srv: UsuariosAdminService =
    service && typeof service.crearUsuario === "function"
      ? service
      : pool
        ? crearUsuariosAdminService(pool)
        : service;

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
      const filtros = listarUsuariosQuerySchema.parse(req.query);
      const resultado = await srv.listarUsuarios(filtros);
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/usuarios/institucional
   *
   * Alta segura de usuario institucional (ADMINISTRADOR).
   */
  async function crearUsuarioInstitucional(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const requester = (req as any).user as
        | { sub?: string; roles?: string[] }
        | undefined;
      const datos = nuevoUsuarioInstitucionalSchema.parse(req.body);
      const resultado = await srv.crearUsuario(datos, requester);
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/usuarios
   *
   * Alta institucional canónica REST. Soporta payload administrativo
   * institucional y DTO de estructura de personal.
   */
  async function crearUsuario(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const requester = (req as any).user as
        | { sub?: string; roles?: string[] }
        | undefined;
      const datos =
        req.body?.username !== undefined ||
        req.body?.tipoDocumentoId !== undefined
          ? crearUsuarioAdminSchema.parse(req.body)
          : nuevoUsuarioInstitucionalSchema.parse(req.body);

      const resultado = await srv.crearUsuario(datos, requester);
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/admin/usuarios/:id
   *
   * Actualización segura de usuario institucional.
   */
  async function actualizarUsuario(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = usuarioIdParamSchema.parse(req.params);
      const requester = (req as any).user as
        | { sub?: string; roles?: string[] }
        | undefined;
      const datos = actualizarUsuarioAdminSchema.parse(req.body);

      const resultado = await srv.actualizarUsuario(id, datos, requester);
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  return {
    listarUsuarios,
    crearUsuario,
    crearUsuarioInstitucional,
    actualizarUsuario,
  };
}

export type UsuariosAdminController = ReturnType<
  typeof crearUsuariosAdminController
>;
