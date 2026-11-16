import { describe, it, expect, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import type { Pool } from 'pg';
import { crearRouterCasilla } from '../../../../src/domains/identicore/casilla.router.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

describe('AF08-01: Verificación de Aislamiento Multiusuario en Casilla Electrónica', () => {
  const usuarioA = '11111111-1111-4111-8111-111111111111';
  const usuarioB = '22222222-2222-4222-8222-222222222222';
  const usuarioInactivo = '33333333-3333-4333-8333-333333333333';

  const notificacionA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const notificacionB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const notificacionSinPropietario = '00000000-0000-0000-0000-000000000101';

  const tokenA = firmarTokenAcceso({ sub: usuarioA });
  const tokenB = firmarTokenAcceso({ sub: usuarioB });
  const tokenInactivo = firmarTokenAcceso({ sub: usuarioInactivo });

  const cuentasActivas = new Set([usuarioA, usuarioB]);

  const baseNotificaciones = [
    {
      id: notificacionA,
      usuario_id: usuarioA,
      cut: 'EXP-2026-000001',
      asunto: 'Notificación para Usuario A',
      tipo_acto: 'OFICIO',
      numero_documento: 'OF-001',
      cuerpo: { texto: 'Contenido A' },
      referencia: null,
      estado: 'NO_LEIDO',
      fecha_deposito: new Date('2026-10-20T10:00:00Z'),
      fecha_lectura: null,
      hash_sha256: 'a'.repeat(64),
      cvd: 'CVD-2026-OF-000001-A1B2',
      id_acuse: null,
      acuse_hash_sha256: null,
      acuse_sellado_tiempo: null,
      documento_url: 'http://minio:9000/sigd-expedientes/doc-a.pdf',
      creado_en: new Date('2026-10-20T10:00:00Z'),
    },
    {
      id: notificacionB,
      usuario_id: usuarioB,
      cut: 'EXP-2026-000002',
      asunto: 'Notificación privada para Usuario B',
      tipo_acto: 'RESOLUCION',
      numero_documento: 'RD-002',
      cuerpo: { texto: 'Contenido privado B' },
      referencia: null,
      estado: 'LEIDO',
      fecha_deposito: new Date('2026-10-21T10:00:00Z'),
      fecha_lectura: new Date('2026-10-21T11:00:00Z'),
      hash_sha256: 'b'.repeat(64),
      cvd: 'CVD-2026-RD-000002-B3C4',
      id_acuse: 'ACU-2026-BBBBBBBB',
      acuse_hash_sha256: 'c'.repeat(64),
      acuse_sellado_tiempo: new Date('2026-10-21T11:05:00Z'),
      documento_url: 'http://minio:9000/sigd-expedientes/doc-b.pdf',
      creado_en: new Date('2026-10-21T10:00:00Z'),
    },
    {
      id: notificacionSinPropietario,
      usuario_id: null,
      cut: 'EXP-2026-000142',
      asunto: 'Notificación huérfana sin propietario',
      tipo_acto: 'RESOLUCION',
      numero_documento: 'RD-142',
      cuerpo: { texto: 'Contenido sin dueño' },
      referencia: null,
      estado: 'NO_LEIDO',
      fecha_deposito: new Date('2026-10-16T10:00:00Z'),
      fecha_lectura: null,
      hash_sha256: '0'.repeat(64),
      cvd: 'CVD-2026-RD-000142-A4F2',
      id_acuse: null,
      acuse_hash_sha256: null,
      acuse_sellado_tiempo: null,
      documento_url: null,
      creado_en: new Date('2026-10-16T10:00:00Z'),
    },
  ];

  function crearAppAislada() {
    const mockPool = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        // Consulta de verificación de cuenta activa
        if (sql.includes('sigd_auth.cuenta_usuario')) {
          const uid = String(params?.[0] ?? '');
          if (cuentasActivas.has(uid)) {
            return { rows: [{ id_usuario: uid }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }

        // Conteo de bandeja
        if (sql.includes('COUNT(*)::text as total FROM sigd_auth.notificacion_casilla')) {
          const uid = String(params?.[0] ?? '');
          const count = baseNotificaciones.filter(n => n.usuario_id === uid).length;
          return { rows: [{ total: String(count) }], rowCount: 1 };
        }

        // Listado de bandeja
        if (sql.includes('FROM sigd_auth.notificacion_casilla') && sql.includes('ORDER BY fecha_deposito DESC')) {
          const uid = String(params?.[0] ?? '');
          const rows = baseNotificaciones.filter(n => n.usuario_id === uid);
          return { rows, rowCount: rows.length };
        }

        // Consulta de estadísticas
        if (sql.includes('SELECT COUNT(*) FILTER')) {
          const uid = String(params?.[0] ?? '');
          const rows = baseNotificaciones.filter(n => n.usuario_id === uid);
          const noLeidas = rows.filter(n => n.estado === 'NO_LEIDO').length;
          return {
            rows: [{
              no_leidas: String(noLeidas),
              leidas: String(rows.length - noLeidas),
              notificadas: '0',
              total: String(rows.length),
            }],
            rowCount: 1,
          };
        }

        // Consulta de recurso individual por ID
        if (sql.includes('SELECT * FROM sigd_auth.notificacion_casilla WHERE id = $1')) {
          const id = String(params?.[0] ?? '');
          const row = baseNotificaciones.find(n => n.id === id);
          return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }

        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    const routerCasilla = crearRouterCasilla(mockPool);
    const app = express();
    app.use(express.json());
    app.use('/api/v1', routerCasilla);
    app.use(errorMiddleware);
    return { app, mockPool };
  }

  it('1. Usuario A consulta su propia casilla -> recibe solo sus notificaciones (total: 1, id: notificacionA)', async () => {
    const { app } = crearAppAislada();
    const res = await request(app)
      .get('/api/v1/casilla/notificaciones')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.notificaciones).toHaveLength(1);
    expect(res.body.notificaciones[0].id).toBe(notificacionA);
    expect(res.body.notificaciones[0].usuarioId).toBe(usuarioA);
    // Verificar que la notificación de B no aparece en la respuesta de A
    expect(JSON.stringify(res.body)).not.toContain(notificacionB);
    expect(JSON.stringify(res.body)).not.toContain('Usuario B');
  });

  it('2. Usuario A intenta consultar el detalle de la notificación de B -> responde 403 Forbidden', async () => {
    const { app } = crearAppAislada();
    const res = await request(app)
      .get(`/api/v1/casilla/notificaciones/${notificacionB}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.notificacion).toBeUndefined();
    expect(res.body.asunto).toBeUndefined();
  });

  it('3. Usuario A intenta descargar el documento del acto de B -> responde 403 Forbidden', async () => {
    const { app } = crearAppAislada();
    const res = await request(app)
      .get(`/api/v1/casilla/notificaciones/${notificacionB}/documento/descargar`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.downloadUrl).toBeUndefined();
  });

  it('4. Usuario A intenta consultar el acuse de B -> responde 403 Forbidden', async () => {
    const { app } = crearAppAislada();
    const res = await request(app)
      .get(`/api/v1/casilla/notificaciones/${notificacionB}/acuse/descargar`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.downloadUrl).toBeUndefined();
  });

  it('5. Usuario sin token consulta la casilla -> responde 401 Unauthorized', async () => {
    const { app } = crearAppAislada();
    const res = await request(app)
      .get('/api/v1/casilla/notificaciones');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('6. Token válido pero con cuenta inactiva o inexistente en DB -> responde 403 Forbidden', async () => {
    const { app } = crearAppAislada();
    const res = await request(app)
      .get('/api/v1/casilla/notificaciones')
      .set('Authorization', `Bearer ${tokenInactivo}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('7. Usuario intenta acceder a una notificación sin propietario (NULL) -> responde 403 Forbidden', async () => {
    const { app } = crearAppAislada();
    const res = await request(app)
      .get(`/api/v1/casilla/notificaciones/${notificacionSinPropietario}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('8. Usuario intenta utilizar x-usuario-id sin JWT -> responde 401 Unauthorized (sin bypass)', async () => {
    const { app } = crearAppAislada();
    const res = await request(app)
      .get('/api/v1/casilla/notificaciones')
      .set('x-usuario-id', usuarioA);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});
