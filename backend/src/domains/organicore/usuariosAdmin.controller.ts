import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  listarUsuariosQuerySchema,
  crearUsuarioAdminSchema,
  actualizarUsuarioAdminSchema,
  restablecerCredencialesAdminSchema,
  usuarioIdParamSchema,
  asignarRolUsuarioSchema,
  revocarRolParamSchema,
  asignarCapacidadUsuarioSchema,
  revocarCapacidadParamSchema,
} from "./dto/usuarioAdmin.dto.js";
import { getRequestContext } from "../../shared/request-context/request-context.js";

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

  async function consultarUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = usuarioIdParamSchema.parse(req.params);
      res.status(200).json(await service.consultarUsuario(id));
    } catch (error) { next(error); }
  }

  async function restablecerCredenciales(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = usuarioIdParamSchema.parse(req.params);
      const { passwordInicial } = restablecerCredencialesAdminSchema.parse(req.body);
      await service.restablecerCredenciales(id, passwordInicial);
      res.status(204).end();
    } catch (error) { next(error); }
  }

  async function asignarRol(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = usuarioIdParamSchema.parse(req.params);
      const { rolId } = asignarRolUsuarioSchema.parse(req.body);
      const actorId = getRequestContext()?.usuario_id ?? (req as any).usuarioId;
      const resultado = await service.asignarRol(id, rolId, actorId);
      res.status(201).json(resultado);
    } catch (error) { next(error); }
  }

  async function revocarRol(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, usuarioRolId } = revocarRolParamSchema.parse(req.params);
      const actorId = getRequestContext()?.usuario_id ?? (req as any).usuarioId;
      const resultado = await service.revocarRol(id, usuarioRolId, actorId);
      res.status(200).json(resultado);
    } catch (error) { next(error); }
  }

  async function asignarCapacidad(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = usuarioIdParamSchema.parse(req.params);
      const { capacidadCodigo, areaId, justificacion } = asignarCapacidadUsuarioSchema.parse(req.body);
      const actorId = getRequestContext()?.usuario_id ?? (req as any).usuarioId;
      const resultado = await service.asignarCapacidad(id, capacidadCodigo, areaId, actorId, justificacion);
      res.status(201).json(resultado);
    } catch (error) { next(error); }
  }

  async function revocarCapacidad(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, usuarioCapacidadId } = revocarCapacidadParamSchema.parse(req.params);
      const actorId = getRequestContext()?.usuario_id ?? (req as any).usuarioId;
      const resultado = await service.revocarCapacidad(id, usuarioCapacidadId, actorId);
      res.status(200).json(resultado);
    } catch (error) { next(error); }
  }

  return {
    listarUsuarios,
    crearUsuario,
    actualizarUsuario,
    consultarUsuario,
    restablecerCredenciales,
    asignarRol,
    revocarRol,
    asignarCapacidad,
    revocarCapacidad,
  };
}

export type UsuariosAdminController =
  ReturnType<
    typeof crearUsuariosAdminController
  >;
