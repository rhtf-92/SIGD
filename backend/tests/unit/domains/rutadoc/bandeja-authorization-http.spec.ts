import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import request from 'supertest';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { SQL_BANDEJA_LOCAL_RUTADOC } from '../../../../src/domains/rutadoc/rutadoc.repository.js';

const usuario = '10000000-0000-4000-8000-000000000001';
const persona = '20000000-0000-4000-8000-000000000002';
const expediente = '30000000-0000-4000-8000-000000000003';
const token = (roles: string[] = []) => firmarTokenAcceso({ sub: usuario, roles });

function preparar(opciones: { cuentaActiva?: boolean; personaId?: string | null; global?: boolean; falla?: boolean } = {}) {
  const consultas: Array<{ sql: string; parametros?: unknown[] }> = [];
  const query = vi.fn(async (sql: string, parametros?: unknown[]) => {
    consultas.push({ sql, parametros });
    if (sql.includes('AS roles') && sql.includes('AS permisos')) {
      return { rows: opciones.cuentaActiva === false ? [] : [{ roles: [], permisos: [] }], rowCount: opciones.cuentaActiva === false ? 0 : 1 };
    }
    if (sql.includes('AS acceso_global')) {
      expect(sql).toContain('cu.id_usuario = $1::uuid AND cu.activo = TRUE');
      expect(sql).toContain("p.codigo = 'EXPEDIENTE_LEER' AND p.ambito = 'GLOBAL'");
      expect(sql).toContain("r.codigo <> 'CIUDADANO'");
      if (opciones.falla) throw new Error('fallo SQL sintético');
      if (opciones.cuentaActiva === false) return { rows: [], rowCount: 0 };
      return { rows: [{ solicitante_id: opciones.personaId === undefined ? persona : opciones.personaId,
        acceso_global: opciones.global === true }], rowCount: 1 };
    }
    if (sql === SQL_BANDEJA_LOCAL_RUTADOC) {
      return { rows: [{ elementos: [{ id_expediente: expediente, cut: 'EXP-TEST-001', asunto: 'Sintético',
        fecha_radicacion: '2026-01-01T00:00:00.000Z', estado_actual: 'REGISTRADO', area_actual_id: null }],
      contadores: { PENDIENTES: 1, EN_TRAMITE: 0, DERIVADOS: 0, POR_FIRMAR: 0, ATENDIDOS: 0, ARCHIVADOS: 0 } }], rowCount: 1 };
    }
    throw new Error('Consulta no prevista en prueba HTTP sintética de Bandeja.');
  });
  const pool = { query, connect: vi.fn(() => { throw new Error('No se permiten transacciones en este caso.'); }) } as unknown as Pool;
  return { app: construirApp(pool), consultas, query };
}

describe('GET Bandeja: autorización derivada del estado persistido', () => {
  it.each(['sin JWT', 'JWT inválido', 'JWT expirado'])('rechaza %s antes de consultar PostgreSQL', async (caso) => {
    const { app, query } = preparar();
    const req = request(app).get('/api/v1/expedientes?pestana=PENDIENTES');
    if (caso === 'JWT inválido') req.set('Authorization', 'Bearer no.es.valido');
    if (caso === 'JWT expirado') req.set('Authorization', `Bearer ${firmarTokenAcceso({
      sub: usuario, ahora: Date.now() - 60_000, expiraSegundos: 1,
    })}`);
    const respuesta = await req;
    expect(respuesta.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('permite listado propio con cuenta activa y aplica el UUID de persona en SQL', async () => {
    const { app, consultas } = preparar();
    const respuesta = await request(app).get('/api/v1/expedientes?pestana=PENDIENTES')
      .set('Authorization', `Bearer ${token(['ESTUDIANTE'])}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.elementos).toHaveLength(1);
    const consultaListado = consultas.find(({ sql }) => sql === SQL_BANDEJA_LOCAL_RUTADOC)!;
    expect(consultaListado.sql).toContain('AND ($5::boolean OR e.solicitante_id = $6::uuid)');
    expect(consultaListado.parametros?.[4]).toBe(false);
    expect(consultaListado.parametros?.[5]).toBe(persona);
  });

  it('no concede acceso global por rol privilegiado declarado solo en JWT', async () => {
    const { app, consultas } = preparar({ personaId: null, global: false });
    const respuesta = await request(app).get('/api/v1/expedientes?pestana=PENDIENTES')
      .set('Authorization', `Bearer ${token(['SUPER_ADMIN'])}`);
    expect(respuesta.status).toBe(403);
    expect(consultas.some(({ sql }) => sql === SQL_BANDEJA_LOCAL_RUTADOC)).toBe(false);
  });

  it('permite alcance institucional solo cuando el permiso GLOBAL vigente está persistido', async () => {
    const { app, consultas } = preparar({ personaId: null, global: true });
    const respuesta = await request(app).get('/api/v1/expedientes?pestana=PENDIENTES')
      .set('Authorization', `Bearer ${token()}`);
    expect(respuesta.status).toBe(200);
    const consultaListado = consultas.find(({ sql }) => sql === SQL_BANDEJA_LOCAL_RUTADOC)!;
    expect(consultaListado.parametros?.[4]).toBe(true);
    expect(consultaListado.parametros?.[5]).toBeNull();
  });

  it('deniega cuentas inactivas y no consulta expedientes', async () => {
    const { app, consultas } = preparar({ cuentaActiva: false });
    const respuesta = await request(app).get('/api/v1/expedientes?pestana=PENDIENTES')
      .set('Authorization', `Bearer ${token(['MESA_PARTES'])}`);
    expect(respuesta.status).toBe(403);
    expect(consultas.some(({ sql }) => sql === SQL_BANDEJA_LOCAL_RUTADOC)).toBe(false);
  });

  it('falla cerrado ante error consultando cuenta o permiso', async () => {
    const { app, consultas } = preparar({ falla: true });
    const respuesta = await request(app).get('/api/v1/expedientes?pestana=PENDIENTES')
      .set('Authorization', `Bearer ${token(['DIRECTOR'])}`);
    expect(respuesta.status).toBe(500);
    expect(consultas.some(({ sql }) => sql === SQL_BANDEJA_LOCAL_RUTADOC)).toBe(false);
  });
});
