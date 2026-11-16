import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Pool } from 'pg';
import { crearRouterTramites } from '../../../../src/domains/tramicore/tramites.controller.js';
import { CATALOGO_TUPA_2026 } from '../../../../src/domains/tramicore/catalogoTupa2026.js';

describe('Catálogo institucional TUPA 2026', () => {
  it('mantiene 72 filas del documento, con claves internas únicas', () => {
    expect(CATALOGO_TUPA_2026).toHaveLength(72);
    expect(new Set(CATALOGO_TUPA_2026.map((item) => item.codigoInterno)).size).toBe(72);
    expect(CATALOGO_TUPA_2026[0].codigoVisible).toBe('SUZ26-001');
    expect(CATALOGO_TUPA_2026[71].codigoVisible).toBe('SUZ26-072');
    expect(CATALOGO_TUPA_2026[71].numeroVisible).toBe('072');
    expect(CATALOGO_TUPA_2026.every((item, idx) => item.codigoVisible === `SUZ26-${String(idx + 1).padStart(3, '0')}`)).toBe(true);
    expect(CATALOGO_TUPA_2026.every((item) => item.paginaFuente >= 1 && item.paginaFuente <= 6)).toBe(true);
  });

  it('preserva las filas con variantes como agrupaciones, no como códigos oficiales', () => {
    expect(CATALOGO_TUPA_2026.find((item) => item.codigoInterno === 'SUZ26-021')?.referenciasInternas)
      .toEqual(['SUZ26-021', 'SUZ26-022']);
    expect(CATALOGO_TUPA_2026.find((item) => item.codigoInterno === 'SUZ26-069')?.referenciasInternas)
      .toEqual(['SUZ26-069', 'SUZ26-070', 'SUZ26-071']);
    expect(CATALOGO_TUPA_2026.every((item) => item.referenciasInternas.every((code) => /^SUZ26-\d{3}$/.test(code)))).toBe(true);
  });

  it('sirve las 72 filas por el endpoint HTTP de consulta', async () => {
    const app = express();
    app.use('/api/v1', crearRouterTramites({} as Pool));
    const response = await request(app).get('/api/v1/tramites/catalogo-tupa-2026');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(72);
    expect(response.headers['cache-control']).toContain('max-age=300');
  });
});
