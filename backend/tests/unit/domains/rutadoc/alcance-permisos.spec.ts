import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import express from 'express';
import request from 'supertest';
import { crearRouterRutaDoc, politicaReversionPredeterminada } from '../../../../src/domains/rutadoc/rutadoc.router.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';

const expediente = '10000000-0000-4000-8000-000000000001';
const area = '20000000-0000-4000-8000-000000000001';
const actor: ActorRutaDoc = { id: '30000000-0000-4000-8000-000000000001', roles: ['ADMINISTRADOR', 'DIRECTOR'], permisos: [] };

describe('RutaDoc · el alcance global exige permiso GLOBAL y asignación sin área', () => {
  it('los nombres de rol solos no autorizan reversiones', async () => {
    const query = vi.fn();
    expect(await politicaReversionPredeterminada({ query } as unknown as Pool)(actor, expediente)).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it.each(['EXPEDIENTE_DERIVAR', 'EXPEDIENTE_RESOLVER', 'ADMIN_USUARIOS'])('no interpreta %s/AREA sin área como facultad global', async codigo => {
    const query = vi.fn();
    expect(await politicaReversionPredeterminada({ query } as unknown as Pool)({ ...actor,
      permisos: [{ codigo, ambito: 'AREA', areaId: null }],
    }, expediente)).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it('conserva la facultad administrativa GLOBAL explícita', async () => {
    expect(await politicaReversionPredeterminada({} as Pool)({ ...actor,
      permisos: [{ codigo: 'ADMIN_USUARIOS', ambito: 'GLOBAL', areaId: null }],
    }, expediente)).toBe(true);
  });

  it.each([false, true])('comprueba el área del expediente para una reversión limitada; acceso=%s', async autorizado => {
    const query = vi.fn().mockResolvedValue({ rows: [{ autorizado }] });
    expect(await politicaReversionPredeterminada({ query } as unknown as Pool)({ ...actor,
      permisos: [{ codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: area }],
    }, expediente)).toBe(autorizado);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ANY($2::text[])'), [expediente, [area]]);
  });

  it.each([
    { ambito: 'AREA' as const, areaId: null },
    { ambito: 'GLOBAL' as const, areaId: area },
  ])('rechaza una derivación con ámbito incoherente: %j, sin abrir transacción', async permiso => {
    const query = vi.fn(); const connect = vi.fn();
    const app = express(); app.use(express.json());
    app.use('/api/v1', crearRouterRutaDoc({ query, connect } as unknown as Pool,
      async () => ({ ...actor, permisos: [{ codigo: 'EXPEDIENTE_DERIVAR', ...permiso }] })));
    app.use(errorMiddleware);
    const res = await request(app).post(`/api/v1/expedientes/${expediente}/derivar`).send({});
    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled(); expect(connect).not.toHaveBeenCalled();
  });
});
