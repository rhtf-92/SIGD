import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { construirApp } from '../../src/app.js';
import { obtenerAutorizacionCuenta, tienePermisoGlobal, verificarFacultadFirma } from '../../src/core/auth/auth.guard.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';
import { crearUsuariosAdminService } from '../../src/domains/organicore/usuariosAdmin.service.js';

const usuario = '10000000-0000-4000-8000-000000000001';
const rol = '20000000-0000-4000-8000-000000000001';
const permiso = '30000000-0000-4000-8000-000000000001';

describe('RBAC institucional persistido (dobles controlados, sin escribir PostgreSQL)', () => {
  it('rechaza identidades no UUID antes de consultar y cuentas ausentes o inactivas', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    expect(await obtenerAutorizacionCuenta(pool, '1')).toBeNull();
    expect(query).not.toHaveBeenCalled();
    expect(await obtenerAutorizacionCuenta(pool, usuario)).toBeNull();
    const sql = query.mock.calls[0][0];
    for (const fragmento of ['cu.activo = TRUE', 'r.vigente = TRUE', 'ur.vigente_desde <= now()', 'ur.vigente_hasta > now()']) expect(sql).toContain(fragmento);
  });
  it('una asignación de área no otorga una facultad global', () => {
    expect(tienePermisoGlobal([{ codigo: 'ADMIN_USUARIOS', ambito: 'GLOBAL', areaId: usuario }], 'ADMIN_USUARIOS')).toBe(false);
    expect(tienePermisoGlobal([{ codigo: 'ADMIN_USUARIOS', ambito: 'GLOBAL', areaId: null }], 'ADMIN_USUARIOS')).toBe(true);
  });
  it('la consulta de facultades excluye la lectura institucional concedida al rol ciudadano', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ roles: ['CIUDADANO'], permisos: [] }] });
    const resultado = await obtenerAutorizacionCuenta({ query } as unknown as Pool, usuario);
    expect(resultado?.roles).toEqual(['CIUDADANO']);
    expect(resultado?.permisos).toEqual([]);
    expect(query.mock.calls[0][0]).toContain("NOT (r.codigo = 'CIUDADANO' AND p.codigo = 'EXPEDIENTE_LEER')");
  });
  it('los roles afirmados por el token no otorgan facultad de firma', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as Pool;
    expect((await verificarFacultadFirma(pool, usuario, ['DIRECTOR', 'ADMINISTRADOR', 'SUPER_ADMIN'])).puedeFirmar).toBe(false);
  });
  it('el perfil de una cuenta sin asignaciones no inventa un rol a partir del JWT', async () => {
    const query = vi.fn(async (sql: string) => ({ rows: sql.includes('AS permisos')
      ? [{ roles: [], permisos: [] }] : [{ id_usuario: usuario, usuario: 'cuenta-del-doble', nombre_completo: 'Cuenta del doble' }] }));
    const res = await request(construirApp({ query } as unknown as Pool)).get('/api/v1/auth/me')
      .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: usuario, roles: ['SUPER_ADMIN'] }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ rol: '', roles: [], permisos: [] });
  });
  it('una asignación de DIRECTOR limitada a un área no se convierte en facultad global de firma', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ rol_codigo: 'DIRECTOR', rol_area_id: usuario, vigente: false, tipo_resolucion: null }] });
    const facultad = await verificarFacultadFirma({ query } as unknown as Pool, usuario);
    expect(facultad.puedeFirmar).toBe(false);
    expect(facultad.facultadGlobal).toBe(false);
  });
  it.each([
    ['get', '/api/v1/admin/auditoria/bitacora'],
    ['post', '/api/v1/admin/organigrama/areas'],
    ['put', '/api/v1/admin/organigrama/areas/' + rol],
    ['post', '/api/v1/admin/calendario-laboral/feriado-excepcional'],
  ] as const)('la operación administrativa %s %s exige facultad persistida', async (method, ruta) => {
    const query = vi.fn().mockResolvedValue({ rows: [{ autorizado: false }] });
    const connect = vi.fn();
    const app = construirApp({ query, connect } as unknown as Pool);
    expect((await request(app)[method](ruta)).status).toBe(401);
    expect(query).not.toHaveBeenCalled();
    expect((await request(app)[method](ruta).set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: usuario, roles: ['SUPER_ADMIN'] }))).status).toBe(403);
    expect(query).toHaveBeenCalledOnce();
    expect(connect).not.toHaveBeenCalled();
  });
  it('un JWT con rol privilegiado sin permiso persistido no consulta reportes ni inicia mutaciones de RutaDoc', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ roles: ['ADMINISTRADOR'], permisos: [] }] });
    const connect = vi.fn();
    const app = construirApp({ query, connect } as unknown as Pool);
    const token = firmarTokenAcceso({ sub: usuario, roles: ['SUPER_ADMIN'] });
    expect((await request(app).get('/api/v1/reportes/dashboard/resumen').set('Authorization', 'Bearer ' + token)).status).toBe(403);
    expect((await request(app).post('/api/v1/expedientes/' + rol + '/observar').set('Authorization', 'Bearer ' + token).send({})).status).toBe(403);
    expect(connect).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(2);
  });
  it('la consulta de reportes exige también alcance global sin limitarlo a una etiqueta de rol', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ roles: ['DIRECTOR'], permisos: [{ codigo: 'REPORTE_LEER', ambito: 'GLOBAL', areaId: usuario }] }] });
    const res = await request(construirApp({ query } as unknown as Pool)).get('/api/v1/reportes/dashboard/resumen')
      .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: usuario }));
    expect(res.status).toBe(403);
    expect(query).toHaveBeenCalledOnce();
  });
  it('el contrato HTTP de reportes permite la facultad persistida y declara los indicadores sin denominador', async () => {
    const query = vi.fn(async (sql: string) => ({ rows: sql.includes('AS permisos')
      ? [{ roles: [], permisos: [{ codigo: 'REPORTE_LEER', ambito: 'GLOBAL', areaId: null }] }]
      : [{ n_radicados: '5', n_resueltos: '0', n_en_tramite: '1' }] }));
    const res = await request(construirApp({ query } as unknown as Pool)).get('/api/v1/reportes/dashboard/resumen')
      .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: usuario }));
    expect(res.status).toBe(200);
    expect(res.body.disponibilidad).toEqual({ vtep: true, tro: false, tprHorasHabiles: false, teo: true });
    expect(res.body.contadores.nRadicados).toBe(5);
    expect(query).toHaveBeenCalledTimes(2);
  });
  it.each([false, true])('actualizar permisos es atómico; fallo de inserción=%s', async fallar => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT rol_id')) return { rows: [{ rol_id: rol }] };
      if (sql.includes('SELECT permiso_id')) return { rows: [{ permiso_id: permiso }] };
      if (sql.includes('INSERT') && fallar) throw new Error('Error controlado de almacenamiento');
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    const service = crearUsuariosAdminService({ connect: async () => ({ query, release }) } as unknown as Pool);
    const operacion = service.actualizarPermisosRol(rol, [permiso], usuario);
    if (fallar) {
      await expect(operacion).rejects.toThrow('Error controlado');
      expect(query).toHaveBeenCalledWith('ROLLBACK');
      expect(query).not.toHaveBeenCalledWith('COMMIT');
    } else {
      await expect(operacion).resolves.toEqual({ id: rol, permisos: [permiso] });
      expect(query).toHaveBeenCalledWith('COMMIT');
    }
    expect(release).toHaveBeenCalledOnce();
  });
  it('no borra permisos previos si el permiso solicitado no pertenece al catálogo', async () => {
    const query = vi.fn(async (sql: string) => ({ rows: sql.includes('SELECT rol_id') ? [{ rol_id: rol }] : [] }));
    const release = vi.fn();
    await expect(crearUsuariosAdminService({ connect: async () => ({ query, release }) } as unknown as Pool)
      .actualizarPermisosRol(rol, [permiso], usuario)).rejects.toMatchObject({ status: 422 });
    expect(query.mock.calls.some(([sql]) => sql.startsWith('DELETE'))).toBe(false);
    expect(query).toHaveBeenCalledWith('ROLLBACK');
  });
  it('el endpoint de permisos rechaza entradas duplicadas antes de abrir transacción', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ autorizado: true }] });
    const connect = vi.fn();
    const res = await request(construirApp({ query, connect } as unknown as Pool)).put('/api/v1/roles/' + rol + '/permisos')
      .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: usuario })).send({ permisos: [permiso, permiso] });
    expect(res.status).toBe(400); expect(connect).not.toHaveBeenCalled();
  });
  it.each(['inactiva', 'carrera', 'fallo'])('el refresco no emite credenciales ante %s', async caso => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.sesion_usuario s')) return { rows: [{ id_usuario: usuario, expira_en: new Date(Date.now() + 60000), revocado_en: null }] };
      if (sql.includes('AS permisos')) return { rows: caso === 'inactiva' ? [] : [{ roles: [], permisos: [] }] };
      if (caso === 'fallo') throw new Error('Fallo de rotación');
      return { rows: [], rowCount: 0 };
    });
    const res = await request(construirApp({ query } as unknown as Pool)).post('/api/v1/auth/refresh').send({ refreshToken: 'abc123abc123abc123abc123abc123ab12' });
    expect(res.status).toBe(caso === 'fallo' ? 500 : 401);
    expect(res.body.accessToken).toBeUndefined();
    const escrituras = query.mock.calls.filter(([sql]) => sql.includes('UPDATE'));
    expect(escrituras).toHaveLength(caso === 'inactiva' ? 0 : 1);
    if (escrituras.length) {
      expect(escrituras[0][0]).toContain('WITH anterior AS');
      expect(escrituras[0][0]).toContain('revocado_en IS NULL AND expira_en > now()');
    }
  });
});
