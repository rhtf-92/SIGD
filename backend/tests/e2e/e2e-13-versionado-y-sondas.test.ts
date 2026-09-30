import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { obtenerAgente, limpiarAmbiente, cerrarAmbiente } from '../helpers/app.helper.js';
import { payloadRadicacionValido } from '../helpers/payloads.helper.js';

describe('E2E-13 · Versionado canónico /api/v1, alias legado y sondas', () => {
  beforeAll(async () => {
    await limpiarAmbiente();
  });

  afterAll(async () => {
    await cerrarAmbiente();
  });

  it('GET /health responde 200 con el estado de las dependencias', async () => {
    const respuesta = await obtenerAgente().get('/health');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.status).toBe('ok');
    expect(respuesta.body.dependencias.postgres.estado).toBe('ok');
    expect(respuesta.body.dependencias.postgres.detalle).toMatch(/PostgreSQL/i);
  });

  it('GET /ready responde 200 cuando PostgreSQL está disponible', async () => {
    const respuesta = await obtenerAgente().get('/ready');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.status).toBe('ok');
    expect(respuesta.body.dependencias.postgres.estado).toBe('ok');
  });

  it('sirve la referencia bajo el prefijo canónico /api/v1', async () => {
    const radicado = await obtenerAgente()
      .post('/api/v1/expedientes')
      .send(await payloadRadicacionValido());

    expect(radicado.status).toBe(201);
    expect(radicado.body.expediente_id).toBeDefined();
  });

  it('conserva el prefijo legado /api con Warning 299 de deprecación', async () => {
    const radicado = await obtenerAgente()
      .post('/api/expedientes')
      .send(await payloadRadicacionValido());

    expect(radicado.status).toBe(201);
    expect(radicado.headers['warning']).toMatch(/^299/);
    expect(radicado.headers['warning']).toMatch(/\/api\/v1/);
  });

  it('NO expone las sondas bajo el prefijo versionado', async () => {
    const respuesta = await obtenerAgente().get('/api/v1/health');

    expect(respuesta.status).toBe(404);
  });

  it('exige identidad autenticada en la cola de firma', async () => {
    const sinIdentidad = await obtenerAgente().get('/api/v1/firma/pendientes');
    expect(sinIdentidad.status).toBe(403);

    const conIdentidad = await obtenerAgente()
      .get('/api/v1/firma/pendientes')
      .set('x-usuario-id', '11111111-1111-4111-8111-111111111111');
    expect(conIdentidad.status).toBe(200);
    expect(conIdentidad.body.documentos).toEqual([]);
    expect(conIdentidad.body.total).toBe(0);
  });

  it('rechaza parámetros de consulta fuera del contrato de la cola de firma', async () => {
    const respuesta = await obtenerAgente()
      .get('/api/v1/firma/pendientes?porPagina=1000')
      .set('x-usuario-id', '11111111-1111-4111-8111-111111111111');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.type).toBeDefined();
  });

  it('mantiene la protección de rutas de la referencia bajo el prefijo canónico', async () => {
    const sinCredencial = await obtenerAgente().get('/api/v1/protegido');
    expect(sinCredencial.status).toBe(401);

    const conCredencial = await obtenerAgente().get('/api/v1/protegido').set('x-auth', 'test');
    expect(conCredencial.status).toBe(200);
    expect(conCredencial.body.ok).toBe(true);
  });

  it('no marca deprecación las rutas canónicas', async () => {
    const radicado = await obtenerAgente()
      .post('/api/v1/expedientes')
      .send(await payloadRadicacionValido());

    expect(radicado.status).toBe(201);
    expect(radicado.headers['warning']).toBeUndefined();
  });
});
