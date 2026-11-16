import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import supertest from 'supertest';
import type { Pool } from 'pg';
import { crearControladorReportes } from '../../../../src/domains/corelink/reportes.controller.js';
import type { ActorProviderRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.actor-provider.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';
import type { RepositorioMgdAnalytics } from '../../../../src/domains/corelink/mgdAnalytics.repository.js';
import { ServicioMgdAnalytics } from '../../../../src/domains/corelink/mgdAnalytics.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

describe('BJ-04: Analítica y Precedencia RBAC (Pruebas Negativas y Positivas)', () => {
  let app: Express;
  let mockActor: ActorRutaDoc | null = null;
  let mockActorProvider: ActorProviderRutaDoc;
  let mockRepositorio: RepositorioMgdAnalytics;
  let mockServicio: ServicioMgdAnalytics;

  beforeEach(() => {
    mockActor = null;
    mockActorProvider = {
      obtenerActor: vi.fn(async () => mockActor),
    };

    const mockPool = { query: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as Pool;
    mockRepositorio = {
      obtenerNombresUnidades: vi.fn().mockResolvedValue(new Map()),
      obtenerContadores: vi.fn().mockResolvedValue([]),
      obtenerTendencias: vi.fn().mockResolvedValue([]),
      obtenerRankingCuellosBotella: vi.fn().mockResolvedValue([]),
      obtenerDistribucionRetencion: vi.fn().mockResolvedValue(new Map()),
      refrescarVistas: vi.fn().mockResolvedValue(undefined),
    } as unknown as RepositorioMgdAnalytics;

    mockServicio = {
      resumen: vi.fn().mockResolvedValue({
        contadores: { nRadicados: 10, nAtendidos: 8, nResueltos: 5, nEnTramite: 5, horasHabilesSuma: 20 },
        vtep: 95.5,
        tprHorasHabiles: 4.0,
        tro: 85.0,
        teo: 15.0,
      }),
      cuellosBotella: vi.fn().mockResolvedValue([]),
      tendencias: vi.fn().mockResolvedValue([]),
      distribucionRetencion: vi.fn().mockResolvedValue(new Map()),
    } as unknown as ServicioMgdAnalytics;

    const controlador = crearControladorReportes(mockActorProvider, mockServicio, mockRepositorio);

    app = express();
    app.use(express.json());
    app.get('/api/v1/reportes/dashboard/resumen', controlador.resumen);
    app.get('/api/v1/reportes/dashboard/cuellos-botella', controlador.cuellosBotella);
    app.get('/api/v1/reportes/dashboard/tendencias', controlador.tendencias);
    app.get('/api/v1/reportes/tiempos-atencion', controlador.tiemposAtencion);
    app.use(errorMiddleware);
  });

  it('1. Sin sesión (actorProvider retorna null) -> responde 401 Unauthorized', async () => {
    mockActor = null;
    const res = await supertest(app).get('/api/v1/reportes/dashboard/resumen');
    expect(res.status).toBe(401);
    expect(res.body.code || res.body.codigo).toBe('UNAUTHORIZED');
  });

  it('2. Ciudadano autenticado sin permiso REPORTE_LEER -> responde 403 Forbidden', async () => {
    mockActor = {
      id: '00000000-0000-0000-0000-000000000001',
      roles: ['CIUDADANO'],
      permisos: [],
      unidadOrganicaId: null,
      puedeVerExpediente: vi.fn().mockResolvedValue(false),
    };
    const res = await supertest(app).get('/api/v1/reportes/dashboard/resumen');
    expect(res.status).toBe(403);
    expect(res.body.code || res.body.codigo).toBe('FORBIDDEN');
  });

  it('3. Operador de Mesa de Partes sin permiso REPORTE_LEER -> responde 403 Forbidden', async () => {
    mockActor = {
      id: '00000000-0000-0000-0000-000000000002',
      roles: ['OPERADOR_MESA_PARTES'],
      permisos: [{ codigo: 'EXPEDIENTE_REGISTRAR', ambito: 'GLOBAL', areaId: null }],
      unidadOrganicaId: '00000000-0000-4000-8000-000000000001',
      puedeVerExpediente: vi.fn().mockResolvedValue(true),
    };
    const res = await supertest(app).get('/api/v1/reportes/dashboard/cuellos-botella');
    expect(res.status).toBe(403);
    expect(res.body.code || res.body.codigo).toBe('FORBIDDEN');
  });

  it('4. JWT con rol DIRECTOR pero sin permiso institucional persistido REPORTE_LEER -> responde 403 Forbidden (no hay bypass por roles de token)', async () => {
    mockActor = {
      id: '00000000-0000-0000-0000-000000000003',
      roles: ['DIRECTOR'],
      permisos: [], // No tiene REPORTE_LEER en BD
      unidadOrganicaId: null,
      puedeVerExpediente: vi.fn().mockResolvedValue(true),
    };
    const res = await supertest(app).get('/api/v1/reportes/dashboard/tendencias');
    expect(res.status).toBe(403);
    expect(res.body.code || res.body.codigo).toBe('FORBIDDEN');
  });

  it('5. Actor con permisos inventados (no REPORTE_LEER) -> responde 403 Forbidden', async () => {
    mockActor = {
      id: '00000000-0000-0000-0000-000000000004',
      roles: ['ADMIN_INVENTADO'],
      permisos: [{ codigo: 'PERMISO_FICTICIO', ambito: 'GLOBAL', areaId: null }],
      unidadOrganicaId: null,
      puedeVerExpediente: vi.fn().mockResolvedValue(true),
    };
    const res = await supertest(app).get('/api/v1/reportes/tiempos-atencion');
    expect(res.status).toBe(403);
    expect(res.body.code || res.body.codigo).toBe('FORBIDDEN');
  });

  it('6. Actor con actor.permisos undefined -> responde 403 Forbidden fail-closed', async () => {
    mockActor = {
      id: '00000000-0000-0000-0000-000000000005',
      roles: ['DIRECTOR'],
      permisos: undefined as unknown as [],
      unidadOrganicaId: null,
      puedeVerExpediente: vi.fn().mockResolvedValue(true),
    };
    const res = await supertest(app).get('/api/v1/reportes/dashboard/resumen');
    expect(res.status).toBe(403);
    expect(res.body.code || res.body.codigo).toBe('FORBIDDEN');
  });

  it('7. Actor con permiso institucional válido REPORTE_LEER -> responde 200 OK con DTO analítico', async () => {
    mockActor = {
      id: '00000000-0000-0000-0000-000000000006',
      roles: ['DIRECTOR'],
      permisos: [{ codigo: 'REPORTE_LEER', ambito: 'GLOBAL', areaId: null }],
      unidadOrganicaId: null,
      puedeVerExpediente: vi.fn().mockResolvedValue(true),
    };
    const res = await supertest(app).get('/api/v1/reportes/dashboard/resumen');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('contadores');
    expect(res.body).toHaveProperty('vtep');
    expect(mockServicio.resumen).toHaveBeenCalled();
  });
});
