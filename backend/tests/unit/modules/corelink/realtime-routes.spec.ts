import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { type Express } from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { BusSse, CANALES_SSE, parsearCanales } from '../../../../src/modules/corelink/sseStream.service.js';
import { crearRouterRealtime } from '../../../../src/modules/corelink/realtime.routes.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

describe('CoreLink · SSE Bus y Router Realtime', () => {
  const secretoPrueba = 'secreto_super_seguro_para_pruebas_unitarias_32_chars';
  let bus: BusSse;
  let app: Express;
  let server: http.Server;
  let serverPort: number;
  let tokenValido: string;

  beforeEach(async () => {
    process.env.AUTH_JWT_SECRET = secretoPrueba;
    bus = new BusSse(10);
    app = express();
    app.use('/api/v1/realtime', crearRouterRealtime(bus));
    app.use(errorMiddleware);

    tokenValido = firmarTokenAcceso({
      sub: '8edd52f9-f13f-4304-8840-169f6559d396',
      roles: ['CIUDADANO'],
      secreto: secretoPrueba,
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        serverPort = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    bus.cerrarTodos();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('BusSse (Enrutador de eventos en memoria)', () => {
    it('1. Gestiona altas y bajas de suscriptores', () => {
      const mockRes = { write: vi.fn(), writableEnded: false } as unknown as express.Response;
      const id1 = bus.suscribir(mockRes, ['casilla']);
      expect(bus.cantidadSuscriptores()).toBe(1);

      bus.cancelar(id1);
      expect(bus.cantidadSuscriptores()).toBe(0);
    });

    it('2. Filtra eventos según los canales suscritos', () => {
      const resCasilla = { write: vi.fn(), writableEnded: false } as unknown as express.Response;
      const resSla = { write: vi.fn(), writableEnded: false } as unknown as express.Response;

      bus.suscribir(resCasilla, ['casilla']);
      bus.suscribir(resSla, ['sla']);

      bus.emitirEvento('casilla_notificacion', { id: 101 });

      expect(resCasilla.write).toHaveBeenCalledWith(expect.stringContaining('event: casilla_notificacion'));
      expect(resSla.write).not.toHaveBeenCalled();
    });

    it('3. Bufferiza y reproduce eventos para reconexión con replayDesde', () => {
      bus.emitirEvento('casilla_notificacion', { cut: 'EXP-1' });
      bus.emitirEvento('casilla_notificacion', { cut: 'EXP-2' });

      const resReplay = { write: vi.fn(), writableEnded: false } as unknown as express.Response;
      const reproducidos = bus.replayDesde(1, resReplay, new Set(['casilla']));

      expect(reproducidos).toEqual([2]);
      expect(resReplay.write).toHaveBeenCalledWith(expect.stringContaining('EXP-2'));
    });

    it('4. Emite trama de heartbeat a todos los suscriptores', () => {
      const res = { write: vi.fn(), writableEnded: false } as unknown as express.Response;
      bus.suscribir(res, CANALES_SSE);

      bus.emitirHeartbeat();

      expect(res.write).toHaveBeenCalledWith(expect.stringContaining(':heartbeat'));
    });

    it('5. Cierra todas las conexiones limpiamente en cerrarTodos', () => {
      const res = { end: vi.fn(), writableEnded: false } as unknown as express.Response;
      bus.suscribir(res, CANALES_SSE);

      bus.cerrarTodos();

      expect(res.end).toHaveBeenCalledOnce();
      expect(bus.cantidadSuscriptores()).toBe(0);
    });

    it('6. parsearCanales normaliza la entrada por comas o usa todos por defecto', () => {
      expect(parsearCanales('casilla,sla')).toEqual(['casilla', 'sla']);
      expect(parsearCanales('')).toEqual(CANALES_SSE);
      expect(parsearCanales(undefined)).toEqual(CANALES_SSE);
    });
  });

  describe('crearRouterRealtime (Endpoint HTTP GET /stream)', () => {
    it('1. Rechaza peticiones sin autenticación con 401', async () => {
      const res = await new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
        http.get(`http://127.0.0.1:${serverPort}/api/v1/realtime/stream`, (r) => {
          let data = '';
          r.on('data', (c) => (data += c));
          r.on('end', () => resolve({ status: r.statusCode ?? 500, body: JSON.parse(data) }));
        }).on('error', reject);
      });

      expect(res.status).toBe(401);
      expect(res.body.code || res.body.codigo).toBe('UNAUTHORIZED');
    });

    it('2. Acepta autenticación vía ?token= en query para clientes EventSource', async () => {
      const res = await new Promise<{ status: number; headers: http.IncomingHttpHeaders; firstChunk: string }>(
        (resolve, reject) => {
          const req = http.get(
            `http://127.0.0.1:${serverPort}/api/v1/realtime/stream?canales=casilla&token=${tokenValido}`,
            (r) => {
              r.on('data', (chunk) => {
                req.destroy();
                resolve({
                  status: r.statusCode ?? 0,
                  headers: r.headers,
                  firstChunk: chunk.toString(),
                });
              });
            },
          );
          req.on('error', (err) => {
            if ((err as { code?: string }).code === 'ECONNRESET') return;
            reject(err);
          });
        },
      );

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.headers['cache-control']).toContain('no-cache');
      expect(res.firstChunk).toContain(':conectado canales=casilla');
    });

    it('3. Acepta autenticación vía cabecera Authorization: Bearer', async () => {
      const res = await new Promise<{ status: number; headers: http.IncomingHttpHeaders; firstChunk: string }>(
        (resolve, reject) => {
          const req = http.get(
            `http://127.0.0.1:${serverPort}/api/v1/realtime/stream?canales=casilla`,
            { headers: { Authorization: `Bearer ${tokenValido}` } },
            (r) => {
              r.on('data', (chunk) => {
                req.destroy();
                resolve({
                  status: r.statusCode ?? 0,
                  headers: r.headers,
                  firstChunk: chunk.toString(),
                });
              });
            },
          );
          req.on('error', (err) => {
            if ((err as { code?: string }).code === 'ECONNRESET') return;
            reject(err);
          });
        },
      );

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.firstChunk).toContain('via=bearer');
    });
  });
});
