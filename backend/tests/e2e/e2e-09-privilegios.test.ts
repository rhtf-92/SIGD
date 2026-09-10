import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { obtenerAgente, limpiarAmbiente, cerrarAmbiente } from '../helpers/app.helper.js';

describe('E2E-09 · Privilegios insuficientes (operador → acción de administrador)', () => {
  beforeAll(async () => {
    await limpiarAmbiente();
  });

  afterAll(async () => {
    await cerrarAmbiente();
  });

  it('responde 403 Forbidden indicando privilegios insuficientes', async () => {
    const respuesta = await obtenerAgente().post('/api/accion-admin').set('x-auth', 't'.repeat(16));
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.code).toBe('FORBIDDEN');

    const sinToken = await obtenerAgente().post('/api/accion-admin');
    expect(sinToken.status).toBe(401);

    const admin = await obtenerAgente()
      .post('/api/accion-admin')
      .set('x-auth', 't'.repeat(16))
      .set('x-rol', 'admin');
    expect(admin.status).toBe(200);
  });
});