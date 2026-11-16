import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { construirApp } from '../../src/app.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';

const ID_CIUDADANO = '10000000-0000-4000-8000-000000000001';
const ID_MESA_PARTES = '10000000-0000-4000-8000-000000000002';
const ID_SECRETARIO = '10000000-0000-4000-8000-000000000003';
const ID_DIRECTOR = '10000000-0000-4000-8000-000000000004';
const ID_ADMIN = '10000000-0000-4000-8000-000000000005';
const ID_ESPECIALISTA = '10000000-0000-4000-8000-000000000006';
const ID_EXPEDIENTE = '30000000-0000-4000-8000-000000000001';
const ID_AREA_SEC = '20000000-0000-4000-8000-000000000001';
const ID_AREA_MP = '20000000-0000-4000-8000-000000000002';

const payloadResolucionValido = {
  expedienteId: ID_EXPEDIENTE,
  tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
  visto: 'Visto el expediente de solicitud ciudadana...',
  considerandos: ['Considerando que el administrado cumple los requisitos normativos...'],
  articulos: [{ numero: 1, texto: 'Articulo 1 de la resolucion directoral de prueba...' }],
};

function crearPoolMock(usuarioIdActivo: string, config: {
  roles: string[];
  permisos: Array<{ codigo: string; ambito: string; areaId: string | null }>;
  areaId?: string | null;
  facultadFirma?: boolean;
}) {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const q = typeof sql === 'string' ? sql : '';

      // SELECT 1 (ready check)
      if (q.trim() === 'SELECT 1') return { rows: [{ ok: 1 }] };

      // Consultas de cuenta / sesion / autorizacion
      if (q.includes('FROM sigd_auth.cuenta_usuario cu')) {
        // Query de datos personales para autorizarFirmante
        if (q.includes('pn.nombre_completo AS nombre') && q.includes('p.id_documento AS documento')) {
          if (params?.[0] === usuarioIdActivo) {
            return { rows: [{ nombre: 'Director Demo', documento: '00112233' }] };
          }
          return { rows: [] };
        }

        if (q.includes('cu.id_usuario = $1::uuid') && q.includes('cu.activo = TRUE')) {
          if (params?.[0] === usuarioIdActivo) {
            if (q.includes('AS roles') && q.includes('AS permisos')) {
              // obtenerAutorizacionCuenta
              const permisosFiltrados = config.roles.includes('CIUDADANO')
                ? config.permisos.filter(p => p.codigo !== 'EXPEDIENTE_LEER')
                : config.permisos;
              return {
                rows: [{
                  roles: config.roles,
                  permisos: permisosFiltrados,
                  unidad_organica_id: config.areaId ?? null,
                }],
              };
            }
            if (q.includes('AS acceso_global')) {
              // obtenerAlcanceBandeja
              const accesoGlobal = config.permisos.some(p => p.codigo === 'EXPEDIENTE_LEER' && p.ambito === 'GLOBAL' && p.areaId === null);
              const tienePermisoArea = config.permisos.some(p => p.codigo === 'EXPEDIENTE_LEER' && p.areaId !== null);
              return {
                rows: [{
                  solicitante_id: config.roles.includes('CIUDADANO') ? usuarioIdActivo : null,
                  acceso_global: accesoGlobal,
                  tiene_permiso_area: tienePermisoArea,
                }],
              };
            }
            if (q.includes('ADMIN_USUARIOS') && q.includes('AS autorizado')) {
              // exigirAdministracionUsuarios
              const autorizado = config.permisos.some(p => p.codigo === 'ADMIN_USUARIOS' && p.ambito === 'GLOBAL' && p.areaId === null);
              return { rows: [{ autorizado }] };
            }
          }
          return { rows: [] };
        }
      }

      // sigd_org.facultad_despacho / verificarFacultadFirma
      if (q.includes('sigd_org.facultad_despacho')) {
        if (params?.[0] === usuarioIdActivo && config.facultadFirma) {
          return {
            rows: [{
              rol_codigo: config.roles[0] ?? null,
              rol_area_id: null,
              tipo_resolucion: null,
              vigente: true,
              motivo_no_habilitado: null,
            }],
          };
        }
        return { rows: [] };
      }

      // Catálogos y conteo para listarUsuarios
      if (q.includes('SELECT COUNT(*)::int AS total')) {
        return { rows: [{ total: 0 }] };
      }
      if (q.includes('AS catalogos')) {
        return { rows: [{ catalogos: { areas: [], cargos: [], roles: [] } }] };
      }

      // Casilla notificaciones
      if (q.includes('FROM sigd_auth.notificacion_casilla')) {
        if (q.includes('COUNT(*)')) return { rows: [{ total: '0' }] };
        return { rows: [] };
      }

      // Reportes MGD resumen
      if (q.includes('FROM sigd_corelink') || q.includes('n_radicados')) {
        return { rows: [{ n_radicados: '0', n_resueltos: '0', n_en_tramite: '0' }] };
      }

      // Default
      return { rows: [], rowCount: 0 };
    }),
    connect: vi.fn(),
  } as unknown as Pool;
}

describe('Matriz Integral de Autorización por Rol en Endpoints Backend', () => {
  describe('Endpoint: Ventanilla Presencial (POST /api/v1/tramites/ventanilla-presencial)', () => {
    it('rechaza llamadas sin token (401)', async () => {
      const app = construirApp(crearPoolMock('', { roles: [], permisos: [] }));
      const res = await request(app).post('/api/v1/tramites/ventanilla-presencial').send({});
      expect(res.status).toBe(401);
    });

    it('deniega acceso a CIUDADANO (403)', async () => {
      const pool = crearPoolMock(ID_CIUDADANO, { roles: ['CIUDADANO'], permisos: [] });
      const app = construirApp(pool);
      const res = await request(app)
        .post('/api/v1/tramites/ventanilla-presencial')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_CIUDADANO, roles: ['CIUDADANO'] }))
        .send({});
      expect(res.status).toBe(403);
    });

    it('deniega acceso a DIRECTOR (403)', async () => {
      const pool = crearPoolMock(ID_DIRECTOR, { roles: ['DIRECTOR'], permisos: [] });
      const app = construirApp(pool);
      const res = await request(app)
        .post('/api/v1/tramites/ventanilla-presencial')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_DIRECTOR, roles: ['DIRECTOR'] }))
        .send({});
      expect(res.status).toBe(403);
    });

    it('deniega acceso a ESPECIALISTA (403)', async () => {
      const pool = crearPoolMock(ID_ESPECIALISTA, { roles: ['ESPECIALISTA'], permisos: [] });
      const app = construirApp(pool);
      const res = await request(app)
        .post('/api/v1/tramites/ventanilla-presencial')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_ESPECIALISTA, roles: ['ESPECIALISTA'] }))
        .send({});
      expect(res.status).toBe(403);
    });

    it('permite a MESA_PARTES superar la guardia de rol (avanza a validación de datos)', async () => {
      const pool = crearPoolMock(ID_MESA_PARTES, {
        roles: ['MESA_PARTES'],
        permisos: [{ codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: ID_AREA_MP }],
        areaId: ID_AREA_MP,
      });
      const app = construirApp(pool);
      const res = await request(app)
        .post('/api/v1/tramites/ventanilla-presencial')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_MESA_PARTES, roles: ['MESA_PARTES'] }))
        .send({});
      // Supera el 401 y 403 de rol; produce 400 por payload vacío
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Endpoint: Proyección de Resoluciones (POST /api/v1/resoluciones/proyectar)', () => {
    it('deniega a CIUDADANO (403)', async () => {
      const pool = crearPoolMock(ID_CIUDADANO, { roles: ['CIUDADANO'], permisos: [] });
      const app = construirApp(pool);
      const res = await request(app)
        .post('/api/v1/resoluciones/proyectar')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_CIUDADANO, roles: ['CIUDADANO'] }))
        .send(payloadResolucionValido);
      expect(res.status).toBe(403);
    });

    it('deniega a MESA_PARTES (403)', async () => {
      const pool = crearPoolMock(ID_MESA_PARTES, {
        roles: ['MESA_PARTES'],
        permisos: [{ codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: ID_AREA_MP }],
      });
      const app = construirApp(pool);
      const res = await request(app)
        .post('/api/v1/resoluciones/proyectar')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_MESA_PARTES, roles: ['MESA_PARTES'] }))
        .send(payloadResolucionValido);
      expect(res.status).toBe(403);
    });

    it('deniega a ESPECIALISTA carente de rol resolutivo (403)', async () => {
      const pool = crearPoolMock(ID_ESPECIALISTA, {
        roles: ['ESPECIALISTA'],
        permisos: [{ codigo: 'EXPEDIENTE_RESOLVER', ambito: 'AREA', areaId: ID_AREA_SEC }],
      });
      const app = construirApp(pool);
      const res = await request(app)
        .post('/api/v1/resoluciones/proyectar')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_ESPECIALISTA, roles: ['ESPECIALISTA'] }))
        .send(payloadResolucionValido);
      expect(res.status).toBe(403);
    });

    it('permite a DIRECTOR superar la autorización de proyección', async () => {
      const pool = crearPoolMock(ID_DIRECTOR, {
        roles: ['DIRECTOR'],
        permisos: [
          { codigo: 'FIRMA_FIRMAR', ambito: 'GLOBAL', areaId: null },
          { codigo: 'EXPEDIENTE_RESOLVER', ambito: 'AREA', areaId: null },
        ],
      });
      const app = construirApp(pool);
      const res = await request(app)
        .post('/api/v1/resoluciones/proyectar')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_DIRECTOR, roles: ['DIRECTOR'] }))
        .send(payloadResolucionValido);
      // Supera 401 y 403 de autorización
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe('Endpoint: Invocación de Firma Digital (POST /api/v1/firma/invocar-refirma)', () => {
    it('deniega a CIUDADANO (403)', async () => {
      const pool = crearPoolMock(ID_CIUDADANO, { roles: ['CIUDADANO'], permisos: [] });
      const app = construirApp(pool);
      const res = await request(app)
        .post('/api/v1/firma/invocar-refirma')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_CIUDADANO, roles: ['CIUDADANO'] }))
        .send({});
      expect(res.status).toBe(403);
    });

    it('deniega a SECRETARIO (403)', async () => {
      const pool = crearPoolMock(ID_SECRETARIO, {
        roles: ['SECRETARIO'],
        permisos: [{ codigo: 'EXPEDIENTE_RESOLVER', ambito: 'AREA', areaId: ID_AREA_SEC }],
      });
      const app = construirApp(pool);
      const res = await request(app)
        .post('/api/v1/firma/invocar-refirma')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_SECRETARIO, roles: ['SECRETARIO'] }))
        .send({});
      expect(res.status).toBe(403);
    });

    it('deniega a ESPECIALISTA (403)', async () => {
      const pool = crearPoolMock(ID_ESPECIALISTA, {
        roles: ['ESPECIALISTA'],
        permisos: [{ codigo: 'EXPEDIENTE_RESOLVER', ambito: 'AREA', areaId: ID_AREA_SEC }],
      });
      const app = construirApp(pool);
      const res = await request(app)
        .post('/api/v1/firma/invocar-refirma')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_ESPECIALISTA, roles: ['ESPECIALISTA'] }))
        .send({});
      expect(res.status).toBe(403);
    });

    it('permite a DIRECTOR con facultad global de firma superar la autorización', async () => {
      const pool = crearPoolMock(ID_DIRECTOR, {
        roles: ['DIRECTOR'],
        permisos: [
          { codigo: 'FIRMA_FIRMAR', ambito: 'GLOBAL', areaId: null },
          { codigo: 'EXPEDIENTE_RESOLVER', ambito: 'AREA', areaId: null },
        ],
        facultadFirma: true,
      });
      const app = construirApp(pool);
      const res = await request(app)
        .post('/api/v1/firma/invocar-refirma')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_DIRECTOR, roles: ['DIRECTOR'] }))
        .send({
          firmante: { id: ID_DIRECTOR, nombre: 'Director Demo', documento: '00112233' },
          hostPublico: 'sigd.iestp-suiza.edu.pe',
        });
      // Supera el 403; responde procesando la solicitud
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe('Endpoint: Panel de Administración de Usuarios (GET /api/v1/admin/usuarios)', () => {
    it('deniega a CIUDADANO (403)', async () => {
      const pool = crearPoolMock(ID_CIUDADANO, { roles: ['CIUDADANO'], permisos: [] });
      const app = construirApp(pool);
      const res = await request(app)
        .get('/api/v1/admin/usuarios')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_CIUDADANO, roles: ['CIUDADANO'] }));
      expect(res.status).toBe(403);
    });

    it('deniega a DIRECTOR (403)', async () => {
      const pool = crearPoolMock(ID_DIRECTOR, { roles: ['DIRECTOR'], permisos: [] });
      const app = construirApp(pool);
      const res = await request(app)
        .get('/api/v1/admin/usuarios')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_DIRECTOR, roles: ['DIRECTOR'] }));
      expect(res.status).toBe(403);
    });

    it('deniega a ESPECIALISTA (403)', async () => {
      const pool = crearPoolMock(ID_ESPECIALISTA, { roles: ['ESPECIALISTA'], permisos: [] });
      const app = construirApp(pool);
      const res = await request(app)
        .get('/api/v1/admin/usuarios')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_ESPECIALISTA, roles: ['ESPECIALISTA'] }));
      expect(res.status).toBe(403);
    });

    it('permite a ADMINISTRADOR con ADMIN_USUARIOS GLOBAL', async () => {
      const pool = crearPoolMock(ID_ADMIN, {
        roles: ['ADMINISTRADOR'],
        permisos: [{ codigo: 'ADMIN_USUARIOS', ambito: 'GLOBAL', areaId: null }],
      });
      const app = construirApp(pool);
      const res = await request(app)
        .get('/api/v1/admin/usuarios')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_ADMIN, roles: ['ADMINISTRADOR'] }));
      expect(res.status).toBe(200);
      expect(res.body.paginacion).toBeDefined();
    });
  });

  describe('Endpoint: Reportes Ejecutivos (GET /api/v1/reportes/dashboard/resumen)', () => {
    it('deniega a CIUDADANO (403)', async () => {
      const pool = crearPoolMock(ID_CIUDADANO, { roles: ['CIUDADANO'], permisos: [] });
      const app = construirApp(pool);
      const res = await request(app)
        .get('/api/v1/reportes/dashboard/resumen')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_CIUDADANO, roles: ['CIUDADANO'] }));
      expect(res.status).toBe(403);
    });

    it('deniega a ESPECIALISTA (403)', async () => {
      const pool = crearPoolMock(ID_ESPECIALISTA, { roles: ['ESPECIALISTA'], permisos: [] });
      const app = construirApp(pool);
      const res = await request(app)
        .get('/api/v1/reportes/dashboard/resumen')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_ESPECIALISTA, roles: ['ESPECIALISTA'] }));
      expect(res.status).toBe(403);
    });

    it('permite a DIRECTOR con REPORTE_LEER GLOBAL', async () => {
      const pool = crearPoolMock(ID_DIRECTOR, {
        roles: ['DIRECTOR'],
        permisos: [{ codigo: 'REPORTE_LEER', ambito: 'GLOBAL', areaId: null }],
      });
      const app = construirApp(pool);
      const res = await request(app)
        .get('/api/v1/reportes/dashboard/resumen')
        .set('Authorization', 'Bearer ' + firmarTokenAcceso({ sub: ID_DIRECTOR, roles: ['DIRECTOR'] }));
      expect(res.status).toBe(200);
      expect(res.body.disponibilidad).toBeDefined();
    });
  });
});
