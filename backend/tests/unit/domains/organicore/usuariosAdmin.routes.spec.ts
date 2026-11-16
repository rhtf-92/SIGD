import express from 'express';
import request from 'supertest';
import type { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

const usuario = '10000000-0000-4000-8000-000000000001';
const rutas = ['/api/v1/admin/usuarios', '/api/v1/usuarios', '/api/v1/admin/roles-permisos'];
afterEach(() => vi.restoreAllMocks());

function escenario(autorizado = false) {
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes('FROM sigd_org.permiso_sistema ORDER BY codigo')) return { rows: [] };
    if (sql.includes('AS autorizado')) {
      expect(params).toEqual([usuario]);
      for (const condicion of ['cu.activo = TRUE', 'r.vigente = TRUE',
        'ur.id_usuario = cu.id_usuario', 'ur.vigente_desde <= now()',
        'ur.vigente_hasta IS NULL OR ur.vigente_hasta > now()',
        "p.codigo = 'ADMIN_USUARIOS'", "p.ambito = 'GLOBAL'"]) expect(sql).toContain(condicion);
      return { rows: [{ autorizado }] };
    }
    if (sql.includes('json_agg')) {
      expect(sql).toContain('r.rol_id AS id');
      expect(sql).toContain('rp.rol_id = r.rol_id');
      expect(sql).toContain('p.permiso_id = rp.permiso_id');
      return { rows: [{ id: usuario, codigo: 'ADMINISTRADOR', nombre: 'Administrador',
        descripcion: null, permisos: ['ADMIN_USUARIOS'] }] };
    }
    throw new Error('Consulta no prevista');
  });
  const connect = vi.fn(() => { throw new Error('Escritura no permitida'); });
  const app: express.Express = construirApp({ query, connect } as unknown as Pool);
  return { app, query, connect };
}

describe('Administración: permiso persistido antes de acceder al controlador', () => {
  it('el controlador entrega el directorio UUID paginado cuando el permiso persistido lo autoriza', async () => {
    const cuenta = { id: usuario, nombre: 'Cuenta sintética', dni: '12345678', correo: 'prueba@iestpsuiza.edu.pe',
      sede: null, area: null, cargo: null, rol: null, estado: 'ACTIVO', ultimoAcceso: null,
      nombres: 'Cuenta', apellidos: 'Sintética', tipoPersona: 'NATURAL', asignaciones: [], roles: [] };
    const catalogos = { areas: [], cargos: [], roles: [] };
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('AS autorizado')) return { rows: [{ autorizado: true }] };
      if (sql.includes('AS catalogos')) return { rows: [{ catalogos }] };
      if (sql.includes('COUNT(*)::int AS total')) return { rows: [{ total: 1 }] };
      expect(sql).toContain('cu.id_usuario::text AS id');
      expect(params).toEqual([1, 0]);
      return { rows: [cuenta] };
    });
    const app = construirApp({ query } as unknown as Pool);
    const res = await request(app).get('/api/v1/admin/usuarios?limite=1')
      .set('Authorization', `Bearer ${firmarTokenAcceso({ sub: usuario })}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ datos: [cuenta], paginacion: { pagina: 1, limite: 1, total: 1, totalPaginas: 1 }, catalogos });
  });

  it('una ruta PUT con ID numérico se rechaza antes de abrir transacciones', async () => {
    const { app, query, connect } = escenario(true);
    const res = await request(app).put('/api/v1/admin/usuarios/1')
      .set('Authorization', `Bearer ${firmarTokenAcceso({ sub: usuario })}`).send({ estado: 'INACTIVO' });
    expect(res.status).toBe(400);
    expect(query).toHaveBeenCalledTimes(1);
    expect(connect).not.toHaveBeenCalled();
  });
  it.each(rutas)('rechaza acceso sin JWT a %s sin consultar PostgreSQL', async ruta => {
    const { app, query } = escenario();
    expect((await request(app).get(ruta)).status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it.each(['invalido', 'expirado', 'id no UUID'])('rechaza token %s', async caso => {
    const { app, query } = escenario();
    const token = caso === 'invalido' ? 'no.es.valido' : firmarTokenAcceso({
      sub: caso === 'id no UUID' ? '1' : usuario,
      ...(caso === 'expirado' ? { ahora: Date.now() - 60_000, expiraSegundos: 1 } : {}),
    });
    expect((await request(app).get(rutas[0]).set('Authorization', `Bearer ${token}`)).status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it.each(rutas)('un rol privilegiado en JWT no concede acceso a %s', async ruta => {
    const { app, query, connect } = escenario();
    const res = await request(app).get(ruta).set('Authorization', `Bearer ${firmarTokenAcceso({
      sub: usuario, roles: ['ADMINISTRADOR', 'SUPER_ADMIN'],
    })}`);
    expect(res.status).toBe(403);
    expect(query).toHaveBeenCalledTimes(1);
    expect(connect).not.toHaveBeenCalled();
  });

  it.each(['/api/v1/admin/usuarios', '/api/v1/usuarios'])('protege también las escrituras en %s', async ruta => {
    const { app, query, connect } = escenario();
    const token = firmarTokenAcceso({ sub: usuario });
    expect((await request(app).post(ruta).set('Authorization', `Bearer ${token}`).send({})).status).toBe(403);
    expect((await request(app).put(`${ruta}/1`).set('Authorization', `Bearer ${token}`).send({})).status).toBe(403);
    expect(query).toHaveBeenCalledTimes(2);
    expect(connect).not.toHaveBeenCalled();
  });

  it('devuelve los roles reales con el contrato existente para un permiso global vigente', async () => {
    const { app, query } = escenario(true);
    const res = await request(app).get(rutas[2])
      .set('Authorization', `Bearer ${firmarTokenAcceso({ sub: usuario })}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ roles: [{ id: usuario, codigo: 'ADMINISTRADOR',
      nombre: 'Administrador', descripcion: null, permisos: ['ADMIN_USUARIOS'] }], catalogoPermisos: [] });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('no sustituye fallos SQL por roles inventados', async () => {
    const { app, query } = escenario(true);
    query.mockImplementationOnce(async () => ({ rows: [{ autorizado: true }] }))
      .mockRejectedValueOnce(new Error('SQL sintético no disponible'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get(rutas[2])
      .set('Authorization', `Bearer ${firmarTokenAcceso({ sub: usuario })}`);
    expect(res.status).toBe(500);
    expect(res.body).not.toHaveProperty('roles');
  });

  it('falla cerrado cuando no se pueden comprobar permisos', async () => {
    const { app, query, connect } = escenario();
    query.mockRejectedValueOnce(new Error('PostgreSQL sintético no disponible'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get(rutas[0])
      .set('Authorization', `Bearer ${firmarTokenAcceso({ sub: usuario })}`);
    expect(res.status).toBe(500);
    expect(connect).not.toHaveBeenCalled();
  });
});
