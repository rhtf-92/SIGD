import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import request from 'supertest';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso, firmarTokenRefresco } from '../../../../src/core/auth/jwt.service.js';

process.env.AUTH_JWT_SECRET ??= 'test-only-jwt-secret-for-postgres-integration';

describe('acuse de Casilla con PostgreSQL', () => {
  let pool: Pool;
  let usuarioId: string;
  let notificacionId: string;
  let accessToken: string;

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL no configurada por globalSetup');
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const persona = await pool.query<{ id_persona: string }>(
      `INSERT INTO sigd_auth.persona (tipo, id_documento) VALUES ('NATURAL', $1) RETURNING id_persona`,
      [`QA-${randomUUID().replaceAll('-', '').slice(0, 16)}`],
    );
    await pool.query(
      `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo)
       VALUES ($1, 'Prueba', 'Casilla', 'Prueba Casilla')`, [persona.rows[0].id_persona],
    );
    const cuenta = await pool.query<{ id_usuario: string }>(
      `INSERT INTO sigd_auth.cuenta_usuario (id_persona, usuario, correo, password_hash)
       VALUES ($1, $2, $3, '$argon2id$v=19$m=65536,t=3,p=4$prueba$casilla') RETURNING id_usuario`,
      [persona.rows[0].id_persona, `qa-casilla-${randomUUID()}`, `qa-casilla-${randomUUID()}@example.test`],
    );
    usuarioId = cuenta.rows[0].id_usuario;
    const rol = await pool.query<{ rol_id: string }>("SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'CIUDADANO'");
    await pool.query('INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id) VALUES ($1, $2)', [usuarioId, rol.rows[0].rol_id]);
    const refreshToken = firmarTokenRefresco({ sub: usuarioId, rolActivo: 'ESTUDIANTE', rolesAutorizados: ['ESTUDIANTE'] });
    const sid = `sha256:${createHash('sha256').update(refreshToken, 'utf8').digest('hex')}`;
    await pool.query(`INSERT INTO sigd_auth.sesion_usuario (id_usuario, refresh_token, expira_en)
      VALUES ($1, $2, now() + interval '30 minutes')`, [usuarioId, sid]);
    accessToken = firmarTokenAcceso({ sub: usuarioId, sid, rolActivo: 'ESTUDIANTE', rolesAutorizados: ['ESTUDIANTE'] });
    const notificacion = await pool.query<{ id: string }>(
      `INSERT INTO sigd_auth.notificacion_casilla (usuario_id, asunto, tipo_acto, estado)
       VALUES ($1, 'Aviso de prueba', 'RESOLUCION', 'NO_LEIDO') RETURNING id`, [usuarioId],
    );
    notificacionId = notificacion.rows[0].id;
  });

  afterAll(async () => { await pool?.end(); });

  it('conserva un único acuse bajo dos solicitudes concurrentes y no fabrica metadatos', async () => {
    const app = construirApp(pool);
    const endpoint = `/api/v1/casilla/notificaciones/${notificacionId}/acuse`;
    const lectura = await request(app).patch(`/api/v1/casilla/notificaciones/${notificacionId}/lectura`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(lectura.status).toBe(200);
    expect(lectura.body.id).toBe(notificacionId);
    expect(lectura.body.estado).toBe('LEIDO');
    expect(lectura.body.actoAdministrativo.tipoActo).toBe('RESOLUCION');

    const respuestas = await Promise.all([
      request(app).post(endpoint).set('Authorization', `Bearer ${accessToken}`),
      request(app).post(endpoint).set('Authorization', `Bearer ${accessToken}`),
    ]);
    expect(respuestas.map((respuesta) => respuesta.status).sort()).toEqual([200, 201]);
    expect(respuestas[0].body.data.idAcuse).toBe(respuestas[1].body.data.idAcuse);
    expect(respuestas[0].body.data.hashSha256Acuse).toBe(respuestas[1].body.data.hashSha256Acuse);
    expect(respuestas[0].body.data.timestampGeneracionIso).toBe(respuestas[1].body.data.timestampGeneracionIso);
    expect(respuestas[0].body.data.cvdAcuse).toBe('');
    expect(respuestas[0].body.data.destinatario.numeroDocumento).toBe('No registrado');
    const fila = await pool.query<{ id_acuse: string; acuse_hash_sha256: string }>(
      'SELECT id_acuse, acuse_hash_sha256 FROM sigd_auth.notificacion_casilla WHERE id=$1', [notificacionId],
    );
    expect(fila.rows[0].id_acuse).toBe(respuestas[0].body.data.idAcuse);
    expect(fila.rows[0].acuse_hash_sha256).toBe(respuestas[0].body.data.hashSha256Acuse);

    const lecturaPosterior = await request(app).patch(`/api/v1/casilla/notificaciones/${notificacionId}/lectura`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(lecturaPosterior.status).toBe(200);
    expect(lecturaPosterior.body.estado).toBe('NOTIFICADO');

    const bandeja = await request(app).get('/api/v1/casilla/notificaciones')
      .query({ tipo: 'RESOLUCION', estado: 'NOTIFICADO' }).set('Authorization', `Bearer ${accessToken}`);
    expect(bandeja.status).toBe(200);
    expect(bandeja.body.notificaciones.map((item: { id: string }) => item.id)).toContain(notificacionId);
    expect(bandeja.body.notificaciones[0].numeroNotificacion).toBe(notificacionId);

    const otroTipo = await request(app).get('/api/v1/casilla/notificaciones')
      .query({ tipo: 'OTRO' }).set('Authorization', `Bearer ${accessToken}`);
    expect(otroTipo.status).toBe(200);
    expect(otroTipo.body.notificaciones.map((item: { id: string }) => item.id)).not.toContain(notificacionId);
  });
});
