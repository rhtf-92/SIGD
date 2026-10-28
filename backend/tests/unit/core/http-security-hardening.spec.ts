import request from 'supertest';
import type { Pool } from 'pg';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { construirApp } from '../../../src/app.js';
import { loginRateLimiter } from '../../../src/middleware/rate-limiter.middleware.js';

describe('SEC-09, SEC-10 & DOC-01: Hardening HTTP, Rate Limiting and Firma Fail-Closed', () => {
  beforeEach(() => {
    loginRateLimiter.reset();
  });

  const fakePool = {
    query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    connect: vi.fn(async () => ({
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
      release: vi.fn(),
    })),
  } as unknown as Pool;

  it('SEC-09: aplica cabeceras defensivas HTTP (nosniff, DENY, Referrer-Policy, sin X-Powered-By)', async () => {
    const app = construirApp(fakePool);

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('SEC-10: bloquea con 429 Too Many Requests tras 5 intentos fallidos en login', async () => {
    const app = construirApp(fakePool);

    // Ejecutar 5 intentos sucesivos
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ identificador: 'usuario.ataque', password: 'passwordIncorrecta1' });
      // Las primeras 5 peticiones deben ser procesadas por el router (ej. 401 Unauthorized)
      expect(res.status).toBe(401);
    }

    // El 6to intento debe ser bloqueado por el Rate Limiter con 429
    const blockedRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identificador: 'usuario.ataque', password: 'passwordIncorrecta1' });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers).toHaveProperty('retry-after');
    expect(blockedRes.body).toMatchObject({
      type: 'https://datatracker.ietf.org/doc/html/rfc9457',
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
    });
  });

  it('DOC-01: en produccion (NODE_ENV=production), falla cerrado si REDIS_URL no esta disponible', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalRedis = process.env.REDIS_URL;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.REDIS_URL;

      expect(() => construirApp(fakePool)).toThrowError(/REDIS_REQUIRED_IN_PRODUCTION/);
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalRedis) process.env.REDIS_URL = originalRedis;
    }
  });
});
