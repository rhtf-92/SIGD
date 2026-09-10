import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { obtenerAgente, limpiarAmbiente, cerrarAmbiente } from '../helpers/app.helper.js';

describe('E2E-08 · Acceso a ruta protegida sin token', () => {
  beforeAll(async () => {
    await limpiarAmbiente();
  });

  afterAll(async () => {
    await cerrarAmbiente();
  });

  it('responde 401 Unauthorized en RFC 7807 sin acceder a la BD', async () => {
    const respuesta = await obtenerAgente().get('/api/protegido');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.code).toBe('UNAUTHORIZED');
    expect(respuesta.body.type).toMatch(/unauthorized$/);
    expect(respuesta.body.correlation_id).toBeTruthy();
  });
});