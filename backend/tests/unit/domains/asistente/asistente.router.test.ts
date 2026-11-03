/**
 * ==============================================================================
 * Pruebas del Router del Asistente Virtual (AsistenteCore)
 * SIGD - IESTP "Suiza"
 * ==============================================================================
 * Cubre:
 * - POST /api/v1/asistente/consulta con mensaje válido (200 y estructura canónica).
 * - Validación del cuerpo (400 con invalidParams, sin 500).
 * - GET /api/v1/asistente/sugerencias.
 * - GET /api/v1/asistente/estado.
 * - Anonimización: la auditoría recibe un hash SHA-256, nunca el texto plano.
 */

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { Pool } from 'pg';
import { construirApp } from '../../../../src/app.js';
import { hashSha256 } from '../../../../src/domains/asistente/asistente.audit.js';

describe('AsistenteCore - Router', () => {
  const fakePool = {
    query: async () => ({ rows: [], rowCount: 0 }),
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {},
    }),
  } as unknown as Pool;

  const app = construirApp(fakePool);

  it('POST /api/v1/asistente/consulta responde 200 con la estructura canónica', async () => {
    const res = await request(app)
      .post('/api/v1/asistente/consulta')
      .send({ mensaje: '¿Cuánto tarda mi trámite?' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('respuesta');
    expect(res.body).toHaveProperty('intencion', 'plazo_sla');
    expect(res.body).toHaveProperty('confianza');
    expect(res.body).toHaveProperty('fuentes');
    expect(res.body).toHaveProperty('sugerencias');
    expect(res.body).toHaveProperty('enlaces');
    expect(Array.isArray(res.body.enlaces)).toBe(true);
    expect(res.body.enlaces).toEqual(
      expect.arrayContaining([expect.objectContaining({ ruta: '/consulta' })]),
    );
    expect(res.body).toHaveProperty('motor', 'faq');
    expect(res.body).toHaveProperty('correlationId');
  });

  it('POST /api/v1/asistente/consulta rechaza mensajes de menos de 3 caracteres con 400', async () => {
    const res = await request(app)
      .post('/api/v1/asistente/consulta')
      .send({ mensaje: 'ab' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('invalid_params');
  });

  it('POST /api/v1/asistente/consulta rechaza cuerpo vacío con 400', async () => {
    const res = await request(app)
      .post('/api/v1/asistente/consulta')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.title).toBe('Validation Error');
  });

  it('registra la consulta en la bitácora con hash anonimizado', async () => {
    const registros: unknown[] = [];
    const fakePoolAuditoria = {
      query: async () => ({ rows: [], rowCount: 0 }),
      connect: async () => ({
        query: async (_sql: string, valores: unknown[]) => {
          registros.push(valores);
          return { rows: [], rowCount: 0 };
        },
        release: () => {},
      }),
    } as unknown as Pool;

    const appConAuditoria = construirApp(fakePoolAuditoria);
    const mensaje = '¿Cómo radico un trámite?';
    const res = await request(appConAuditoria)
      .post('/api/v1/asistente/consulta')
      .send({ mensaje });

    expect(res.status).toBe(200);
    expect(registros).toHaveLength(1);
    const valores = registros[0] as unknown[];
    const datos = JSON.parse(valores[8] as string) as Record<string, string>;
    expect(datos.mensajeHashSha256).toBe(hashSha256(mensaje));
    expect(datos.mensajeHashSha256).not.toContain(mensaje);
  });

  it('GET /api/v1/asistente/sugerencias responde 200 con sugerencias', async () => {
    const res = await request(app).get('/api/v1/asistente/sugerencias');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sugerencias)).toBe(true);
    expect(res.body.sugerencias.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/asistente/estado responde 200 con el motor activo', async () => {
    const res = await request(app).get('/api/v1/asistente/estado');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('UP');
    expect(res.body.motor).toBe('faq');
  });
});
