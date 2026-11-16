import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';
import { crearRouterTesoreria } from '../../../../src/domains/tesoreria/tesoreria.router.js';
import type { ActorTesoreria } from '../../../../src/domains/tesoreria/tesoreria.service.js';

const secreto = 'solo-prueba-unitaria-seguridad-tesoreria-clave-larga';
const usuario = '11111111-1111-4111-8111-111111111111';
const persona = '22222222-2222-4222-8222-222222222222';
const permisosTes = [
  'TESORERIA_LEER','TESORERIA_TARIFA_PROPONER','TESORERIA_TARIFA_VALIDAR','TESORERIA_PAGO_REGISTRAR',
  'TESORERIA_PAGO_VERIFICAR','TESORERIA_DEVOLUCION_EVALUAR','TESORERIA_DEVOLUCION_APROBAR',
  'TESORERIA_DEVOLUCION_EJECUTAR','TESORERIA_REPORTES',
];

function montar(roles: string[], permisos: string[] = [], ctx?: string, contextoRevocado = false) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('sigd_auth.cuenta_usuario cu')) {
      if (contextoRevocado) {
        return { rows: [{ roles: [], permisos: [], unidad_organica_id: null }] };
      }
      return { rows: [{ roles, permisos: permisos.map(codigo => ({ codigo, ambito: 'GLOBAL', areaId: null })), unidad_organica_id: null }] };
    }
    if (sql.includes('json_agg(DISTINCT r.codigo')) return { rows: [{ roles, permisos: permisos.map(codigo => ({ codigo, ambito: 'GLOBAL', areaId: null })) }] };
    if (sql.includes('SELECT id_persona FROM sigd_auth.cuenta_usuario')) return { rows: [{ id_persona: persona }] };
    if (sql.includes('to_regclass')) return { rows: [{ tabla: 'sigd_tes.orden_pago' }] };
    return { rows: [] };
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/tesoreria', crearRouterTesoreria({ query, connect: vi.fn() } as unknown as Pool));
  app.use(errorMiddleware);
  const token = firmarTokenAcceso({ sub: usuario, roles, ctx, expiraSegundos: 900, secreto });
  return { app, token, query };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe('M10 · autorización de API por rol vigente', () => {
  it('ADMINISTRADOR consulta capacidades y reportes, pero no registra efectivo', async () => {
    vi.stubEnv('AUTH_JWT_SECRET', secreto);
    const { app, token } = montar(['ADMINISTRADOR']);
    const caps = await request(app).get('/api/v1/tesoreria/capacidades').set('Authorization', `Bearer ${token}`);
    expect(caps.status).toBe(200);
    expect(caps.body.permisos.sort()).toEqual(['TESORERIA_LEER','TESORERIA_REPORTES']);
    const reporte = await request(app).get('/api/v1/tesoreria/reportes?desde=2026-10-01&hasta=2026-10-01').set('Authorization', `Bearer ${token}`);
    expect(reporte.status).toBe(200);
    const cobro = await request(app).post('/api/v1/tesoreria/pagos/efectivo').set('Authorization', `Bearer ${token}`)
      .send({ ordenId: usuario, efectivoRecibido: '80.00', confirmaRecepcion: true });
    expect(cobro.status).toBe(403);
  });

  it('el permiso global ADMIN_USUARIOS identifica al administrador y conserva M10 en solo lectura', async () => {
    vi.stubEnv('AUTH_JWT_SECRET', secreto);
    const { app, token } = montar(['MESA_PARTES'], ['ADMIN_USUARIOS']);
    const caps = await request(app).get('/api/v1/tesoreria/capacidades').set('Authorization', `Bearer ${token}`);
    expect(caps.status).toBe(200);
    expect(caps.body.permisos.sort()).toEqual(['TESORERIA_LEER','TESORERIA_REPORTES']);
    const cobro = await request(app).post('/api/v1/tesoreria/pagos/efectivo').set('Authorization', `Bearer ${token}`)
      .send({ ordenId: usuario, efectivoRecibido: '80.00', confirmaRecepcion: true });
    expect(cobro.status).toBe(403);
  });

  it('TESORERO recibe las facultades financieras RBAC vigentes', async () => {
    vi.stubEnv('AUTH_JWT_SECRET', secreto);
    const { app, token } = montar(['TESORERO'], permisosTes);
    const caps = await request(app).get('/api/v1/tesoreria/capacidades').set('Authorization', `Bearer ${token}`);
    expect(caps.status).toBe(200);
    expect(caps.body.permisos.sort()).toEqual([...permisosTes].sort());
  });

  it('rechaza a un trabajador no autorizado antes de consultar M10', async () => {
    vi.stubEnv('AUTH_JWT_SECRET', secreto);
    const { app, token, query } = montar(['MESA_PARTES']);
    const response = await request(app).get('/api/v1/tesoreria/capacidades').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).not.toHaveBeenCalledWith("SELECT to_regclass('sigd_tes.orden_pago')::text tabla");
  });

  it('M10 rechaza con 403 CONTEXT_REVOKED si el contexto activo del token fue revocado', async () => {
    vi.stubEnv('AUTH_JWT_SECRET', secreto);
    const ctxId = '44444444-4444-4444-8444-444444444444';
    const { app, token } = montar(['TESORERO'], permisosTes, ctxId, true);
    const res = await request(app).get('/api/v1/tesoreria/capacidades').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CONTEXT_REVOKED');
  });

  it('garantía transaccional de operaciones financieras: ante revocación o error en vuelo, la transacción aborta con ROLLBACK', async () => {
    const { TesoreriaRepository } = await import('../../../../src/domains/tesoreria/tesoreria.repository.js');
    const queriesEjecutadas: string[] = [];
    const clientMock = {
      query: vi.fn(async (sql: string) => {
        queriesEjecutadas.push(sql);
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const poolMock = {
      connect: vi.fn(async () => clientMock),
    } as unknown as Pool;

    const repo = new TesoreriaRepository(poolMock);
    await expect(
      repo.transaccion(async (c) => {
        await c.query("INSERT INTO sigd_tes.pago (id) VALUES ('1')");
        throw new Error('REVOCACION_EN_VUELO');
      }),
    ).rejects.toThrow('REVOCACION_EN_VUELO');

    expect(queriesEjecutadas).toContain('BEGIN');
    expect(queriesEjecutadas).toContain('ROLLBACK');
    expect(queriesEjecutadas).not.toContain('COMMIT');
    expect(clientMock.release).toHaveBeenCalled();
  });
  it('coordinación transaccional: no se confirma la revisión de un pago si la facultad de TESORERO fue revocada antes del punto de confirmación', async () => {
    const { TesoreriaRepository } = await import('../../../../src/domains/tesoreria/tesoreria.repository.js');
    const { TesoreriaService } = await import('../../../../src/domains/tesoreria/tesoreria.service.js');

    const tesoreroId = '11111111-1111-4111-8111-111111111111';
    const pagoId = '77777777-7777-4777-8777-777777777777';
    const actor: ActorTesoreria = {
      usuario: tesoreroId,
      persona: '22222222-2222-4222-8222-222222222222',
      ciudadano: false,
      permisos: ['TESORERIA_PAGO_VERIFICAR'],
    };

    let transaccionIniciada = false;
    let rolRevocadoEnVuelo = false;
    const queriesEjecutadas: string[] = [];

    const clientMock = {
      query: vi.fn(async (sql: string) => {
        queriesEjecutadas.push(sql);
        if (sql === 'BEGIN') {
          transaccionIniciada = true;
          return { rows: [] };
        }
        if (sql.includes('SELECT p.*,o.ciudadano_id FROM sigd_tes.pago')) {
          rolRevocadoEnVuelo = true;
          return {
            rows: [{
              id: pagoId,
              orden_id: '88888888-8888-4888-8888-888888888888',
              ciudadano_id: '99999999-9999-4999-8999-999999999999',
              estado: 'EN_VERIFICACION',
              caja_id: null,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM sigd_org.usuario_rol ur')) {
          if (rolRevocadoEnVuelo) {
            return { rows: [], rowCount: 0 };
          }
          return { rows: [{ '?column?': 1 }], rowCount: 1 };
        }
        if (sql.includes('UPDATE sigd_tes.pago')) {
          return { rows: [{ id: pagoId, estado: 'VERIFICADO' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };

    const poolMock = {
      connect: vi.fn(async () => clientMock),
    } as unknown as Pool;

    const repo = new TesoreriaRepository(poolMock);
    const service = new TesoreriaService(repo);

    await expect(
      service.revisarPago(actor, pagoId, { estado: 'VERIFICADO', motivo: 'Voucher validado en ventanilla' }),
    ).rejects.toMatchObject({
      code: 'AUTORIZACION_REVOCADA',
      status: 403,
    });

    expect(transaccionIniciada).toBe(true);
    expect(queriesEjecutadas).toContain('BEGIN');
    expect(queriesEjecutadas).toContain('ROLLBACK');
    expect(queriesEjecutadas).not.toContain('COMMIT');
    const queryUpdatePago = queriesEjecutadas.find(q => q.includes('UPDATE sigd_tes.pago'));
    expect(queryUpdatePago).toBeUndefined();
    expect(clientMock.release).toHaveBeenCalled();
  });
});