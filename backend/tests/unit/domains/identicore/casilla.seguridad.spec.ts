import express from 'express';
import request from 'supertest';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { crearRouterCasilla } from '../../../../src/domains/identicore/casilla.router.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

const USUARIO_A = '11111111-1111-4111-8111-111111111111';
const USUARIO_B = '22222222-2222-4222-8222-222222222222';
const ID_PROPIO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_AJENO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const FILA = {
  id: ID_PROPIO,
  usuario_id: USUARIO_B,
  correo_destinatario: 'b@example.test',
  cut: 'EXP-2026-000001',
  asunto: 'Notificación privada',
  tipo_acto: 'RESOLUCION',
  numero_documento: 'RD-1',
  cuerpo: 'Contenido privado',
  referencia: null,
  estado: 'NO_LEIDO',
  fecha_deposito: new Date('2026-01-01T00:00:00Z'),
  fecha_lectura: null,
  hash_sha256: null,
  cvd: null,
  id_acuse: null as string | null,
  acuse_hash_sha256: null as string | null,
  acuse_sellado_tiempo: null as Date | null,
  documento_url: 's3://private/documento.pdf' as string | null,
  creado_en: new Date('2026-01-01T00:00:00Z'),
};

function token(sub: string) {
  return firmarTokenAcceso({ sub, sid: `${sub}-session-token`, roles: ['ESTUDIANTE'] });
}

function crearApp(overrides: Partial<typeof FILA> = {}) {
  const fila = { ...FILA, ...overrides };
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('UPDATE sigd_auth.notificacion_casilla') && sql.includes('SET estado')) {
      const autorizada = params[0] === fila.id && params[1] === fila.usuario_id;
      return { rows: autorizada ? [{ ...fila, estado: 'LEIDO', fecha_lectura: new Date('2026-01-02T00:00:00Z') }] : [], rowCount: autorizada ? 1 : 0 };
    }
    if (sql.includes('UPDATE sigd_auth.notificacion_casilla') && sql.includes('SET id_acuse')) {
      if (fila.id_acuse) return { rows: [], rowCount: 0 };
      fila.id_acuse = String(params[0]);
      fila.acuse_hash_sha256 = String(params[1]);
      fila.acuse_sellado_tiempo = new Date(String(params[2]));
      return { rows: [fila], rowCount: 1 };
    }
    if (sql.includes('notificacion_casilla') && sql.includes('COUNT(*)')) {
      return { rows: [{ total: '0', no_leidas: '0' }], rowCount: 1 };
    }
    if (sql.includes('notificacion_casilla')) {
      const scopedId = sql.includes('WHERE id = $1 AND usuario_id = $2');
      const userId = String(params[scopedId ? 1 : 0] ?? '');
      const notificationId = scopedId ? String(params[0] ?? '') : '';
      const authorized = userId === fila.usuario_id && (!notificationId || notificationId === fila.id);
      return { rows: authorized ? [fila] : [], rowCount: authorized ? 1 : 0 };
    }
    if (sql.includes('sesion_usuario')) {
      const sid = String(params[0] ?? '');
      const userId = sid.replace('-session-token', '');
      return { rows: [{ id_usuario: userId, expira_en: new Date(Date.now() + 60_000), revocado_en: null, activo: true, bloqueado_hasta: null }], rowCount: 1 };
    }
    if (sql.includes('usuario_rol')) return { rows: [{ rol_codigo: 'CIUDADANO', vigente: true, permiso_codigo: null }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1', crearRouterCasilla({ query } as unknown as Pool));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
    res.status(status).json({ error: 'request failed' });
  });
  return { app, query };
}

describe('seguridad de Casilla Electrónica', () => {
  it('rechaza ausencia de JWT e ignora la identidad indicada por el cliente', async () => {
    const { app, query } = crearApp();
    const response = await request(app).get('/api/v1/casilla/notificaciones').set('x-usuario-id', USUARIO_B);
    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('filtra bandeja y estadísticas por propietario y excluye filas sin dueño', async () => {
    const { app, query } = crearApp();
    await request(app).get('/api/v1/casilla/notificaciones').set('Authorization', `Bearer ${token(USUARIO_A)}`);
    await request(app).get('/api/v1/casilla/estadisticas').set('Authorization', `Bearer ${token(USUARIO_A)}`);
    const calls = query.mock.calls.filter(([sql]) => String(sql).includes('notificacion_casilla'));
    expect(calls.length).toBeGreaterThan(0);
    for (const [sql, params] of calls) {
      expect(String(sql)).toContain('usuario_id =');
      expect(String(sql)).not.toContain('usuario_id IS NULL');
      expect(params?.[0]).toBe(USUARIO_A);
    }
  });

  it('aplica filtros de estado, tipo y fechas en la consulta del propietario', async () => {
    const { app, query } = crearApp();
    const response = await request(app).get('/api/v1/casilla/notificaciones')
      .query({ estado: 'NOTIFICADO', tipo: 'RESOLUCION', fechaInicio: '2026-01-01', fechaFin: '2026-01-31' })
      .set('Authorization', `Bearer ${token(USUARIO_B)}`);
    expect(response.status).toBe(200);
    const consulta = query.mock.calls.find(([sql]) => String(sql).includes('FROM sigd_auth.notificacion_casilla') && String(sql).includes('COUNT(*)'));
    expect(String(consulta?.[0])).toContain('id_acuse IS NOT NULL');
    expect(String(consulta?.[0])).toContain('tipo_acto ILIKE ANY');
    expect(String(consulta?.[0])).toContain('fecha_deposito >=');
    expect(String(consulta?.[0])).toContain('fecha_deposito <');
    expect(consulta?.[1]).toEqual([USUARIO_B, ['RESOLUCION%', 'RESOLUCIÓN%'], '2026-01-01', '2026-01-31']);
  });

  it.each([
    ['detalle', 'get', `/api/v1/casilla/notificaciones/${ID_AJENO}`],
    ['lectura', 'patch', `/api/v1/casilla/notificaciones/${ID_AJENO}/lectura`],
    ['acuse', 'post', `/api/v1/casilla/notificaciones/${ID_AJENO}/acuse`],
    ['descarga de documento', 'get', `/api/v1/casilla/notificaciones/${ID_AJENO}/documento/descargar`],
    ['descarga de acuse', 'get', `/api/v1/casilla/notificaciones/${ID_AJENO}/acuse/descargar`],
  ])('rechaza acceso ajeno al %s', async (_name, method, path) => {
    const { app, query } = crearApp();
    const client = request(app);
    const response = await (method === 'patch' ? client.patch(path) : method === 'post' ? client.post(path) : client.get(path))
      .set('Authorization', `Bearer ${token(USUARIO_A)}`);
    expect(response.status).toBe(404);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('usuario_id ='))).toBe(true);
  });

  it('no crea una URL de descarga antes de comprobar propietario y documento real', async () => {
    const { app, query } = crearApp({ documento_url: 'https://external.test/private.pdf' });
    const response = await request(app).get(`/api/v1/casilla/notificaciones/${ID_PROPIO}/documento/descargar`)
      .set('Authorization', `Bearer ${token(USUARIO_B)}`);
    expect(response.status).toBe(404);
    expect(response.body.downloadUrl).toBeUndefined();
    expect(query.mock.calls.some(([sql]) => String(sql).includes('usuario_id ='))).toBe(true);
  });

  it('permite al propietario ver su notificación y obtener la URL del documento registrado', async () => {
    const { app, query } = crearApp();
    const detalle = await request(app).get(`/api/v1/casilla/notificaciones/${ID_PROPIO}`)
      .set('Authorization', `Bearer ${token(USUARIO_B)}`);
    const descarga = await request(app).get(`/api/v1/casilla/notificaciones/${ID_PROPIO}/documento/descargar`)
      .set('Authorization', `Bearer ${token(USUARIO_B)}`);

    expect(detalle.status).toBe(200);
    expect(detalle.body.actoAdministrativo.hashIntegridadSha256).toBe('');
    expect(detalle.body.actoAdministrativo.cvd).toBe('');
    expect(detalle.body.actoAdministrativo.firmantes).toEqual([]);
    expect(descarga.status).toBe(200);
    expect(descarga.body.downloadUrl).toBe('/api/v1/storage/download/private/documento.pdf');
    expect(query.mock.calls.filter(([sql]) => String(sql).includes('notificacion_casilla'))
      .every(([sql]) => String(sql).includes('usuario_id ='))).toBe(true);
  });

  it('devuelve la notificación completa tras marcar lectura para mantener el modal sincronizado', async () => {
    const { app } = crearApp();
    const response = await request(app).patch(`/api/v1/casilla/notificaciones/${ID_PROPIO}/lectura`)
      .set('Authorization', `Bearer ${token(USUARIO_B)}`);
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(ID_PROPIO);
    expect(response.body.estado).toBe('LEIDO');
    expect(response.body.actoAdministrativo.numeroDocumento).toBe(FILA.numero_documento);
    expect(response.body.acuse).toBeNull();
  });

  it('genera el PDF del acuse existente solo para el propietario', async () => {
    const { app } = crearApp({
      id_acuse: 'ACU-2026-A1B2C3D4',
      acuse_hash_sha256: 'a'.repeat(64),
      acuse_sellado_tiempo: new Date('2026-01-02T00:00:00Z'),
    });
    const propio = await request(app).get(`/api/v1/casilla/notificaciones/${ID_PROPIO}/acuse/descargar`)
      .set('Authorization', `Bearer ${token(USUARIO_B)}`);
    const ajeno = await request(app).get(`/api/v1/casilla/notificaciones/${ID_PROPIO}/acuse/descargar`)
      .set('Authorization', `Bearer ${token(USUARIO_A)}`);

    expect(propio.status).toBe(200);
    expect(propio.headers['content-type']).toContain('application/pdf');
    expect(propio.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(ajeno.status).toBe(404);
  });

  it('no inventa identidad ni CVD para un acuse persistido sin esos metadatos', async () => {
    const { app } = crearApp({ id_acuse: 'ACU-REAL', acuse_hash_sha256: 'a'.repeat(64) });
    const response = await request(app).get(`/api/v1/casilla/notificaciones/${ID_PROPIO}`)
      .set('Authorization', `Bearer ${token(USUARIO_B)}`);
    expect(response.status).toBe(200);
    expect(response.body.acuse.destinatario.numeroDocumento).toBe('No registrado');
    expect(response.body.acuse.destinatario.direccionCasilla).toBe(FILA.correo_destinatario);
    expect(response.body.acuse.cvdAcuse).toBe('');
  });

  it('clasifica una resolución con su nombre documental completo', async () => {
    const { app } = crearApp({ tipo_acto: 'Resolución Directoral' });
    const response = await request(app).get(`/api/v1/casilla/notificaciones/${ID_PROPIO}`)
      .set('Authorization', `Bearer ${token(USUARIO_B)}`);
    expect(response.status).toBe(200);
    expect(response.body.tipo).toBe('RESOLUCION');
  });

  it('devuelve el mismo acuse persistido al repetir la solicitud', async () => {
    const { app } = crearApp();
    const endpoint = `/api/v1/casilla/notificaciones/${ID_PROPIO}/acuse`;
    const primero = await request(app).post(endpoint).set('Authorization', `Bearer ${token(USUARIO_B)}`);
    const segundo = await request(app).post(endpoint).set('Authorization', `Bearer ${token(USUARIO_B)}`);
    expect(primero.status).toBe(201);
    expect(segundo.status).toBe(200);
    expect(segundo.body.data.idAcuse).toBe(primero.body.data.idAcuse);
    expect(segundo.body.data.hashSha256Acuse).toBe(primero.body.data.hashSha256Acuse);
    expect(segundo.body.data.timestampGeneracionIso).toBe(primero.body.data.timestampGeneracionIso);
    expect(segundo.body.data.cvdAcuse).toBe('');
  });
});
