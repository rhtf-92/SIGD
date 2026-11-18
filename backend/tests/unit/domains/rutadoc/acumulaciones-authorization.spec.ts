import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

describe('SEC-01: Control de Acceso y Autorización en Acumulaciones (Art. 160 LPAG)', () => {
  const ID_EXPEDIENTE_AUTORIZADO = '11111111-1111-4111-8111-111111111111';
  const ID_EXPEDIENTE_AJENO = '99999999-9999-4999-8999-999999999999';

  const tokenCiudadano = firmarTokenAcceso({
    sub: 'user-ciudadano-1',
    roles: ['CIUDADANO'],
  });

  const mockActorProvider = {
    obtenerActor: vi.fn(async () => ({
      id: 'user-ciudadano-1',
      roles: ['CIUDADANO'],
      unidadOrganicaId: null,
      puedeVerExpediente: vi.fn(async (idExpediente: string) => {
        return idExpediente === ID_EXPEDIENTE_AUTORIZADO;
      }),
    })),
  };

  const fakePool = {
    query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    connect: vi.fn(async () => ({
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
      release: vi.fn(),
    })),
  } as unknown as Pool;

  const app = construirApp(fakePool, {
    actorProviderRutaDoc: mockActorProvider,
  });

  it('GET /api/v1/expedientes/:id/acumulaciones responde 403 Forbidden si el actor no tiene permiso para ver el expediente', async () => {
    const res = await request(app)
      .get(`/api/v1/expedientes/${ID_EXPEDIENTE_AJENO}/acumulaciones`)
      .set('Authorization', `Bearer ${tokenCiudadano}`);

    expect(res.status).toBe(403);
    expect(res.body.detail).toContain('No tiene autorización');
  });

  it('GET /api/v1/expedientes/:id/acumulaciones responde 200 OK si el actor tiene autorización sobre el expediente', async () => {
    const res = await request(app)
      .get(`/api/v1/expedientes/${ID_EXPEDIENTE_AUTORIZADO}/acumulaciones`)
      .set('Authorization', `Bearer ${tokenCiudadano}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.acumulaciones)).toBe(true);
  });

  it('POST /api/v1/expedientes/:id/acumular responde 403 si el actor no tiene autorización sobre el expediente principal', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE_AJENO}/acumular`)
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        expedienteAccesorioId: ID_EXPEDIENTE_AUTORIZADO,
        actoResolutivo: 'Resolución Directoral 001',
      });

    expect(res.status).toBe(403);
    expect(res.body.detail).toContain('principal');
  });

  it('POST /api/v1/expedientes/:id/acumular responde 403 si el actor no tiene autorización sobre el expediente accesorio', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE_AUTORIZADO}/acumular`)
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        expedienteAccesorioId: ID_EXPEDIENTE_AJENO,
        actoResolutivo: 'Resolución Directoral 001',
      });

    expect(res.status).toBe(403);
    expect(res.body.detail).toContain('accesorio');
  });
});
