import express from 'express';
import request from 'supertest';
import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearRouterAuth } from '../../../../src/domains/identicore/auth.router.js';
import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

const USUARIO_A = '11111111-1111-4111-8111-111111111111';
const PERSONA_A = '22222222-2222-4222-8222-222222222222';
const PERSONA_B = '33333333-3333-4333-8333-333333333333';
const secretoAnterior = process.env.AUTH_JWT_SECRET;

type Estado = { usuario: string; correo: string; telefono: string | null; direccion: string | null };

function servidor(estado: Estado, opciones: { usernameOcupado?: boolean; correoOcupado?: boolean; rol?: boolean; tipo?: 'NATURAL' | 'JURIDICA' } = {}) {
  const consultas: Array<{ sql: string; params?: unknown[] }> = [];
  const queryClient = vi.fn(async (sql: string, params?: unknown[]) => {
    consultas.push({ sql, params });
    if (sql.includes('SELECT c.id_persona, c.usuario')) return { rows: [{
      id_persona: PERSONA_A, usuario: estado.usuario, correo: estado.correo,
      id_documento: '12345678', tipo: opciones.tipo ?? 'NATURAL', activo: true, es_ciudadano: opciones.rol ?? true,
    }] };
    if (sql.includes('SELECT c.password_hash')) return { rows: [{
      activo: true, es_ciudadano: true, password_hash: Argon2Service.generateFallbackHash('ClaveAnterior123!'),
    }] };
    if (sql.includes('SELECT 1 FROM sigd_auth.cuenta_usuario')) {
      return { rows: [], rowCount: sql.includes('lower(usuario)') ? Number(opciones.usernameOcupado) : Number(opciones.correoOcupado) };
    }
    if (sql.includes('SET usuario =')) estado.usuario = String(params?.[0]);
    if (sql.includes('SET correo =')) estado.correo = String(params?.[0]);
    if (sql.includes('SET telefono =')) estado.telefono = String(params?.[0]);
    if (sql.includes('SET direccion =')) estado.direccion = String(params?.[0]);
    return { rows: [], rowCount: 1 };
  });
  const pool = { connect: vi.fn().mockResolvedValue({ query: queryClient, release: vi.fn() }),
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      consultas.push({ sql, params });
      if (sql.includes('FROM sigd_auth.cuenta_usuario c')) {
        if (sql.includes('c.password_hash') &&
            ![estado.usuario, estado.correo].includes(String(params?.[0]))) return { rows: [] };
        return { rows: [{
        id_usuario: USUARIO_A, id_persona: PERSONA_A, usuario: estado.usuario,
        correo: estado.correo, numero_documento: '12345678', tipo_documento: 'DNI',
        nombres: 'Ana', apellidos: 'Pérez', nombre_completo: 'Ana Pérez',
        telefono: estado.telefono, direccion: estado.direccion, rol_codigo: 'CIUDADANO',
        password_hash: Argon2Service.generateFallbackHash('ClaveAnterior123!'), activo: true,
      }] };
      }
      return { rows: [], rowCount: 1 };
    }),
  } as unknown as Pool;
  const app = express();
  app.use(express.json());
  app.use('/api/v1', crearRouterAuth(pool));
  app.use(errorMiddleware);
  const token = firmarTokenAcceso({ sub: USUARIO_A, roles: ['CIUDADANO'] });
  return { app, token, consultas, queryClient };
}

beforeEach(() => { process.env.AUTH_JWT_SECRET = 'test-only-perfil-ciudadano-secret-32-bytes'; });
afterEach(() => {
  if (secretoAnterior === undefined) delete process.env.AUTH_JWT_SECRET;
  else process.env.AUTH_JWT_SECRET = secretoAnterior;
  vi.restoreAllMocks();
});

describe('perfil ciudadano y compatibilidad legacy', () => {
  it('permite login por correo con usuario legacy autogenerado', async () => {
    const { app } = servidor({ usuario: '12345678', correo: 'ana@example.test', telefono: null, direccion: null });
    const response = await request(app).post('/api/v1/auth/login')
      .send({ identificador: 'ana@example.test', password: 'ClaveAnterior123!' });
    expect(response.status).toBe(200);
  });

  it('marca como no configurado el username autogenerado y conserva el login por correo', async () => {
    const { app, token } = servidor({ usuario: '12345678', correo: 'ana@example.test', telefono: null, direccion: null });
    const response = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ usernameConfigurado: false, username: '12345678', correo: 'ana@example.test' });
  });

  it('agrega username opcional una vez y actualiza correo, teléfono y dirección propios', async () => {
    const estado = { usuario: '12345678', correo: 'ana@example.test', telefono: null, direccion: null };
    const { app, token, consultas } = servidor(estado);
    const response = await request(app).patch('/api/v1/auth/me').set('Authorization', `Bearer ${token}`)
      .send({ username: '  Ana.Perez  ', correo: 'NUEVO@example.test', telefono: '987654321', direccion: 'Av. Central 123' });
    expect(response.status).toBe(204);
    expect(estado).toEqual({ usuario: 'ana.perez', correo: 'nuevo@example.test', telefono: '987654321', direccion: 'Av. Central 123' });
    expect(consultas.find((c) => c.sql.includes('SET usuario ='))?.params).toEqual(['ana.perez', USUARIO_A]);
    expect(consultas.find((c) => c.sql.includes('SET direccion ='))?.params?.[1]).toBe(PERSONA_A);
    expect(consultas.some((c) => c.sql === 'COMMIT')).toBe(true);
    const perfil = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(perfil.body).toMatchObject({ usernameConfigurado: true, telefono: '987654321', direccion: 'Av. Central 123' });
    for (const identificador of ['ana.perez', 'nuevo@example.test']) {
      const login = await request(app).post('/api/v1/auth/login')
        .send({ identificador, password: 'ClaveAnterior123!' });
      expect(login.status).toBe(200);
    }
  });

  it('rechaza username duplicado y revierte la transacción', async () => {
    const { app, token, consultas } = servidor({ usuario: '12345678', correo: 'ana@example.test', telefono: null, direccion: null }, { usernameOcupado: true });
    const response = await request(app).patch('/api/v1/auth/me').set('Authorization', `Bearer ${token}`)
      .send({ username: 'ocupado.test' });
    expect(response.status).toBe(409);
    expect(response.body.detail).toBe('Este nombre de usuario ya está en uso.');
    expect(consultas.some((c) => c.sql === 'ROLLBACK')).toBe(true);
  });

  it('no permite cambiar un username ya configurado', async () => {
    const { app, token } = servidor({ usuario: 'ana.perez', correo: 'ana@example.test', telefono: null, direccion: null });
    const response = await request(app).patch('/api/v1/auth/me').set('Authorization', `Bearer ${token}`)
      .send({ username: 'otro.nombre' });
    expect(response.status).toBe(409);
  });

  it('no considera configurado volver a elegir el documento legacy', async () => {
    const { app, token } = servidor({ usuario: '12345678', correo: 'ana@example.test', telefono: null, direccion: null });
    const response = await request(app).patch('/api/v1/auth/me').set('Authorization', `Bearer ${token}`)
      .send({ username: '12345678' });
    expect(response.status).toBe(400);
  });

  it('rechaza correo duplicado', async () => {
    const { app, token } = servidor({ usuario: '12345678', correo: 'ana@example.test', telefono: null, direccion: null }, { correoOcupado: true });
    const response = await request(app).patch('/api/v1/auth/me').set('Authorization', `Bearer ${token}`)
      .send({ correo: 'usado@example.test' });
    expect(response.status).toBe(409);
  });

  it('guarda teléfono y dirección de persona jurídica en sus tablas actuales', async () => {
    const { app, token, consultas } = servidor(
      { usuario: '20131312955', correo: 'empresa@example.test', telefono: null, direccion: null },
      { tipo: 'JURIDICA' },
    );
    const response = await request(app).patch('/api/v1/auth/me').set('Authorization', `Bearer ${token}`)
      .send({ telefono: '912345678', direccion: 'Av. Empresa 100' });
    expect(response.status).toBe(204);
    expect(consultas.some((c) => c.sql.includes('INSERT INTO sigd_auth.perfil_usuario'))).toBe(true);
    expect(consultas.some((c) => c.sql.includes('UPDATE sigd_auth.persona_juridica SET direccion'))).toBe(true);
  });

  it('no acepta personaId de otra cuenta ni edición de identidad legal', async () => {
    const { app, token, queryClient } = servidor({ usuario: '12345678', correo: 'ana@example.test', telefono: null, direccion: null });
    const response = await request(app).patch('/api/v1/auth/me').set('Authorization', `Bearer ${token}`)
      .send({ personaId: PERSONA_B, nombres: 'Otra persona', correo: 'otro@example.test' });
    expect(response.status).toBe(400);
    expect(queryClient).not.toHaveBeenCalled();
  });

  it.each([
    ['tipoDocumento', 'CE'],
    ['numeroDocumento', '87654321'],
    ['nombres', 'Nombre cambiado'],
    ['apellidos', 'Apellido cambiado'],
    ['personaId', PERSONA_B],
  ])('rechaza %s en PATCH /auth/me aunque también se envíe contacto válido', async (campo, valor) => {
    const { app, token, queryClient } = servidor({ usuario: '12345678', correo: 'ana@example.test', telefono: null, direccion: null });
    const response = await request(app).patch('/api/v1/auth/me').set('Authorization', `Bearer ${token}`)
      .send({ [campo]: valor, telefono: '987654321' });
    expect(response.status).toBe(400);
    expect(queryClient).not.toHaveBeenCalled();
  });

  it('requiere sesión y rol ciudadano', async () => {
    const { app, token } = servidor({ usuario: '12345678', correo: 'ana@example.test', telefono: null, direccion: null }, { rol: false });
    expect((await request(app).patch('/api/v1/auth/me').send({ telefono: '987654321' })).status).toBe(401);
    expect((await request(app).patch('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).send({ telefono: '987654321' })).status).toBe(403);
  });

  it('verifica la contraseña anterior, actualiza hash y revoca sesiones', async () => {
    vi.spyOn(Argon2Service, 'hash').mockResolvedValue('$argon2id$test');
    const { app, token, consultas } = servidor({ usuario: 'ana.perez', correo: 'ana@example.test', telefono: null, direccion: null });
    const response = await request(app).patch('/api/v1/auth/me/password').set('Authorization', `Bearer ${token}`)
      .send({ passwordActual: 'ClaveAnterior123!', passwordNueva: 'NuevaClave123!', confirmarPassword: 'NuevaClave123!' });
    expect(response.status).toBe(204);
    expect(consultas.some((c) => c.sql.includes('SET password_hash ='))).toBe(true);
    expect(consultas.some((c) => c.sql.includes('UPDATE sigd_auth.sesion_usuario SET revocado_en'))).toBe(true);
  });

  it('no cambia contraseña ni sesiones si la clave actual falla', async () => {
    const { app, token, consultas } = servidor({ usuario: 'ana.perez', correo: 'ana@example.test', telefono: null, direccion: null });
    const response = await request(app).patch('/api/v1/auth/me/password').set('Authorization', `Bearer ${token}`)
      .send({ passwordActual: 'incorrecta', passwordNueva: 'NuevaClave123!', confirmarPassword: 'NuevaClave123!' });
    expect(response.status).toBe(400);
    expect(consultas.some((c) => c.sql.includes('SET password_hash ='))).toBe(false);
    expect(consultas.some((c) => c.sql === 'ROLLBACK')).toBe(true);
  });
});
