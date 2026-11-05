import express from 'express';
import request from 'supertest';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { crearRouterStorage } from '../../../../src/core/storage/storage.router.js';

const OWNER = '22222222-2222-4222-8222-222222222222';
const OTHER = '11111111-1111-4111-8111-111111111111';
const BUCKET = 'private';
const KEY = 'documents/notification.pdf';

function crearApp(usuario: string) {
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM sigd_auth.sesion_usuario')) return { rows: [{ id_usuario: usuario, activo: true, revocado_en: null, expira_en: new Date(Date.now() + 60_000) }], rowCount: 1 };
    if (sql.includes('SELECT DISTINCT ps.codigo AS permiso_codigo')) return { rows: [], rowCount: 0 };
    if (sql.includes('FROM sigd_org.usuario_rol')) return { rows: [{ rol_codigo: 'CIUDADANO', permiso_codigo: null }], rowCount: 1 };
    if (sql.includes('FROM sigd_auth.cuenta_usuario c LEFT JOIN')) return { rows: [{ id_usuario: usuario, id_persona: usuario, area_id: null }], rowCount: 1 };
    if (sql.includes('FROM sigd_doc.documento_adjunto')) {
      const ownerId = String(params[2] ?? '');
      return { rows: ownerId === OWNER ? [{ autorizado: true }] : [], rowCount: ownerId === OWNER ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  });
  const app = express();
  app.use('/api/v1', crearRouterStorage({ query } as unknown as Pool));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
    res.status(status).json({ error: 'request failed' });
  });
  const accessToken = firmarTokenAcceso({ sub: usuario, sid: `${usuario}-session-token`, roles: ['ESTUDIANTE'] });
  return { app, query, accessToken };
}

describe('autorización de descargas S3', () => {
  it('autoriza documentos de Casilla solo al propietario y soporta claves S3 con subdirectorios', async () => {
    const { app, accessToken, query } = crearApp(OWNER);
    const response = await request(app).get(`/api/v1/storage/download/${BUCKET}/${KEY}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    expect(response.body.downloadUrl).toContain('/documents/notification.pdf?');
    const authorization = query.mock.calls.find(([sql]) => String(sql).includes('notificacion_casilla'));
    expect(authorization).toBeDefined();
    expect(authorization?.[1]).toEqual([BUCKET, KEY, OWNER, OWNER, false]);
  });

  it('no emite una URL prefirmada para el documento de otro usuario', async () => {
    const { app, accessToken } = crearApp(OTHER);
    const response = await request(app).get(`/api/v1/storage/download/${BUCKET}/${KEY}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(response.status).toBe(404);
    expect(response.body.downloadUrl).toBeUndefined();
  });
});
