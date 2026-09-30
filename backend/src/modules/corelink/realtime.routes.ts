import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { BusSse, CANALES_SSE, HEARTBEAT_SEGUNDOS, parsearCanales } from './sseStream.service.js';

const esquemaConsulta = z.object({
  canales: z.string().regex(/^[a-z_]+(,[a-z_]+)*$/).optional(),
  lastEventId: z.string().regex(/^\d+$/).optional(),
});

export function crearRouterRealtime(bus: BusSse): Router {
  const router = Router();

  router.get('/stream', (req: Request, res: Response) => {
    const { canales: canalesQuery, lastEventId: lastEventIdQuery } = esquemaConsulta.parse(req.query);

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
      res.write(`:conectado canales=${canales.join(',')}\n\n`);
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
