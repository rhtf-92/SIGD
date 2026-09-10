import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { obtenerAgente, limpiarAmbiente, cerrarAmbiente } from '../helpers/app.helper.js';
import { payloadRadicacionValido } from '../helpers/payloads.helper.js';

describe('E2E-03 · Registro duplicado (PostgreSQL 23505 → 409)', () => {
  beforeAll(async () => {
    await limpiarAmbiente();
  });

  afterAll(async () => {
    await cerrarAmbiente();
  });

  it('mapea la violación de unicidad a 409 DUPLICATE_KEY sin exponer mensaje del motor', async () => {
    const numeroUnico = `DUP-${Date.now()}`;
    const payload = { ...payloadRadicacionValido(), numero: numeroUnico };

    const primera = await obtenerAgente().post('/api/expedientes').send(payload);
    expect(primera.status).toBe(201);

    const segunda = await obtenerAgente().post('/api/expedientes').send(payload);

    expect(segunda.status).toBe(409);
    expect(segunda.body.code).toBe('DUPLICATE_KEY');
    expect(segunda.body.detail).not.toMatch(/duplicate key|23505/i);
  });
});