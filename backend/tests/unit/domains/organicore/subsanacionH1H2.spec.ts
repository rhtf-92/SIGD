import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { crearUsuariosAdminService } from '../../../../src/domains/organicore/usuariosAdmin.service.js';
import { politicaReversionPredeterminada } from '../../../../src/domains/rutadoc/rutadoc.router.js';
import { obtenerAutorizacionCuenta, tienePermisoGlobal } from '../../../../src/core/auth/auth.guard.js';
import { runWithContext, crearContexto } from '../../../../src/shared/request-context/request-context.js';
import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';

const ADMIN_ID = '99999999-9999-4999-8999-999999999999';
const USUARIO_ID = '10000000-0000-4000-8000-000000000001';
const PERSONA_ID = '20000000-0000-4000-8000-000000000002';
const AREA_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AREA_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CARGO_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ROL_ESPECIALISTA_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const ROL_ADMIN_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ASIGNACION_ID = '30000000-0000-4000-8000-000000000003';
const USUARIO_ROL_ID = '40000000-0000-4000-8000-000000000004';
const EXPEDIENTE_ID = '50000000-0000-4000-8000-000000000005';

describe('Subsanación H1 y H2 — Cierre Técnico Definitivo de Fase 1', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('H1: Identidad del Administrador y Trazabilidad en Bitácora', () => {
    it('H1.1: Ambos campos (usuario_id de BD y datos_despues.actor_id) contienen el mismo UUID exacto del administrador', async () => {
      let mutacionRegistrada: any = null;
      const query = vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.includes('SELECT rol_id, codigo, nombre FROM sigd_org.rol_sistema')) {
          return { rows: [{ rol_id: ROL_ESPECIALISTA_ID, codigo: 'ESPECIALISTA', nombre: 'Especialista' }] };
        }
        if (sql.includes('SELECT permiso_id, codigo FROM sigd_org.permiso_sistema WHERE permiso_id=ANY')) {
          return { rows: [{ permiso_id: 'p1', codigo: 'EXPEDIENTE_DERIVAR' }] };
        }
        if (sql.includes('SELECT p.permiso_id, p.codigo FROM sigd_org.rol_permiso')) {
          return { rows: [{ permiso_id: 'p1', codigo: 'EXPEDIENTE_DERIVAR' }] };
        }
        if (sql.includes('DELETE FROM sigd_org.rol_permiso')) return { rows: [], rowCount: 1 };
        if (sql.includes('INSERT INTO sigd_org.rol_permiso')) return { rows: [], rowCount: 1 };
        if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
          mutacionRegistrada = { sql, params };
          return { rows: [{ id_auditoria: 'audit-uuid-1' }] };
        }
        return { rows: [] };
      });
      const release = vi.fn();
      const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
      const service = crearUsuariosAdminService(pool);

      // Ejecutar dentro de un contexto HTTP autenticado
      const ctx = crearContexto({ correlation_id: 'corr-uuid-1', usuario_id: ADMIN_ID });
      await runWithContext(ctx, async () => {
        const res = await service.actualizarPermisosRol(ROL_ESPECIALISTA_ID, ['p1']);
        expect(res).toBeDefined();
      });

      expect(mutacionRegistrada).not.toBeNull();
      const [, usuarioIdCol, , , , , , , datosDespuesStr] = mutacionRegistrada.params;
      const datosDespues = JSON.parse(datosDespuesStr);

      // Verificación de oro H1: La columna usuario_id y datos_despues.actor_id coinciden exactamente con ADMIN_ID
      expect(usuarioIdCol).toBe(ADMIN_ID);
      expect(datosDespues.actor_id).toBe(ADMIN_ID);
    });

    it('H1.2: Contexto inexistente / no autenticado rechaza la operación con UnauthorizedError sin mutar', async () => {
      const query = vi.fn();
      const release = vi.fn();
      const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
      const service = crearUsuariosAdminService(pool);

      // Llamar sin actorId y sin RequestContext
      await expect(service.actualizarPermisosRol(ROL_ESPECIALISTA_ID, ['p1'])).rejects.toMatchObject({
        status: 401,
        code: 'UNAUTHORIZED',
      });

      expect(query).not.toHaveBeenCalled();
    });

    it('H1.3: Un error durante el registro en auditoría revierte la transacción completa (ROLLBACK)', async () => {
      const query = vi.fn(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.includes('SELECT rol_id, codigo, nombre FROM sigd_org.rol_sistema')) {
          return { rows: [{ rol_id: ROL_ESPECIALISTA_ID, codigo: 'ESPECIALISTA', nombre: 'Especialista' }] };
        }
        if (sql.includes('SELECT permiso_id, codigo FROM sigd_org.permiso_sistema')) {
          return { rows: [{ permiso_id: 'p1', codigo: 'EXPEDIENTE_DERIVAR' }] };
        }
        if (sql.includes('DELETE FROM sigd_org.rol_permiso')) return { rows: [], rowCount: 1 };
        if (sql.includes('INSERT INTO sigd_org.rol_permiso')) return { rows: [], rowCount: 1 };
        if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
          throw new Error('Violación WORM simulada');
        }
        return { rows: [] };
      });
      const release = vi.fn();
      const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
      const service = crearUsuariosAdminService(pool);

      await expect(
        service.actualizarPermisosRol(ROL_ESPECIALISTA_ID, ['p1'], ADMIN_ID)
      ).rejects.toThrow('Violación WORM simulada');

      expect(query).toHaveBeenCalledWith('ROLLBACK');
      expect(query).not.toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('H2: Sincronización de Ámbitos Institucionales (GLOBAL y AREA)', () => {
    it('H2.1: Asignación posterior de rol departamental vincula el area_id del trabajador en usuario_rol', async () => {
      vi.spyOn(Argon2Service, 'hash').mockResolvedValueOnce('$argon2id$mocked-hash');
      const inserts: Record<string, unknown[]> = {};

      const query = vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.startsWith('SELECT id_usuario, activo FROM sigd_auth.cuenta_usuario')) {
          return { rows: [{ id_usuario: USUARIO_ID, activo: false }], rowCount: 1 };
        }
        if (sql.startsWith('SELECT cargo_id') || sql.startsWith('SELECT area_id')) return { rows: [{}], rowCount: 1 };
        if (sql.includes('FROM sigd_org.rol_sistema')) {
          return { rows: [{ rol_id: ROL_ESPECIALISTA_ID, codigo: 'ESPECIALISTA' }], rowCount: 1 };
        }
        if (sql.includes('FROM sigd_org.usuario_rol WHERE id_usuario=')) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('asignacion_personal')) {
          return { rows: [{ area_id: AREA_A_ID }], rowCount: 1 };
        }
        if (sql.startsWith('INSERT INTO sigd_org.usuario_rol')) {
          inserts['usuario_rol'] = params ?? [];
          return { rows: [{ id_usuario_rol: USUARIO_ROL_ID }], rowCount: 1 };
        }
        if (sql.startsWith('UPDATE sigd_auth.sesion_usuario')) return { rows: [], rowCount: 0 };
        if (sql.startsWith('SELECT cu.id_usuario::text')) {
          return {
            rows: [{
              id: USUARIO_ID, username: 'juan.perez', nombre: 'Juan Pérez',
              area: 'Informática', cargo: 'Especialista', rol: 'Especialista', estado: 'INACTIVO',
              asignaciones: [{ id: ASIGNACION_ID, cargoId: CARGO_ID, areaId: AREA_A_ID }],
              roles: [{ id: USUARIO_ROL_ID, rolId: ROL_ESPECIALISTA_ID, areaId: AREA_A_ID }]
            }],
            rowCount: 1,
          };
        }
        if (sql.startsWith('INSERT INTO sigd_audit.bitacora_auditoria')) return { rows: [{ id_auditoria: 'a1' }], rowCount: 1 };
        if (/^(INSERT|UPDATE) /.test(sql)) return { rows: [], rowCount: 1 };
        return { rows: [] };
      });
      const release = vi.fn();
      const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
      const service = crearUsuariosAdminService(pool);

      const usuarioConRol = await service.asignarRol(USUARIO_ID, ROL_ESPECIALISTA_ID, ADMIN_ID);
      expect(usuarioConRol).toBeDefined();
      // Verificación H2: Para rol departamental, usuario_rol recibe el area_id del trabajador e institucion_id
      expect(inserts['usuario_rol']).toEqual([USUARIO_ID, ROL_ESPECIALISTA_ID, AREA_A_ID, expect.any(String)]);
    });

    it('H2.2: Asignación de rol ADMINISTRADOR conserva area_id = NULL en usuario_rol para alcance global', async () => {
      let insertURParams: unknown[] = [];

      const query = vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.startsWith('SELECT id_usuario, activo FROM sigd_auth.cuenta_usuario')) {
          return { rows: [{ id_usuario: USUARIO_ID, activo: false }], rowCount: 1 };
        }
        if (sql.includes('FROM sigd_org.rol_sistema')) {
          return { rows: [{ rol_id: ROL_ADMIN_ID, codigo: 'ADMINISTRADOR' }], rowCount: 1 };
        }
        if (sql.includes('FROM sigd_org.usuario_rol WHERE id_usuario=')) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.startsWith('INSERT INTO sigd_org.usuario_rol')) {
          insertURParams = params ?? [];
          return { rows: [{ id_usuario_rol: USUARIO_ROL_ID }], rowCount: 1 };
        }
        if (sql.startsWith('UPDATE sigd_auth.sesion_usuario')) return { rows: [], rowCount: 0 };
        if (sql.startsWith('SELECT cu.id_usuario::text')) {
          return { rows: [{ id: USUARIO_ID, roles: [] }], rowCount: 1 };
        }
        if (sql.startsWith('INSERT INTO sigd_audit.bitacora_auditoria')) return { rows: [{ id_auditoria: 'a1' }], rowCount: 1 };
        if (/^(INSERT|UPDATE) /.test(sql)) return { rows: [], rowCount: 1 };
        return { rows: [] };
      });
      const release = vi.fn();
      const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
      const service = crearUsuariosAdminService(pool);

      await service.asignarRol(USUARIO_ID, ROL_ADMIN_ID, ADMIN_ID);

      // Para ADMINISTRADOR, area_id en usuario_rol debe ser NULL
      expect(insertURParams).toEqual([USUARIO_ID, ROL_ADMIN_ID, null, expect.any(String)]);
    });

    it('H2.3: auth.guard mapea areaId sólo a permisos con ambito AREA, y null a permisos GLOBAL', async () => {
      const query = vi.fn().mockResolvedValueOnce({
        rows: [{
          roles: ['ESPECIALISTA'],
          permisos: [
            { codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: AREA_A_ID },
            { codigo: 'EXPEDIENTE_RESOLVER', ambito: 'AREA', areaId: AREA_A_ID },
            { codigo: 'EXPEDIENTE_LEER', ambito: 'GLOBAL', areaId: null },
          ],
          unidad_organica_id: AREA_A_ID,
        }]
      });
      const pool = { query } as unknown as Pool;
      const autorizacion = await obtenerAutorizacionCuenta(pool, USUARIO_ID);

      expect(autorizacion).not.toBeNull();
      const perms = autorizacion!.permisos;

      // Permisos de AREA tienen el areaId correspondiente
      const permDerivar = perms.find(p => p.codigo === 'EXPEDIENTE_DERIVAR');
      expect(permDerivar?.areaId).toBe(AREA_A_ID);
      expect(permDerivar?.ambito).toBe('AREA');

      // Permisos GLOBAL conservan areaId = null
      const permLeer = perms.find(p => p.codigo === 'EXPEDIENTE_LEER');
      expect(permLeer?.areaId).toBeNull();
      expect(permLeer?.ambito).toBe('GLOBAL');

      // tienePermisoGlobal evalúa a true para EXPEDIENTE_LEER
      expect(tienePermisoGlobal(perms, 'EXPEDIENTE_LEER')).toBe(true);
    });

    it('H2.4: RutaDoc permite a trabajador de Área A operar expediente en Área A, y deniega en Área B', async () => {
      const pool = {
        query: vi.fn(async (_sql: string, params?: unknown[]) => {
          const [, areas] = params as [string, string[]];
          // Simular que el expediente está en Área A
          const areaActualExpediente = AREA_A_ID;
          const autorizado = areas.includes(areaActualExpediente);
          return { rows: [{ autorizado }] };
        }),
      } as unknown as Pool;

      const politica = politicaReversionPredeterminada(pool);

      // Actor asignado a Área A
      const actorAreaA = {
        id: USUARIO_ID,
        roles: ['ESPECIALISTA'],
        permisos: [
          { codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: AREA_A_ID },
          { codigo: 'EXPEDIENTE_RESOLVER', ambito: 'AREA', areaId: AREA_A_ID },
        ],
      };

      // Expediente en Área A -> Permitido
      const accesoPermitido = await politica(actorAreaA as any, EXPEDIENTE_ID);
      expect(accesoPermitido).toBe(true);

      // Actor asignado a Área B intentando operar en expediente de Área A
      const actorAreaB = {
        id: 'otro-usuario',
        roles: ['ESPECIALISTA'],
        permisos: [
          { codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: AREA_B_ID },
        ],
      };

      const accesoDenegado = await politica(actorAreaB as any, EXPEDIENTE_ID);
      expect(accesoDenegado).toBe(false);
    });

    it('H2.5: Traslado institucional (cambio de área en actualizarUsuario) actualiza usuario_rol y revoca sesiones', async () => {
      let updateUR = false;
      let insertURNuevo = false;
      let sesionesRevocadas = false;

      const query = vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.includes('FROM sigd_auth.cuenta_usuario WHERE id_usuario=$1::uuid FOR UPDATE')) {
          return { rows: [{ id_persona: PERSONA_ID, activo: true }], rowCount: 1 };
        }
        if (sql.startsWith('SELECT cargo_id') || sql.startsWith('SELECT area_id')) return { rows: [{}], rowCount: 1 };
        if (sql.startsWith('SELECT ap.id_asignacion')) {
          // Asignación previa en Área A
          return { rows: [{ id_asignacion: ASIGNACION_ID, cargo_id: CARGO_ID, area_id: AREA_A_ID }], rowCount: 1 };
        }
        if (sql.includes('UPDATE sigd_org.asignacion_personal SET vigente_hasta=now()')) {
          return { rows: [], rowCount: 1 };
        }
        if (sql.startsWith('INSERT INTO sigd_org.asignacion_personal')) {
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes('SELECT ur.id_usuario_rol, ur.rol_id, ur.area_id, r.codigo')) {
          return { rows: [{ id_usuario_rol: USUARIO_ROL_ID, rol_id: ROL_ESPECIALISTA_ID, area_id: AREA_A_ID, codigo: 'ESPECIALISTA' }], rowCount: 1 };
        }
        if (sql.includes('UPDATE sigd_org.usuario_rol SET vigente_hasta=now()')) {
          updateUR = true;
          return { rows: [], rowCount: 1 };
        }
        if (sql.startsWith('INSERT INTO sigd_org.usuario_rol')) {
          // Se inserta con el nuevo AREA_B_ID
          if (params?.[2] === AREA_B_ID) {
            insertURNuevo = true;
          }
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes('UPDATE sigd_auth.sesion_usuario SET revocado_en = now()')) {
          sesionesRevocadas = true;
          return { rows: [], rowCount: 1 };
        }
        if (sql.startsWith('SELECT cu.id_usuario::text')) {
          return { rows: [{ id: USUARIO_ID, estado: 'ACTIVO', asignaciones: [], roles: [] }], rowCount: 1 };
        }
        if (sql.startsWith('INSERT INTO sigd_audit.bitacora_auditoria')) return { rows: [{ id_auditoria: 'a2' }], rowCount: 1 };
        return { rows: [] };
      });
      const release = vi.fn();
      const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
      const service = crearUsuariosAdminService(pool);

      // Trasladar trabajador de Área A a Área B
      await service.actualizarUsuario(USUARIO_ID, {
        cargoId: CARGO_ID,
        areaId: AREA_B_ID,
      });

      expect(updateUR).toBe(true);
      expect(insertURNuevo).toBe(true);
      expect(sesionesRevocadas).toBe(true);
      expect(query).toHaveBeenCalledWith('COMMIT');
    });
  });
});
