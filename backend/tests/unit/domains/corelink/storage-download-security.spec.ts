import express from 'express';
import request from 'supertest';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { crearRouterStorage } from '../../../../src/core/storage/storage.router.js';

const USUARIO_A = '11111111-1111-4111-8111-111111111111';
const USUARIO_B = '22222222-2222-4222-8222-222222222222';
const BUCKET = 'private';
const KEY = 'documentos/solo-a.pdf';

function crearApp(propietario: string | null) {
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
      return { rows: [{ id_usuario: USUARIO_A, id_persona: 'persona-a', area_id: null }], rowCount: 1 };
    }
    if (sql.includes('FROM sigd_org.usuario_rol')) {
      return { rows: [{ rol_codigo: 'CIUDADANO', permiso_codigo: null }], rowCount: 1 };
    }
    if (sql.includes('FROM sigd_doc.documento_adjunto')) {
      const autorizado = propietario === USUARIO_A && params[0] === BUCKET && params[1] === KEY && params[2] === USUARIO_A;
      return { rows: autorizado ? [{ solicitante_id: null, usuario_id: USUARIO_A }] : [], rowCount: autorizado ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  });
  const app = express();
  app.use('/api/v1', crearRouterStorage({ query } as unknown as Pool));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
    res.status(status).json({ error: 'request failed' });
  });
  return { app, query };
}

describe('autorización de descarga en almacenamiento', () => {
  it('firma el enlace de un objeto solo tras resolver su relación con la cuenta autenticada', async () => {
    const { app, query } = crearApp(USUARIO_A);
    const jwt = firmarTokenAcceso({ sub: USUARIO_A, sid: `${USUARIO_A}-session`, roles: ['ESTUDIANTE'] });

    const respuesta = await request(app)
      .get(`/api/v1/storage/download/${BUCKET}/${KEY}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.downloadUrl).toContain('/private/documentos/solo-a.pdf?');
    const consulta = query.mock.calls.find(([sql]) => String(sql).includes('FROM sigd_doc.documento_adjunto'));
    expect(consulta?.[1]).toEqual([BUCKET, KEY, USUARIO_A, 'persona-a', false]);
  });

  it('oculta el objeto de otro usuario y no devuelve URL prefirmada', async () => {
    const { app, query } = crearApp(USUARIO_B);
    const jwt = firmarTokenAcceso({ sub: USUARIO_A, sid: `${USUARIO_A}-session`, roles: ['ESTUDIANTE'] });

    const respuesta = await request(app)
      .get(`/api/v1/storage/download/${BUCKET}/${KEY}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.downloadUrl).toBeUndefined();
    expect(query.mock.calls.some(([sql]) => String(sql).includes('usuario_id=$3'))).toBe(true);
  });
});
