import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { crearRouterTramites } from '../../../../src/domains/tramicore/tramites.controller.js';
import { radicacionVirtualSchema } from '../../../../src/domains/tramicore/tramites.schemas.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

const USUARIO_A = '5c1f97ed-3933-4be6-bfbe-50fbeb5dfa9e';
const PERSONA_A = '917c9a70-af8f-47d4-8292-913c763dfc45';
const PERSONA_B = '6d338460-985d-4e69-a8ce-c3f50ac0779d';
const SECRETO_TEST = 'test-only-radicacion-jwt-secret-32-bytes';

describe('radicación virtual: identidad autenticada', () => {
  it('rechaza dos nombres distintos con el mismo PDF antes de crear el expediente', () => {
    const documento = { nombreArchivo: 'solicitud.pdf', contentType: 'application/pdf', tamanoBytes: 100,
      hashSha256: 'a'.repeat(64) };
    const parsed = radicacionVirtualSchema.safeParse({ asunto: 'Solicitud con duplicados', idPersona: PERSONA_A,
      nombreSolicitante: 'Prueba Documental', correo: 'prueba@example.test', totalFolios: 1,
      documentos: [documento, { ...documento, nombreArchivo: 'copia.pdf' }] });
    expect(parsed.success).toBe(false);
  });
  const previousSecret = process.env.AUTH_JWT_SECRET;
  let query: ReturnType<typeof vi.fn>;
  let app: express.Express;

  beforeEach(() => {
    process.env.AUTH_JWT_SECRET = SECRETO_TEST;
    query = vi.fn().mockResolvedValue({ rows: [{ id_persona: PERSONA_A, activo: true }] });
    app = express();
    app.use(express.json());
    app.use('/api/v1', crearRouterTramites({ query } as unknown as Pool));
    app.use(errorMiddleware);
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.AUTH_JWT_SECRET;
    else process.env.AUTH_JWT_SECRET = previousSecret;
  });

  it('rechaza sin JWT antes de tocar PostgreSQL', async () => {
    const response = await request(app).post('/api/v1/tramites/radicacion-virtual').send({ idPersona: PERSONA_A });
    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('rechaza un token falsificado antes de tocar PostgreSQL', async () => {
    const response = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .set('Authorization', 'Bearer invalid.token.signature')
      .send({ idPersona: PERSONA_A });
    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('impide que el usuario A indique la persona B como propietaria', async () => {
    const token = firmarTokenAcceso({ sub: USUARIO_A, roles: ['CIUDADANO'] });
    const response = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .set('Authorization', `Bearer ${token}`)
      .send({ idPersona: PERSONA_B });
    expect(response.status).toBe(403);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rechaza ventanilla presencial sin JWT', async () => {
    const response = await request(app).post('/api/v1/tramites/ventanilla-presencial').send({});
    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('rechaza al ciudadano aunque envíe un JWT válido', async () => {
    query.mockResolvedValueOnce({ rows: [{ permitido: false }] });
    const token = firmarTokenAcceso({ sub: USUARIO_A, roles: ['CIUDADANO'] });
    const response = await request(app).post('/api/v1/tramites/ventanilla-presencial')
      .set('Authorization', `Bearer ${token}`).send({});
    expect(response.status).toBe(403);
  });

  it('deja pasar al rol vigente de Mesa de Partes hasta la validación del formulario', async () => {
    query.mockResolvedValueOnce({ rows: [{ permitido: true }] });
    const token = firmarTokenAcceso({ sub: USUARIO_A, roles: ['MESA_PARTES'] });
    const response = await request(app).post('/api/v1/tramites/ventanilla-presencial')
      .set('Authorization', `Bearer ${token}`).send({});
    expect(response.status).toBe(400);
    expect(query.mock.calls[0][0]).toContain('sigd_org.usuario_rol');
  });
});
