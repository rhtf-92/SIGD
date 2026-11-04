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

function token(sub: string) {
  return firmarTokenAcceso({ sub, sid: `${sub}-session-token`, roles: ['ESTUDIANTE'] });
}

function crearApp() {
  const fila = {
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
    id_acuse: null,
    acuse_hash_sha256: null,
    acuse_sellado_tiempo: null,
    documento_url: 's3://private/documento.pdf',
    creado_en: new Date('2026-01-01T00:00:00Z'),
  };
  let sesionRevocada = false;
  let perfilActivo = true;
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM sigd_auth.sesion_usuario')) {
      const usuarioId = String(params[0]).replace('-session-token', '');
      const vigente = usuarioId === USUARIO_A || usuarioId === USUARIO_B;
      return { rows: vigente ? [{ id_usuario: usuarioId, expira_en: new Date(Date.now() + 60_000), revocado_en: sesionRevocada ? new Date() : null, activo: true }] : [], rowCount: vigente ? 1 : 0 };
    }
    if (sql.includes('FROM sigd_org.usuario_rol')) return { rows: perfilActivo ? [{ rol_codigo: 'CIUDADANO', permiso_codigo: null }] : [], rowCount: perfilActivo ? 1 : 0 };
    if (sql.includes('notificacion_casilla') && sql.includes('usuario_id =')) {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '0', no_leidas: '0' }], rowCount: 1 };
      const usuarioId = String(sql.includes('id = $1 AND usuario_id = $2') ? params[1] : params[0]);
      const id = String(sql.includes('id = $1 AND usuario_id = $2') ? params[0] : '');
      const autorizado = usuarioId === fila.usuario_id && (!id || id === fila.id);
      return { rows: autorizado ? [fila] : [], rowCount: autorizado ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1', crearRouterCasilla({ query } as unknown as Pool));
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof err === 'object' && err !== null && 'status' in err ? Number(err.status) : 500;
    res.status(status).json({ error: 'request failed' });
  });
  return {
    app,
    query,
    revokeSession: () => { sesionRevocada = true; },
    revokeProfile: () => { perfilActivo = false; },
  };
}

describe('seguridad de Casilla Electrónica', () => {
  it('exige un JWT de acceso válido e ignora las cabeceras de identidad aportadas por el cliente', async () => {
    const { app, query } = crearApp();

    const sinToken = await request(app).get('/api/v1/casilla/notificaciones').set('x-usuario-id', USUARIO_B);
    const invalido = await request(app).get('/api/v1/casilla/notificaciones')
      .set('Authorization', 'Bearer token-invalido').set('x-usuario-id', USUARIO_B);

    expect(sinToken.status).toBe(401);
    expect(invalido.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('limita bandeja y estadísticas al propietario del JWT, sin incluir filas huérfanas', async () => {
    const { app, query } = crearApp();

    await request(app).get('/api/v1/casilla/notificaciones').set('Authorization', `Bearer ${token(USUARIO_A)}`);
    await request(app).get('/api/v1/casilla/estadisticas').set('Authorization', `Bearer ${token(USUARIO_A)}`);

    const casillaQueries = query.mock.calls.filter(([sql]) => String(sql).includes('notificacion_casilla'));
    expect(casillaQueries).toHaveLength(3);
    for (const [sql, params] of casillaQueries) {
      expect(String(sql)).toContain('usuario_id = $1');
      expect(String(sql)).not.toContain('usuario_id IS NULL');
      expect(params?.[0]).toBe(USUARIO_A);
    }
  });

  it.each([
    ['detalle', 'get', `/api/v1/casilla/notificaciones/${ID_AJENO}`],
    ['marcado de lectura', 'patch', `/api/v1/casilla/notificaciones/${ID_AJENO}/lectura`],
    ['emisión de acuse', 'post', `/api/v1/casilla/notificaciones/${ID_AJENO}/acuse`],
    ['descarga del documento', 'get', `/api/v1/casilla/notificaciones/${ID_AJENO}/documento/descargar`],
    ['descarga del acuse', 'get', `/api/v1/casilla/notificaciones/${ID_AJENO}/acuse/descargar`],
  ])('rechaza el acceso a una notificación ajena en %s', async (_nombre, metodo, ruta) => {
    const { app, query } = crearApp();
    const llamada = request(app);
    const operacion = metodo === 'patch' ? llamada.patch(ruta) : metodo === 'post' ? llamada.post(ruta) : llamada.get(ruta);
    const respuesta = await operacion.set('Authorization', `Bearer ${token(USUARIO_A)}`);

    expect(respuesta.status).toBe(404);
    const consultasNotificacion = query.mock.calls.filter(([sql]) => String(sql).includes('notificacion_casilla'));
    expect(consultasNotificacion.length).toBeGreaterThan(0);
    expect(consultasNotificacion.every(([sql]) => String(sql).includes('usuario_id ='))).toBe(true);
  });

  it('descarga solo después de comprobar la propiedad en la base de datos', async () => {
    const { app, query } = crearApp();
    const respuesta = await request(app)
      .get(`/api/v1/casilla/notificaciones/${ID_PROPIO}/documento/descargar`)
      .set('Authorization', `Bearer ${token(USUARIO_B)}`);

    expect(respuesta.status).toBe(200);
    const consultaNotificacion = query.mock.calls.find(([sql]) => String(sql).includes('notificacion_casilla'));
    expect(String(consultaNotificacion?.[0])).toContain('usuario_id =');
    expect(respuesta.body.downloadUrl).toBe('s3://private/documento.pdf');
  });

  it('rechaza JWT asociados a una sesión revocada', async () => {
    const { app, revokeSession } = crearApp();
    revokeSession();
    const respuesta = await request(app).get('/api/v1/casilla/notificaciones')
      .set('Authorization', `Bearer ${token(USUARIO_A)}`);
    expect(respuesta.status).toBe(401);
  });

  it('rechaza JWT cuyo perfil activo ya no está asignado', async () => {
    const { app, revokeProfile } = crearApp();
    revokeProfile();
    const respuesta = await request(app).get('/api/v1/casilla/notificaciones')
      .set('Authorization', `Bearer ${token(USUARIO_A)}`);
    expect(respuesta.status).toBe(401);
  });

  it('permite al propietario abrir su detalle y emitir su acuse', async () => {
    const { app, query } = crearApp();
    const detalle = await request(app).get(`/api/v1/casilla/notificaciones/${ID_PROPIO}`)
      .set('Authorization', `Bearer ${token(USUARIO_B)}`);
    const acuse = await request(app).post(`/api/v1/casilla/notificaciones/${ID_PROPIO}/acuse`)
      .set('Authorization', `Bearer ${token(USUARIO_B)}`);
    const consultasCasilla = query.mock.calls.filter(([sql]) => String(sql).includes('notificacion_casilla'));

    expect(detalle.status).toBe(200);
    expect(acuse.status).toBe(201);
    expect(consultasCasilla.every(([sql]) => String(sql).includes('usuario_id ='))).toBe(true);
  });
});
