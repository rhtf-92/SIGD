import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';

function app(actor: ActorRutaDoc | null) {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const pool = { query: async (sql: string) => {
    if (sql.includes('creado_en AT TIME ZONE')) return { rows: [{ fecha_inicio: hoy }] };
    throw new Error('No se esperaba acceso a PostgreSQL');
  }, connect: async () => ({
    query: async () => ({ rowCount: 0, rows: [] }),
    release: () => undefined,
  }) } as unknown as Pool;
  return construirApp(pool, { actorProviderRutaDoc: { obtenerActor: () => actor } });
}

describe('endpoints de lectura RutaDoc', () => {
  it.each([
    '/api/v1/expedientes/12/trazabilidad',
    '/api/v1/expedientes/12/foliacion',
    '/api/v1/expedientes/12/sla-status',
    '/api/v1/expedientes/clasificador-ccd',
  ])('responde 401 sin actor autenticado: %s', async (path) => {
    const response = await request(app(null)).get(path);
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  it('deniega el CCD a un actor autenticado fuera de las políticas del módulo', async () => {
    const response = await request(app({ id: '8', roles: ['INVITADO'] })).get('/api/v1/expedientes/clasificador-ccd');
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ status: 403 });
  });

  it('resuelve la ruta CCD estática antes de /expedientes/:id y devuelve el catálogo predeterminado', async () => {
    const response = await request(app({ id: '8', roles: ['SUPER_ADMIN'] })).get('/api/v1/expedientes/clasificador-ccd');
    expect(response.status).toBe(200);
    expect(response.body.elementos[0]).toMatchObject({ tipo: 'SERIE', codigo: 'DEMO-01' });
    expect(response.body.elementos[0].hijos[0]).toMatchObject({ tipo: 'SUBSERIE', codigo: 'DEMO-01.01' });
  });

  it('sla-status responde con el calendario predeterminado sin requerir un port externo', async () => {
    const response = await request(app({ id: '8', roles: ['SUPER_ADMIN'], puedeVerExpediente: async () => true }))
      .get('/api/v1/expedientes/12/sla-status');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ diasHabilesTranscurridos: 0, estado: 'VERDE' });
  });

  it.each([
    ['/api/v1/expedientes/12/derivar', { destinos: [{ area_destino_id: 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1' }], proveido: 'Derivar' }],
    ['/api/v1/expedientes/12/atender', { resultado_resumen: 'Atendido' }],
    ['/api/v1/expedientes/12/archivar', { estante: 'A', balda: '1', caja: '1' }],
  ])('registra la operación RutaDoc de main y exige identidad verificada: %s', async (path, body) => {
    const sinActor = await request(app(null)).post(path).set('x-usuario-id', 'no-verificado').send(body);
    expect(sinActor.status).toBe(401);

    const conActor = await request(app({ id: '7', roles: ['SUPER_ADMIN'] })).post(path).send(body);
    // La ruta autenticó al actor y consultó el expediente; la base de prueba indica que no existe.
    expect(conActor.status).toBe(404);
  });
});
