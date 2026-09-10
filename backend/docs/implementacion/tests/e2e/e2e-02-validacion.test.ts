import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { obtenerAgente, limpiarAmbiente, cerrarAmbiente } from '../helpers/app.helper.js';
import { correlationIdFijo } from '../helpers/payloads.helper.js';

describe('E2E-02 · Validación de entrada (Zod → RFC 7807)', () => {
  beforeAll(async () => {
    await limpiarAmbiente();
  });

  afterAll(async () => {
    await cerrarAmbiente();
  });

  it('responde 400 VALIDATION_ERROR con invalid_params por campo', async () => {
    const id = correlationIdFijo();
    const respuesta = await obtenerAgente()
      .post('/api/expedientes')
      .set('x-correlation-id', id)
      .send({
        numero: '',
        dni_solicitante: '123',
        numero_documento: '',
        folios: -3,
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.code).toBe('VALIDATION_ERROR');
    expect(respuesta.body.status).toBe(400);
    expect(Array.isArray(respuesta.body.invalid_params)).toBe(true);
    expect(respuesta.body.invalid_params.length).toBeGreaterThan(0);

    const nombres = respuesta.body.invalid_params.map((p: { name: string }) => p.name);
    expect(nombres).toContain('numero_documento');
    expect(nombres).toContain('dni_solicitante');
    expect(nombres).toContain('folios');

    expect(respuesta.body.correlation_id).toBe(id);
    expect(respuesta.headers['x-correlation-id']).toBe(id);
  });
});