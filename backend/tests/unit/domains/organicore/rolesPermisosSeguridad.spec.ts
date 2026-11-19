import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { crearUsuariosAdminService } from '../../../../src/domains/organicore/usuariosAdmin.service.js';
import { exigirAdministradorTupa, crearRouterAdminMaestras } from '../../../../src/domains/organicore/adminMaestras.routes.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';
import express from 'express';

const ROL_ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const ROL_CIUDADANO_ID = '22222222-2222-4222-8222-222222222222';
const ROL_ESPECIALISTA_ID = '33333333-3333-4333-8333-333333333333';
const PERMISO_ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PERMISO_DERIVAR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PERMISO_RESOLVER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ACTOR_ADMIN_ID = '99999999-9999-4999-8999-999999999999';

describe('Seguridad RBAC Fase 1: Blindaje de Roles y Permisos', () => {
  describe('Protección del rol CIUDADANO (5.2)', () => {
    it('rechaza cualquier intento de modificar permisos del rol CIUDADANO con HTTP 422', async () => {
      const query = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT rol_id')) {
          return { rows: [{ rol_id: ROL_CIUDADANO_ID, codigo: 'CIUDADANO', nombre: 'Ciudadano' }] };
        }
        return { rows: [] };
      });
      const release = vi.fn();
      const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
      const service = crearUsuariosAdminService(pool);

      await expect(
        service.actualizarPermisosRol(ROL_CIUDADANO_ID, [PERMISO_DERIVAR_ID], ACTOR_ADMIN_ID)
      ).rejects.toMatchObject({
        status: 422,
        code: 'ROL_EXTERNO_NO_MODIFICABLE',
      });

      expect(query).toHaveBeenCalledWith('ROLLBACK');
      expect(query.mock.calls.some(([sql]) => sql.includes('DELETE FROM sigd_org.rol_permiso'))).toBe(false);
      expect(release).toHaveBeenCalledOnce();
    });
  });

  describe('Protección contra Autobloqueo Administrativo (5.3)', () => {
    it('rechaza con HTTP 422 si se intenta retirar ADMIN_USUARIOS del rol ADMINISTRADOR', async () => {
      const query = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT rol_id, codigo')) {
          return { rows: [{ rol_id: ROL_ADMIN_ID, codigo: 'ADMINISTRADOR', nombre: 'Administrador del Sistema' }] };
        }
        if (sql.includes("SELECT permiso_id, codigo FROM sigd_org.permiso_sistema WHERE permiso_id=ANY")) {
          return { rows: [{ permiso_id: PERMISO_DERIVAR_ID, codigo: 'EXPEDIENTE_DERIVAR' }] };
        }
        if (sql.includes("WHERE codigo = 'ADMIN_USUARIOS'")) {
          return { rows: [{ permiso_id: PERMISO_ADMIN_ID }] };
        }
        return { rows: [] };
      });
      const release = vi.fn();
      const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
      const service = crearUsuariosAdminService(pool);

      await expect(
        service.actualizarPermisosRol(ROL_ADMIN_ID, [PERMISO_DERIVAR_ID], ACTOR_ADMIN_ID)
      ).rejects.toMatchObject({
        status: 422,
        code: 'PERMISO_ADMIN_OBLIGATORIO',
      });

      expect(query).toHaveBeenCalledWith('ROLLBACK');
      expect(query.mock.calls.some(([sql]) => sql.includes('DELETE FROM sigd_org.rol_permiso'))).toBe(false);
      expect(release).toHaveBeenCalledOnce();
    });

    it('rechaza con HTTP 422 si no existen cuentas activas asignadas al rol ADMINISTRADOR', async () => {
      const query = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT rol_id, codigo')) {
          return { rows: [{ rol_id: ROL_ADMIN_ID, codigo: 'ADMINISTRADOR', nombre: 'Administrador del Sistema' }] };
        }
        if (sql.includes("WHERE codigo = 'ADMIN_USUARIOS'")) {
          return { rows: [{ permiso_id: PERMISO_ADMIN_ID }] };
        }
        if (sql.includes("SELECT permiso_id, codigo FROM sigd_org.permiso_sistema WHERE permiso_id=ANY")) {
          return { rows: [{ permiso_id: PERMISO_ADMIN_ID, codigo: 'ADMIN_USUARIOS' }] };
        }
        if (sql.includes('COUNT(DISTINCT ur.id_usuario)')) {
          return { rows: [{ total: 0 }] };
        }
        return { rows: [] };
      });
      const release = vi.fn();
      const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
      const service = crearUsuariosAdminService(pool);

      await expect(
        service.actualizarPermisosRol(ROL_ADMIN_ID, [PERMISO_ADMIN_ID], ACTOR_ADMIN_ID)
      ).rejects.toMatchObject({
        status: 422,
        code: 'SIN_ADMINISTRADORES_ACTIVOS',
      });

      expect(query).toHaveBeenCalledWith('ROLLBACK');
      expect(query.mock.calls.some(([sql]) => sql.includes('DELETE FROM sigd_org.rol_permiso'))).toBe(false);
      expect(release).toHaveBeenCalledOnce();
    });
  });

  describe('Auditoría obligatoria de modificaciones de permisos (5.1)', () => {
    it('registra en sigd_audit.bitacora_auditoria los permisos anteriores, nuevos, agregados y retirados con actorId', async () => {
      const auditoriaRows: any[] = [];
      const query = vi.fn(async (sql: string, params?: any[]) => {
        if (sql.includes('SELECT rol_id, codigo')) {
          return { rows: [{ rol_id: ROL_ESPECIALISTA_ID, codigo: 'ESPECIALISTA', nombre: 'Especialista' }] };
        }
        if (sql.includes("SELECT permiso_id, codigo FROM sigd_org.permiso_sistema WHERE permiso_id=ANY")) {
          return {
            rows: [
              { permiso_id: PERMISO_DERIVAR_ID, codigo: 'EXPEDIENTE_DERIVAR' },
              { permiso_id: PERMISO_RESOLVER_ID, codigo: 'EXPEDIENTE_RESOLVER' },
            ],
          };
        }
        if (sql.includes('FROM sigd_org.rol_permiso rp')) {
          // Permiso previo: solo DERIVAR
          return { rows: [{ permiso_id: PERMISO_DERIVAR_ID, codigo: 'EXPEDIENTE_DERIVAR' }] };
        }
        if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
          auditoriaRows.push({ sql, params });
          return { rows: [{ id_auditoria: 'auditoria-123' }] };
        }
        return { rows: [], rowCount: 1 };
      });
      const release = vi.fn();
      const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
      const service = crearUsuariosAdminService(pool);

      const resultado = await service.actualizarPermisosRol(
        ROL_ESPECIALISTA_ID,
        [PERMISO_DERIVAR_ID, PERMISO_RESOLVER_ID],
        ACTOR_ADMIN_ID
      );

      expect(resultado).toEqual({
        id: ROL_ESPECIALISTA_ID,
        permisos: [PERMISO_DERIVAR_ID, PERMISO_RESOLVER_ID],
      });

      expect(query).toHaveBeenCalledWith('COMMIT');
      expect(auditoriaRows.length).toBe(1);

      const auditParams = auditoriaRows[0].params;
      expect(auditParams[4]).toBe('sigd_org'); // esquema
      expect(auditParams[5]).toBe('rol_permiso'); // tabla
      expect(auditParams[6]).toBe('UPDATE'); // operacion

      const datosAntes = JSON.parse(auditParams[7]);
      const datosDespues = JSON.parse(auditParams[8]);

      expect(datosAntes.rol_codigo).toBe('ESPECIALISTA');
      expect(datosAntes.permisos).toEqual(['EXPEDIENTE_DERIVAR']);

      expect(datosDespues.rol_codigo).toBe('ESPECIALISTA');
      expect(datosDespues.permisos).toEqual(['EXPEDIENTE_DERIVAR', 'EXPEDIENTE_RESOLVER']);
      expect(datosDespues.agregados).toEqual(['EXPEDIENTE_RESOLVER']);
      expect(datosDespues.retirados).toEqual([]);
      expect(datosDespues.actor_id).toBe(ACTOR_ADMIN_ID);
    });

    it('ejecuta ROLLBACK completo si el registro de auditoría falla', async () => {
      const query = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT rol_id, codigo')) {
          return { rows: [{ rol_id: ROL_ESPECIALISTA_ID, codigo: 'ESPECIALISTA', nombre: 'Especialista' }] };
        }
        if (sql.includes("SELECT permiso_id, codigo FROM sigd_org.permiso_sistema WHERE permiso_id=ANY")) {
          return { rows: [{ permiso_id: PERMISO_DERIVAR_ID, codigo: 'EXPEDIENTE_DERIVAR' }] };
        }
        if (sql.includes('FROM sigd_org.rol_permiso rp')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
          throw new Error('Fallo simulado de disco en bitácora WORM');
        }
        return { rows: [], rowCount: 1 };
      });
      const release = vi.fn();
      const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
      const service = crearUsuariosAdminService(pool);

      await expect(
        service.actualizarPermisosRol(ROL_ESPECIALISTA_ID, [PERMISO_DERIVAR_ID], ACTOR_ADMIN_ID)
      ).rejects.toThrow('Fallo simulado de disco');

      expect(query).toHaveBeenCalledWith('ROLLBACK');
      expect(query).not.toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('Eliminación del Bypass en Maestras TUPA (5.4)', () => {
    it('deniega con HTTP 403 a un JWT con rol afirmado si la base de datos no autoriza la cuenta', async () => {
      process.env.AUTH_JWT_SECRET = '12345678901234567890123456789012';
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('autorizado')) {
            // Base de datos dice que NO está autorizado (cuenta inactiva o rol revocado)
            return { rows: [{ autorizado: false }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const app = express();
      app.use(express.json());
      app.use('/api/v1/admin', crearRouterAdminMaestras(mockPool));
      app.use(errorMiddleware);

      const tokenConRolAfirmado = firmarTokenAcceso({
        sub: '55555555-5555-4555-8555-555555555555',
        roles: ['ADMINISTRADOR'],
        expiraSegundos: 300,
        secreto: '12345678901234567890123456789012',
      });

      const res = await request(app)
        .post('/api/v1/admin/tupa/versiones')
        .set('Authorization', `Bearer ${tokenConRolAfirmado}`)
        .send({ codigoVersion: 'TUPA-HACK-V1', denominacion: 'Hack' });

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('Acceso denegado');
    });

    it('permite acceso cuando la base de datos confirma que la cuenta institucional está activa y vigente', async () => {
      process.env.AUTH_JWT_SECRET = '12345678901234567890123456789012';
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('autorizado')) {
            return { rows: [{ autorizado: true }] };
          }
          if (sql.includes('information_schema.tables')) {
            return { rows: [{ existe: false }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const app = express();
      app.use(express.json());
      app.use('/api/v1/admin', crearRouterAdminMaestras(mockPool));
      app.use(errorMiddleware);

      const tokenAdmin = firmarTokenAcceso({
        sub: ACTOR_ADMIN_ID,
        roles: ['ADMINISTRADOR'],
        expiraSegundos: 300,
        secreto: '12345678901234567890123456789012',
      });

      const res = await request(app)
        .post('/api/v1/admin/tupa/versiones')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          codigoVersion: 'TUPA-TEST-2026',
          denominacion: 'TUPA Test Institucional',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.codigoVersion).toBe('TUPA-TEST-2026');
    });
  });
});
