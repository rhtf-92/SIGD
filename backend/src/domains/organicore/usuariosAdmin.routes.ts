
import { Router, type RequestHandler } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { extraerTokenBearer, verificarTokenAcceso } from "../../core/auth/jwt.service.js";
import { AppError, ForbiddenError, UnauthorizedError } from "../../shared/domain/errors/index.js";
import { setUsuarioId } from "../../shared/request-context/request-context.js";
import { obtenerAutorizacionCuenta } from "../../core/auth/auth.guard.js";

import { crearUsuariosAdminService } from "./usuariosAdmin.service.js";
import { crearUsuariosAdminController } from "./usuariosAdmin.controller.js";

/** ADMIN_USUARIOS/GLOBAL del catálogo original; el JWT identifica la cuenta y contexto activo. */
export function exigirAdministracionUsuarios(pool: Pool): RequestHandler {
  return async (req, _res, next) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) throw new UnauthorizedError();
    const claims = verificarTokenAcceso(token);
    const { sub, ctx } = claims;
    if (!z.string().uuid().safeParse(sub).success) throw new UnauthorizedError();

    if (ctx) {
      const autorizacion = await obtenerAutorizacionCuenta(pool, sub, ctx);
      if (!autorizacion) throw new ForbiddenError({ message: 'Cuenta institucional inactiva o no autorizada.' });
      if (autorizacion.contextoRevocado) {
        throw new AppError({
          status: 403,
          code: 'CONTEXT_REVOKED',
          message: 'El contexto activo ha sido revocado. Debe seleccionar un contexto vigente.',
        });
      }

      const tienePermisoAdmin = autorizacion.permisos.some(
        (p) => p.codigo === 'ADMIN_USUARIOS' && p.ambito === 'GLOBAL',
      ) || autorizacion.roles.includes('ADMINISTRADOR');

      if (!tienePermisoAdmin) throw new ForbiddenError();
    } else {
      const acceso = await pool.query<{ autorizado: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM sigd_auth.cuenta_usuario cu
          JOIN sigd_org.usuario_rol ur ON ur.id_usuario = cu.id_usuario
          JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
          JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
          JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
          WHERE cu.id_usuario = $1::uuid AND cu.activo = TRUE
            AND ur.vigente_desde <= now()
            AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
            AND p.codigo = 'ADMIN_USUARIOS' AND p.ambito = 'GLOBAL'
            AND ur.area_id IS NULL
        ) AS autorizado`, [sub]);
      if (acceso.rows.length !== 1 || acceso.rows[0].autorizado !== true) throw new ForbiddenError();
    }

    setUsuarioId(sub);
    (req as any).usuarioId = sub;
    next();
  };
}

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
  router.use(exigirAdministracionUsuarios(pool));

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

  router.get("/:id", controller.consultarUsuario);

  /**
   * Actualización de usuario institucional.
   */
  router.put(
    "/:id",
    controller.actualizarUsuario,
  );

  router.post("/:id/restablecer-credenciales", controller.restablecerCredenciales);

  /** Asignación posterior de rol institucional */
  router.post("/:id/roles", controller.asignarRol);

  /** Revocación de asignación de rol institucional */
  router.delete("/:id/roles/:usuarioRolId", controller.revocarRol);

  /** Asignación de capacidad operativa de área */
  router.post("/:id/capacidades", controller.asignarCapacidad);

  /** Revocación de capacidad operativa de área */
  router.delete("/:id/capacidades/:usuarioCapacidadId", controller.revocarCapacidad);

  /**
   * Regla institucional permanente: ningún usuario puede eliminarse físicamente del SIGD.
   * Únicamente se puede desactivar su cuenta mediante PUT /:id con estado: 'INACTIVO'.
   */
  router.delete("/:id", (_req, _res) => {
    throw new AppError({
      status: 405,
      code: "METHOD_NOT_ALLOWED",
      message: "Eliminación física de usuarios no permitida.",
      detail: "Regla institucional permanente: ningún usuario puede eliminarse físicamente del SIGD. Únicamente se puede desactivar su cuenta institucional mediante PUT /api/v1/admin/usuarios/:id con estado INACTIVO.",
    });
  });

  return router;
}
