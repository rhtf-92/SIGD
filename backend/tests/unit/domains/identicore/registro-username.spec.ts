import express from 'express';
import request from 'supertest';
import type { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';
import { crearRouterAuth } from '../../../../src/domains/identicore/auth.router.js';
import { RegistroCiudadanoService } from '../../../../src/domains/identicore/registroCiudadano.service.js';
import { registroCiudadanoSchema, registroPersonaJuridicaSchema } from '../../../../src/domains/identicore/registro.schemas.js';
import type { UbigeoService } from '../../../../src/domains/identicore/ubigeo.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

const natural = {
  tipoPersona: 'NATURAL', tipoDocumento: 'DNI', dni: '12345678',
  nombres: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: 'Ramos',
  correo: 'ana@example.test', celular: '961234567',
  ubigeoDistrito: '250101', direccion: 'Jr. Lima 123',
  password: 'MiClaveSegura#2026', consentimientoDatos: true,
  username: 'ana.perez',
};
const juridica = {
  tipoPersona: 'JURIDICA', ruc: '20131312955', razonSocial: 'Empresa Suiza',
  dniRepresentante: '12345678', nombreRepresentante: 'Ana Pérez Ramos',
  correo: 'empresa@example.test', celular: '961234567',
  ubigeoDistrito: '250101', direccion: 'Jr. Lima 123',
  password: 'MiClaveSegura#2026', consentimientoDatos: true,
  username: 'empresa.suiza',
};

afterEach(() => vi.restoreAllMocks());

describe('username en registro público', () => {
  it('lo exige en persona natural y jurídica', () => {
    expect(registroCiudadanoSchema.safeParse({ ...natural, username: undefined }).success).toBe(false);
    expect(registroPersonaJuridicaSchema.safeParse({ ...juridica, username: undefined }).success).toBe(false);
    expect(registroPersonaJuridicaSchema.safeParse(juridica).success).toBe(true);
  });

  it('normaliza trim y lowercase en backend', () => {
    const parsed = registroCiudadanoSchema.parse({ ...natural, username: '  Ana.Perez  ' });
    expect(parsed.username).toBe('ana.perez');
  });

  it.each(['ana perez', 'ana@perez', 'abc', 'a'.repeat(31), 'áñá.perez'])(
    'rechaza username inválido %s', (username) => {
      expect(registroCiudadanoSchema.safeParse({ ...natural, username }).success).toBe(false);
    },
  );

  it('guarda el username elegido y no el DNI en la misma transacción', async () => {
    vi.spyOn(Argon2Service, 'hash').mockResolvedValue('$argon2id$test');
    const statements: Array<{ sql: string; params?: unknown[] }> = [];
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      statements.push({ sql, params });
      if (sql.includes('FROM sigd_auth.tipos_documento')) return { rows: [{ id: '1' }] };
      if (sql.includes('AS existe')) return { rows: [{ existe: false, usuario_existente: false }] };
      if (sql.includes('INSERT INTO sigd_auth.persona_natural')) return { rows: [] };
      if (sql.includes('INSERT INTO sigd_auth.persona\n')) return { rows: [{ id: '11111111-1111-4111-8111-111111111111' }] };
      if (sql.includes('INSERT INTO sigd_auth.cuenta_usuario')) return { rows: [{ id: '22222222-2222-4222-8222-222222222222' }] };
      if (sql.includes('INSERT INTO sigd_org.usuario_rol')) return { rows: [{ id: '22222222-2222-4222-8222-222222222222' }] };
      return { rows: [] };
    });
    const pool = { connect: vi.fn().mockResolvedValue({ query, release: vi.fn() }) } as unknown as Pool;
    const ubigeo = { contieneDistrito: vi.fn().mockResolvedValue(true) } as unknown as UbigeoService;
    await new RegistroCiudadanoService(pool, ubigeo).registrarCiudadano(
      registroCiudadanoSchema.parse({ ...natural, username: '  Ana.Perez  ' }), null,
    );
    expect(statements.map((s) => s.sql.trim())).toContain('COMMIT');
    const insert = statements.find((s) => s.sql.includes('INSERT INTO sigd_auth.cuenta_usuario'));
    expect(insert?.params?.[1]).toBe('ana.perez');
    expect(insert?.params?.[1]).not.toBe(natural.dni);
  });

  it('rechaza username duplicado con 409 y revierte', async () => {
    vi.spyOn(Argon2Service, 'hash').mockResolvedValue('$argon2id$test');
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.tipos_documento')) return { rows: [{ id: '1' }] };
      if (sql.includes('AS existe')) return { rows: [{ existe: true, usuario_existente: true }] };
      return { rows: [] };
    });
    const pool = { connect: vi.fn().mockResolvedValue({ query, release: vi.fn() }) } as unknown as Pool;
    const ubigeo = { contieneDistrito: vi.fn().mockResolvedValue(true) } as unknown as UbigeoService;
    await expect(new RegistroCiudadanoService(pool, ubigeo).registrarCiudadano(
      registroCiudadanoSchema.parse(natural), null,
    )).rejects.toMatchObject({ status: 409, code: 'USERNAME_ALREADY_EXISTS', message: 'Este nombre de usuario ya está en uso.' });
    expect(query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('convierte la carrera de la restricción UNIQUE en 409 específico', async () => {
    vi.spyOn(Argon2Service, 'hash').mockResolvedValue('$argon2id$test');
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.tipos_documento')) return { rows: [{ id: '1' }] };
      if (sql.includes('AS existe')) return { rows: [{ existe: false, usuario_existente: false }] };
      if (sql.includes('INSERT INTO sigd_auth.persona_natural')) return { rows: [] };
      if (sql.includes('INSERT INTO sigd_auth.persona\n')) return { rows: [{ id: '11111111-1111-4111-8111-111111111111' }] };
      if (sql.includes('INSERT INTO sigd_auth.cuenta_usuario')) {
        throw { code: '23505', constraint: 'cuenta_usuario_usuario_key' };
      }
      return { rows: [] };
    });
    const pool = { connect: vi.fn().mockResolvedValue({ query, release: vi.fn() }) } as unknown as Pool;
    const ubigeo = { contieneDistrito: vi.fn().mockResolvedValue(true) } as unknown as UbigeoService;
    await expect(new RegistroCiudadanoService(pool, ubigeo).registrarCiudadano(
      registroCiudadanoSchema.parse(natural), null,
    )).rejects.toMatchObject({ status: 409, code: 'USERNAME_ALREADY_EXISTS' });
    expect(query).toHaveBeenCalledWith('ROLLBACK');
  });
});

describe('login de cuentas existentes y nuevas', () => {
  it.each(['ana.perez', 'ana@example.test'])('acepta %s con la misma contraseña', async (identificador) => {
    const hash = Argon2Service.generateFallbackHash('MiClaveSegura#2026');
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario') &&
          sql.includes('(c.usuario = $1 OR c.correo = $1)') &&
          ['ana.perez', 'ana@example.test'].includes(String(params?.[0]))) return { rows: [{
        id_usuario: '22222222-2222-4222-8222-222222222222',
        id_persona: '11111111-1111-4111-8111-111111111111',
        usuario: 'ana.perez', correo: 'ana@example.test', password_hash: hash,
        activo: true, nombre_completo: 'Ana Pérez Ramos', rol_codigo: 'CIUDADANO', area_id: null,
      }] };
      return { rows: [] };
    });
    const app = express();
    app.use(express.json());
    app.use('/api/v1', crearRouterAuth({ query } as unknown as Pool));
    app.use(errorMiddleware);
    const response = await request(app).post('/api/v1/auth/login')
      .send({ identificador, password: 'MiClaveSegura#2026' });
    expect(response.status).toBe(200);
    expect(query.mock.calls[0]?.[1]).toEqual([identificador]);
  });
});
