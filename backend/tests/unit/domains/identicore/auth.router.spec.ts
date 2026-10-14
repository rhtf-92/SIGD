import request from 'supertest';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenRefresco, verificarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';

const ID = '11111111-1111-1111-1111-111111111111';
const PASSWORD = 'PasswordValida123!';
const hashValido = Argon2Service.generateFallbackHash(PASSWORD);

function crearPool(rolesIniciales: Array<{ rol_codigo: string; permiso_codigo: string | null }>, activo = true) {
  let roles = [...rolesIniciales];
  const sesiones = new Map<string, { id_usuario: string; expira_en: string; revocado_en: string | null }>();
  const cuenta = { id_usuario: ID, id_persona: null, usuario: 'persona', correo: 'persona@suiza.edu.pe',
    password_hash: hashValido, activo, nombre_completo: 'Persona Institucional', area_id: null };
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM sigd_auth.cuenta_usuario c') && sql.includes('password_hash')) {
      return { rows: params[0] === cuenta.usuario || params[0] === cuenta.correo ? [cuenta] : [], rowCount: 1 };
    }
    if (sql.includes('FROM sigd_org.usuario_rol ur')) return { rows: roles, rowCount: roles.length };
    if (sql.includes('FROM sigd_auth.cuenta_usuario c') && sql.includes('WHERE c.id_usuario')) {
      return { rows: params[0] === ID ? [cuenta] : [], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO sigd_auth.sesion_usuario')) {
      sesiones.set(String(params[1]), { id_usuario: String(params[0]), expira_en: String(params[4]), revocado_en: null });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('FROM sigd_auth.sesion_usuario s')) {
      const sesion = sesiones.get(String(params[0]));
      return { rows: sesion ? [{ ...sesion, activo }] : [], rowCount: sesion ? 1 : 0 };
    }
    if (sql.includes('UPDATE sigd_auth.sesion_usuario')) {
      const sesion = sesiones.get(String(params[0]));
      if (sesion) sesion.revocado_en = new Date().toISOString();
      return { rows: [], rowCount: sesion ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  });
  return { pool: { query } as unknown as Pool, query, setRoles: (next: typeof roles) => { roles = [...next]; } };
}

describe('Auth Router — perfiles institucionales activos', () => {
  it('activa automáticamente el único rol vigente y limita el JWT a ese perfil', async () => {
    const { pool } = crearPool([{ rol_codigo: 'ADMINISTRADOR', permiso_codigo: 'admin:acceso' }]);
    const res = await request(construirApp(pool)).post('/api/v1/auth/login')
      .send({ identificador: 'persona', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ requiresRoleSelection: false,
      usuario: { rol: 'SUPER_ADMIN', rolesAutorizados: ['SUPER_ADMIN'], permisos: ['admin:acceso'] } });
    const claims = verificarTokenAcceso(res.body.accessToken);
    expect(claims.roles).toEqual(['SUPER_ADMIN']);
    expect(claims.rolActivo).toBe('SUPER_ADMIN');
  });

  it('con varios roles entrega un token transitorio y no crea sesión todavía', async () => {
    const { pool, query } = crearPool([
      { rol_codigo: 'DOCENTE', permiso_codigo: 'expedientes:leer' },
      { rol_codigo: 'DIRECTOR', permiso_codigo: 'reportes:leer' },
    ]);
    const res = await request(construirApp(pool)).post('/api/v1/auth/login')
      .send({ identificador: 'persona', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.requiresRoleSelection).toBe(true);
    expect(res.body.rolesDisponibles).toEqual(['DIRECTOR', 'DOCENTE']);
    expect(res.body.accessToken).toBeUndefined();
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO sigd_auth.sesion_usuario'))).toBe(false);
  });

  it('valida de nuevo en servidor el perfil seleccionado y emite el perfil efectivo', async () => {
    const { pool } = crearPool([{ rol_codigo: 'DOCENTE', permiso_codigo: 'expedientes:leer' },
      { rol_codigo: 'DIRECTOR', permiso_codigo: 'reportes:leer' }]);
    const app = construirApp(pool);
    const login = await request(app).post('/api/v1/auth/login').send({ identificador: 'persona', password: PASSWORD });
    const seleccion = await request(app).post('/api/v1/auth/select-role')
      .send({ selectionToken: login.body.selectionToken, rol: 'DOCENTE' });
    expect(seleccion.status).toBe(200);
    expect(seleccion.body.usuario).toMatchObject({ rol: 'DOCENTE', permisos: ['expedientes:leer'] });
    expect(verificarTokenAcceso(seleccion.body.accessToken)).toMatchObject({ rolActivo: 'DOCENTE', roles: ['DOCENTE'] });
  });

  it('rechaza un rol no asignado y uno que dejó de estar vigente', async () => {
    const fixture = crearPool([{ rol_codigo: 'DOCENTE', permiso_codigo: null },
      { rol_codigo: 'DIRECTOR', permiso_codigo: null }]);
    const app = construirApp(fixture.pool);
    const login = await request(app).post('/api/v1/auth/login').send({ identificador: 'persona', password: PASSWORD });
    expect((await request(app).post('/api/v1/auth/select-role')
      .send({ selectionToken: login.body.selectionToken, rol: 'SUPER_ADMIN' })).status).toBe(403);
    fixture.setRoles([{ rol_codigo: 'DIRECTOR', permiso_codigo: null }]);
    expect((await request(app).post('/api/v1/auth/select-role')
      .send({ selectionToken: login.body.selectionToken, rol: 'DOCENTE' })).status).toBe(403);
  });

  it('deniega cuentas sin roles, deshabilitadas o con contraseña incorrecta', async () => {
    const sinRoles = construirApp(crearPool([]).pool);
    const deshabilitada = construirApp(crearPool([{ rol_codigo: 'DOCENTE', permiso_codigo: null }], false).pool);
    expect((await request(sinRoles).post('/api/v1/auth/login').send({ identificador: 'persona', password: PASSWORD })).status).toBe(403);
    expect((await request(deshabilitada).post('/api/v1/auth/login').send({ identificador: 'persona', password: PASSWORD })).status).toBe(403);
    expect((await request(sinRoles).post('/api/v1/auth/login').send({ identificador: 'persona', password: 'incorrecta' })).status).toBe(401);
  });

  it('permite cambiar solo a otro perfil actualmente asignado', async () => {
    const fixture = crearPool([{ rol_codigo: 'DOCENTE', permiso_codigo: null },
      { rol_codigo: 'DIRECTOR', permiso_codigo: 'reportes:leer' }]);
    const app = construirApp(fixture.pool);
    const login = await request(app).post('/api/v1/auth/login').send({ identificador: 'persona', password: PASSWORD });
    const docente = await request(app).post('/api/v1/auth/select-role')
      .send({ selectionToken: login.body.selectionToken, rol: 'DOCENTE' });
    const cambio = await request(app).post('/api/v1/auth/switch-role')
      .set('Authorization', `Bearer ${docente.body.accessToken}`).send({ rol: 'DIRECTOR', refreshToken: docente.body.refreshToken });
    expect(cambio.status).toBe(200);
    expect(cambio.body.usuario.rol).toBe('DIRECTOR');
    expect(verificarTokenAcceso(cambio.body.accessToken).roles).toEqual(['DIRECTOR']);
    expect((await request(app).post('/api/v1/auth/switch-role')
      .set('Authorization', `Bearer ${cambio.body.accessToken}`).send({ rol: 'SUPER_ADMIN' })).status).toBe(403);
  });

  it('rota el refresh token dentro de una transacción y bloquea la sesión consumida', async () => {
    const refreshToken = firmarTokenRefresco({
      sub: ID,
      rolActivo: 'DOCENTE',
      rolesAutorizados: ['DOCENTE'],
    });
    const cuenta = {
      id_usuario: ID,
      id_persona: null,
      usuario: 'persona',
      correo: 'persona@suiza.edu.pe',
      activo: true,
      bloqueado_hasta: null,
      nombre_completo: 'Persona Institucional',
      area_id: null,
    };
    const responder = async (sql: string) => {
      if (sql.includes('FROM sigd_auth.sesion_usuario s')) {
        return { rows: [{ id_usuario: ID, expira_en: new Date(Date.now() + 60_000).toISOString(), revocado_en: null, activo: true }], rowCount: 1 };
      }
      if (sql.includes('FROM sigd_auth.cuenta_usuario c')) return { rows: [cuenta], rowCount: 1 };
      if (sql.includes('FROM sigd_org.usuario_rol ur')) {
        return { rows: [{ rol_codigo: 'DOCENTE', permiso_codigo: 'expedientes:leer' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    };
    const client = { query: vi.fn(responder), release: vi.fn() };
    const pool = {
      query: vi.fn(responder),
      connect: vi.fn(async () => client),
    } as unknown as Pool;

    const res = await request(construirApp(pool)).post('/api/v1/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(pool.connect).toHaveBeenCalledOnce();
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE OF s'), [refreshToken]);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('SET revocado_en = now()'),
      [refreshToken],
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });
});
