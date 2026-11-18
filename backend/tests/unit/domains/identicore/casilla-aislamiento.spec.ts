import request from 'supertest';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

const usuarioA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const usuarioB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const avisoA = 'aaaaaaaa-0000-4000-8000-000000000001';
const avisoB = 'bbbbbbbb-0000-4000-8000-000000000002';
const secreto = 'casilla-test-secret-32-characters-minimum';

function fila(id: string, usuarioId: string) {
  return {
    id, usuario_id: usuarioId, correo_destinatario: `${usuarioId}@example.test`, cut: null,
    asunto: 'Aviso de prueba', tipo_acto: 'Notificación', numero_documento: null,
    cuerpo: null, referencia: null, estado: 'NO_LEIDO', fecha_deposito: new Date('2026-01-01T00:00:00Z'),
    fecha_lectura: null, hash_sha256: null, cvd: null, id_acuse: null,
    acuse_hash_sha256: null, acuse_sellado_tiempo: null, documento_url: null,
    creado_en: new Date('2026-01-01T00:00:00Z'),
  };
}

describe('Casilla: identidad JWT y aislamiento entre ciudadanos', () => {
  const anterior = process.env.AUTH_JWT_SECRET;
  beforeAll(() => { process.env.AUTH_JWT_SECRET = secreto; });
  afterAll(() => { if (anterior === undefined) delete process.env.AUTH_JWT_SECRET; else process.env.AUTH_JWT_SECRET = anterior; });

  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    const idSolicitado = params[0];
    const usuarioSolicitante = params[1];
    if (sql.includes('FROM sigd_auth.notificacion_casilla') && sql.includes('COUNT(*)')) {
      expect(sql).toContain('usuario_id = $1::uuid');
      return { rows: [{ total: '1', no_leidas: '1' }], rowCount: 1 };
    }
    if (sql.includes('FROM sigd_auth.notificacion_casilla') && sql.includes('LIMIT')) {
      expect(sql).toContain('usuario_id = $1::uuid');
      const usuarioId = params[0] as string;
      return { rows: [fila(usuarioId === usuarioA ? avisoA : avisoB, usuarioId)], rowCount: 1 };
    }
    if (sql.includes('FROM sigd_auth.cuenta_usuario c') && sql.includes('JOIN sigd_auth.persona p')) {
      return { rows: [{ nombre_completo: 'Persona actual', id_documento: '12345678', tipo: 'NATURAL' }], rowCount: 1 };
    }
    if (sql.includes('sigd_auth.notificacion_casilla') && sql.includes('WHERE id =')) {
      expect(sql).toContain('usuario_id = $2::uuid');
      const pertenece = (idSolicitado === avisoA && usuarioSolicitante === usuarioA)
        || (idSolicitado === avisoB && usuarioSolicitante === usuarioB);
      return { rows: pertenece ? [fila(idSolicitado as string, usuarioSolicitante as string)] : [], rowCount: pertenece ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  });
  const app = construirApp({ query } as unknown as Pool);
  const token = (sub: string) => firmarTokenAcceso({ sub, roles: ['CIUDADANO'], secreto });

  it('rechaza ausencia de JWT y no acepta x-usuario-id como identidad', async () => {
    expect((await request(app).get('/api/v1/casilla/notificaciones')).status).toBe(401);
    expect((await request(app).get('/api/v1/casilla/notificaciones').set('x-usuario-id', usuarioA)).status).toBe(401);
    expect((await request(app).get('/api/v1/casilla/notificaciones').set('Authorization', 'Bearer falso')).status).toBe(401);
    expect((await request(app).get('/api/v1/ruta-publica-inexistente')).status).not.toBe(401);
  });

  it('lista solo la casilla vinculada al sub del JWT, aunque el cliente envíe otro usuarioId', async () => {
    const respuestaA = await request(app).get('/api/v1/casilla/notificaciones')
      .set('Authorization', `Bearer ${token(usuarioA)}`).set('x-usuario-id', usuarioB).query({ usuarioId: usuarioB });
    expect(respuestaA.status).toBe(200);
    expect(respuestaA.body.notificaciones.map((item: { id: string }) => item.id)).toEqual([avisoA]);
    const respuestaB = await request(app).get('/api/v1/casilla/notificaciones')
      .set('Authorization', `Bearer ${token(usuarioB)}`).query({ usuarioId: usuarioA });
    expect(respuestaB.status).toBe(200);
    expect(respuestaB.body.notificaciones.map((item: { id: string }) => item.id)).toEqual([avisoB]);
    expect((await request(app).get(`/api/v1/casilla/notificaciones/${avisoA}`)
      .set('Authorization', `Bearer ${token(usuarioA)}`)).status).toBe(200);
    expect((await request(app).get(`/api/v1/casilla/notificaciones/${avisoB}`)
      .set('Authorization', `Bearer ${token(usuarioB)}`)).status).toBe(200);
    expect((await request(app).get('/api/v1/casilla/estadisticas')
      .set('Authorization', `Bearer ${token(usuarioA)}`).query({ usuarioId: usuarioB })).status).toBe(200);
  });

  it('deniega detalle, lectura, acuse y descarga de la notificación de otro ciudadano', async () => {
    const autorizacion = `Bearer ${token(usuarioA)}`;
    const base = `/api/v1/casilla/notificaciones/${avisoB}`;
    expect((await request(app).get(base).set('Authorization', autorizacion)).status).toBe(404);
    expect((await request(app).patch(`${base}/lectura`).set('Authorization', autorizacion)).status).toBe(404);
    expect((await request(app).post(`${base}/acuse`).set('Authorization', autorizacion)).status).toBe(404);
    expect((await request(app).get(`${base}/documento/descargar`).set('Authorization', autorizacion)).status).toBe(404);
    expect((await request(app).get(`${base}/acuse/descargar`).set('Authorization', autorizacion)).status).toBe(404);
  });
});
