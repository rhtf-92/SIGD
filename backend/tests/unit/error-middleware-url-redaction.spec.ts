import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorMiddleware } from '../../src/middleware/error-middleware.js';

describe('redacción de tokens SSE en errores HTTP', () => {
  afterEach(() => vi.restoreAllMocks());

  it('omite la query privada de la URL tanto del log como de la respuesta', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = express();
    app.get('/api/v1/realtime/stream', () => { throw new Error('fallo interno'); });
    app.use(errorMiddleware);

    const response = await request(app).get('/api/v1/realtime/stream?token=jwt-secreto&canales=casilla');

    expect(response.status).toBe(500);
    expect(response.body.instance).toBe('/api/v1/realtime/stream');
    expect(JSON.stringify(response.body)).not.toContain('jwt-secreto');
    expect(errorLog.mock.calls.flat().join(' ')).not.toContain('jwt-secreto');
    expect(errorLog.mock.calls.flat().join(' ')).not.toContain('?token=');
  });
});
