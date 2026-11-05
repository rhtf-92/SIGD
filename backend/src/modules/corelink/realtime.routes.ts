import { Router, type Request, type Response, type NextFunction } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { BusSse, CANALES_SSE, HEARTBEAT_SEGUNDOS, parsearCanales } from './sseStream.service.js';
import { extraerTokenBearer } from '../../core/auth/jwt.service.js';
import { verificarSesionActiva } from '../../core/auth/sesion-activa.js';
import { UnauthorizedError } from '../../shared/domain/errors/index.js';

const esquemaConsulta = z.object({
  canales: z.string().regex(/^[a-z_]+(,[a-z_]+)*$/).optional(),
  lastEventId: z.string().regex(/^\d+$/).optional(),
  token: z.string().min(20).optional(),
});

export interface OpcionesRealtime {
  intervaloRevalidacionSesionMs?: number;
}

const INTERVALO_REVALIDACION_SESION_MS = 15_000;

export function crearRouterRealtime(bus: BusSse, pool: Pool, opciones: OpcionesRealtime = {}): Router {
  const router = Router();

  /**
   * GET /api/v1/realtime/stream — endpoint #55.
   *
   * Autenticación obligatoria: un stream sin identidad verificada permitiría a
   * cualquier cliente anónimo recibir los movimientos de expedientes ajenos. Se
   * acepta `Authorization: Bearer <jwt>` y, por la limitación de la API nativa
   * `EventSource` (no admite cabeceras personalizadas), `?token=<jwt>`; ambas
   * rutas verifican firma y expiración HS256, y el fallo responde 401 en el
   * formato institucional de la plataforma.
   */
  router.get('/stream', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { canales: canalesQuery, lastEventId: lastEventIdQuery } = esquemaConsulta.parse(req.query);
      const bearer = extraerTokenBearer(req.get('authorization'));
      const token = bearer ?? (typeof req.query.token === 'string' ? req.query.token : undefined);
      if (!token) throw new UnauthorizedError({ detail: 'Token de acceso no proporcionado.' });
      const claims = await verificarSesionActiva(pool, token);

      res.status(200).set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store, no-cache, private, no-transform',
        'Referrer-Policy': 'no-referrer',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders?.();

      const canales = parsearCanales(canalesQuery);
      const idSuscripcion = bus.suscribir(res, canales, claims.sub);
      let cerrada = false;
      let validacionEnCurso = false;
      let intervaloSesion: NodeJS.Timeout | undefined;
      const cerrar = () => {
        if (cerrada) return;
        cerrada = true;
        if (intervaloSesion) clearInterval(intervaloSesion);
        bus.cancelar(idSuscripcion);
        if (!res.writableEnded) res.end();
      };

      intervaloSesion = setInterval(() => {
        if (validacionEnCurso || cerrada) return;
        validacionEnCurso = true;
        void verificarSesionActiva(pool, token)
          .then((sesion) => { if (sesion.sub !== claims.sub) cerrar(); })
          .catch(cerrar)
          .finally(() => { validacionEnCurso = false; });
      }, opciones.intervaloRevalidacionSesionMs ?? INTERVALO_REVALIDACION_SESION_MS);
      intervaloSesion.unref?.();

      const ultimoEventoId = req.get('last-event-id') ?? lastEventIdQuery;
      if (ultimoEventoId) {
        const reproducidos = bus.replayDesde(Number(ultimoEventoId), res, new Set(canales), claims.sub);
        res.write(`:replay ${reproducidos.length} evento(s) desde ${ultimoEventoId}\n\n`);
      } else {
        res.write(`:conectado canales=${canales.join(',')} usuario=${claims.sub} via=${bearer ? 'bearer' : 'query'}\n\n`);
      }

      req.on('aborted', cerrar);
      res.on('close', cerrar);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export { CANALES_SSE, HEARTBEAT_SEGUNDOS };
