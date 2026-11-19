import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import express from 'express';
import request from 'supertest';
import { crearRouterTramites } from '../../../../src/domains/tramicore/tramites.controller.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

const usuario = '11111111-2222-4333-8444-555555555555';
const token = () => firmarTokenAcceso({ sub: usuario, roles: ['CIUDADANO'] });

function appDePrueba(options: { roles?: string[]; propio?: boolean; publico?: boolean } = {}) {
  const queries: string[] = [];
  const pool = {
    query: vi.fn(async (sql: string) => {
      queries.push(sql);
      if (sql.includes('AS permisos')) return { rows: [{ roles: options.roles ?? ['CIUDADANO'], permisos: [] }], rowCount: 1 };
      if (sql.includes('FROM sigd_tra.radicacion_publica')) {
        return { rows: options.publico ? [{ sesion_hash: '0'.repeat(64) }] : [], rowCount: options.publico ? 1 : 0 };
      }
      if (sql.includes('AS propio')) return { rows: [{ propio: options.propio ?? false }], rowCount: 1 };
      if (sql.includes('AS asunto') || sql.includes('FROM sigd_auth.cuenta_usuario cuenta')) {
        return { rows: [{ cut: 'EXP-2026-000001', fecha_radicacion: '2026-10-01T12:00:00Z', estado: 'REGISTRADO',
          codigo_procedimiento: 'SUZ26-035', procedimiento: 'Certificado de Estudios', asunto: 'Solicitud propia' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  } as unknown as Pool;
  const app = express();
  app.use('/api/v1', crearRouterTramites(pool));
  app.use(errorMiddleware);
  return { app, queries, pool };
}

describe('TramiCore: consulta autenticada de expedientes por titular', () => {
  it('rechaza solicitudes sin JWT', async () => {
    const { app } = appDePrueba();
    const response = await request(app).get('/api/v1/tramites/mis-expedientes');
    expect(response.status).toBe(401);
  });

  it('rechaza una cuenta sin rol CIUDADANO', async () => {
    const { app, queries } = appDePrueba({ roles: ['MESA_PARTES'] });
    const response = await request(app).get('/api/v1/tramites/mis-expedientes').set('Authorization', `Bearer ${token()}`);
    expect(response.status).toBe(403);
    expect(queries.some(sql => sql.includes('FROM sigd_auth.cuenta_usuario cuenta'))).toBe(false);
  });

  it('filtra el historial por el usuario autenticado y devuelve solo campos de seguimiento', async () => {
    const { app, queries } = appDePrueba();
    const response = await request(app).get('/api/v1/tramites/mis-expedientes').set('Authorization', `Bearer ${token()}`);
    expect(response.status).toBe(200);
    expect(response.body.items[0]).toMatchObject({ cut: 'EXP-2026-000001', codigo_procedimiento: 'SUZ26-035' });
    const historial = queries.find(q => q.includes('FROM sigd_auth.cuenta_usuario cuenta'));
    expect(historial).toContain('e.solicitante_id = cuenta.id_persona');
    expect(historial).toContain('cuenta.id_usuario = $1::uuid');
    expect(queries.at(-1)).toContain('CONSULTA_EXPEDIENTES_PROPIOS');
    expect(response.body.items[0]).not.toHaveProperty('numeroDocumento');
    expect(response.body.items[0]).not.toHaveProperty('correo');
  });

  it('oculta el detalle de un expediente privado cuando la cuenta no es titular', async () => {
    const { app } = appDePrueba({ propio: false });
    const response = await request(app).get('/api/v1/tramites/consulta-publica/EXP-2026-000001')
      .set('Authorization', `Bearer ${token()}`);
    expect(response.status).toBe(404);
  });
  it('rechaza identificadores de persona enviados por el cliente', async () => {
    const { app } = appDePrueba();
    const response = await request(app).get('/api/v1/tramites/mis-expedientes?idPersona=otra-persona').set('Authorization', 'Bearer ' + token());
    expect(response.status).toBe(400);
  });
  it('pagina el historial sin eliminar el filtro de titularidad', async () => {
    const { app, pool } = appDePrueba();
    const response = await request(app).get('/api/v1/tramites/mis-expedientes?pagina=2').set('Authorization', 'Bearer ' + token());
    expect(response.status).toBe(200); expect(response.body.pagina).toBe(2);
    const consulta = vi.mocked(pool.query).mock.calls.find(([sql]) => String(sql).includes('FROM sigd_auth.cuenta_usuario cuenta'));
    expect(consulta?.[1]).toEqual([usuario, 100]);
  });
});
