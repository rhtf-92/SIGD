import type { Pool } from 'pg';
import { Router, type Request, type Response } from 'express';
import { sondearDependencias } from '../salud/sonda.service.js';

/**
 * Sondas operativas del plan maestro.
 *
 * `GET /health`  · liveness. Siempre responde 200 mientras el proceso levante:
 *                  una caída de MinIO o Redis no debe reiniciar el pod. Incluye
 *                  el estado de las dependencias para diagnóstico.
 * `GET /ready`   · readiness. Responde 503 si alguna dependencia configurada
 *                  está caída, para retirar la réplica del balanceador.
 */
export function crearRouterSalud(pool: Pool): Router {
  const router = Router();

  router.get('/health', async (_req: Request, res: Response) => {
    const resumen = await sondearDependencias(pool);

    res.json({
      status: 'ok',
      version: process.env.npm_package_version ?? '1.0.0',
      uptime_s: Math.round(process.uptime()),
      dependencias: resumen.dependencias,
    });
  });

  router.get('/ready', async (_req: Request, res: Response) => {
    const resumen = await sondearDependencias(pool);
    const caidas = Object.values(resumen.dependencias).filter((d) => d.estado === 'indisponible');

    res.status(caidas.length > 0 ? 503 : 200).json({
      status: caidas.length > 0 ? 'indisponible' : 'ok',
      version: process.env.npm_package_version ?? '1.0.0',
      uptime_s: Math.round(process.uptime()),
      dependencias: resumen.dependencias,
    });
  });

  return router;
}
