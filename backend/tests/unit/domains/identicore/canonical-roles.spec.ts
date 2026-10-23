import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { construirApp } from '../../../../src/app.js';
import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';
import { verificarTokenAcceso, firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

describe('Alineación Canónica de Roles F-09 (§9 / Codex) & H-08', () => {
  const hashValido = Argon2Service.generateFallbackHash('PasswordValida123!');
  const tokenAdmin = firmarTokenAcceso({
    sub: '11111111-1111-1111-1111-111111111111',
    roles: ['ADMINISTRADOR'],
    expiraSegundos: 300,
  });

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

  it('H-08: GET /api/v1/admin/roles-permisos propaga 500 y NO usa arreglos sintéticos cuando falla la BD', async () => {
    const fakePool = {
      query: vi.fn().mockRejectedValue(new Error('DB_DOWN_FAIL_CLOSED_TEST')),
      connect: vi.fn(),
    } as unknown as Pool;

    const app = construirApp(fakePool);

    const res = await request(app)
      .get('/api/v1/admin/roles-permisos')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    // H-08: Debe propagar el error 500 a next(err) y no devolver 200 con fallbacks hardcodeados
    expect(res.status).toBe(500);
    expect(res.body.title || res.body.detail || res.body.type).toBeDefined();
  });

  it('H-08: GET /api/v1/admin/roles-permisos devuelve roles reales desde DB cuando la consulta es exitosa', async () => {
    const fakePool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { rol_id: 'r1', codigo: 'ADMINISTRADOR', nombre: 'Administrador' },
          { rol_id: 'r2', codigo: 'DIRECTOR', nombre: 'Director' },
          { rol_id: 'r3', codigo: 'CIUDADANO', nombre: 'Ciudadano' },
        ],
        rowCount: 3,
      }),
      connect: vi.fn(),
    } as unknown as Pool;

    const app = construirApp(fakePool);

    const res = await request(app)
      .get('/api/v1/admin/roles-permisos')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.roles).toBeDefined();
    const codigos = res.body.roles.map((r: { codigo: string }) => r.codigo);
    expect(codigos).toEqual(['ADMINISTRADOR', 'DIRECTOR', 'CIUDADANO']);
  });
});
