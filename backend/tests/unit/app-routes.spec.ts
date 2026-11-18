import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { construirApp } from '../../src/app.js';
import { crearRouterStorage } from '../../src/core/storage/storage.router.js';

describe('App Routing & Health Verification', () => {
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

  it('GET /api/v1/admin/organigrama/arbol responde adecuadamente con 200', async () => {
    const res = await request(app).get('/api/v1/admin/organigrama/arbol');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/validador/cvd/:codigo responde ante formato CVD', async () => {
    const res = await request(app).get('/api/v1/validador/cvd/CVD-INEXISTENTE-123');
    // Puede responder 404 (no encontrado) o 400 pero no 500
    expect([400, 404]).toContain(res.status);
  });

  it('GET /api/v1/admin/auditoria/bitacora responde con registros paginados', async () => {
    const res = await request(app).get('/api/v1/admin/auditoria/bitacora');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('registros');
  });

  it('GET /api/v1/admin/roles-permisos responde con roles y permisos', async () => {
    const res = await request(app).get('/api/v1/admin/roles-permisos');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('roles');
  });

  it('GET /api/v1/admin/maestras/sede responde con sedes institucionales', async () => {
    const res = await request(app).get('/api/v1/admin/maestras/sede');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sedes');
  });

  it('GET /api/v1/admin/maestras/tipo-documento responde con tipos documentales', async () => {
    const res = await request(app).get('/api/v1/admin/maestras/tipo-documento');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v1/storage/presigned-url responde con error de validacion si faltan datos', async () => {
    const res = await request(app).post('/api/v1/storage/presigned-url').send({});
    expect([400, 422]).toContain(res.status);
  });

  it('firma la URL S3 local para el host del navegador y mantiene el host Docker en llamadas internas', async () => {
    const endpointAnterior = process.env.S3_ENDPOINT;
    process.env.S3_ENDPOINT = 'http://minio:9000';
    try {
      const storageApp = express();
      storageApp.use(express.json());
      storageApp.use(crearRouterStorage(fakePool));
      const body = {
        nombreArchivo: 'solicitud.pdf',
        mimeType: 'application/pdf',
        tamanoBytes: 512,
        checksumSha256: 'a'.repeat(64),
      };

      const browserResponse = await request(storageApp)
        .post('/storage/presigned-url')
        .set('Origin', 'http://localhost:5173')
        .send(body);
      expect(browserResponse.status, browserResponse.text).toBe(200);
      expect(new URL(browserResponse.body.uploadUrl).host).toBe('localhost:9000');
      expect(browserResponse.body.s3Key).toMatch(/^expedientes\/\d{4}\/[0-9a-f-]+\.pdf$/i);

      const internalResponse = await request(storageApp).post('/storage/presigned-url').send(body);
      expect(internalResponse.status).toBe(200);
      expect(new URL(internalResponse.body.uploadUrl).host).toBe('minio:9000');

      const downloadResponse = await request(storageApp)
        .get(`/storage/download/sigd-expedientes/${encodeURIComponent(browserResponse.body.s3Key)}`)
        .set('Origin', 'http://localhost:5174');
      expect(downloadResponse.status).toBe(200);
      const downloadUrl = new URL(downloadResponse.body.downloadUrl);
      expect(downloadUrl.host).toBe('localhost:9000');
      expect(downloadUrl.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
      expect(Object.keys(downloadResponse.body).sort()).toEqual(['downloadUrl', 'expiraEnSegundos']);

      const internalDownload = await request(storageApp)
        .get(`/storage/download/sigd-expedientes/${encodeURIComponent(browserResponse.body.s3Key)}`);
      expect(new URL(internalDownload.body.downloadUrl).host).toBe('minio:9000');
    } finally {
      if (endpointAnterior === undefined) delete process.env.S3_ENDPOINT;
      else process.env.S3_ENDPOINT = endpointAnterior;
    }
  });

  it('GET /api/v1/firmas/cola-firmantes responde protegiendo acceso sin autenticacion', async () => {
    const res = await request(app).get('/api/v1/firmas/cola-firmantes');
    expect([401, 403]).toContain(res.status);
  });
});
