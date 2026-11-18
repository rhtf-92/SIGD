import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Pool } from 'pg';
import { crearRouterTramites } from '../../../../src/domains/tramicore/tramites.controller.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

// Mock de redis.service para verificar invalidación y nombres de claves namespaced
vi.mock('../../../../src/core/cache/redis.service.js', () => {
  const store = new Map<string, string>();
  return {
    getCached: vi.fn(async (key: string) => {
      const val = store.get(key);
      return val ? JSON.parse(val) : null;
    }),
    setCached: vi.fn(async (key: string, data: any) => {
      store.set(key, JSON.stringify(data));
    }),
    invalidateCache: vi.fn(async (pattern: string) => {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        for (const k of Array.from(store.keys())) {
          if (k.startsWith(prefix)) store.delete(k);
        }
      } else {
        store.delete(pattern);
      }
    }),
    rateLimitDistributed: vi.fn().mockResolvedValue({ count: 1, allowed: true, retryAfter: 60 }),
    isRedisAvailable: vi.fn().mockReturnValue(true),
    getRedisMetrics: vi.fn().mockResolvedValue({ conectado: true, memoriaUsada: '1MB', fragmentacion: 1.0, comandosProcesados: 100 }),
    getRedisClient: vi.fn().mockReturnValue(null),
    _rawStore: store,
  };
});

import { getCached, setCached, invalidateCache } from '../../../../src/core/cache/redis.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

describe('P1 — Consistencia de Caché TUPA por Versión (Codex Audit)', () => {
  const ID_V2026 = '11111111-2026-4111-8111-111111111111';
  const ID_V2027 = '22222222-2027-4222-8222-222222222222';

  const tokenAdmin = firmarTokenAcceso({
    sub: '11111111-1111-4111-8111-111111111111',
    roles: ['ADMINISTRADOR'],
    expiraSegundos: 3600,
  });

  let mockPool: Partial<Pool>;
  let versionActiva = ID_V2026;
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    (vi.mocked(invalidateCache) as any).mockClear();
    (vi.mocked(setCached) as any).mockClear();
    (vi.mocked(getCached) as any).mockClear();
    versionActiva = ID_V2026;

    mockPool = {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
          if (sql.includes('UPDATE sigd_doc.tupa_version')) {
            if (sql.includes('SET estado = \'VIGENTE\'')) {
              versionActiva = ID_V2027;
              return {
                rows: [{ id_version: ID_V2027, codigo: 'TUPA-2027', denominacion: 'TUPA 2027', anio: 2027, estado: 'VIGENTE' }],
                rowCount: 1,
              };
            }
            return { rowCount: 1, rows: [] };
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn(),
      } as any),
      query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
        // Identidad
        if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
          return {
            rows: [{ id_persona: 'p-1', activo: true, correo: 'admin@iestpsuiza.edu.pe', nombre_completo: 'Admin' }],
            rowCount: 1,
          };
        }
        // Versión vigente
        if (sql.includes('FROM sigd_doc.tupa_version') && sql.includes('estado = \'VIGENTE\'')) {
          if (versionActiva === ID_V2026) {
            return {
              rows: [{ id_version: ID_V2026, codigo: 'TUPA-2026', anio: 2026, estado: 'VIGENTE', total_procedimientos: 72 }],
              rowCount: 1,
            };
          } else {
            return {
              rows: [{ id_version: ID_V2027, codigo: 'TUPA-2027', anio: 2027, estado: 'VIGENTE', total_procedimientos: 72 }],
              rowCount: 1,
            };
          }
        }
        // Obtener versión por ID
        if (sql.includes('FROM sigd_doc.tupa_version') && sql.includes('id_version = $1')) {
          const reqId = params?.[0];
          return {
            rows: [{
              id_version: reqId,
              codigo: reqId === ID_V2026 ? 'TUPA-2026' : 'TUPA-2027',
              anio: reqId === ID_V2026 ? 2026 : 2027,
              estado: reqId === versionActiva ? 'VIGENTE' : 'BORRADOR',
            }],
            rowCount: 1,
          };
        }
        // Procedimientos de la versión
        if (sql.includes('FROM sigd_doc.tupa_procedimiento')) {
          return {
            rows: [
              {
                id_procedimiento: 'proc-1',
                id_version: versionActiva,
                codigo_ref: versionActiva === ID_V2026 ? 'TUPA-2026-P01' : 'TUPA-2027-P01',
                denominacion: versionActiva === ID_V2026 ? 'Procedimiento 2026' : 'Procedimiento 2027 Actualizado',
                categoria: 'PROCEDIMIENTO_APROBADO',
                monto: 10,
                plazo_dias: 5,
                requisitos: ['FUT'],
                genera_expediente: true,
                calificacion: 'AUTOMATICA',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    };

    app = express();
    app.use(express.json());
    app.use('/api/v1', crearRouterTramites(mockPool as Pool));
    app.use(errorMiddleware);
  });

  it('guarda cache namespaced por version y el siguiente GET devuelve la nueva versión inmediatamente tras publicar', async () => {
    // 1. Primer GET: con 2026 vigente, consulta y guarda en cache tupa:catalogo:v:${ID_V2026}:aprobados
    const res1 = await request(app).get('/api/v1/tramites/tupa?aprobados=true');
    expect(res1.status).toBe(200);
    expect(res1.body[0].codigoRef).toBe('TUPA-2026-P01');

    // Verificar que se invocó setCached con la clave namespaced por version
    expect(setCached).toHaveBeenCalledWith(
      `tupa:catalogo:v:${ID_V2026}:aprobados`,
      expect.any(Array),
      3600,
    );

    // 2. Administrador publica la versión 2027
    const resPub = await request(app)
      .post(`/api/v1/admin/tupa/versiones/${ID_V2027}/publicar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ motivoCambio: 'Aprobación mediante resolución 2027' });

    expect(resPub.status).toBe(200);
    // Verificar que se invalidó el patrón de catálogo
    expect(invalidateCache).toHaveBeenCalledWith('tupa:catalogo:*');

    // 3. Siguiente GET: debe devolver inmediatamente la versión 2027 sin esperar el TTL de 1 hora
    const res2 = await request(app).get('/api/v1/tramites/tupa?aprobados=true');
    expect(res2.status).toBe(200);
    expect(res2.body[0].codigoRef).toBe('TUPA-2027-P01');
    expect(res2.body[0].denominacion).toBe('Procedimiento 2027 Actualizado');

    // Y se almacena en la nueva clave de versión 2027
    expect(setCached).toHaveBeenCalledWith(
      `tupa:catalogo:v:${ID_V2027}:aprobados`,
      expect.any(Array),
      3600,
    );
  });
});
