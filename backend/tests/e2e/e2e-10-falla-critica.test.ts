import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { obtenerAgente, limpiarAmbiente, cerrarAmbiente } from '../helpers/app.helper.js';

describe('E2E-10 · Falla crítica inducida (errores 500 seguros)', () => {
  beforeAll(async () => {
    await limpiarAmbiente();
  });

  afterAll(async () => {
    await cerrarAmbiente();
  });

  it('serializa 500 INTERNAL_ERROR sin filtrar stack traces ni rutas internas', async () => {
    const respuesta = await obtenerAgente().get('/api/falla-critica');

    expect(respuesta.status).toBe(500);
    expect(respuesta.body.code).toBe('INTERNAL_ERROR');
    expect(respuesta.body.detail).toBe('Ocurrió un error interno en el servidor.');
    expect(respuesta.body.type).toMatch(/internal_error$/);

    const cuerpo = JSON.stringify(respuesta.body);
    expect(cuerpo).not.toMatch(/falla inducida|stack|at /i);
    expect(respuesta.body.correlation_id).toBeTruthy();
  });
});