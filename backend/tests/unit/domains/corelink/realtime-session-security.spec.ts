import express from 'express';
import request from 'supertest';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { crearRouterRealtime } from '../../../../src/modules/corelink/realtime.routes.js';
import { BusSse } from '../../../../src/modules/corelink/sseStream.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

const USUARIO = '11111111-1111-4111-8111-111111111111';

describe('sesión SSE', () => {
  it('rechaza la apertura de un stream si no se presenta credencial', async () => {
    const query = vi.fn();
    const app = express();
    app.use('/realtime', crearRouterRealtime(new BusSse(), { query } as unknown as Pool));
    app.use(errorMiddleware);

    const respuesta = await request(app).get('/realtime/stream?canales=casilla');

    expect(respuesta.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('cierra una conexión ya abierta al revocarse su sesión', async () => {
    let revocada = false;
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.sesion_usuario')) {
        return { rows: [{
          id_usuario: USUARIO,
          expira_en: new Date(Date.now() + 60_000),
          revocado_en: revocada ? new Date() : null,
          activo: true,
        }], rowCount: 1 };
      }
      if (sql.includes('FROM sigd_org.usuario_rol')) {
        return { rows: [{ rol_codigo: 'CIUDADANO', permiso_codigo: null }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const app = express();
    app.use('/realtime', crearRouterRealtime(new BusSse(), { query } as unknown as Pool, {
      intervaloRevalidacionSesionMs: 100,
    }));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
      res.status(status).end();
    });

    const jwt = firmarTokenAcceso({ sub: USUARIO, sid: `${USUARIO}-session`, roles: ['ESTUDIANTE'] });
    const respuestaPendiente = request(app)
      .get(`/realtime/stream?token=${encodeURIComponent(jwt)}&canales=casilla`)
      .buffer(true)
      .parse((respuesta, callback) => {
        const chunks: Buffer[] = [];
        respuesta.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        respuesta.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    const respuestaPromesa = respuestaPendiente.then((respuesta) => respuesta);

    await vi.waitFor(() => expect(query.mock.calls.length).toBeGreaterThanOrEqual(2));
    revocada = true;
    const respuesta = await respuestaPromesa;

    expect(respuesta.status).toBe(200);
    expect(query.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(respuesta.headers['cache-control']).toContain('no-store');
    expect(respuesta.headers['referrer-policy']).toBe('no-referrer');
  });
});
