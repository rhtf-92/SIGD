import { Router } from 'express';
import { z } from 'zod';
import type { Pool } from 'pg';
import { RbacService, type ClienteSql } from './rbac.service.js';
import { crearAutenticacionRbac, requirePermission } from '../../middleware/rbac.middleware.js';
import { publicarInvalidacion, type CachePermisos, type ConexionRedis } from '../../redis.js';

export const PERMISO_VER_MATRIZ = 'rol.ver';
export const PERMISO_GESTIONAR_MATRIZ = 'permiso.gestionar';

const esquemaActualizacion = z.object({
  rol_id: z.string().uuid('El campo rol_id debe ser un UUID válido.'),
  codigos_permisos: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Los códigos de permiso no pueden estar vacíos.')
        .regex(
          /^[a-z0-9_]+(\.[a-z0-9_]+)+$/,
          'Formato de código de permiso inválido (se espera dominio.accion).',
        ),
    )
    .max(500, 'Se excedió el máximo de permisos por rol.'),
});

export interface RbacRouterOptions {
  redis?: ConexionRedis;
}

export function crearRbacService(
  db: ClienteSql,
  cache: CachePermisos,
  opciones: RbacRouterOptions = {},
): RbacService {
  const redis = opciones.redis;
  return new RbacService(db, cache, {
    propagarInvalidacion: redis ? (rol_id) => publicarInvalidacion(redis, rol_id) : undefined,
  });
}

export function crearRouterRbac(
  db: Pool | ClienteSql,
  cache: CachePermisos,
  opciones: RbacRouterOptions = {},
): Router {
  const router = Router();
  const servicio = crearRbacService(db, cache, opciones);

  router.use(crearAutenticacionRbac(servicio));

  router.get(
    '/roles-permisos',
    requirePermission(PERMISO_VER_MATRIZ, servicio),
    async (_req, res) => {
      const matriz = await servicio.obtenerMatrizRolesPermisos();
      res.status(200).json({ matriz, total_roles: matriz.length });
    },
  );

  router.put(
    '/roles-permisos',
    requirePermission(PERMISO_GESTIONAR_MATRIZ, servicio),
    async (req, res) => {
      const datos = esquemaActualizacion.parse(req.body);
      const resultado = await servicio.actualizarPermisosDeRol({
        rol_id: datos.rol_id,
        codigos_permisos: datos.codigos_permisos,
      });
      res.status(200).json(resultado);
    },
  );

  return router;
}
