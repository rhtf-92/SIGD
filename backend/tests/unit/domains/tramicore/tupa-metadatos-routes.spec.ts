import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Pool } from 'pg';
import { crearRouterTramites } from '../../../../src/domains/tramicore/tramites.controller.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

vi.mock('../../../../src/core/cache/redis.service.js', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
  invalidateCache: vi.fn().mockResolvedValue(undefined),
}));

describe('Rutas de tarifas y procedencia TUPA', () => {
  const idUsuario = '11111111-1111-4111-8111-111111111111';
  const idProcedimiento = '22222222-2222-4222-8222-222222222222';
  const idRegistroVersion = '33333333-3333-4333-8333-333333333333';
  const tokenAdmin = firmarTokenAcceso({ sub: idUsuario, roles: ['ADMINISTRADOR'] });
  const tokenCiudadano = firmarTokenAcceso({ sub: idUsuario, roles: ['CIUDADANO'] });
  let query: ReturnType<typeof vi.fn>;
  let app: express.Express;

  beforeEach(() => {
    query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return {
          rows: [{
            id_persona: '44444444-4444-4444-8444-444444444444',
            activo: true,
            correo: 'admin@example.test',
            nombre_completo: 'Usuario de prueba',
          }],
          rowCount: 1,
        };
      }
      if (sql.includes('SELECT v.estado AS estado_version')) {
        return { rows: [{ estado_version: 'BORRADOR' }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO sigd_doc.tupa_tarifa_variante')) {
        return { rows: [{ id_tarifa_variante: '55555555-5555-4555-8555-555555555555' }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO sigd_doc.tupa_campo_procedencia')) {
        return { rows: [{ id_procedencia: '66666666-6666-4666-8666-666666666666' }], rowCount: 1 };
      }
      if (sql.includes('FROM sigd_doc.tupa_tarifa_variante')) {
        return { rows: [{ codigo_variante: 'HEMBRAS', monto: '30.00' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    app = express();
    app.use(express.json());
    app.use('/api/v1', crearRouterTramites({
      query,
      connect: vi.fn().mockResolvedValue({ query, release: vi.fn() }),
    } as unknown as Pool));
    app.use(errorMiddleware);
  });

  it('expone tarifas variantes del procedimiento', async () => {
    const response = await request(app)
      .get(`/api/v1/tramites/tupa/procedimientos/${idProcedimiento}/tarifas`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ codigo_variante: 'HEMBRAS', monto: '30.00' }]);
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/JOIN sigd_doc\.tupa_version version[\s\S]*version\.estado = 'VIGENTE'/),
      [idProcedimiento],
    );
  });

  it('permite a ADMINISTRADOR registrar tarifa de versión borrador', async () => {
    const response = await request(app)
      .post(`/api/v1/admin/tupa/procedimientos/${idProcedimiento}/tarifas`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        idRegistroVersion,
        codigoVariante: 'HEMBRAS',
        nombreVariante: 'Pichones hembras',
        monto: 30,
        fuente: 'OFICIAL',
      });

    expect(response.status).toBe(201);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO sigd_doc.tupa_tarifa_variante'))).toBe(true);
  });

  it('permite a ADMINISTRADOR registrar y consultar procedencia', async () => {
    const creado = await request(app)
      .post(`/api/v1/admin/tupa/procedimientos/${idProcedimiento}/procedencia`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        idRegistroVersion,
        campoNombre: 'monto',
        valor: '30.00',
        fuente: 'OFICIAL',
        evidencia: 'Fila del documento fuente',
      });
    const listado = await request(app)
      .get(`/api/v1/admin/tupa/procedimientos/${idProcedimiento}/procedencia?idRegistroVersion=${idRegistroVersion}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(creado.status).toBe(201);
    expect(listado.status).toBe(200);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO sigd_doc.tupa_campo_procedencia'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('FROM sigd_doc.tupa_campo_procedencia'))).toBe(true);
  });

  it('no permite a ciudadanos escribir procedencia', async () => {
    const response = await request(app)
      .post(`/api/v1/admin/tupa/procedimientos/${idProcedimiento}/procedencia`)
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        idRegistroVersion,
        campoNombre: 'monto',
        valor: '30.00',
        fuente: 'OFICIAL',
      });

    expect(response.status).toBe(403);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO sigd_doc.tupa_campo_procedencia'))).toBe(false);
  });
});
