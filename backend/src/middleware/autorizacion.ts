/**
 * Autenticación y autorización por permiso para las rutas de administración.
 *
 * Reutiliza la infraestructura que el proyecto YA tiene, sin duplicarla:
 *   - `UnauthorizedError` (401) y `ForbiddenError` (403) de
 *     `src/shared/domain/errors/index.js`, renderizadas por `errorMiddleware`
 *     como RFC 7807 (`code`, `type`, `title`, `detail`, `instance`,
 *     `correlation_id`).
 *   - `setUsuarioId` de `src/shared/request-context/request-context.js`, que ya
 *     alimenta el `usuario_id` del `RequestContext` (AsyncLocalStorage) y, por
 *     tanto, la bitácora WORM y el outbox.
 *   - Las cabeceras que ya usa `src/referencia/expediente.router.ts`:
 *     `x-auth` (credencial) y `x-usuario-id` (cuenta).
 *
 * Sobre `Authorization: Bearer`: el cliente web (`src/api/client.ts`) inyecta un
 * Bearer, mientras que las rutas de referencia leen `x-auth`. Ambas convenciones
 * ya existen en el proyecto, así que se aceptan las dos en lugar de elegir una y
 * dejar la otra rota.
 *
 * LÍMITE CONOCIDO DE ESTA CAPA: se valida la *presencia* de una credencial, no
 * su veracidad criptográfica, porque el proyecto todavía no tiene un emisor de
 * tokens (JWT) ni servicio de sesión en el backend: `sigd_auth.sesion_usuario`
 * sólo almacena `token_refresh` y ningún código lo emite o verifica. Por tanto
 * la confianza en la identidad depende de que quien termina en este proceso
 * (gateway inverso o servicio de identidad) haya validado la credencial. Ese
 * acoplamiento está documentado como pendiente; lo que sí se garantiza aquí, y
 * es lo que protege el calendario laboral, es que la decisión de autorización se
 * toma contra el RBAC de la base de datos y no contra lo que afirme el cliente.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Pool } from 'pg';

import { tienePermiso } from '../domains/organicore/autorizacion.repository.js';
import {
  ForbiddenError,
  UnauthorizedError,
} from '../shared/domain/errors/index.js';
import { setUsuarioId } from '../shared/request-context/request-context.js';

/** Cabecera de credencial usada por las rutas de referencia del proyecto. */
export const HEADER_CREDENCIAL = 'x-auth';
/** Cabecera con la cuenta del usuario, ya leída en `expediente.router.ts`. */
export const HEADER_CUENTA = 'x-usuario-id';
/** Cabecera estándar que inyecta el cliente web. */
export const HEADER_AUTORIZACION = 'authorization';

/**
 * Permiso que exige `POST /api/v1/admin/calendario-laboral/feriado-excepcional`.
 *
 * `CALENDARIO_LABORAL_GESTIONAR` sigue la convención de
 * `permiso_sistema.codigo` (UPPER_SNAKE, `VARCHAR(100) UNIQUE`). Se siembra en
 * `docs/02_organicore/11_esquema_calendario_laboral.sql` junto con el rol
 * `ADMIN_CALENDARIO_LABORAL` que lo otorga.
 */
export const PERMISO_GESTIONAR_CALENDARIO_LABORAL = 'CALENDARIO_LABORAL_GESTIONAR';

const REGEX_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Extrae la credencial de la petición, o `null` si no hay ninguna. */
export function credencialDe(req: Request): string | null {
  const directa = req.get(HEADER_CREDENCIAL);
  if (directa && directa.trim() !== '') {
    return directa.trim();
  }

  const portador = req.get(HEADER_AUTORIZACION);
  if (portador) {
    const coincidencia = /^Bearer\s+(.+)$/i.exec(portador.trim());
    if (coincidencia && coincidencia[1].trim() !== '') {
      return coincidencia[1].trim();
    }
  }

  return null;
}

/** Cuenta declarada en la petición, si viene y tiene forma de UUID. */
export function cuentaDe(req: Request): string | null {
  const declarada = req.get(HEADER_CUENTA);
  if (!declarada) {
    return null;
  }
  const normalizada = declarada.trim().toLowerCase();
  return REGEX_UUID.test(normalizada) ? normalizada : null;
}

/**
 * Exige que la petición llegue autenticada. Sin credencial responde 401.
 *
 * Publica la cuenta en el `RequestContext` para que la auditoría WORM y el
 * outbox registren quién realizó la operación.
 */
export function autenticar(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!credencialDe(req)) {
      throw new UnauthorizedError({
        detail:
          'La operación requiere autenticación. Envíe la credencial en la cabecera ' +
          `"${HEADER_CREDENCIAL}" o en "${HEADER_AUTORIZACION}: Bearer <token>".`,
      });
    }

    const cuenta = cuentaDe(req);
    if (cuenta) {
      setUsuarioId(cuenta);
    }

    next();
  };
}

/**
 * Exige que la cuenta autenticada tenga concedido el permiso indicado en el
 * RBAC. Autenticado pero sin permiso responde 403.
 *
 * Si no se declara cuenta no hay sujeto contra el que resolver el permiso, así
 * que se deniega: nunca se concede acceso por ausencia de identidad.
 */
export function exigirPermiso(pool: Pool, codigoPermiso: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const cuenta = cuentaDe(req);

    if (!cuenta) {
      next(
        new ForbiddenError({
          detail:
            `No se pudo determinar la cuenta del usuario, por lo que no puede ` +
            `acreditarse el permiso '${codigoPermiso}'.`,
        }),
      );
      return;
    }

    void tienePermiso(pool, cuenta, codigoPermiso)
      .then((concedido) => {
        if (!concedido) {
          next(
            new ForbiddenError({
              detail: `La cuenta no tiene el permiso '${codigoPermiso}'.`,
            }),
          );
          return;
        }
        setUsuarioId(cuenta);
        next();
      })
      .catch(next);
  };
}
