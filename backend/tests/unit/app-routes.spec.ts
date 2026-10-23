import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Pool } from 'pg';
import { construirApp } from '../../src/app.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';

describe('App Routing & Health Verification', () => {
  const tokenAdmin = firmarTokenAcceso({
    sub: '11111111-1111-1111-1111-111111111111',
    roles: ['ADMINISTRADOR'],
    expiraSegundos: 300,
  });

  const fakePool = {
    query: async () => ({ rows: [], rowCount: 0 }),
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {},
    }),
  } as unknown as Pool;

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

  it('GET /api/v1/admin/organigrama/arbol responde adecuadamente con 200 con token admin', async () => {
    const res = await request(app)
      .get('/api/v1/admin/organigrama/arbol')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/validador/cvd/:codigo responde ante formato CVD', async () => {
    const res = await request(app).get('/api/v1/validador/cvd/CVD-INEXISTENTE-123');
    // Puede responder 404 (no encontrado) o 400 pero no 500
    expect([400, 404]).toContain(res.status);
  });

  it('GET /api/v1/admin/auditoria/bitacora responde con registros paginados con token admin', async () => {
    const res = await request(app)
      .get('/api/v1/admin/auditoria/bitacora')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('registros');
  });

  it('GET /api/v1/admin/roles-permisos responde con roles y permisos con token admin', async () => {
    const res = await request(app)
      .get('/api/v1/admin/roles-permisos')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('roles');
  });

  it('GET /api/v1/admin/maestras/sede responde con sedes institucionales con token admin', async () => {
    const res = await request(app)
      .get('/api/v1/admin/maestras/sede')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sedes');
  });

  it('GET /api/v1/admin/maestras/tipo-documento responde con tipos documentales con token admin', async () => {
    const res = await request(app)
      .get('/api/v1/admin/maestras/tipo-documento')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v1/storage/presigned-url responde con error de validacion si faltan datos', async () => {
    const res = await request(app).post('/api/v1/storage/presigned-url').send({});
    expect([400, 401, 422]).toContain(res.status);
  });

  it('GET /api/v1/firmas/cola-firmantes responde protegiendo acceso sin autenticacion', async () => {
    const res = await request(app).get('/api/v1/firmas/cola-firmantes');
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/v1/admin/calendarizacion-institucional responde 200 con las 23 actividades de 2026', async () => {
    const res = await request(app)
      .get('/api/v1/admin/calendarizacion-institucional')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(23);
    expect(Array.isArray(res.body.actividades)).toBe(true);
    expect(res.body.fuente.nombre).toBe('Calendarización Institucional 2026');
    expect(res.body.fuente.anio).toBe(2026);
  });

  it('GET /api/v1/admin/calendarizacion-institucional/actividades/1 responde con la actividad 1', async () => {
    const res = await request(app)
      .get('/api/v1/admin/calendarizacion-institucional/actividades/1')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.numero).toBe(1);
    expect(res.body.actividad).toBe('Reincorporación, Traslados Internos y Externos');
  });

  it('GET /api/v1/admin/calendarizacion-institucional/actividades/999 responde 404', async () => {
    const res = await request(app)
      .get('/api/v1/admin/calendarizacion-institucional/actividades/999')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(404);
  });
});
