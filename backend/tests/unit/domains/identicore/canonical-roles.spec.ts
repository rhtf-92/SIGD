import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { construirApp } from '../../../../src/app.js';
import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';
import { verificarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

describe('Alineación Canónica de Roles F-09 (§9 / Codex)', () => {
  const hashValido = Argon2Service.generateFallbackHash('PasswordValida123!');

  it('asigna rol canónico CIUDADANO por defecto en token cuando un usuario no tiene rol_codigo en BD', async () => {
    let queryEjecutada = '';
    const fakePool = {
      query: vi.fn(async (queryText: string) => {
        if (queryText.includes('FROM sigd_auth.cuenta_usuario')) {
          queryEjecutada = queryText;
          return {
            rows: [
              {
                id_usuario: '11111111-1111-1111-1111-111111111111',
                id_persona: '22222222-2222-2222-2222-222222222222',
                usuario: 'ciudadano.test',
                correo: 'ciudadano@test.pe',
                password_hash: hashValido,
                activo: true,
                nombre_completo: 'Ciudadano Ejemplo',
                rol_codigo: null, // Sin rol explícito en BD
                area_id: null,
              },
            ],
            rowCount: 1,
          };
        }
        if (queryText.includes('INSERT INTO sigd_auth.sesion_usuario')) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      connect: vi.fn(async () => ({
        query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
        release: vi.fn(),
      })),
    } as unknown as Pool;

    const app = construirApp(fakePool);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identificador: 'ciudadano.test',
        password: 'PasswordValida123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();

    // Comprobar que la consulta SQL usa fallback 'CIUDADANO' y no 'ESTUDIANTE'
    expect(queryEjecutada).toContain("COALESCE(r.codigo, 'CIUDADANO') AS rol_codigo");
    expect(queryEjecutada).not.toContain("'ESTUDIANTE'");

    // Decodificar token de acceso y comprobar rol canónico
    const claims = verificarTokenAcceso(res.body.accessToken);
    expect(claims.roles).toEqual(['CIUDADANO']);
  });

  it('GET /api/v1/admin/roles-permisos devuelve catálogo canónico completo con ADMINISTRADOR y CIUDADANO en fallback', async () => {
    const fakePool = {
      query: vi.fn().mockRejectedValue(new Error('DB_DOWN_FALLBACK_TEST')),
      connect: vi.fn(),
    } as unknown as Pool;

    const app = construirApp(fakePool);

    const res = await request(app).get('/api/v1/admin/roles-permisos');

    expect(res.status).toBe(200);
    expect(res.body.roles).toBeDefined();

    const codigosRoles = res.body.roles.map((r: { codigo: string }) => r.codigo);
    expect(codigosRoles).toContain('ADMINISTRADOR');
    expect(codigosRoles).toContain('DIRECTOR');
    expect(codigosRoles).toContain('SECRETARIO');
    expect(codigosRoles).toContain('ESPECIALISTA');
    expect(codigosRoles).toContain('MESA_PARTES');
    expect(codigosRoles).toContain('CIUDADANO');
    expect(codigosRoles).not.toContain('DOCENTE');
    expect(codigosRoles).not.toContain('ESTUDIANTE');
  });
});
