import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';
import { crearRouterTramites } from '../../../../src/domains/tramicore/tramites.controller.js';
import { VentanillaPresencialService, type ResultadoVentanilla } from '../../../../src/domains/tramicore/ventanillaPresencial.service.js';

// MT55: claves y datos exclusivamente unitarios; no hay conexión a PostgreSQL.
const secretoPrueba = 'mt55-clave-exclusivamente-unitaria-con-mas-de-32-caracteres';
const ruta = '/api/v1/tramites/ventanilla-presencial';
const datos = {
  tipoPersona: 'NATURAL', tipoDocumento: 'DNI', dniSolicitante: '00000000',
  nombres: 'Persona', apellidos: 'Ficticia', correo: 'unitario@example.test',
  telefono: '000000000', asunto: 'Solicitud exclusivamente unitaria', foliosTotales: 2,
  tipoDocumentalId: '10000000-0000-4000-8000-000000000001',
};
const resultadoDoble: ResultadoVentanilla = {
  expedienteId: '20000000-0000-4000-8000-000000000002', cut: 'EXP-2026-000001',
  anioFiscal: 2026, fechaRadicacion: '2026-10-11T15:00:00.000Z',
  ticketImpresion: 'Texto exclusivo del doble de prueba',
  cargo: {
    cut: 'EXP-2026-000001', remitente: 'Persona Ficticia', dni: datos.dniSolicitante,
    asunto: datos.asunto, folios: 2, fechaRecepcion: '2026-10-11T15:00:00.000Z',
    hashSha256: 'a'.repeat(64), qrSeguimientoUrl: '/consulta/EXP-2026-000001',
  },
};

function token(roles = ['MESA_PARTES'], expiraSegundos = 900, secreto = secretoPrueba) {
  return firmarTokenAcceso({ sub: 'operador-unitario', roles, expiraSegundos, secreto });
}

function crearApp() {
  const query = vi.fn();
  const connect = vi.fn();
  const registro = vi.spyOn(VentanillaPresencialService.prototype, 'registrarExpedienteVentanilla')
    .mockResolvedValue(resultadoDoble);
  const app = express();
  app.use(express.json());
  app.use('/api/v1', crearRouterTramites({ query, connect } as unknown as Pool));
  app.use(errorMiddleware);
  return { app, query, connect, registro };
}

describe('Ventanilla · autorización del registro presencial', () => {
  beforeEach(() => vi.stubEnv('AUTH_JWT_SECRET', secretoPrueba));
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it('mantiene payload validado y respuesta 201 para un JWT MESA_PARTES válido', async () => {
    const { app, registro, query, connect } = crearApp();
    const res = await request(app).post(ruta).set('Authorization', `Bearer ${token()}`)
      .send({ ...datos, nombres: ' Persona ', foliosTotales: '2' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(resultadoDoble);
    expect(registro).toHaveBeenCalledExactlyOnceWith(datos);
    expect(query).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it.each([
    { caso: 'sin credenciales', authorization: undefined },
    { caso: 'JWT mal formado', authorization: 'Bearer token-invalido' },
    { caso: 'esquema incorrecto', authorization: 'Basic token-invalido' },
    { caso: 'ingreso de demostración', authorization: 'Bearer demo-unitario-sin-firma' },
  ])('responde 401 ($caso) antes de validar el payload o llamar al servicio', async ({ authorization }) => {
    const { app, registro, query, connect } = crearApp();
    const req = request(app).post(ruta).send({});
    if (authorization) req.set('Authorization', authorization);
    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(registro).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it.each([
    { caso: 'JWT expirado', credencial: () => token(['MESA_PARTES'], -60) },
    { caso: 'firma inválida', credencial: () => token(['MESA_PARTES'], 900, 'otra-clave-unitaria-de-mas-de-32-caracteres') },
  ])('responde 401 ($caso) sin actividad de base de datos', async ({ credencial }) => {
    const { app, registro, query, connect } = crearApp();
    const res = await request(app).post(ruta).set('Authorization', `Bearer ${credencial()}`).send(datos);
    expect(res.status).toBe(401);
    expect(registro).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it.each([{ roles: ['CIUDADANO'] }, { roles: ['DIRECTOR'] }, { roles: [] }])(
    'responde 403 a un JWT válido sin MESA_PARTES ($roles) antes de procesar el registro', async ({ roles }) => {
      const { app, registro, query, connect } = crearApp();
      const res = await request(app).post(ruta).set('Authorization', `Bearer ${token(roles)}`).send({});
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ status: 403, code: 'FORBIDDEN' });
      expect(registro).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
    },
  );

  it('no acepta JWT en URL ni identidad por cabecera como alternativas al Bearer', async () => {
    vi.stubEnv('ALLOW_HEADER_IDENTITY', 'true');
    const { app, registro, query, connect } = crearApp();
    const res = await request(app).post(ruta).query({ token: token() })
      .set('x-usuario-id', 'operador-unitario').send(datos);
    expect(res.status).toBe(401);
    expect(registro).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it('conserva las validaciones del payload para un operador autenticado', async () => {
    const { app, registro, query, connect } = crearApp();
    const res = await request(app).post(ruta).set('Authorization', `Bearer ${token()}`)
      .send({ ...datos, foliosTotales: 0 });
    expect(res.status).toBe(400);
    expect(registro).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });
});
