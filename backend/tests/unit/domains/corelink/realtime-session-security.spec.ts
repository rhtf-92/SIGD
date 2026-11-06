import express from 'express';
import type { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { crearRouterRealtime } from '../../../../src/modules/corelink/realtime.routes.js';
import { BusSse } from '../../../../src/modules/corelink/sseStream.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

const USER = '11111111-1111-4111-8111-111111111111';

function crearApp(state: { sessionActive: boolean }) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('FROM sigd_auth.sesion_usuario')) return {
      rows: state.sessionActive ? [{ id_usuario: USER, activo: true, revocado_en: null, expira_en: new Date(Date.now() + 60_000) }] : [],
      rowCount: state.sessionActive ? 1 : 0,
    };
    if (sql.includes('FROM sigd_org.usuario_rol')) return { rows: [{ rol_codigo: 'CIUDADANO', permiso_codigo: null }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
  const bus = new BusSse();
  const app = express();
  app.use('/realtime', crearRouterRealtime(bus, { query } as unknown as Pool, { intervaloRevalidacionSesionMs: 10 }));
  app.use(errorMiddleware);
  return { app, bus, query };
}

describe('seguridad de sesión SSE', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rechaza streams sin JWT de acceso', async () => {
    const { app } = crearApp({ sessionActive: true });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No se pudo obtener el puerto de prueba.');
      const response = await fetch(`http://127.0.0.1:${address.port}/realtime/stream`);
      expect(response.status).toBe(401);
    } finally {
      server.close();
    }
  });

  it('cierra un stream cuando la sesión se revoca y envía cabeceras privadas', async () => {
    const state = { sessionActive: true };
    const { app, bus, query } = crearApp(state);
    const server = app.listen(0);
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No se pudo obtener el puerto de prueba.');
      const token = firmarTokenAcceso({ sub: USER, sid: `${USER}-session-token`, roles: ['ESTUDIANTE'] });
      const response = await fetch(`http://127.0.0.1:${address.port}/realtime/stream?token=${token}`, { signal: controller.signal });
      reader = response.body?.getReader();
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
      const connected = await reader?.read();
      expect(new TextDecoder().decode(connected?.value)).toContain(':conectado');
      expect(bus.cantidadSuscriptores()).toBe(1);

      state.sessionActive = false;
      const closed = await reader?.read();
      expect(closed?.done).toBe(true);
      expect(bus.cantidadSuscriptores()).toBe(0);
      expect(query.mock.calls.filter(([sql]) => String(sql).includes('sesion_usuario')).length).toBeGreaterThan(1);
    } finally {
      controller.abort();
      await reader?.cancel().catch(() => undefined);
      server.close();
    }
  });
});
