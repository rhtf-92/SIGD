import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import request from 'supertest';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenRefresco } from '../../../../src/core/auth/jwt.service.js';

process.env.AUTH_JWT_SECRET ??= 'test-only-jwt-secret-for-postgres-integration';

describe('rotación concurrente de refresh token con PostgreSQL', () => {
  let pool: Pool;
  let usuarioId: string;

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL no configurada por globalSetup');
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });

    const persona = await pool.query<{ id_persona: string }>(
      `INSERT INTO sigd_auth.persona (tipo, id_documento) VALUES ('NATURAL', $1) RETURNING id_persona`,
      [`QA-${randomUUID().replaceAll('-', '').slice(0, 16)}`],
    );
    await pool.query(
      `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo)
       VALUES ($1, 'Prueba', 'Refresh', 'Prueba Refresh')`,
      [persona.rows[0].id_persona],
    );
    const cuenta = await pool.query<{ id_usuario: string }>(
      `INSERT INTO sigd_auth.cuenta_usuario (id_persona, usuario, correo, password_hash)
       VALUES ($1, $2, $3, '$argon2id$v=19$m=65536,t=3,p=4$prueba$refresh') RETURNING id_usuario`,
      [persona.rows[0].id_persona, `qa-refresh-${randomUUID()}`, `qa-refresh-${randomUUID()}@example.test`],
    );
    usuarioId = cuenta.rows[0].id_usuario;
    const rol = await pool.query<{ rol_id: string }>("SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'CIUDADANO'");
    await pool.query('INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id) VALUES ($1, $2)', [usuarioId, rol.rows[0].rol_id]);
  });

  afterAll(async () => { await pool?.end(); });

  it('permite exactamente una rotación cuando dos solicitudes usan el mismo refresh token', async () => {
    const refreshToken = firmarTokenRefresco({ sub: usuarioId, rolActivo: 'ESTUDIANTE', rolesAutorizados: ['ESTUDIANTE'] });
    const huella = `sha256:${createHash('sha256').update(refreshToken, 'utf8').digest('hex')}`;
    await pool.query(
      `INSERT INTO sigd_auth.sesion_usuario (id_usuario, refresh_token, expira_en)
       VALUES ($1, $2, now() + interval '30 minutes')`,
      [usuarioId, huella],
    );
    const app = construirApp(pool);

    const respuestas = await Promise.all([
      request(app).post('/api/v1/auth/refresh').send({ refreshToken }),
      request(app).post('/api/v1/auth/refresh').send({ refreshToken }),
    ]);

    expect(respuestas.map((respuesta) => respuesta.status).sort()).toEqual([200, 401]);
    const sesionesActivas = await pool.query<{ total: string }>(
      'SELECT COUNT(*)::text AS total FROM sigd_auth.sesion_usuario WHERE id_usuario = $1 AND revocado_en IS NULL AND expira_en > now()',
      [usuarioId],
    );
    expect(Number(sesionesActivas.rows[0].total)).toBe(1);
  });
});
