import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';

import {
  actualizarUsuarioAdminSchema,
  listarUsuariosQuerySchema,
  usuarioIdParamSchema,
} from '../../../../src/domains/organicore/dto/usuarioAdmin.dto.js';
import {
  crearUsuariosAdminService,
  type UsuarioDirectorio,
} from '../../../../src/domains/organicore/usuariosAdmin.service.js';

const USUARIO_ID = '11111111-1111-4111-8111-111111111111';
const PERSONA_ID = '22222222-2222-4222-8222-222222222222';
const AREA_ID = '33333333-3333-4333-8333-333333333333';
const CARGO_ID = '44444444-4444-4444-8444-444444444444';
const ROL_ID = '55555555-5555-4555-8555-555555555555';

const usuario: UsuarioDirectorio = {
  id: USUARIO_ID,
  idPersona: PERSONA_ID,
  nombre: 'Leonardo Rodríguez',
  documento: '74851201',
  correo: 'leonardo@iestpsuiza.edu.pe',
  area: { id: AREA_ID, nombre: 'Administración' },
  cargo: { id: CARGO_ID, nombre: 'Administrador' },
  rol: { id: ROL_ID, nombre: 'Administrador' },
  roles: [{ id: ROL_ID, nombre: 'Administrador' }],
  estado: 'ACTIVO',
  ultimoAcceso: null,
};

describe('DTO canónico de usuarios administrativos', () => {
  it('acepta UUID y elimina filtros sin respaldo en migraciones', () => {
    const filtros = listarUsuariosQuerySchema.parse({
      areaId: AREA_ID,
      rolId: ROL_ID,
      estado: 'ACTIVO',
    });

    expect(filtros).toMatchObject({ areaId: AREA_ID, rolId: ROL_ID, estado: 'ACTIVO' });
    expect(() => listarUsuariosQuerySchema.parse({ sedeId: AREA_ID })).toThrow();
    expect(listarUsuariosQuerySchema.parse({ estado: 'BLOQUEADO' }).estado).toBe('BLOQUEADO');
  });

  it('valida :id como UUID', () => {
    expect(usuarioIdParamSchema.parse({ id: USUARIO_ID }).id).toBe(USUARIO_ID);
    expect(() => usuarioIdParamSchema.parse({ id: '15' })).toThrow();
  });

  it('acepta actualización por área, cargo, rol, correo y estado', () => {
    expect(
      actualizarUsuarioAdminSchema.parse({
        areaId: AREA_ID,
        cargoId: CARGO_ID,
        rolesAgregar: [ROL_ID],
        correo: 'nuevo@iestpsuiza.edu.pe',
        estado: 'INACTIVO',
      }),
    ).toMatchObject({ areaId: AREA_ID, cargoId: CARGO_ID, rolesAgregar: [ROL_ID] });
  });
});

describe('UsuariosAdminService · lectura canónica', () => {
  const query = vi.fn();
  const pool = { query } as unknown as Pool;

  beforeEach(() => vi.clearAllMocks());

  it('usa columnas UUID reales y conserva usuarios sin asignación vigente', async () => {
    query
      .mockResolvedValueOnce({ rows: [usuario], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 1 }], rowCount: 1 });

    const resultado = await crearUsuariosAdminService(pool).listarUsuarios({ pagina: 1, limite: 20 });
    const sql = String(query.mock.calls[0][0]);

    expect(sql).toContain('cu.id_usuario AS id');
    expect(sql).toContain('cu.id_persona');
    expect(sql).toContain('asignacion.id_usuario = cu.id_usuario');
    expect(sql).toContain('relacion.id_usuario = cu.id_usuario');
    expect(sql).toContain('FROM sigd_org.asignacion_personal');
    expect(sql).not.toContain('puesto_laboral');
    expect(sql).not.toContain('sigd_org.sede');
    expect(resultado.datos).toEqual([usuario]);
  });

  it('aplica filtros por área, rol y estado con parámetros independientes', async () => {
    query
      .mockResolvedValueOnce({ rows: [usuario], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 1 }], rowCount: 1 });

    await crearUsuariosAdminService(pool).listarUsuarios({
      areaId: AREA_ID,
      rolId: ROL_ID,
      estado: 'ACTIVO',
      pagina: 2,
      limite: 10,
    });

    const [sql, parametros] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ap.area_id = $1');
    expect(sql).toContain('filtro_rol.rol_id = $2');
    expect(sql).toContain('cu.activo = TRUE');
    expect(parametros).toEqual([AREA_ID, ROL_ID, 10, 10]);
  });

  it('devuelve paginación estable', async () => {
    query
      .mockResolvedValueOnce({ rows: [usuario], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 21 }], rowCount: 1 });

    const resultado = await crearUsuariosAdminService(pool).listarUsuarios({ pagina: 2, limite: 10 });
    expect(resultado.paginacion).toEqual({ pagina: 2, limite: 10, total: 21, totalPaginas: 3 });
  });
});

describe('UsuariosAdminService · actualización transaccional', () => {
  function crearPoolTransaccional(options: { fallarEn?: string } = {}) {
    const consultas: Array<{ sql: string; values?: unknown[] }> = [];
    const client = {
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        consultas.push({ sql, values });
        if (options.fallarEn && sql.includes(options.fallarEn)) throw new Error('fallo controlado');
        if (sql.includes('SELECT cu.id_usuario')) {
          return { rows: [{ id_usuario: USUARIO_ID, id_persona: PERSONA_ID }], rowCount: 1 };
        }
        if (sql.includes('SELECT id_usuario, id_persona')) {
          return { rows: [{ id_usuario: USUARIO_ID, id_persona: PERSONA_ID }], rowCount: 1 };
        }
        if (sql.includes('SELECT rol_id FROM sigd_org.rol_sistema')) {
          return { rows: [{ rol_id: ROL_ID }], rowCount: 1 };
        }
        if (sql.includes('COUNT(*)::int AS total FROM sigd_org.usuario_rol')) {
          return { rows: [{ total: 2 }], rowCount: 1 };
        }
        if (sql.includes('SELECT area_id, cargo_id')) {
          return { rows: [{ area_id: AREA_ID, cargo_id: CARGO_ID }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    } as unknown as PoolClient;
    const pool = {
      connect: vi.fn(async () => client),
      query: vi.fn(async () => ({ rows: [usuario], rowCount: 1 })),
    } as unknown as Pool;
    return { pool, consultas };
  }

  it('actualiza cuenta, persona, asignación y rol en una sola transacción', async () => {
    const { pool, consultas } = crearPoolTransaccional();

    await crearUsuariosAdminService(pool).actualizarUsuario(USUARIO_ID, {
      nombres: 'Leonardo',
      apellidos: 'Rodríguez',
      correo: 'nuevo@iestpsuiza.edu.pe',
      areaId: AREA_ID,
      cargoId: CARGO_ID,
      rolesAgregar: [ROL_ID],
      estado: 'BLOQUEADO',
    });

    const sql = consultas.map((consulta) => consulta.sql).join('\n');
    expect(consultas[0].sql).toBe('BEGIN');
    expect(sql).toContain('UPDATE sigd_auth.cuenta_usuario');
    expect(sql).toContain('UPDATE sigd_auth.persona_natural');
    expect(sql).toContain('UPDATE sigd_org.asignacion_personal');
    expect(sql).toContain('INSERT INTO sigd_org.asignacion_personal');
    expect(sql).toContain('INSERT INTO sigd_org.usuario_rol');
    expect(sql).not.toMatch(/UPDATE sigd_org\.usuario_rol\s+SET vigente_hasta = now\(\)\s+WHERE id_usuario = \$1\s+AND \(vigente_hasta/);
    expect(sql).toContain('UPDATE sigd_auth.sesion_usuario');
    expect(consultas.at(-1)?.sql).toBe('COMMIT');
  });

  it('revierte toda la operación si una escritura falla', async () => {
    const { pool, consultas } = crearPoolTransaccional({ fallarEn: 'INSERT INTO sigd_org.usuario_rol' });

    await expect(
      crearUsuariosAdminService(pool).actualizarUsuario(USUARIO_ID, {
        areaId: AREA_ID,
        cargoId: CARGO_ID,
        rolesAgregar: [ROL_ID],
      }),
    ).rejects.toThrow('fallo controlado');

    expect(consultas.at(-1)?.sql).toBe('ROLLBACK');
  });
});
