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
   * `EventSource` (no admite cabeceras personalizadas), `?token=<jwt>`. La query
   * puede quedar expuesta en historial y logs de infraestructura: usar TLS,
   * `no-store`, `no-referrer`, nunca registrar la query y redactar `token` en
   * proxies. La mitigación local y el cambio futuro a tickets SSE se documentan
   * en `docs/00_corelink/seguridad-sse.md`. Ambas rutas verifican firma,
   * vencimiento, sesión persistida y perfil activo.
   */
  router.get('/stream', async (req: Request, res: Response, next: NextFunction) => {
    const { canales: canalesQuery, lastEventId: lastEventIdQuery } = esquemaConsulta.parse(req.query);
    const bearer = extraerTokenBearer(req.get('authorization'));
    const token = bearer ?? (typeof req.query.token === 'string' ? req.query.token : undefined);
    if (!token) throw new UnauthorizedError({ detail: 'Token de acceso no proporcionado.' });
    try {
      const claims = await verificarSesionActiva(pool, token);
      iniciarStream(
        req, res, bus, pool, token, claims.sub, bearer ? 'bearer' : 'query',
        canalesQuery, lastEventIdQuery,
        opciones.intervaloRevalidacionSesionMs ?? INTERVALO_REVALIDACION_SESION_MS,
      );
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
  pool: Pool,
  token: string,
  usuarioId: string,
  via: 'bearer' | 'query',
  canalesQuery: string | undefined,
  lastEventIdQuery: string | undefined,
  intervaloRevalidacionSesionMs: number,
): void {
  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store, no-cache, private, no-transform',
    'Referrer-Policy': 'no-referrer',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const canales = parsearCanales(canalesQuery);
  const idSuscripcion = bus.suscribir(res, canales, usuarioId);
  let cerrada = false;
  let validacionEnCurso = false;
  const cerrar = () => {
    if (cerrada) return;
    cerrada = true;
    clearInterval(intervaloSesion);
    bus.cancelar(idSuscripcion);
    if (!res.writableEnded) res.end();
  };
  const intervaloSesion = setInterval(() => {
    if (validacionEnCurso || cerrada) return;
    validacionEnCurso = true;
    void verificarSesionActiva(pool, token)
      .then((claims) => {
        if (claims.sub !== usuarioId) cerrar();
      })
      .catch(cerrar)
      .finally(() => { validacionEnCurso = false; });
  }, intervaloRevalidacionSesionMs);
  intervaloSesion.unref?.();
  const ultimoEventoId = req.get('last-event-id') ?? lastEventIdQuery;

  if (ultimoEventoId) {
    const reproducidos = bus.replayDesde(Number(ultimoEventoId), res, new Set(canales), usuarioId);
    res.write(`:replay ${reproducidos.length} evento(s) desde ${ultimoEventoId}\n\n`);
  } else {
    res.write(`:conectado canales=${canales.join(',')} usuario=${usuarioId} via=${via}\n\n`);
  }

  // El heartbeat lo emite un único ticker global del proceso (ver server.ts).
  req.on('aborted', cerrar);
  res.on('close', cerrar);
}

export { CANALES_SSE, HEARTBEAT_SEGUNDOS };
