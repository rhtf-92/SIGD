/**
 * Alias del entregable `src/middlewares/rbac.middleware.ts`.
 *
 * La implementación vive en `src/middleware/` (singular), que es el directorio real
 * del proyecto junto a `context-middleware.ts` y `error-middleware.ts`. Este módulo
 * solo reexporta para respetar la ruta del plan de trabajo sin duplicar codigo:
 * cualquier cambio debe hacerse en el singular.
 */
export {
  USUARIO_HEADER,
  actorDe,
  conectarActor,
  crearAutenticacionRbac,
  requirePermission,
  type ActorAutenticado,
  type RequestConActor,
} from '../middleware/rbac.middleware.js';
