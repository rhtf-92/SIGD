import type { Pool, PoolClient } from 'pg';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';

const mockExpedienteId = '9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca';
const mockAreaSecId = '2b147b0d-7c8f-434f-b75a-598a1ccb855b';
const mockOperadorId = '00000000-0000-0000-0000-000000000030';

function crearAppRecepcion(actor: ActorRutaDoc | null, poolQueryMock?: any, clientQueryMock?: any) {
  const defaultPoolQuery = async (sql: string, params?: any[]) => {
    // RBAC check in rutadoc.router.ts
    if (sql.includes('SELECT EXISTS') && sql.includes('sigd_rut.estado_actual_expediente')) {
      const areasParam = params?.[1] || [];
      const autorizado = Array.isArray(areasParam) && areasParam.includes(mockAreaSecId);
      return { rows: [{ autorizado }] };
    }
    return { rows: [] };
  };

  const defaultClientQuery = async (sql: string) => {
    if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
      return { rowCount: 1, rows: [] };
    }
    if (sql.includes('FOR UPDATE OF e')) {
      return {
        rowCount: 1,
        rows: [{
          expediente_id: mockExpedienteId,
          codigo_expediente: 'EXP-2026-000011',
          estado_actual: 'DERIVADO',
          area_actual_id: mockAreaSecId,
          secuencia: '2',
        }],
      };
    }
    if (sql.includes('information_schema.columns')) {
      return { rowCount: 1, rows: [{ data_type: 'bigint' }] };
    }
    if (sql.includes('operador_identidad')) {
      return { rowCount: 1, rows: [{ operador_id: '990000003' }] };
    }
    if (sql.includes('INSERT INTO sigd_rut.movimiento_tramite')) {
      return { rowCount: 1, rows: [{ id_movimiento: 'mov-recep-001', secuencia: '3' }] };
    }
    if (sql.includes('sigd_audit.evento_outbox')) {
      return { rowCount: 1, rows: [{ id_evento: 'evt-recep-001' }] };
    }
    return { rowCount: 0, rows: [] };
  };

  const pool = {
    query: poolQueryMock ?? defaultPoolQuery,
    connect: async () => ({
      query: clientQueryMock ?? defaultClientQuery,
      release: () => undefined,
    } as unknown as PoolClient),
  } as unknown as Pool;

  return construirApp(pool, {
    actorProviderRutaDoc: { obtenerActor: () => actor },
  });
}

describe('T-BE-RD-12 / FASE 7B: Endpoint HTTP de Recepción Formal [HAL-B03-07 / OBS-13-01]', () => {
  it('1. POST /api/v1/expedientes/:id/recepcionar retorna 200 OK con payload institucional cuando está autorizado con EXPEDIENTE_RECEPCIONAR en ámbito AREA', async () => {
    const actorSec: ActorRutaDoc = {
      id: mockOperadorId,
      roles: ['SECRETARIO'],
      unidadOrganicaId: mockAreaSecId,
      permisos: [
        { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'AREA', areaId: mockAreaSecId },
      ],
    };

    const res = await request(crearAppRecepcion(actorSec))
      .post(`/api/v1/expedientes/${mockExpedienteId}/recepcionar`)
      .send({ observaciones: 'Conforme para revisión académica' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      mensaje: 'Recepción formal registrada exitosamente.',
      expediente_id: mockExpedienteId,
      nuevoEstado: 'EN_REVISION',
      secuencia: '3',
    });
  });

  it('2. POST /api/v1/expedientes/:id/movimientos/recepcionar ruta alias funciona idénticamente con EXPEDIENTE_RECEPCIONAR', async () => {
    const actorSec: ActorRutaDoc = {
      id: mockOperadorId,
      roles: ['SECRETARIO'],
      unidadOrganicaId: mockAreaSecId,
      permisos: [
        { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'AREA', areaId: mockAreaSecId },
      ],
    };

    const res = await request(crearAppRecepcion(actorSec))
      .post(`/api/v1/expedientes/${mockExpedienteId}/movimientos/recepcionar`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.nuevoEstado).toBe('EN_REVISION');
  });

  it('3. autoriza la recepción cuando el actor posee EXPEDIENTE_RECEPCIONAR con ámbito GLOBAL', async () => {
    const actorGlobal: ActorRutaDoc = {
      id: mockOperadorId,
      roles: [],
      unidadOrganicaId: null,
      permisos: [
        { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'GLOBAL', areaId: null },
      ],
    };

    const res = await request(crearAppRecepcion(actorGlobal))
      .post(`/api/v1/expedientes/${mockExpedienteId}/recepcionar`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.nuevoEstado).toBe('EN_REVISION');
  });

  it('4. rechaza con 401 Unauthorized cuando el usuario no envía token o actor es nulo', async () => {
    const res = await request(crearAppRecepcion(null))
      .post(`/api/v1/expedientes/${mockExpedienteId}/recepcionar`)
      .send({});

    expect(res.status).toBe(401);
  });

  it('5. [HARDENING OBS-13-01] rechaza con 403 Forbidden cuando el actor autenticado tiene permisos undefined', async () => {
    const actorPermisosUndefined: ActorRutaDoc = {
      id: mockOperadorId,
      roles: ['SECRETARIO'],
      unidadOrganicaId: mockAreaSecId,
      permisos: undefined,
    };

    const res = await request(crearAppRecepcion(actorPermisosUndefined))
      .post(`/api/v1/expedientes/${mockExpedienteId}/recepcionar`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('6. [HARDENING OBS-13-01] rechaza con 403 Forbidden cuando el operador no tiene permisos configurados (array vacío)', async () => {
    const actorSinPermisos: ActorRutaDoc = {
      id: mockOperadorId,
      roles: ['DOCENTE'],
      unidadOrganicaId: mockAreaSecId,
      permisos: [],
    };

    const res = await request(crearAppRecepcion(actorSinPermisos))
      .post(`/api/v1/expedientes/${mockExpedienteId}/recepcionar`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('7. rechaza con 403 Forbidden cuando el operador solo posee EXPEDIENTE_DERIVAR pero no EXPEDIENTE_RECEPCIONAR', async () => {
    const actorDerivar: ActorRutaDoc = {
      id: mockOperadorId,
      roles: ['SECRETARIO'],
      unidadOrganicaId: mockAreaSecId,
      permisos: [
        { codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: mockAreaSecId },
      ],
    };

    const res = await request(crearAppRecepcion(actorDerivar))
      .post(`/api/v1/expedientes/${mockExpedienteId}/recepcionar`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('8. rechaza con 403 Forbidden cuando el operador solo posee EXPEDIENTE_RESOLVER pero no EXPEDIENTE_RECEPCIONAR', async () => {
    const actorResolver: ActorRutaDoc = {
      id: mockOperadorId,
      roles: ['SECRETARIO'],
      unidadOrganicaId: mockAreaSecId,
      permisos: [
        { codigo: 'EXPEDIENTE_RESOLVER', ambito: 'AREA', areaId: mockAreaSecId },
      ],
    };

    const res = await request(crearAppRecepcion(actorResolver))
      .post(`/api/v1/expedientes/${mockExpedienteId}/recepcionar`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('9. rechaza con 403 Forbidden cuando el operador tiene EXPEDIENTE_RECEPCIONAR para otra área distinta', async () => {
    const actorOtraArea: ActorRutaDoc = {
      id: '00000000-0000-0000-0000-000000000099',
      roles: ['OPERADOR_MP'],
      unidadOrganicaId: '11111111-1111-4111-8111-111111111111',
      permisos: [
        { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'AREA', areaId: '11111111-1111-4111-8111-111111111111' },
      ],
    };

    const res = await request(crearAppRecepcion(actorOtraArea))
      .post(`/api/v1/expedientes/${mockExpedienteId}/recepcionar`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('10. rechaza con 409 Conflict cuando el expediente ya se encuentra en EN_REVISION', async () => {
    const actorSec: ActorRutaDoc = {
      id: mockOperadorId,
      roles: ['SECRETARIO'],
      unidadOrganicaId: mockAreaSecId,
      permisos: [
        { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'AREA', areaId: mockAreaSecId },
      ],
    };

    const clientQueryMock = async (sql: string) => {
      if (sql.includes('FOR UPDATE OF e')) {
        return {
          rowCount: 1,
          rows: [{
            expediente_id: mockExpedienteId,
            codigo_expediente: 'EXP-2026-000011',
            estado_actual: 'EN_REVISION',
            area_actual_id: mockAreaSecId,
            secuencia: '3',
          }],
        };
      }
      return { rowCount: 1, rows: [] };
    };

    const res = await request(crearAppRecepcion(actorSec, undefined, clientQueryMock))
      .post(`/api/v1/expedientes/${mockExpedienteId}/recepcionar`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EXPEDIENTE_YA_RECEPCIONADO');
  });

  it('11. rechaza con 404 Not Found cuando el expediente no existe', async () => {
    const actorSec: ActorRutaDoc = {
      id: mockOperadorId,
      roles: ['SECRETARIO'],
      unidadOrganicaId: mockAreaSecId,
      permisos: [
        { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'AREA', areaId: mockAreaSecId },
      ],
    };

    const clientQueryMock = async (sql: string) => {
      if (sql.includes('FOR UPDATE OF e')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    };

    const res = await request(crearAppRecepcion(actorSec, undefined, clientQueryMock))
      .post(`/api/v1/expedientes/${mockExpedienteId}/recepcionar`)
      .send({});

    expect(res.status).toBe(404);
  });

  it('12. [HARDENING OBS-13-01] la operacion de derivacion mantiene fail-closed estricto: rechaza con 403 si tiene permisos undefined o solo EXPEDIENTE_RECEPCIONAR', async () => {
    const actorPermisosUndefined: ActorRutaDoc = {
      id: mockOperadorId,
      roles: ['SECRETARIO'],
      unidadOrganicaId: mockAreaSecId,
      permisos: undefined,
    };

    const resUndefined = await request(crearAppRecepcion(actorPermisosUndefined))
      .post(`/api/v1/expedientes/${mockExpedienteId}/derivar`)
      .send({ areaDestinoId: mockAreaSecId });

    expect(resUndefined.status).toBe(403);

    const actorSoloRecepcion: ActorRutaDoc = {
      id: mockOperadorId,
      roles: ['SECRETARIO'],
      unidadOrganicaId: mockAreaSecId,
      permisos: [
        { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'AREA', areaId: mockAreaSecId },
      ],
    };

    const resSoloRecep = await request(crearAppRecepcion(actorSoloRecepcion))
      .post(`/api/v1/expedientes/${mockExpedienteId}/derivar`)
      .send({ areaDestinoId: mockAreaSecId });

    expect(resSoloRecep.status).toBe(403);
  });
});
