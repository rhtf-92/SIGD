import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Pool } from 'pg';
import { construirApp } from '../../src/app.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';

describe('App Routing & Health Verification', () => {
  const fakePool = {
    query: async () => ({ rows: [], rowCount: 0 }),
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {},
    }),
  } as unknown as Pool;

  const adminToken = firmarTokenAcceso({
    sub: '00000000-0000-4000-8000-000000000001',
    roles: ['ADMINISTRADOR'],
  });
  const app = construirApp(fakePool);

  it('GET /health responde 200 con estado UP', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('UP');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /ready responde 200 con estado READY', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('READY');
  });

  it('POST /api/v1/auth/login responde con error de validacion estructurado si falta body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({});
    // No debe lanzar un 500 fatal de ruta no encontrada ni de sintaxis
    expect([400, 422]).toContain(res.status);
    expect(res.body).toHaveProperty('title');
  });

  it('GET /api/v1/admin/organigrama/arbol responde adecuadamente con 200', async () => {
    const res = await request(app)
      .get('/api/v1/admin/organigrama/arbol')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/validador/cvd/:codigo responde ante formato CVD', async () => {
    const res = await request(app).get('/api/v1/validador/cvd/CVD-INEXISTENTE-123');
    // Puede responder 404 (no encontrado) o 400 pero no 500
    expect([400, 404]).toContain(res.status);
  });

  it('GET /api/v1/admin/auditoria/bitacora responde con registros paginados', async () => {
    const res = await request(app)
      .get('/api/v1/admin/auditoria/bitacora')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('registros');
  });

  it('GET /api/v1/admin/roles-permisos responde con roles y permisos', async () => {
    const res = await request(app)
      .get('/api/v1/admin/roles-permisos')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('roles');
  });

  it('GET /api/v1/admin/maestras/sede responde con sedes institucionales', async () => {
    const res = await request(app)
      .get('/api/v1/admin/maestras/sede')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sedes');
  });

  it('GET /api/v1/admin/maestras/tipo-documento responde con tipos documentales', async () => {
    const res = await request(app)
      .get('/api/v1/admin/maestras/tipo-documento')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/admin/maestras/sede rechaza solicitudes sin JWT con 401', async () => {
    const res = await request(app)
      .get('/api/v1/admin/maestras/sede')
      .set('x-auth', 'simulado')
      .set('x-rol', 'admin')
      .set('x-usuario-id', '00000000-0000-4000-8000-000000000001');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/admin/maestras/sede rechaza JWT válido sin permiso con 403', async () => {
    const token = firmarTokenAcceso({
      sub: '00000000-0000-4000-8000-000000000002',
      roles: ['ESTUDIANTE'],
    });
    const res = await request(app)
      .get('/api/v1/admin/maestras/sede')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/v1/admin/maestras/sede permite JWT autorizado con 200', async () => {
    const res = await request(app)
      .get('/api/v1/admin/maestras/sede')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sedes');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('no monta el router de referencia ni acepta cabeceras simuladas fuera de test', async () => {
    const nodeEnvOriginal = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const appProductivo = construirApp(fakePool);
      const referencia = await request(appProductivo)
        .get('/api/protegido')
        .set('x-auth', 'simulado');
      const admin = await request(appProductivo)
        .get('/api/v1/admin/maestras/sede')
        .set('x-auth', 'simulado')
        .set('x-rol', 'admin')
        .set('x-usuario-id', '00000000-0000-4000-8000-000000000001');

      expect(referencia.status).toBe(404);
      expect(admin.status).toBe(401);
    } finally {
      if (nodeEnvOriginal === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = nodeEnvOriginal;
    }
  });

  it('limita intentos en login, refresh y registro ciudadano', async () => {
    const appConLimites = construirApp(fakePool);
    const endpointsLimitados = [
      { ruta: '/api/v1/auth/login', maximo: 10 },
      { ruta: '/api/v1/auth/refresh', maximo: 20 },
      { ruta: '/api/v1/auth/registro-ciudadano', maximo: 5 },
    ];

    for (const endpoint of endpointsLimitados) {
      const respuestas = await Promise.all(
        Array.from({ length: endpoint.maximo + 1 }, () =>
          request(appConLimites).post(endpoint.ruta).send({}),
        ),
      );
      expect(respuestas.some((respuesta) => respuesta.status === 429)).toBe(true);
    }
  });

  it('POST /api/v1/storage/presigned-url exige autenticacion antes de validar el cuerpo', async () => {
    const res = await request(app).post('/api/v1/storage/presigned-url').send({});
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/firmas/cola-firmantes responde protegiendo acceso sin autenticacion', async () => {
    const res = await request(app).get('/api/v1/firmas/cola-firmantes');
    expect([401, 403]).toContain(res.status);
  });
});
