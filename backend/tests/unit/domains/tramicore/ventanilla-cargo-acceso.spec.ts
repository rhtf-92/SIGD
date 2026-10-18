import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';
import { crearRouterTramites } from '../../../../src/domains/tramicore/tramites.controller.js';
import { ConsultaPublicaService } from '../../../../src/domains/tramicore/consultaPublica.service.js';

// MT53: JWT reales de prueba y consultas con dobles; no se utiliza PostgreSQL.
const secretoPrueba = 'mt53-secreto-unitario-exclusivo-de-pruebas-32-caracteres';
const ruta = '/api/v1/tramites/ventanilla/cargo/EXP-2026-000001';
const asientoDoble = {
  cut: 'EXP-2026-000001', remitente: 'Solicitante ficticio',
  remitente_documento: '00000000', asunto: 'Asunto del doble',
  folios: 2, fecha_asiento: new Date('2026-10-11T15:00:00.000Z'),
};

function crearApp(query = vi.fn(async (_sql: string, _params: unknown[]) => ({ rows: [asientoDoble] }))) {
  const app = express();
  app.use('/api/v1', crearRouterTramites({ query } as unknown as Pool));
  app.use(errorMiddleware);
  return { app, query };
}

function token(roles: string[] = ['MESA_PARTES'], expiraSegundos = 900) {
  return firmarTokenAcceso({ sub: 'operador-unitario', roles, expiraSegundos, secreto: secretoPrueba });
}

describe('Ventanilla · autorización de recuperación del cargo', () => {
  beforeEach(() => vi.stubEnv('AUTH_JWT_SECRET', secretoPrueba));
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('permite a MESA_PARTES con JWT Bearer válido llegar a la consulta existente', async () => {
    const { app, query } = crearApp();
    const res = await request(app).get(ruta).set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cut: asientoDoble.cut, dni: asientoDoble.remitente_documento, folios: 2 });
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][1]).toEqual([asientoDoble.cut]);
    // El doble ejercita la autorización; no acredita compatibilidad del SQL con V2.
  });

  it.each([
    ['sin credenciales', undefined],
    ['JWT mal formado', 'Bearer token-invalido'],
    ['esquema incorrecto', 'Basic token-invalido'],
  ])('devuelve 401 %s sin consultar el cargo', async (_caso, authorization) => {
    const { app, query } = crearApp();
    const req = request(app).get(ruta);
    if (authorization) req.set('Authorization', authorization);
    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(query).not.toHaveBeenCalled();
    expect(res.body).not.toHaveProperty('dni');
  });

  it('rechaza con 401 un JWT firmado con otra clave', async () => {
    const { app, query } = crearApp();
    const falso = firmarTokenAcceso({ sub: 'operador-unitario', roles: ['MESA_PARTES'], secreto: 'otra-clave-unitaria-de-al-menos-32-caracteres' });
    const res = await request(app).get(ruta).set('Authorization', `Bearer ${falso}`);
    expect(res.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('rechaza con 401 un JWT expirado', async () => {
    const { app, query } = crearApp();
    const res = await request(app).get(ruta).set('Authorization', `Bearer ${token(['MESA_PARTES'], -60)}`);
    expect(res.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it.each([{ roles: ['CIUDADANO'] }, { roles: [] }])('devuelve 403 a un JWT válido sin el rol MESA_PARTES ($roles)', async ({ roles }) => {
    const { app, query } = crearApp();
    const res = await request(app).get(ruta).set('Authorization', `Bearer ${token(roles)}`);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(query).not.toHaveBeenCalled();
    expect(res.body).not.toHaveProperty('dni');
  });

  it('no admite identidad por cabecera ni JWT en URL como sustitutos del Bearer', async () => {
    vi.stubEnv('ALLOW_HEADER_IDENTITY', 'true');
    const { app, query } = crearApp();
    const res = await request(app).get(ruta).query({ token: token() }).set('x-usuario-id', 'operador-unitario');
    expect(res.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('propaga el error SQL para personal autorizado sin simular recuperación', async () => {
    const query = vi.fn(async (_sql: string, _params: unknown[]): Promise<{ rows: typeof asientoDoble[] }> => {
      throw Object.assign(new Error('Fallo SQL sintético del doble'), { code: '42703' });
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { app } = crearApp(query);
    const res = await request(app).get(ruta).set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(500);
    expect(query).toHaveBeenCalledOnce();
    expect(res.body).not.toHaveProperty('ticketTermicoTexto');
  });

  it('mantiene accesible la consulta pública por CUT sin credenciales', async () => {
    const consulta = vi.spyOn(ConsultaPublicaService.prototype, 'consultarPorCut').mockResolvedValue({
      cut: asientoDoble.cut, anioFiscal: 2026, estadoTramite: 'RECEPCIONADO', tipoTramite: null,
      asunto: 'Asunto del doble público', fechaEnvioReal: asientoDoble.fecha_asiento.toISOString(),
      fechaRadicacionLegal: asientoDoble.fecha_asiento.toISOString(), fueraDeHorario: false,
      canalRecepcion: 'MESA_PRESENCIAL', totalFolios: 2,
      administrado: { documentoEnmascarado: '00***000', nombreEnmascarado: 'S**********' },
      documentos: [], proveidos: [], mensajeLegal: 'Texto unitario',
    });
    const { app, query } = crearApp();
    const res = await request(app).get(`/api/v1/tramites/consulta-publica/${asientoDoble.cut}`);
    expect(res.status).toBe(200);
    expect(consulta).toHaveBeenCalledWith({ cut: asientoDoble.cut });
    expect(query).not.toHaveBeenCalled();
  });
});
