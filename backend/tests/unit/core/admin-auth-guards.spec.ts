import { describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { construirApp } from '../../../src/app.js';
import { firmarTokenAcceso } from '../../../src/core/auth/jwt.service.js';

describe('H-08: Admin Auth Guards & No Synthetic Fallback (§12 / Codex)', () => {
  const tokenCiudadano = firmarTokenAcceso({
    sub: '11111111-1111-4111-8111-111111111111',
    roles: ['CIUDADANO'],
  });

  const tokenAdmin = firmarTokenAcceso({
    sub: '55555555-5555-4555-8555-555555555555',
    roles: ['ADMINISTRADOR'],
  });

  const tokenSuperAdmin = firmarTokenAcceso({
    sub: '66666666-6666-4666-8666-666666666666',
    roles: ['SUPER_ADMIN'],
  });

  const mockPool = {
    query: async (sql: string) => {
      const sqlStr = String(sql);

      if (sqlStr.includes('sigd_audit.bitacora_auditoria')) {
        return { rows: [] };
      }

      if (sqlStr.includes('sigd_org.rol_sistema')) {
        return {
          rows: [
            {
              id: '34b04cf1-09d3-4460-8b05-80c6b244f42d',
              codigo: 'ADMINISTRADOR',
              nombre: 'Administrador del Sistema',
              descripcion: 'Administración total',
              permisos: ['ADMIN:ALL'],
            },
          ],
        };
      }

      if (sqlStr.includes('sigd_doc.tipo_documento')) {
        return {
          rows: [
            {
              id: 'a373f0c7-8d3e-4328-aec1-78409b539131',
              codigo: 'SOL',
              nombre: 'Solicitud',
              extension: 'pdf',
              mime_type: 'application/pdf',
              tamano_maximo_mb: 25,
              exige_firma: false,
              vigente: true,
            },
          ],
        };
      }

      if (sqlStr.includes('sigd_org.area')) {
        return { rows: [] };
      }

      return { rows: [] };
    },
    connect: async () => ({
      query: async () => ({ rows: [] }),
      release: () => undefined,
    }),
  } as unknown as Pool;

  const app = construirApp(mockPool);

  const rutasAdmin = [
    '/api/v1/admin/auditoria/bitacora',
    '/api/v1/admin/roles-permisos',
    '/api/v1/admin/organigrama',
    '/api/v1/admin/tablas-maestras',
    '/api/v1/admin/maestras/sede',
    '/api/v1/admin/maestras/tipo-documento',
  ];

  for (const ruta of rutasAdmin) {
    it(`anónimo sobre ${ruta} -> 401 Unauthorized`, async () => {
      const res = await request(app).get(ruta);
      expect(res.status).toBe(401);
    });

    it(`ciudadano (sin rol admin) sobre ${ruta} -> 403 Forbidden`, async () => {
      const res = await request(app)
        .get(ruta)
        .set('Authorization', `Bearer ${tokenCiudadano}`);
      expect(res.status).toBe(403);
    });

    it(`ADMINISTRADOR sobre ${ruta} -> acceso concedido (no 401 ni 403)`, async () => {
      const res = await request(app)
        .get(ruta)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect([200, 304]).toContain(res.status);
    });

    it(`SUPER_ADMIN sobre ${ruta} -> acceso concedido (no 401 ni 403)`, async () => {
      const res = await request(app)
        .get(ruta)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);
      expect([200, 304]).toContain(res.status);
    });
  }

  it('roles-permisos propaga 5xx con RFC 9457 ante fallo SQL y NO devuelve array sintético', async () => {
    const poolFallo = {
      query: async (sql: string) => {
        if (String(sql).includes('sigd_org.rol_sistema')) {
          throw new Error('DATABASE_OUTAGE');
        }
        return { rows: [] };
      },
      connect: async () => ({
        query: async () => ({ rows: [] }),
        release: () => undefined,
      }),
    } as unknown as Pool;

    const appFallo = construirApp(poolFallo);

    const res = await request(appFallo)
      .get('/api/v1/admin/roles-permisos')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(500);
    expect(res.body).not.toHaveProperty('roles');
  });

  it('maestras/tipo-documento propaga 5xx con RFC 9457 ante fallo SQL y NO devuelve array sintético', async () => {
    const poolFallo = {
      query: async (sql: string) => {
        if (String(sql).includes('sigd_doc.tipo_documento')) {
          throw new Error('DATABASE_OUTAGE');
        }
        return { rows: [] };
      },
      connect: async () => ({
        query: async () => ({ rows: [] }),
        release: () => undefined,
      }),
    } as unknown as Pool;

    const appFallo = construirApp(poolFallo);

    const res = await request(appFallo)
      .get('/api/v1/admin/maestras/tipo-documento')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(500);
  });
});
