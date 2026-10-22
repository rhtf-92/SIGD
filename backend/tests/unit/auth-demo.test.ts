import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getJwtSecret } from '../../src/config/jwt.js';
import { createApiRoutes } from '../../src/routes/index.js';

const originalJwtSecret = process.env.JWT_SECRET;
const originalNodeEnv = process.env.NODE_ENV;

beforeAll(() => {
  process.env.JWT_SECRET = 'demo-test-jwt-secret-that-is-at-least-32-characters';
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
  process.env.NODE_ENV = 'test';
});

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRoutes());
  return app;
}

describe('demo authentication routes', () => {
  it('authenticates a test user and returns a signed JWT without the password hash', async () => {
    const response = await request(createTestApp())
      .post('/api/auth/login')
      .send({ identificador: 'admin.demo', password: 'AdminDemo2026!' });

    expect(response.status).toBe(200);
    expect(response.body.usuario.rol).toBe('SUPER_ADMIN');
    expect(response.body.usuario).not.toHaveProperty('passwordHash');
    expect(jwt.verify(response.body.accessToken, getJwtSecret())).toMatchObject({
      sub: 'demo-admin',
      rol: 'SUPER_ADMIN',
    });
  });

  it('rejects invalid credentials with a generic response', async () => {
    const response = await request(createTestApp())
      .post('/api/auth/login')
      .send({ identificador: 'admin.demo', password: 'incorrecta' });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Usuario o contraseña incorrectos.');
  });

  it('authenticates the clider admin account (free-text username)', async () => {
    const response = await request(createTestApp())
      .post('/api/auth/login')
      .send({ identificador: 'clider', password: '123456789' });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.usuario.rol).toBe('SUPER_ADMIN');
    expect(response.body.usuario.id).toBe('clider');
    expect(jwt.verify(response.body.accessToken, getJwtSecret())).toMatchObject({
      sub: 'clider',
      rol: 'SUPER_ADMIN',
    });
  });

  it('authenticates the clider account by email as well', async () => {
    const response = await request(createTestApp())
      .post('/api/auth/login')
      .send({
        identificador: 'clider@iestp-suiza.edu.pe',
        password: '123456789',
      });

    expect(response.status).toBe(200);
    expect(response.body.usuario.rol).toBe('SUPER_ADMIN');
  });


  it('authenticates the student account by email', async () => {
    const response = await request(createTestApp())
      .post('/api/auth/login')
      .send({ identificador: 'estudiante.demo@iestp-suiza.edu.pe', password: 'EstudianteDemo2026!' });

    expect(response.status).toBe(200);
    expect(response.body.usuario.rol).toBe('ESTUDIANTE');
  });

  it('allows access to the protected profile with a valid token', async () => {
    const app = createTestApp();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ identificador: 'mesa.demo', password: 'MesaDemo2026!' });

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'demo-mesa-partes', role: 'MESA_PARTES' });
  });

  it('rejects profile requests without a bearer token', async () => {
    const response = await request(createTestApp()).get('/api/auth/me');

    expect(response.status).toBe(401);
  });

  it('does not expose demo auth routes in production', async () => {
    process.env.NODE_ENV = 'production';
    const response = await request(createTestApp())
      .post('/api/auth/login')
      .send({ identificador: 'admin.demo', password: 'AdminDemo2026!' });
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    expect(response.status).toBe(404);
  });
});
