import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { BusSse, CANALES_SSE, HEARTBEAT_SEGUNDOS, parsearCanales } from './sseStream.service.js';
import { resolverIdentidad } from '../../core/auth/auth.guard.js';

const esquemaConsulta = z.object({
  canales: z.string().regex(/^[a-z_]+(,[a-z_]+)*$/).optional(),
  lastEventId: z.string().regex(/^\d+$/).optional(),
  token: z.string().min(20).optional(),
});

export function crearRouterRealtime(bus: BusSse): Router {
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
  router.get('/stream', (req: Request, res: Response, next: NextFunction) => {
    const { canales: canalesQuery, lastEventId: lastEventIdQuery } = esquemaConsulta.parse(req.query);
    const identidad = resolverIdentidad(req);

    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    const canales = parsearCanales(canalesQuery);
    const idSuscripcion = bus.suscribir(res, canales);

    const cabecera = req.get('last-event-id');
    const ultimoEventoId = cabecera ?? lastEventIdQuery;

    if (ultimoEventoId) {
      const reproducidos = bus.replayDesde(Number(ultimoEventoId), res, new Set(canales));
      res.write(`:replay ${reproducidos.length} evento(s) desde ${ultimoEventoId}\n\n`);
    } else {
      res.write(
        `:conectado canales=${canales.join(',')} usuario=${identidad.idUsuario} via=${identidad.via}\n\n`,
      );
    }

    // El heartbeat lo emite un único ticker global del proceso (ver server.ts):
    // un temporizador por conexión multiplicaría las tramas por el número de
    // suscriptores y saturaría el proxy de balanceo.
    req.on('close', () => bus.cancelar(idSuscripcion));
    res.on('close', () => bus.cancelar(idSuscripcion));
  });

  return router;
}

export { CANALES_SSE, HEARTBEAT_SEGUNDOS };
