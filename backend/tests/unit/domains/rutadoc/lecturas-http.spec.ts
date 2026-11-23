import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';
import { expedienteDePrueba } from '../../../support/rutadoc-baseline-fixture.js';

const expedienteId = expedienteDePrueba(12);

function app(actor: ActorRutaDoc | null) {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const pool = { query: async (sql: string) => {
    if (sql.includes('AS inconsistente')) return { rows: [{ inconsistente: false }] };
    if (sql.includes('to_regclass')) return { rows: [{ existe: null }] };
    if (sql.includes('fecha_radicacion AT TIME ZONE')) return { rows: [{ fecha_inicio: hoy }] };
    throw new Error('No se esperaba acceso a PostgreSQL');
  }, connect: async () => ({
    query: async () => ({ rowCount: 0, rows: [] }),
    release: () => undefined,
  }) } as unknown as Pool;
  return construirApp(pool, { actorProviderRutaDoc: { obtenerActor: () => actor } });
}

describe('endpoints de lectura RutaDoc', () => {
  it('no distingue por HTTP/cuerpo público entre expediente ajeno e inexistente en trazabilidad', async () => {
    const responseAjeno = await request(app({ id: '8', roles: [], puedeVerExpediente: async () => false }))
      .get('/api/v1/expedientes/11111111-1111-4111-8111-111111111111/trazabilidad');
    const responseInexistente = await request(app({ id: '8', roles: [], puedeVerExpediente: async () => false }))
      .get('/api/v1/expedientes/99999999-9999-4999-8999-999999999999/trazabilidad');

    expect(responseAjeno.status).toBe(403);
    expect(responseInexistente.status).toBe(403);
    expect(responseAjeno.headers['content-type']).toContain('application/problem+json');
    expect(responseInexistente.headers['content-type']).toContain('application/problem+json');
    expect(responseAjeno.body).toMatchObject({ status: 403, code: 'FORBIDDEN', detail: 'No tiene privilegios para realizar esta operación.' });
    expect(responseInexistente.body).toMatchObject({ status: 403, code: 'FORBIDDEN', detail: 'No tiene privilegios para realizar esta operación.' });
    expect(Object.keys(responseAjeno.body).sort()).toEqual(Object.keys(responseInexistente.body).sort());
  });

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
      .get(`/api/v1/expedientes/${expedienteId}/sla-status`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ diasHabilesTranscurridos: 0, estado: 'VERDE' });
  });

  it.each(['12', 'uuid-malformado'])('sla-status rechaza ID de expediente no UUID: %s', async (id) => {
    const response = await request(app({ id: '8', roles: ['SUPER_ADMIN'], puedeVerExpediente: async () => true }))
      .get(`/api/v1/expedientes/${id}/sla-status`);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ status: 400, correlation_id: expect.any(String) });
  });

  it.each([
    [`/api/v1/expedientes/${expedienteId}/derivar`, { destinos: [{ area_destino_id: 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1' }], proveido: 'Derivar' }],
    [`/api/v1/expedientes/${expedienteId}/atender`, { resultado_resumen: 'Atendido' }],
    [`/api/v1/expedientes/${expedienteId}/archivar`, { estante: 'A', balda: '1', caja: '1' }],
  ])('registra la operación RutaDoc de main y exige identidad verificada: %s', async (path, body) => {
    const sinActor = await request(app(null)).post(path).set('x-usuario-id', 'no-verificado').send(body);
    expect(sinActor.status).toBe(401);

    const conActor = await request(app({
      id: '7',
      roles: ['SUPER_ADMIN'],
      permisos: [
        { codigo: 'EXPEDIENTE_DERIVAR', ambito: 'GLOBAL', areaId: null },
        { codigo: 'EXPEDIENTE_RESOLVER', ambito: 'GLOBAL', areaId: null },
      ],
    })).post(path).send(body);
    // La ruta autenticó al actor y consultó el expediente; la base de prueba indica que no existe.
    expect(conActor.status).toBe(404);
  });
});
