import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';

function app(actor: ActorRutaDoc | null) {
  const pool = { query: async () => { throw new Error('No se esperaba acceso a PostgreSQL'); } } as unknown as Pool;
  return construirApp(pool, { actorProviderRutaDoc: { obtenerActor: () => actor } });
}

describe('endpoints de lectura RutaDoc', () => {
  it.each([
    '/api/v1/expedientes/12/trazabilidad',
    '/api/v1/expedientes/12/foliacion',
    '/api/v1/expedientes/12/sla-status',
    '/api/v1/expedientes/clasificador-ccd',
  ])('responde 401 sin actor autenticado: %s', async (path) => {
    const response = await request(app(null)).get(path);
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  it('deniega el CCD a un actor autenticado fuera de las políticas del módulo', async () => {
    const response = await request(app({ id: '8', roles: ['INVITADO'] })).get('/api/v1/expedientes/clasificador-ccd');
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ status: 403 });
  });

  it('resuelve la ruta CCD estática antes de /expedientes/:id y falla cerrado si no hay catálogo', async () => {
    const response = await request(app({ id: '8', roles: ['SUPER_ADMIN'] })).get('/api/v1/expedientes/clasificador-ccd');
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ status: 503, code: 'CCD_NO_DISPONIBLE' });
  });
});
