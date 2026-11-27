import request from 'supertest';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

const SECRETO_PRUEBA = 'secreto-de-prueba-para-registros-ciudadanos';

function crearAppPrueba(query = vi.fn().mockResolvedValue({ rows: [] })) {
  const pool = { connect: vi.fn(), query } as unknown as Pool;
  return construirApp(pool);
}

function crearToken(roles: string[]) {
  process.env.AUTH_JWT_SECRET = SECRETO_PRUEBA;
  return firmarTokenAcceso({
    sub: '00000000-0000-0000-0000-000000000001',
    roles,
    secreto: SECRETO_PRUEBA,
  });
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
        declaracion_jurada: true,
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.headers['content-type']).toContain('application/problem+json');
    expect(respuesta.body).toMatchObject({
      code: 'RUC_DIGITO_VERIFICADOR_INVALIDO',
      invalid_params: [{ name: 'ruc', reason: 'RUC_DIGITO_VERIFICADOR_INVALIDO' }],
    });
  });

  it('requiere sesión para consultar registros ciudadanos', async () => {
    const respuesta = await request(crearAppPrueba())
      .get('/api/v1/auth/registro-ciudadanos');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('no permite a una cuenta ciudadana consultar el listado administrativo', async () => {
    const respuesta = await request(crearAppPrueba())
      .get('/api/v1/auth/registro-ciudadanos')
      .set('Authorization', `Bearer ${crearToken(['CIUDADANO'])}`);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('entrega registros paginados solo a roles administrativos autorizados', async () => {
    const registro = {
      id_persona: '00000000-0000-0000-0000-000000000002',
      tipo: 'NATURAL',
      tipo_documento: 'DNI',
      id_documento: '12345678',
      nombre_completo: 'María Pérez',
      correo: 'maria@example.com',
      telefono: '912345678',
      direccion: 'Jr. Lima 123',
      ubigeo_distrito: '250101',
      referencia_domicilio: null,
      fecha_nacimiento: '1990-01-01',
      razon_social: null,
      representante_legal: null,
      representante_tipo_documento: null,
      representante_documento: null,
      representante_cargo: null,
      partida_registral_sunarp: null,
      declaracion_jurada_aceptada: true,
      consentimiento_ley_29733: true,
      acepta_notificaciones: false,
      creado_en: '2026-11-18T10:00:00.000Z',
      total: '1',
    };
    const query = vi.fn().mockResolvedValue({ rows: [registro] });
    const respuesta = await request(crearAppPrueba(query))
      .get('/api/v1/auth/registro-ciudadanos')
      .query({ pagina: 1, porPagina: 10 })
      .set('Authorization', `Bearer ${crearToken(['ADMINISTRADOR'])}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      total: 1,
      pagina: 1,
      porPagina: 10,
      totalPaginas: 1,
      registros: [{ id_persona: registro.id_persona, correo: registro.correo }],
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('sigd_auth.persona'), [10, 0]);
  });
});