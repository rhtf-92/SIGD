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

export function crearRouterRealtime(bus: BusSse, pool: Pool): Router {
  const router = Router();

  /**
   * GET /api/v1/realtime/stream — endpoint #55.
   *
   * Autenticación obligatoria: un stream sin identidad verificada permitiría a
   * cualquier cliente anónimo recibir los movimientos de expedientes ajenos. Se
   * acepta `Authorization: Bearer <jwt>` y, por la limitación de la API nativa
   * `EventSource` (no admite cabeceras personalizadas), `?token=<jwt>`; ambas
   * rutas verifican firma, vencimiento, sesión persistida y perfil activo.
   */
  router.get('/stream', async (req: Request, res: Response, next: NextFunction) => {
    const { canales: canalesQuery, lastEventId: lastEventIdQuery } = esquemaConsulta.parse(req.query);
    const bearer = extraerTokenBearer(req.get('authorization'));
    const token = bearer ?? (typeof req.query.token === 'string' ? req.query.token : undefined);
    if (!token) throw new UnauthorizedError({ detail: 'Token de acceso no proporcionado.' });
    try {
      const claims = await verificarSesionActiva(pool, token);
      iniciarStream(req, res, bus, claims.sub, bearer ? 'bearer' : 'query', canalesQuery, lastEventIdQuery);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function iniciarStream(
  req: Request,
  res: Response,
  bus: BusSse,
  usuarioId: string,
  via: 'bearer' | 'query',
  canalesQuery: string | undefined,
  lastEventIdQuery: string | undefined,
): void {
  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const canales = parsearCanales(canalesQuery);
  const idSuscripcion = bus.suscribir(res, canales, usuarioId);
  const ultimoEventoId = req.get('last-event-id') ?? lastEventIdQuery;

  if (ultimoEventoId) {
    const reproducidos = bus.replayDesde(Number(ultimoEventoId), res, new Set(canales), usuarioId);
    res.write(`:replay ${reproducidos.length} evento(s) desde ${ultimoEventoId}\n\n`);
  } else {
    res.write(`:conectado canales=${canales.join(',')} usuario=${usuarioId} via=${via}\n\n`);
  }

  // El heartbeat lo emite un único ticker global del proceso (ver server.ts).
  req.on('close', () => bus.cancelar(idSuscripcion));
  res.on('close', () => bus.cancelar(idSuscripcion));
}

export { CANALES_SSE, HEARTBEAT_SEGUNDOS };
