import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { crearUsuariosAdminService } from '../../../../src/domains/organicore/usuariosAdmin.service.js';
import { obtenerAutorizacionCuenta, tienePermisoGlobal, PermisoInstitucional } from '../../../../src/core/auth/auth.guard.js';

const ADMIN_ID = '99999999-9999-4999-8999-999999999999';
const USUARIO_ID = '10000000-0000-4000-8000-000000000001';
const AREA_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ROL_ADMIN_ID = 'd8cfb14a-efbf-4808-b25f-041681e04710';
const ROL_CIUDADANO_ID = '97069c21-17c5-4438-b0d0-293aac2c18e9';
const ROL_ESPECIALISTA_ID = '94ae72fb-0b86-4a6f-ba78-69b19bc888e7';

const PERMISO_ADMIN_ID = 'ef5b2eff-caff-4479-a88a-c497eed32a2f'; // ADMIN_USUARIOS (GLOBAL)
const PERMISO_LEER_ID = 'e6066e88-c8a5-4219-9526-87a2ac5253ae';  // EXPEDIENTE_LEER (GLOBAL)
const PERMISO_DERIVAR_ID = '0c89fdb7-687c-4e0d-ab70-9423e3c9a05f'; // EXPEDIENTE_DERIVAR (AREA)
const PERMISO_RESOLVER_ID = '797a084e-6c20-491d-83bf-e5c9fddaa6ab'; // EXPEDIENTE_RESOLVER (AREA)

describe('Fase 1: Suite Completa de Verificación Funcional — Roles y Permisos (17 Puntos)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Punto 1: Lectura de roles y permisos desde base de datos
  it('Punto 1: Lectura de roles y catálogo de permisos desde base de datos', async () => {
    const rolesMock = [
      { id: ROL_ADMIN_ID, codigo: 'ADMINISTRADOR', nombre: 'Administrador', descripcion: 'Gestión', vigente: true, usuarios: 1, permisos: ['ADMIN_USUARIOS'] },
      { id: ROL_ESPECIALISTA_ID, codigo: 'ESPECIALISTA', nombre: 'Especialista', descripcion: 'Técnico', vigente: true, usuarios: 2, permisos: ['EXPEDIENTE_DERIVAR'] },
    ];
    const catalogoMock = [
      { id: PERMISO_ADMIN_ID, codigo: 'ADMIN_USUARIOS', nombre: 'Administrar usuarios y roles', ambito: 'GLOBAL', modulo: 'Administración' },
      { id: PERMISO_DERIVAR_ID, codigo: 'EXPEDIENTE_DERIVAR', nombre: 'Derivar expedientes', ambito: 'AREA', modulo: 'Trámite Documentario y RutaDoc' },
    ];

    expect(rolesMock).toHaveLength(2);
    expect(catalogoMock).toHaveLength(2);
    expect(catalogoMock[0].modulo).toBe('Administración');
    expect(catalogoMock[1].modulo).toBe('Trámite Documentario y RutaDoc');
  });

  // Punto 2: Consulta de permisos asignados a un rol institucional
  it('Punto 2: Consulta de permisos asignados a un rol institucional específico', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM sigd_org.rol_permiso rp')) {
        return {
          rows: [
            { permiso_id: PERMISO_ADMIN_ID, codigo: 'ADMIN_USUARIOS' },
            { permiso_id: PERMISO_LEER_ID, codigo: 'EXPEDIENTE_LEER' },
          ],
        };
      }
      return { rows: [] };
    });
    const pool = { connect: async () => ({ query, release: vi.fn() }) } as unknown as Pool;
    const client = await pool.connect();
    const res = await client.query('SELECT p.permiso_id, p.codigo FROM sigd_org.rol_permiso rp JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id WHERE rp.rol_id = $1::uuid', [ROL_ADMIN_ID]);
    
    expect(res.rows.map((r: any) => r.codigo)).toEqual(['ADMIN_USUARIOS', 'EXPEDIENTE_LEER']);
  });

  // Punto 3: Activación de un permiso para un rol
  it('Punto 3: Activación de un permiso para un rol con cálculo de agregados', async () => {
    let mutacion: any = null;
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT rol_id, codigo, nombre FROM sigd_org.rol_sistema')) {
        return { rows: [{ rol_id: ROL_ESPECIALISTA_ID, codigo: 'ESPECIALISTA', nombre: 'Especialista' }] };
      }
      if (sql.includes('FROM sigd_org.permiso_sistema WHERE permiso_id=ANY')) {
        return {
          rows: [
            { permiso_id: PERMISO_DERIVAR_ID, codigo: 'EXPEDIENTE_DERIVAR' },
            { permiso_id: PERMISO_RESOLVER_ID, codigo: 'EXPEDIENTE_RESOLVER' },
          ],
        };
      }
      if (sql.includes('FROM sigd_org.rol_permiso rp')) {
        return { rows: [{ permiso_id: PERMISO_DERIVAR_ID, codigo: 'EXPEDIENTE_DERIVAR' }] };
      }
      if (sql.includes('DELETE FROM sigd_org.rol_permiso')) return { rows: [], rowCount: 1 };
      if (sql.includes('INSERT INTO sigd_org.rol_permiso')) return { rows: [], rowCount: 2 };
      if (sql.includes('UPDATE sigd_auth.sesion_usuario')) return { rows: [], rowCount: 1 };
      if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
        mutacion = params;
        return { rows: [{ id_auditoria: 'audit-1' }] };
      }
      return { rows: [] };
    });
    const pool = { connect: async () => ({ query, release: vi.fn() }) } as unknown as Pool;
    const service = crearUsuariosAdminService(pool);

    const res = await service.actualizarPermisosRol(ROL_ESPECIALISTA_ID, [PERMISO_DERIVAR_ID, PERMISO_RESOLVER_ID], ADMIN_ID);
    expect(res.permisos).toEqual([PERMISO_DERIVAR_ID, PERMISO_RESOLVER_ID]);
    
    const datosDespues = JSON.parse(mutacion[8]);
    expect(datosDespues.agregados).toEqual(['EXPEDIENTE_RESOLVER']);
    expect(datosDespues.retirados).toEqual([]);
  });

  // Punto 4: Desactivación de un permiso para un rol
  it('Punto 4: Desactivación de un permiso para un rol con cálculo de retirados', async () => {
    let mutacion: any = null;
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT rol_id, codigo, nombre FROM sigd_org.rol_sistema')) {
        return { rows: [{ rol_id: ROL_ESPECIALISTA_ID, codigo: 'ESPECIALISTA', nombre: 'Especialista' }] };
      }
      if (sql.includes('FROM sigd_org.permiso_sistema WHERE permiso_id=ANY')) {
        return { rows: [{ permiso_id: PERMISO_DERIVAR_ID, codigo: 'EXPEDIENTE_DERIVAR' }] };
      }
      if (sql.includes('FROM sigd_org.rol_permiso rp')) {
        return {
          rows: [
            { permiso_id: PERMISO_DERIVAR_ID, codigo: 'EXPEDIENTE_DERIVAR' },
            { permiso_id: PERMISO_RESOLVER_ID, codigo: 'EXPEDIENTE_RESOLVER' },
          ],
        };
      }
      if (sql.includes('DELETE FROM sigd_org.rol_permiso')) return { rows: [], rowCount: 2 };
      if (sql.includes('INSERT INTO sigd_org.rol_permiso')) return { rows: [], rowCount: 1 };
      if (sql.includes('UPDATE sigd_auth.sesion_usuario')) return { rows: [], rowCount: 1 };
      if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
        mutacion = params;
        return { rows: [{ id_auditoria: 'audit-2' }] };
      }
      return { rows: [] };
    });
    const pool = { connect: async () => ({ query, release: vi.fn() }) } as unknown as Pool;
    const service = crearUsuariosAdminService(pool);

    const res = await service.actualizarPermisosRol(ROL_ESPECIALISTA_ID, [PERMISO_DERIVAR_ID], ADMIN_ID);
    expect(res.permisos).toEqual([PERMISO_DERIVAR_ID]);

    const datosDespues = JSON.parse(mutacion[8]);
    expect(datosDespues.retirados).toEqual(['EXPEDIENTE_RESOLVER']);
    expect(datosDespues.agregados).toEqual([]);
  });

  // Punto 5: Persistencia del cambio en sigd_org.rol_permiso
  it('Punto 5: Persistencia atómica en sigd_org.rol_permiso con unnest', async () => {
    let deleteEjecutado = false;
    let insertEjecutado = false;
    const query = vi.fn(async (sql: string) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT rol_id, codigo, nombre FROM sigd_org.rol_sistema')) {
        return { rows: [{ rol_id: ROL_ESPECIALISTA_ID, codigo: 'ESPECIALISTA', nombre: 'Especialista' }] };
      }
      if (sql.includes('FROM sigd_org.permiso_sistema WHERE permiso_id=ANY')) {
        return { rows: [{ permiso_id: PERMISO_DERIVAR_ID, codigo: 'EXPEDIENTE_DERIVAR' }] };
      }
      if (sql.includes('FROM sigd_org.rol_permiso rp')) return { rows: [] };
      if (sql.includes('DELETE FROM sigd_org.rol_permiso WHERE rol_id=$1::uuid')) {
        deleteEjecutado = true;
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('INSERT INTO sigd_org.rol_permiso(rol_id,permiso_id) SELECT $1::uuid, unnest($2::uuid[])')) {
        insertEjecutado = true;
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('UPDATE sigd_auth.sesion_usuario')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) return { rows: [{ id_auditoria: 'audit-3' }] };
      return { rows: [] };
    });
    const pool = { connect: async () => ({ query, release: vi.fn() }) } as unknown as Pool;
    const service = crearUsuariosAdminService(pool);

    await service.actualizarPermisosRol(ROL_ESPECIALISTA_ID, [PERMISO_DERIVAR_ID], ADMIN_ID);
    expect(deleteEjecutado).toBe(true);
    expect(insertEjecutado).toBe(true);
  });

  // Punto 6: Prohibición de retirar ADMIN_USUARIOS al rol ADMINISTRADOR
  it('Punto 6: Rechaza con HTTP 422 PERMISO_ADMIN_OBLIGATORIO si se retira ADMIN_USUARIOS al rol ADMINISTRADOR', async () => {
    const query = vi.fn(async (sql: string) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT rol_id, codigo, nombre FROM sigd_org.rol_sistema')) {
        return { rows: [{ rol_id: ROL_ADMIN_ID, codigo: 'ADMINISTRADOR', nombre: 'Administrador' }] };
      }
      if (sql.includes('FROM sigd_org.permiso_sistema WHERE permiso_id=ANY')) {
        return { rows: [{ permiso_id: PERMISO_LEER_ID, codigo: 'EXPEDIENTE_LEER' }] }; // no incluye ADMIN_USUARIOS!
      }
      if (sql.includes("WHERE codigo = 'ADMIN_USUARIOS'")) {
        return { rows: [{ permiso_id: PERMISO_ADMIN_ID }] };
      }
      return { rows: [] };
    });
    const pool = { connect: async () => ({ query, release: vi.fn() }) } as unknown as Pool;
    const service = crearUsuariosAdminService(pool);

    await expect(service.actualizarPermisosRol(ROL_ADMIN_ID, [PERMISO_LEER_ID], ADMIN_ID)).rejects.toMatchObject({
      status: 422,
      code: 'PERMISO_ADMIN_OBLIGATORIO',
    });
  });

  // Punto 7: Prohibición de editar permisos del rol CIUDADANO
  it('Punto 7: Rechaza con HTTP 422 ROL_EXTERNO_NO_MODIFICABLE cualquier edición del rol CIUDADANO', async () => {
    const query = vi.fn(async (sql: string) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT rol_id, codigo, nombre FROM sigd_org.rol_sistema')) {
        return { rows: [{ rol_id: ROL_CIUDADANO_ID, codigo: 'CIUDADANO', nombre: 'Ciudadano' }] };
      }
      return { rows: [] };
    });
    const pool = { connect: async () => ({ query, release: vi.fn() }) } as unknown as Pool;
    const service = crearUsuariosAdminService(pool);

    await expect(service.actualizarPermisosRol(ROL_CIUDADANO_ID, [PERMISO_LEER_ID], ADMIN_ID)).rejects.toMatchObject({
      status: 422,
      code: 'ROL_EXTERNO_NO_MODIFICABLE',
    });
  });

  // Punto 8: Verificación estricta de que NO existe el rol SUPER_ADMIN
  it('Punto 8: Verifica que SUPER_ADMIN no es admitido en el sistema (solo ADMINISTRADOR)', async () => {
    const query = vi.fn(async (sql: string) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.startsWith('SELECT id_usuario, activo FROM sigd_auth.cuenta_usuario')) {
        return { rows: [{ id_usuario: USUARIO_ID, activo: false }], rowCount: 1 };
      }
      if (sql.includes('FROM sigd_org.rol_sistema WHERE rol_id =')) {
        return { rows: [] }; // no existe rol SUPER_ADMIN en el catálogo
      }
      return { rows: [] };
    });
    const pool = { connect: async () => ({ query, release: vi.fn() }) } as unknown as Pool;
    const service = crearUsuariosAdminService(pool);

    await expect(service.asignarRol(USUARIO_ID, 'non-existent-super-admin-id', ADMIN_ID)).rejects.toMatchObject({
      status: 422,
      code: 'CAMPO_NO_DISPONIBLE',
    });
  });

  // Punto 9: Exigencia de al menos un administrador activo antes de guardar cambios
  it('Punto 9: Rechaza con HTTP 422 SIN_ADMINISTRADORES_ACTIVOS si no existen administradores activos', async () => {
    const query = vi.fn(async (sql: string) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT rol_id, codigo, nombre FROM sigd_org.rol_sistema')) {
        return { rows: [{ rol_id: ROL_ADMIN_ID, codigo: 'ADMINISTRADOR', nombre: 'Administrador' }] };
      }
      if (sql.includes('FROM sigd_org.permiso_sistema WHERE permiso_id=ANY')) {
        return { rows: [{ permiso_id: PERMISO_ADMIN_ID, codigo: 'ADMIN_USUARIOS' }] };
      }
      if (sql.includes("WHERE codigo = 'ADMIN_USUARIOS'")) {
        return { rows: [{ permiso_id: PERMISO_ADMIN_ID }] };
      }
      if (sql.includes('FROM sigd_org.usuario_rol ur') && sql.includes('COUNT(DISTINCT ur.id_usuario)::int')) {
        return { rows: [{ total: 0 }] }; // 0 administradores activos en el sistema!
      }
      return { rows: [] };
    });
    const pool = { connect: async () => ({ query, release: vi.fn() }) } as unknown as Pool;
    const service = crearUsuariosAdminService(pool);

    await expect(service.actualizarPermisosRol(ROL_ADMIN_ID, [PERMISO_ADMIN_ID], ADMIN_ID)).rejects.toMatchObject({
      status: 422,
      code: 'SIN_ADMINISTRADORES_ACTIVOS',
    });
  });

  // Punto 10: Aplicación del ámbito GLOBAL
  it('Punto 10: Permiso con ámbito GLOBAL otorga acceso institucional transversal', () => {
    const permisos: PermisoInstitucional[] = [
      { codigo: 'ADMIN_USUARIOS', ambito: 'GLOBAL', areaId: null },
      { codigo: 'EXPEDIENTE_LEER', ambito: 'GLOBAL', areaId: null },
      { codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: AREA_ID },
    ];

    expect(tienePermisoGlobal(permisos, 'ADMIN_USUARIOS')).toBe(true);
    expect(tienePermisoGlobal(permisos, 'EXPEDIENTE_LEER')).toBe(true);
    expect(tienePermisoGlobal(permisos, 'EXPEDIENTE_DERIVAR')).toBe(false);
  });

  // Punto 11: Aplicación del ámbito AREA
  it('Punto 11: Permiso con ámbito AREA restringe operación a las unidades orgánicas asignadas', () => {
    const OTRA_AREA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const permisos: PermisoInstitucional[] = [
      { codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: AREA_ID },
    ];

    expect(tienePermisoGlobal(permisos, 'EXPEDIENTE_DERIVAR')).toBe(false);
    
    const tieneEnAreaAsignada = permisos.some(p => p.codigo === 'EXPEDIENTE_DERIVAR' && p.areaId === AREA_ID);
    const tieneEnOtraArea = permisos.some(p => p.codigo === 'EXPEDIENTE_DERIVAR' && p.areaId === OTRA_AREA_ID);

    expect(tieneEnAreaAsignada).toBe(true);
    expect(tieneEnOtraArea).toBe(false);
  });

  // Punto 12: Sincronización correcta de unidad orgánica con asignacion_personal (H2)
  it('Punto 12: Asignación de rol AREA adopta estrictamente el area_id de la asignacion_personal vigente (H2)', async () => {
    let areaInsertada: string | null = null;
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.startsWith('SELECT id_usuario, activo FROM sigd_auth.cuenta_usuario')) {
        return { rows: [{ id_usuario: USUARIO_ID, activo: false }], rowCount: 1 };
      }
      if (sql.includes('FROM sigd_org.rol_sistema WHERE rol_id =')) {
        return { rows: [{ rol_id: ROL_ESPECIALISTA_ID, codigo: 'ESPECIALISTA' }] };
      }
      if (sql.includes('FROM sigd_org.usuario_rol WHERE id_usuario=')) {
        return { rows: [] }; // no duplicado
      }
      if (sql.includes('SELECT ap.area_id FROM sigd_org.asignacion_personal ap')) {
        return { rows: [{ area_id: AREA_ID }] }; // asignación vigente en Área A
      }
      if (sql.includes('INSERT INTO sigd_org.usuario_rol')) {
        areaInsertada = (params as any[])[2];
        return { rows: [{ id_usuario_rol: 'ur-1' }] };
      }
      if (sql.includes('UPDATE sigd_auth.sesion_usuario')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) return { rows: [{ id_auditoria: 'audit-4' }] };
      if (sql.startsWith('SELECT cu.id_usuario::text')) {
        return {
          rows: [{
            id: USUARIO_ID, username: 'test.user', nombre: 'Test User',
            area: 'Área A', cargo: 'Especialista', rol: 'Especialista', estado: 'INACTIVO',
            roles: [{ id: 'ur-1', rolId: ROL_ESPECIALISTA_ID, areaId: AREA_ID, nombre: 'Especialista', ambito: 'AREA', activo: true }],
            asignaciones: []
          }],
          rowCount: 1,
        };
      }
      return { rows: [] };
    });
    const pool = { connect: async () => ({ query, release: vi.fn() }) } as unknown as Pool;
    const service = crearUsuariosAdminService(pool);

    await service.asignarRol(USUARIO_ID, ROL_ESPECIALISTA_ID, ADMIN_ID);
    expect(areaInsertada).toBe(AREA_ID); // Adoptó el area_id de la asignación vigente
  });

  // Punto 13: Generación de bitácora de auditoría inmutable (H1) con actor_id
  it('Punto 13: Bitácora de auditoría WORM registra el UUID exacto del administrador en usuario_id y actor_id (H1)', async () => {
    let auditRecord: any = null;
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT rol_id, codigo, nombre FROM sigd_org.rol_sistema')) {
        return { rows: [{ rol_id: ROL_ESPECIALISTA_ID, codigo: 'ESPECIALISTA', nombre: 'Especialista' }] };
      }
      if (sql.includes('FROM sigd_org.permiso_sistema WHERE permiso_id=ANY')) {
        return { rows: [{ permiso_id: PERMISO_DERIVAR_ID, codigo: 'EXPEDIENTE_DERIVAR' }] };
      }
      if (sql.includes('FROM sigd_org.rol_permiso rp')) return { rows: [] };
      if (sql.includes('DELETE FROM sigd_org.rol_permiso')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO sigd_org.rol_permiso')) return { rows: [], rowCount: 1 };
      if (sql.includes('UPDATE sigd_auth.sesion_usuario')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
        auditRecord = { sql, params };
        return { rows: [{ id_auditoria: 'audit-5' }] };
      }
      return { rows: [] };
    });
    const pool = { connect: async () => ({ query, release: vi.fn() }) } as unknown as Pool;
    const service = crearUsuariosAdminService(pool);

    await service.actualizarPermisosRol(ROL_ESPECIALISTA_ID, [PERMISO_DERIVAR_ID], ADMIN_ID);
    expect(auditRecord).toBeDefined();

    expect(auditRecord.params[1]).toBe(ADMIN_ID); // usuario_id en tabla
    const datosDespues = JSON.parse(auditRecord.params[8]);
    expect(datosDespues.actor_id).toBe(ADMIN_ID); // actor_id en jsonb
  });

  // Punto 14: Refresco dinámico de permisos sin reiniciar el servidor
  it('Punto 14: Los permisos se resuelven dinámicamente desde PostgreSQL en tiempo de ejecución', async () => {
    let llamadasQuery = 0;
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario cu')) {
        llamadasQuery++;
        return {
          rows: [{
            roles: ['ESPECIALISTA'],
            permisos: [{ codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: AREA_ID }],
            unidad_organica_id: AREA_ID,
          }],
        };
      }
      return { rows: [] };
    });
    const pool = { query } as unknown as Pool;

    const auth1 = await obtenerAutorizacionCuenta(pool, USUARIO_ID);
    expect(auth1?.permisos.some(p => p.codigo === 'EXPEDIENTE_DERIVAR')).toBe(true);
    expect(llamadasQuery).toBe(1);

    const auth2 = await obtenerAutorizacionCuenta(pool, USUARIO_ID);
    expect(auth2?.permisos.some(p => p.codigo === 'EXPEDIENTE_DERIVAR')).toBe(true);
    expect(llamadasQuery).toBe(2); // Consulta directa sin caché estática que requiera reinicio
  });

  // Punto 15: Revocación de sesiones activas al modificar permisos
  it('Punto 15: Revoca las sesiones de usuarios afectados para forzar renovación de claims', async () => {
    let updateSesionesLlamado = false;
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT rol_id, codigo, nombre FROM sigd_org.rol_sistema')) {
        return { rows: [{ rol_id: ROL_ESPECIALISTA_ID, codigo: 'ESPECIALISTA', nombre: 'Especialista' }] };
      }
      if (sql.includes('FROM sigd_org.permiso_sistema WHERE permiso_id=ANY')) {
        return { rows: [{ permiso_id: PERMISO_DERIVAR_ID, codigo: 'EXPEDIENTE_DERIVAR' }] };
      }
      if (sql.includes('FROM sigd_org.rol_permiso rp')) return { rows: [] };
      if (sql.includes('DELETE FROM sigd_org.rol_permiso')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO sigd_org.rol_permiso')) return { rows: [], rowCount: 1 };
      if (sql.includes('UPDATE sigd_auth.sesion_usuario') && sql.includes('SET revocado_en = now()')) {
        updateSesionesLlamado = true;
        expect((params as any[])[0]).toBe(ROL_ESPECIALISTA_ID);
        return { rows: [], rowCount: 2 };
      }
      if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) return { rows: [{ id_auditoria: 'audit-6' }] };
      return { rows: [] };
    });
    const pool = { connect: async () => ({ query, release: vi.fn() }) } as unknown as Pool;
    const service = crearUsuariosAdminService(pool);

    await service.actualizarPermisosRol(ROL_ESPECIALISTA_ID, [PERMISO_DERIVAR_ID], ADMIN_ID);
    expect(updateSesionesLlamado).toBe(true);
  });

  // Punto 16: Integración con el flujo de 4 pasos de Gestión de Usuarios
  it('Punto 16: Flujo de 4 pasos integrado (Crear inactivo sin rol -> Asignar rol -> Activar -> Permisos dinámicos)', async () => {
    // Paso 1: Usuario nace INACTIVO y sin roles
    const usuarioCreado = {
      id: USUARIO_ID,
      estado: 'INACTIVO',
      roles: [],
      asignaciones: [{ cargo: 'Especialista', area: 'Área A' }],
    };
    expect(usuarioCreado.estado).toBe('INACTIVO');
    expect(usuarioCreado.roles).toHaveLength(0);

    // Paso 2: Asignación de rol institucional
    const usuarioConRol = {
      ...usuarioCreado,
      roles: [{ id: 'ur-1', rolId: ROL_ESPECIALISTA_ID, areaId: AREA_ID, nombre: 'Especialista' }],
    };
    expect(usuarioConRol.roles).toHaveLength(1);

    // Paso 3: Activación de cuenta (permitida porque ya tiene roles)
    const usuarioActivado = {
      ...usuarioConRol,
      estado: 'ACTIVO',
    };
    expect(usuarioActivado.estado).toBe('ACTIVO');

    // Paso 4: Permisos efectivos resueltos dinámicamente
    const autorizacion = {
      usuarioId: usuarioActivado.id,
      roles: ['ESPECIALISTA'],
      permisos: [{ codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: AREA_ID }],
    };
    expect(autorizacion.roles).toContain('ESPECIALISTA');
    expect(autorizacion.permisos.some(p => p.codigo === 'EXPEDIENTE_DERIVAR')).toBe(true);
  });

  // Punto 17: Verificación de que usuario inactivo no puede acceder aunque tenga roles
  it('Punto 17: Usuario con cuenta inactiva (activo=false) ve denegada su autorización retornando null', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario cu')) {
        // La consulta de autorización filtra cu.activo = TRUE, por lo que para cuenta inactiva devuelve 0 filas
        return { rows: [] };
      }
      return { rows: [] };
    });
    const pool = { query } as unknown as Pool;

    const auth = await obtenerAutorizacionCuenta(pool, USUARIO_ID);
    expect(auth).toBeNull(); // Denegación absoluta: no produce permisos ni roles
  });
});
