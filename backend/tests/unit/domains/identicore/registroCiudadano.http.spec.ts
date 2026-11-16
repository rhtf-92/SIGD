import request from 'supertest';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { construirApp } from '../../../../src/app.js';

describe('HTTP de Registro Ciudadano sin persistencia compatible', () => {
  it('responde 503 antes de conectar una transacción si no hay columnas para domicilio y ubigeo', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const connect = vi.fn();
    const app = construirApp({ query, connect } as unknown as Pool);
    const respuesta = await request(app)
      .post('/api/v1/auth/registro-ciudadano')
      .send({
        tipoPersona: 'NATURAL',
        dni: '12345678',
        nombres: 'Ana',
        apellidoPaterno: 'Perez',
        apellidoMaterno: 'Rojas',
        fechaNacimiento: '1990-01-01',
        correo: 'ana@example.com',
        celular: '912345678',
        ubigeoDistrito: '250101',
        direccion: 'Jr. Lima 123',
        password: 'secreto123',
        consentimientoDatos: true,
        declaracionJuradaAceptada: true,
        aceptaNotificaciones: false,
      });

    expect(respuesta.status).toBe(503);
    expect(respuesta.headers['content-type']).toContain('application/problem+json');
    expect(respuesta.body).toMatchObject({
      code: 'REGISTRO_MODELO_NO_COMPATIBLE',
      detail: expect.stringContaining('No se ha creado ninguna cuenta.'),
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(connect).not.toHaveBeenCalled();
  });

  it('acepta el contrato explícito de CE y lo bloquea por persistencia, no por validación DNI', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const connect = vi.fn();
    const app = construirApp({ query, connect } as unknown as Pool);
    const respuesta = await request(app)
      .post('/api/v1/auth/registro-ciudadano')
      .send({
        tipoPersona: 'NATURAL',
        tipoDocumento: 'CE',
        numeroDocumento: 'X123456789',
        nombres: 'Ana',
        apellidoPaterno: 'Perez',
        apellidoMaterno: '',
        fechaNacimiento: '2000-01-01',
        correo: 'ana@example.com',
        celular: '912345678',
        ubigeoDistrito: '250101',
        direccion: 'Jr. Lima 123',
        password: 'secreto123',
        consentimientoDatos: true,
        declaracionJuradaAceptada: true,
      });

    expect(respuesta.status).toBe(503);
    expect(respuesta.body.code).toBe('REGISTRO_MODELO_NO_COMPATIBLE');
    expect(connect).not.toHaveBeenCalled();
  });
});
