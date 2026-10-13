import request from 'supertest';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso, firmarTokenSeleccionPerfil, verificarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';

const ID_USUARIO = '11111111-1111-1111-1111-111111111111';
const ROL_ADMIN = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', codigo: 'ADMINISTRADOR', nombre: 'Administrador', areaId: null };
const ROL_DIRECTOR = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', codigo: 'DIRECTOR', nombre: 'Director', areaId: null };
const hashValido = Argon2Service.generateFallbackHash('PasswordValida123!');

function usuario(roles: unknown, extras: Record<string, unknown> = {}) {
  return {
    id_usuario: ID_USUARIO,
    id_persona: '22222222-2222-2222-2222-222222222222',
    usuario: 'admin.institucional',
    correo: 'admin@iestp-suiza.edu.pe',
    nombre_completo: 'Administrador General',
    password_hash: hashValido,
    activo: true,
    bloqueado_hasta: null,
    roles,
    ...extras,
  };
}

describe('Auth Router — perfil RBAC activo', () => {
  it('con un rol inicia sesión y emite un JWT con exactamente ese rol', async () => {
    let consultaLogin = '';
    let insercionSesion = '';
    const fakePool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM sigd_auth.cuenta_usuario c') && sql.includes('password_hash')) {
          consultaLogin = sql;
          return { rows: [usuario([ROL_ADMIN])], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO sigd_auth.sesion_usuario')) {
          insercionSesion = sql;
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    const res = await request(construirApp(fakePool)).post('/api/v1/auth/login')
      .send({ identificador: 'admin.institucional', password: 'PasswordValida123!' });

    expect(res.status).toBe(200);
    expect(res.body.requiereSeleccionPerfil).toBe(false);
    expect(res.body.usuario).toMatchObject({ rol: 'ADMINISTRADOR', roles: ['ADMINISTRADOR'] });
    expect(verificarTokenAcceso(res.body.accessToken).roles).toEqual(['ADMINISTRADOR']);
    expect(consultaLogin).toContain("COALESCE(rv.roles, '[]'::jsonb)");
    expect(consultaLogin).not.toContain("ARRAY['CIUDADANO']");
    expect(insercionSesion).toContain('rol_activo_id');
  });

  it('con varios roles exige selección y no entrega tokens de sesión', async () => {
    let insertoSesion = false;
    const fakePool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('password_hash')) return { rows: [usuario([ROL_ADMIN, ROL_DIRECTOR])], rowCount: 1 };
        if (sql.includes('INSERT INTO sigd_auth.sesion_usuario')) insertoSesion = true;
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    const res = await request(construirApp(fakePool)).post('/api/v1/auth/login')
      .send({ identificador: 'admin.institucional', password: 'PasswordValida123!' });

    expect(res.status).toBe(200);
    expect(res.body.requiereSeleccionPerfil).toBe(true);
    expect(res.body.rolesDisponibles).toHaveLength(2);
    expect(res.body).not.toHaveProperty('accessToken');
    expect(res.body).not.toHaveProperty('refreshToken');
    expect(() => verificarTokenAcceso(res.body.tokenSeleccionPerfil)).toThrow();
    expect(insertoSesion).toBe(false);
  });

  it('sin roles activos deniega permisos y nunca aplica CIUDADANO por defecto', async () => {
    const fakePool = { query: vi.fn(async () => ({ rows: [usuario([])], rowCount: 1 })) } as unknown as Pool;
    const res = await request(construirApp(fakePool)).post('/api/v1/auth/login')
      .send({ identificador: 'admin.institucional', password: 'PasswordValida123!' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_WITHOUT_ACTIVE_ROLES');
    expect(res.body).not.toHaveProperty('accessToken');
  });

  it('selecciona únicamente un rol incluido en el token y todavía vigente en PostgreSQL', async () => {
    const tokenSeleccionPerfil = firmarTokenSeleccionPerfil({ sub: ID_USUARIO, rolesDisponibles: [ROL_DIRECTOR.id] });
    const fakePool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('r.rol_id = $2')) return { rows: [usuario(undefined, { ...ROL_DIRECTOR })], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }),
    } as unknown as Pool;
    const res = await request(construirApp(fakePool)).post('/api/v1/auth/seleccionar-perfil')
      .send({ tokenSeleccionPerfil, rolId: ROL_DIRECTOR.id });
    expect(res.status).toBe(200);
    expect(verificarTokenAcceso(res.body.accessToken).roles).toEqual(['DIRECTOR']);
    expect(res.body.usuario.roles).toEqual(['DIRECTOR']);
  });

  it('rechaza seleccionar un rol que no estaba habilitado al autenticar', async () => {
    const tokenSeleccionPerfil = firmarTokenSeleccionPerfil({ sub: ID_USUARIO, rolesDisponibles: [ROL_ADMIN.id] });
    const fakePool = { query: vi.fn() } as unknown as Pool;
    const res = await request(construirApp(fakePool)).post('/api/v1/auth/seleccionar-perfil')
      .send({ tokenSeleccionPerfil, rolId: ROL_DIRECTOR.id });
    expect(res.status).toBe(401);
    expect(fakePool.query).not.toHaveBeenCalled();
  });

  it('refresh conserva únicamente el rol activo persistido en la sesión', async () => {
    const expiraEn = new Date(Date.now() + 3600_000).toISOString();
    const fakePool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM sigd_auth.sesion_usuario s')) {
          return { rows: [{ id_usuario: ID_USUARIO, rol_activo_id: ROL_DIRECTOR.id, expira_en: expiraEn,
            revocado_en: null, activo: true, bloqueado_hasta: null, codigo: 'DIRECTOR', nombre: 'Director' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
    } as unknown as Pool;
    const res = await request(construirApp(fakePool)).post('/api/v1/auth/refresh')
      .send({ refreshToken: 'abcdef1234567890abcdef1234567890' });
    expect(res.status).toBe(200);
    expect(verificarTokenAcceso(res.body.accessToken).roles).toEqual(['DIRECTOR']);
    expect(fakePool.query).toHaveBeenCalledWith(
      expect.stringContaining('SET revocado_en = now()'),
      ['abcdef1234567890abcdef1234567890'],
    );
    expect(fakePool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sigd_auth.sesion_usuario'),
      expect.arrayContaining([ID_USUARIO, ROL_DIRECTOR.id]),
    );
  });

  it('logout revoca el refresh token recibido', async () => {
    const fakePool = { query: vi.fn(async () => ({ rows: [], rowCount: 1 })) } as unknown as Pool;
    const refreshToken = 'abcdef1234567890abcdef1234567890';

    const res = await request(construirApp(fakePool)).post('/api/v1/auth/logout').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(fakePool.query).toHaveBeenCalledWith(
      expect.stringContaining('revocado_en = now()'),
      [refreshToken],
    );
  });

  it('refresh rechaza una sesión revocada y no emite nuevos tokens', async () => {
    const expiraEn = new Date(Date.now() + 3600_000).toISOString();
    const fakePool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM sigd_auth.sesion_usuario s')) {
          return { rows: [{ id_usuario: ID_USUARIO, rol_activo_id: ROL_ADMIN.id, expira_en: expiraEn,
            revocado_en: new Date().toISOString(), activo: true, bloqueado_hasta: null,
            codigo: 'ADMINISTRADOR', nombre: 'Administrador' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
    } as unknown as Pool;

    const res = await request(construirApp(fakePool)).post('/api/v1/auth/refresh')
      .send({ refreshToken: 'abcdef1234567890abcdef1234567890' });

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('accessToken');
    expect(fakePool.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sigd_auth.sesion_usuario'),
      expect.anything(),
    );
  });

  it('cambio de perfil valida sesión, usuario y asignación activa en backend', async () => {
    const accessToken = firmarTokenAcceso({ sub: ID_USUARIO, roles: ['ADMINISTRADOR'] });
    const expiraEn = new Date(Date.now() + 3600_000).toISOString();
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM sigd_auth.sesion_usuario') && sql.includes('FOR UPDATE')) {
          return { rows: [{ id_usuario: ID_USUARIO, expira_en: expiraEn, revocado_en: null }], rowCount: 1 };
        }
        if (sql.includes('r.rol_id = $2')) return { rows: [usuario(undefined, { ...ROL_DIRECTOR })], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const fakePool = { connect: vi.fn(async () => client) } as unknown as Pool;
    const res = await request(construirApp(fakePool)).post('/api/v1/auth/cambiar-perfil')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken: 'abcdef1234567890abcdef1234567890', rolId: ROL_DIRECTOR.id });
    expect(res.status).toBe(200);
    expect(verificarTokenAcceso(res.body.accessToken).roles).toEqual(['DIRECTOR']);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('cambio de perfil rechaza un refresh token perteneciente a otro usuario', async () => {
    const accessToken = firmarTokenAcceso({ sub: ID_USUARIO, roles: ['ADMINISTRADOR'] });
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FOR UPDATE')) {
          return { rows: [{ id_usuario: '99999999-9999-4999-8999-999999999999',
            expira_en: new Date(Date.now() + 3600_000).toISOString(), revocado_en: null }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const fakePool = { connect: vi.fn(async () => client) } as unknown as Pool;

    const res = await request(construirApp(fakePool)).post('/api/v1/auth/cambiar-perfil')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken: 'abcdef1234567890abcdef1234567890', rolId: ROL_DIRECTOR.id });

    expect(res.status).toBe(401);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO sigd_auth.sesion_usuario'), expect.anything());
  });

  it('GET /auth/me valida el rol del JWT y solo lo expone como rol autorizado', async () => {
    const token = firmarTokenAcceso({ sub: ID_USUARIO, roles: ['ADMINISTRADOR'] });
    const fakePool = {
      query: vi.fn(async (_sql: string, params?: unknown[]) => ({
        rows: [usuario(undefined, { roles_disponibles: [ROL_ADMIN, ROL_DIRECTOR], area_id: null })], rowCount: 1,
        params,
      })),
    } as unknown as Pool;
    const res = await request(construirApp(fakePool)).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rol).toBe('ADMINISTRADOR');
    expect(res.body.roles).toEqual(['ADMINISTRADOR']);
    expect(res.body.rolesDisponibles).toHaveLength(2);
    expect(fakePool.query).toHaveBeenCalledWith(expect.stringContaining('rol_activo.codigo = $2'), [ID_USUARIO, 'ADMINISTRADOR']);
  });

  it('rechaza una cuenta bloqueada', async () => {
    const fakePool = { query: vi.fn(async () => ({ rows: [usuario([ROL_ADMIN], { bloqueado_hasta: 'infinity' })], rowCount: 1 })) } as unknown as Pool;
    const res = await request(construirApp(fakePool)).post('/api/v1/auth/login')
      .send({ identificador: 'bloqueado', password: 'PasswordValida123!' });
    expect(res.status).toBe(423);
    expect(res.body.code).toBe('ACCOUNT_LOCKED');
  });
});
