import express from 'express';
import request from 'supertest';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { autorizarPermisos, PERMISOS_RBAC } from '../../../../src/core/auth/auth.guard.js';

function crearApp(permisos: string[]) {
  const query = vi.fn(async (_sql: string, _params: unknown[] = []) => ({ rows: permisos.map((codigo) => ({ permiso_codigo: codigo })), rowCount: permisos.length }));
  const app = express();
  app.use((req, _res, next) => {
    req.cuentaActual = { idUsuario: '11111111-1111-4111-8111-111111111111', roles: ['SUPER_ADMIN'] };
    next();
  });
  app.get('/admin', autorizarPermisos({ query } as unknown as Pool, PERMISOS_RBAC.ADMIN_ACCESO), (_req, res) => res.sendStatus(204));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
    res.sendStatus(status);
  });
  return { app, query };
}

describe('autorización RBAC administrativa vigente en PostgreSQL', () => {
  it('autoriza solo cuando el rol activo conserva el permiso asignado en la base de datos', async () => {
    const { app, query } = crearApp([PERMISOS_RBAC.ADMIN_ACCESO]);
    const response = await request(app).get('/admin');
    expect(response.status).toBe(204);
    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0])).toContain('sigd_org.rol_permiso');
  });

  it('deniega aunque el JWT declare un rol administrativo si el permiso fue revocado', async () => {
    const { app, query } = crearApp([]);
    const response = await request(app).get('/admin');
    expect(response.status).toBe(403);
    expect(query).toHaveBeenCalledOnce();
  });
});
