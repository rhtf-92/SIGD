import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { crearUsuariosAdminService } from '../../../../src/domains/organicore/usuariosAdmin.service.js';
import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const USUARIO_ID = '11111111-1111-4111-8111-111111111111';
const PERSONA_ID = '22222222-2222-4222-8222-222222222222';
const AREA_ID = '33333333-3333-4333-8333-333333333333';
const CARGO_ID = '44444444-4444-4444-8444-444444444444';
const ROL_ESPECIALISTA_ID = '55555555-5555-4555-8555-555555555555';
const ROL_ADMIN_ID = '66666666-6666-4666-8666-666666666666';
const ROL_CIUDADANO_ID = '77777777-7777-4777-8777-777777777777';
const USUARIO_ROL_ID = '88888888-8888-4888-8888-888888888888';

describe('SIGD — Ciclo de Vida del Usuario y Asignación de Roles (15 Escenarios)', () => {

  // Escenario 1, 2, 3, 4: crearUsuario
  it('Escenarios 1-4: crearUsuario crea persona natural, cuenta inactiva (activo=false), asignación laboral y CERO roles en usuario_rol', async () => {
    vi.spyOn(Argon2Service, 'hash').mockResolvedValueOnce('$argon2id$hashed');
    const inserts: Record<string, unknown[]> = {};

    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.startsWith('SELECT codigo FROM sigd_auth.tipos_documento')) return { rows: [{ codigo: 'DNI' }], rowCount: 1 };
      if (sql.startsWith('SELECT cargo_id')) return { rows: [{ cargo_id: CARGO_ID }], rowCount: 1 };
      if (sql.startsWith('SELECT area_id')) return { rows: [{ area_id: AREA_ID }], rowCount: 1 };
      if (sql.startsWith('INSERT INTO sigd_auth.persona(')) {
        inserts['persona'] = params ?? [];
        return { rows: [{ id_persona: PERSONA_ID }], rowCount: 1 };
      }
      if (sql.startsWith('INSERT INTO sigd_auth.cuenta_usuario')) {
        inserts['cuenta_usuario'] = params ?? [];
        return { rows: [{ id_usuario: USUARIO_ID }], rowCount: 1 };
      }
      if (sql.startsWith('INSERT INTO sigd_org.asignacion_personal')) {
        inserts['asignacion_personal'] = params ?? [];
        return { rows: [{ id_asignacion: 'asig-1' }], rowCount: 1 };
      }
      if (sql.startsWith('INSERT INTO sigd_org.usuario_rol')) {
        inserts['usuario_rol'] = params ?? [];
        return { rows: [{ id_usuario_rol: 'ur-1' }], rowCount: 1 };
      }
      if (sql.startsWith('SELECT cu.id_usuario::text')) {
        return {
          rows: [{
            id: USUARIO_ID, username: 'juan.perez', nombre: 'Juan Pérez',
            area: 'Informática', cargo: 'Especialista', rol: '', estado: 'INACTIVO',
            roles: [], asignaciones: [{ id: 'asig-1', cargoId: CARGO_ID, areaId: AREA_ID }]
          }],
          rowCount: 1,
        };
      }
      if (sql.startsWith('INSERT INTO sigd_audit.bitacora_auditoria')) return { rows: [{ id_auditoria: 'audit-1' }], rowCount: 1 };
      return { rows: [] };
    });

    const release = vi.fn();
    const service = crearUsuariosAdminService({ connect: async () => ({ query, release }) } as unknown as Pool);

    const resultado = await service.crearUsuario({
      tipoDocumentoId: 1,
      username: 'juan.perez',
      estado: 'INACTIVO',
      numeroDocumento: '12345678',
      nombres: 'Juan',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: 'Gómez',
      correo: 'juan.perez@iestpsuiza.edu.pe',
      cargoId: CARGO_ID,
      areaId: AREA_ID,
      passwordInicial: 'ClaveSegura2026',
    });

    // Escenario 1: Persona natural con DNI
    expect(inserts['persona']).toBeDefined();
    expect(inserts['persona'][0]).toBe('12345678');

    // Escenario 2: Cuenta creada con activo = false (estado INACTIVO)
    expect(inserts['cuenta_usuario']).toBeDefined();
    expect(resultado.estado).toBe('INACTIVO');

    // Escenario 3: Asignación personal registrada con cargo y área
    expect(inserts['asignacion_personal']).toBeDefined();
    expect(inserts['asignacion_personal'][1]).toBe(CARGO_ID);
    expect(inserts['asignacion_personal'][2]).toBe(AREA_ID);

    // Escenario 4: CERO inserciones en usuario_rol
    expect(inserts['usuario_rol']).toBeUndefined();
    expect(resultado.roles).toEqual([]);
  });

  // Escenario 7: actualizarUsuario no permite activar cuenta sin roles
  it('Escenario 7: actualizarUsuario rechaza activar cuenta (activo=true) si no tiene roles asignados con 422 ACTIVACION_SIN_ROLES', async () => {
    const query = vi.fn(async (sql: string) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM sigd_auth.cuenta_usuario WHERE id_usuario=$1::uuid FOR UPDATE')) {
        return { rows: [{ id_persona: PERSONA_ID, activo: false }], rowCount: 1 };
      }
      if (sql.includes('SELECT COUNT(*)::int AS total FROM sigd_org.usuario_rol ur')) {
        // Cero roles
        return { rows: [{ total: 0 }], rowCount: 1 };
      }
      return { rows: [] };
    });

    const release = vi.fn();
    const service = crearUsuariosAdminService({ connect: async () => ({ query, release }) } as unknown as Pool);

    await expect(service.actualizarUsuario(USUARIO_ID, {
      estado: 'ACTIVO',
    })).rejects.toMatchObject({
      status: 422,
      code: 'ACTIVACION_SIN_ROLES',
    });
  });

  // Escenario 8: asignarRol departamental vincula area_id del trabajador (H2)
  it('Escenario 8: asignarRol departamental vincula automáticamente el area_id del trabajador en usuario_rol', async () => {
    let insertURParams: unknown[] = [];
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.startsWith('SELECT id_usuario, activo FROM sigd_auth.cuenta_usuario')) {
        return { rows: [{ id_usuario: USUARIO_ID, activo: false }], rowCount: 1 };
      }
      if (sql.includes('FROM sigd_org.rol_sistema')) {
        return { rows: [{ rol_id: ROL_ESPECIALISTA_ID, codigo: 'ESPECIALISTA' }], rowCount: 1 };
      }
      if (sql.includes('FROM sigd_org.usuario_rol WHERE id_usuario=')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('asignacion_personal')) {
        return { rows: [{ area_id: AREA_ID }], rowCount: 1 };
      }
      if (sql.startsWith('INSERT INTO sigd_org.usuario_rol')) {
        insertURParams = params ?? [];
        return { rows: [{ id_usuario_rol: USUARIO_ROL_ID }], rowCount: 1 };
      }
      if (sql.startsWith('UPDATE sigd_auth.sesion_usuario')) return { rows: [], rowCount: 0 };
      if (sql.startsWith('SELECT cu.id_usuario::text')) {
        return {
          rows: [{
            id: USUARIO_ID, username: 'juan.perez', nombre: 'Juan Pérez',
            area: 'Informática', cargo: 'Especialista', rol: 'Especialista', estado: 'INACTIVO',
            roles: [{ id: USUARIO_ROL_ID, rolId: ROL_ESPECIALISTA_ID, areaId: AREA_ID }],
            asignaciones: [{ id: 'asig-1', cargoId: CARGO_ID, areaId: AREA_ID }]
          }],
          rowCount: 1,
        };
      }
      if (sql.startsWith('INSERT INTO sigd_audit.bitacora_auditoria')) return { rows: [{ id_auditoria: 'audit-1' }], rowCount: 1 };
      return { rows: [] };
    });

    const release = vi.fn();
    const service = crearUsuariosAdminService({ connect: async () => ({ query, release }) } as unknown as Pool);

    const resultado = await service.asignarRol(USUARIO_ID, ROL_ESPECIALISTA_ID, ADMIN_ID);
    expect(resultado).toBeDefined();
    expect(insertURParams).toEqual([USUARIO_ID, ROL_ESPECIALISTA_ID, AREA_ID]);
  });

  // Escenario 9: asignarRol global ADMINISTRADOR deja area_id = null (H2)
  it('Escenario 9: asignarRol global ADMINISTRADOR mantiene area_id = NULL para alcance institucional', async () => {
    let insertURParams: unknown[] = [];
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
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
        return {
          rows: [{
            id: USUARIO_ID, username: 'admin', nombre: 'Admin',
            area: 'Informática', cargo: 'Especialista', rol: 'ADMINISTRADOR', estado: 'INACTIVO',
            roles: [{ id: USUARIO_ROL_ID, rolId: ROL_ADMIN_ID, areaId: null }],
            asignaciones: []
          }],
          rowCount: 1,
        };
      }
      if (sql.startsWith('INSERT INTO sigd_audit.bitacora_auditoria')) return { rows: [{ id_auditoria: 'audit-1' }], rowCount: 1 };
      return { rows: [] };
    });

    const release = vi.fn();
    const service = crearUsuariosAdminService({ connect: async () => ({ query, release }) } as unknown as Pool);

    await service.asignarRol(USUARIO_ID, ROL_ADMIN_ID, ADMIN_ID);
    expect(insertURParams).toEqual([USUARIO_ID, ROL_ADMIN_ID, null]);
  });

  // Escenario 10: asignarRol rechaza roles externos CIUDADANO y ESTUDIANTE
  it('Escenario 10: asignarRol rechaza asignar roles externos (CIUDADANO, ESTUDIANTE) a personal institucional', async () => {
    const query = vi.fn(async (sql: string) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.startsWith('SELECT id_usuario, activo FROM sigd_auth.cuenta_usuario')) {
        return { rows: [{ id_usuario: USUARIO_ID, activo: false }], rowCount: 1 };
      }
      if (sql.includes('FROM sigd_org.rol_sistema')) {
        return { rows: [{ rol_id: ROL_CIUDADANO_ID, codigo: 'CIUDADANO' }], rowCount: 1 };
      }
      return { rows: [] };
    });

    const release = vi.fn();
    const service = crearUsuariosAdminService({ connect: async () => ({ query, release }) } as unknown as Pool);

    await expect(service.asignarRol(USUARIO_ID, ROL_CIUDADANO_ID, ADMIN_ID)).rejects.toMatchObject({
      status: 422,
      code: 'CAMPO_NO_DISPONIBLE',
    });
  });

  // Escenario 11: asignarRol impide duplicidad de asignación activa
  it('Escenario 11: asignarRol rechaza duplicidad si el rol ya está activo y vigente para la cuenta', async () => {
    const query = vi.fn(async (sql: string) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.startsWith('SELECT id_usuario, activo FROM sigd_auth.cuenta_usuario')) {
        return { rows: [{ id_usuario: USUARIO_ID, activo: false }], rowCount: 1 };
      }
      if (sql.includes('FROM sigd_org.rol_sistema')) {
        return { rows: [{ rol_id: ROL_ESPECIALISTA_ID, codigo: 'ESPECIALISTA' }], rowCount: 1 };
      }
      if (sql.includes('FROM sigd_org.usuario_rol WHERE id_usuario=')) {
        return { rows: [{ id_usuario_rol: USUARIO_ROL_ID }], rowCount: 1 }; // ya asignado!
      }
      return { rows: [] };
    });

    const release = vi.fn();
    const service = crearUsuariosAdminService({ connect: async () => ({ query, release }) } as unknown as Pool);

    await expect(service.asignarRol(USUARIO_ID, ROL_ESPECIALISTA_ID, ADMIN_ID)).rejects.toMatchObject({
      status: 409,
      code: 'ROL_YA_ASIGNADO',
    });
  });

  // Escenario 12: asignarRol revoca sesiones y registra auditoría con actor_id (H1)
  it('Escenario 12: asignarRol revoca sesiones activas y registra bitácora de auditoría con actor_id', async () => {
    let sesionRevocada = false;
    let auditActorId: string | null = null;

    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
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
        return { rows: [{ id_usuario_rol: USUARIO_ROL_ID }], rowCount: 1 };
      }
      if (sql.startsWith('UPDATE sigd_auth.sesion_usuario')) {
        sesionRevocada = true;
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('INSERT INTO sigd_audit.bitacora_auditoria')) {
        auditActorId = params?.[1] as string;
        return { rows: [{ id_auditoria: 'audit-1' }], rowCount: 1 };
      }
      if (sql.startsWith('SELECT cu.id_usuario::text')) {
        return {
          rows: [{
            id: USUARIO_ID, username: 'admin', nombre: 'Admin',
            area: 'Informática', cargo: 'Especialista', rol: 'ADMINISTRADOR', estado: 'INACTIVO',
            roles: [{ id: USUARIO_ROL_ID, rolId: ROL_ADMIN_ID, areaId: null }],
            asignaciones: []
          }],
          rowCount: 1,
        };
      }
      return { rows: [] };
    });

    const release = vi.fn();
    const service = crearUsuariosAdminService({ connect: async () => ({ query, release }) } as unknown as Pool);

    await service.asignarRol(USUARIO_ID, ROL_ADMIN_ID, ADMIN_ID);
    expect(sesionRevocada).toBe(true);
    expect(auditActorId).toBe(ADMIN_ID);
  });

  // Escenario 13: actualizarUsuario habilitación exitosa con rol asignado
  it('Escenario 13: actualizarUsuario permite activar cuenta (activo=true) cuando el usuario tiene roles vigentes', async () => {
    let updateCuentaParams: unknown[] = [];
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM sigd_auth.cuenta_usuario WHERE id_usuario=$1::uuid FOR UPDATE')) {
        return { rows: [{ id_persona: PERSONA_ID, activo: false }], rowCount: 1 };
      }
      if (sql.includes('SELECT COUNT(*)::int AS total FROM sigd_org.usuario_rol ur')) {
        return { rows: [{ total: 1 }], rowCount: 1 };
      }
      if (sql.startsWith('UPDATE sigd_auth.cuenta_usuario')) {
        updateCuentaParams = params ?? [];
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('SELECT cu.id_usuario::text')) {
        return {
          rows: [{
            id: USUARIO_ID, username: 'juan.perez', nombre: 'Juan Pérez',
            area: 'Informática', cargo: 'Especialista', rol: 'Especialista', estado: 'ACTIVO',
            roles: [{ id: USUARIO_ROL_ID, rolId: ROL_ESPECIALISTA_ID, areaId: AREA_ID }],
            asignaciones: []
          }],
          rowCount: 1,
        };
      }
      if (sql.startsWith('INSERT INTO sigd_audit.bitacora_auditoria')) return { rows: [{ id_auditoria: 'audit-1' }], rowCount: 1 };
      return { rows: [] };
    });

    const release = vi.fn();
    const service = crearUsuariosAdminService({ connect: async () => ({ query, release }) } as unknown as Pool);

    const res = await service.actualizarUsuario(USUARIO_ID, { estado: 'ACTIVO' });
    expect(res.estado).toBe('ACTIVO');
    expect(updateCuentaParams[1]).toBe(true); // activo = true
  });

  // Escenario 14: revocarRol en cuenta ACTIVA que dejaría al usuario con 0 roles rechaza con 422
  it('Escenario 14: revocarRol en cuenta ACTIVA rechaza dejar a la cuenta con 0 roles con 422 CUENTA_ACTIVA_SIN_ROLES', async () => {
    const query = vi.fn(async (sql: string) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.startsWith('SELECT id_usuario, activo FROM sigd_auth.cuenta_usuario')) {
        return { rows: [{ id_usuario: USUARIO_ID, activo: true }], rowCount: 1 }; // CUENTA ACTIVA
      }
      if (sql.includes('SELECT id_usuario_rol, rol_id, area_id FROM sigd_org.usuario_rol')) {
        return { rows: [{ id_usuario_rol: USUARIO_ROL_ID, rol_id: ROL_ESPECIALISTA_ID, area_id: AREA_ID }], rowCount: 1 };
      }
      if (sql.includes('SELECT COUNT(*)::int AS total FROM sigd_org.usuario_rol ur')) {
        return { rows: [{ total: 0 }], rowCount: 1 }; // 0 otros roles
      }
      return { rows: [] };
    });

    const release = vi.fn();
    const service = crearUsuariosAdminService({ connect: async () => ({ query, release }) } as unknown as Pool);

    await expect(service.revocarRol(USUARIO_ID, USUARIO_ROL_ID, ADMIN_ID)).rejects.toMatchObject({
      status: 422,
      code: 'CUENTA_ACTIVA_SIN_ROLES',
    });
  });

  // Escenario 15: revocarRol en cuenta INACTIVA concluye la vigencia, revoca sesiones y registra auditoría
  it('Escenario 15: revocarRol en cuenta INACTIVA concluye vigencia (vigente_hasta=now()), revoca sesiones y audita', async () => {
    let updateUR = false;
    let sesionRevocada = false;
    let auditRegistrada = false;

    const query = vi.fn(async (sql: string) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.startsWith('SELECT id_usuario, activo FROM sigd_auth.cuenta_usuario')) {
        return { rows: [{ id_usuario: USUARIO_ID, activo: false }], rowCount: 1 }; // INACTIVA
      }
      if (sql.includes('SELECT id_usuario_rol, rol_id, area_id FROM sigd_org.usuario_rol')) {
        return { rows: [{ id_usuario_rol: USUARIO_ROL_ID, rol_id: ROL_ESPECIALISTA_ID, area_id: AREA_ID }], rowCount: 1 };
      }
      if (sql.startsWith('UPDATE sigd_org.usuario_rol SET vigente_hasta=now()')) {
        updateUR = true;
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('UPDATE sigd_auth.sesion_usuario')) {
        sesionRevocada = true;
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('INSERT INTO sigd_audit.bitacora_auditoria')) {
        auditRegistrada = true;
        return { rows: [{ id_auditoria: 'audit-1' }], rowCount: 1 };
      }
      if (sql.startsWith('SELECT cu.id_usuario::text')) {
        return {
          rows: [{
            id: USUARIO_ID, username: 'juan.perez', nombre: 'Juan Pérez',
            area: 'Informática', cargo: 'Especialista', rol: '', estado: 'INACTIVO',
            roles: [],
            asignaciones: []
          }],
          rowCount: 1,
        };
      }
      return { rows: [] };
    });

    const release = vi.fn();
    const service = crearUsuariosAdminService({ connect: async () => ({ query, release }) } as unknown as Pool);

    const res = await service.revocarRol(USUARIO_ID, USUARIO_ROL_ID, ADMIN_ID);
    expect(res).toBeDefined();
    expect(updateUR).toBe(true);
    expect(sesionRevocada).toBe(true);
    expect(auditRegistrada).toBe(true);
    expect(res.roles).toHaveLength(0);
  });
});
