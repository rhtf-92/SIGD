import request from 'supertest';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { construirApp } from '../../../../src/app.js';

function crearAppPrueba() {
  const pool = { connect: vi.fn() } as unknown as Pool;
  return construirApp(pool);
}

describe('rutas HTTP de validación IdentiCore', () => {
  it('valida DNI mediante query camelCase', async () => {
    const respuesta = await request(crearAppPrueba())
      .get('/api/v1/auth/validar-documento')
      .query({ tipoDocumento: 'DNI', numeroDocumento: '12345678' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ valido: true, tipo: 'DNI' });
  });

  it('acepta query snake_case y reporta el dígito verificador inválido', async () => {
    const respuesta = await request(crearAppPrueba())
      .get('/api/v1/auth/validar-documento')
      .query({ tipo_documento: 'RUC', numero_documento: '20123456780' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      valido: false,
      tipo: 'RUC',
      codigo: 'RUC_DIGITO_VERIFICADOR_INVALIDO',
    });
  });

  it('devuelve errores Zod con application/problem+json', async () => {
    const respuesta = await request(crearAppPrueba())
      .get('/api/v1/auth/validar-documento')
      .query({ tipoDocumento: 'PASAPORTE', numeroDocumento: '12345678' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.headers['content-type']).toContain('application/problem+json');
    expect(respuesta.body).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  });

  it('rechaza RUC inválido en el autoregistro con el código de dominio correspondiente', async () => {
    const respuesta = await request(crearAppPrueba())
      .post('/api/v1/auth/registro-persona-juridica')
      .send({
        tipo_persona: 'JURIDICA',
        ruc: '20123456780',
        razon_social: 'Entidad de prueba',
        dni_representante: '12345678',
        nombre_representante: 'Ana Perez Rojas',
        correo: 'ana@example.com',
        celular: '912345678',
        ubigeo_distrito: '250101',
        direccion: 'Jr. Lima 123',
        password: 'secreto123',
        consentimiento_datos: true,
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.headers['content-type']).toContain('application/problem+json');
    expect(respuesta.body).toMatchObject({
      code: 'RUC_DIGITO_VERIFICADOR_INVALIDO',
      invalid_params: [{ name: 'ruc', reason: 'RUC_DIGITO_VERIFICADOR_INVALIDO' }],
    });
  });
});