import request from 'supertest';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

describe('Auth Router — Schema Alignment & Database Interactions', () => {
  const hashValido = Argon2Service.generateFallbackHash('PasswordValida123!');

  it('POST /api/v1/auth/login ejecuta query alineada a 02_sigd_auth y 03_sigd_org', async () => {
    let capturedQuery = '';
    let capturedParams: any[] = [];
    let sessionInsertExecuted = false;
    let sessionInsertParams: any[] = [];

    const fakePool = {
      query: vi.fn(async (queryText: string, params?: any[]) => {
        if (queryText.includes('FROM sigd_auth.cuenta_usuario')) {
          capturedQuery = queryText;
          capturedParams = params ?? [];
          return {
            rows: [
              {
                id_usuario: '11111111-1111-1111-1111-111111111111',
                id_persona: '22222222-2222-2222-2222-222222222222',
                usuario: 'admin.institucional',
                correo: 'admin@iestp-suiza.edu.pe',
                password_hash: hashValido,
                activo: true,
                nombre_completo: 'Administrador General',
                rol_codigo: 'ADMINISTRADOR',
                area_id: '33333333-3333-3333-3333-333333333333',
              },
            ],
            rowCount: 1,
          };
        }
        if (queryText.includes('INSERT INTO sigd_auth.sesion_usuario')) {
          sessionInsertExecuted = true;
          sessionInsertParams = params ?? [];
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      connect: vi.fn(async () => ({
        query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
        release: vi.fn(),
      })),
    } as unknown as Pool;

    const app = construirApp(fakePool);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identificador: 'admin.institucional',
        password: 'PasswordValida123!',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.usuario).toMatchObject({
      id: '11111111-1111-1111-1111-111111111111',
      idPersona: '22222222-2222-2222-2222-222222222222',
      nombreCompleto: 'Administrador General',
      correo: 'admin@iestp-suiza.edu.pe',
      rol: 'ADMINISTRADOR',
      areaId: '33333333-3333-3333-3333-333333333333',
    });

    // Validar alineación exacta de columnas en el SQL capturado
    expect(capturedQuery).toContain('c.usuario');
    expect(capturedQuery).toContain('c.correo');
    expect(capturedQuery).not.toContain('c.username');
    expect(capturedQuery).not.toContain('c.correo_institucional');
    expect(capturedQuery).not.toContain('bloqueado_hasta');
    expect(capturedQuery).toContain('(ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())');
    expect(capturedQuery).toContain('r.rol_id = ur.rol_id');
    expect(capturedQuery).toContain('COALESCE(ur.area_id, p.area_id) AS area_id');
    expect(capturedQuery).not.toContain('r.id_rol');
    expect(capturedQuery).not.toContain('ur.estado');
    expect(capturedQuery).toContain('(c.usuario = $1 OR c.correo = $1)');
    expect(capturedQuery).toContain("WHEN 'ADMINISTRADOR' THEN 1");
    expect(capturedQuery).toContain("WHEN 'CIUDADANO' THEN 6");
    expect(sessionInsertExecuted).toBe(true);

    // SEC-05: El token persistido en DB NUNCA es texto plano, sino su hash SHA-256 (64 hex chars)
    const rawRefreshToken = res.body.refreshToken;
    const storedHash = sessionInsertParams[1];
    expect(storedHash).not.toBe(rawRefreshToken);
    expect(storedHash).toHaveLength(64);
  });

  it('POST /api/v1/auth/login propaga error 500 si falla la insercion de sesion (no swallow)', async () => {
    const fakePool = {
      query: vi.fn(async (queryText: string) => {
        if (queryText.includes('FROM sigd_auth.cuenta_usuario')) {
          return {
            rows: [
              {
                id_usuario: '11111111-1111-1111-1111-111111111111',
                usuario: 'admin.institucional',
                correo: 'admin@iestp-suiza.edu.pe',
                password_hash: hashValido,
                activo: true,
                nombre_completo: 'Admin',
                rol_codigo: 'ADMINISTRADOR',
              },
            ],
            rowCount: 1,
          };
        }
        if (queryText.includes('INSERT INTO sigd_auth.sesion_usuario')) {
          throw new Error('violacion de llave foranea o base de datos inaccesible');
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    const app = construirApp(fakePool);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identificador: 'admin.institucional',
        password: 'PasswordValida123!',
      });

    // No debe tragar el error con 200
    expect(res.status).toBe(500);
  });

  it('POST /api/v1/auth/refresh ejecuta query alineada a rol_id y vigente_hasta bajo transaccion atomica con FOR UPDATE (SEC-07)', async () => {
    let capturedQuery = '';
    const executedQueries: string[] = [];
    const expiraEn = new Date(Date.now() + 3600 * 1000).toISOString();

    const fakeClient = {
      query: vi.fn(async (queryText: string, params?: any[]) => {
        executedQueries.push(queryText);
        if (queryText.includes('FROM sigd_auth.sesion_usuario s')) {
          capturedQuery = queryText;
          return {
            rows: [
              {
                id_usuario: '11111111-1111-1111-1111-111111111111',
                expira_en: expiraEn,
                revocado_en: null,
                rol_codigo: 'ADMINISTRADOR',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };

    const fakePool = {
      query: vi.fn(),
      connect: vi.fn(async () => fakeClient),
    } as unknown as Pool;

    const app = construirApp(fakePool);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'abcdef1234567890abcdef1234567890' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');

    expect(capturedQuery).toContain('(ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())');
    expect(capturedQuery).toContain('r.rol_id = ur.rol_id');
    expect(capturedQuery).toContain('FOR UPDATE OF s');
    expect(capturedQuery).not.toContain('ur.estado');
    expect(capturedQuery).not.toContain('r.id_rol');

    // Validar aislamiento transaccional atómico
    expect(executedQueries).toContain('BEGIN');
    expect(executedQueries).toContain('COMMIT');
    expect(fakeClient.release).toHaveBeenCalled();
  });

  it('GET /api/v1/auth/me retorna usuario con correo y usuario alineados', async () => {
    let capturedQuery = '';
    const token = firmarTokenAcceso({
      sub: '11111111-1111-1111-1111-111111111111',
      roles: ['ADMINISTRADOR'],
      expiraSegundos: 300,
    });

    const fakePool = {
      query: vi.fn(async (queryText: string) => {
        if (queryText.includes('FROM sigd_auth.cuenta_usuario c')) {
          capturedQuery = queryText;
          return {
            rows: [
              {
                id_usuario: '11111111-1111-1111-1111-111111111111',
                id_persona: '22222222-2222-2222-2222-222222222222',
                usuario: 'admin.institucional',
                correo: 'admin@iestp-suiza.edu.pe',
                nombre_completo: 'Administrador General',
                rol_codigo: 'ADMINISTRADOR',
                area_id: '33333333-3333-3333-3333-333333333333',
                cargo_id: null,
                telefono: '987654321',
                tipo_documento: 'DNI',
                numero_documento: '12345678',
                nombres: 'Administrador',
                apellidos: 'General',
                direccion: 'Av. Institucional 100',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    const app = construirApp(fakePool);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: '11111111-1111-1111-1111-111111111111',
      usuario: 'admin.institucional',
      correo: 'admin@iestp-suiza.edu.pe',
      nombreCompleto: 'Administrador General',
      rol: 'ADMINISTRADOR',
      areaId: '33333333-3333-3333-3333-333333333333',
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
      nombres: 'Administrador',
      apellidos: 'General',
      telefono: '987654321',
      direccion: 'Av. Institucional 100',
    });

    expect(capturedQuery).toContain('c.usuario');
    expect(capturedQuery).toContain('c.correo');
    expect(capturedQuery).toContain('JOIN sigd_auth.persona pers');
    expect(capturedQuery).toContain('pers.id_documento AS numero_documento');
    expect(capturedQuery).not.toContain('c.username');
    expect(capturedQuery).not.toContain('c.correo_institucional');
    expect(capturedQuery).toContain('(ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())');
    expect(capturedQuery).toContain('r.rol_id = ur.rol_id');
    expect(capturedQuery).toContain('COALESCE(ur.area_id, p.area_id) AS area_id');
  });
});
