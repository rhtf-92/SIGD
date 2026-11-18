import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Pool } from 'pg';
import { crearRouterDocuCore } from '../../../../src/domains/docucore/docucore.router.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

function crearApp(): { app: express.Express; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn();
  const pool = { query, connect: vi.fn() } as unknown as Pool;
  const app = express();
  app.use(express.json());
  app.use(crearRouterDocuCore(pool));
  app.use(errorMiddleware);
  return { app, query };
}

describe('router DocuCore original y ausencia de rutas TUPA añadidas', () => {
  it('no monta la ruta administrativa de versiones TUPA', async () => {
    const { app, query } = crearApp();
    const response = await request(app).get('/v1/admin/tupa-versiones');

    expect(response.status).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });

  it('no monta la ruta administrativa de conceptos TUPA', async () => {
    const { app, query } = crearApp();
    const response = await request(app)
      .get('/v1/admin/tupa-versiones/5fb0f914-a828-4950-9a0c-7925e3e03f47/conceptos');

    expect(response.status).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });

  it('conserva la ruta original de validación CVD y su validación de entrada', async () => {
    const { app, query } = crearApp();
    const response = await request(app).get('/v1/validador-cvd/verificar/no-valido');

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('conserva la ruta original de foliación y rechaza entrada inválida antes de acceder a datos', async () => {
    const { app, query } = crearApp();
    const response = await request(app)
      .post('/v1/expedientes/expediente-existente/foliar-documento')
      .send({});

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});
