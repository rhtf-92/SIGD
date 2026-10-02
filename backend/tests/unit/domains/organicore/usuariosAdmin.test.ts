import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

import {
  correoInstitucionalSchema,
  listarUsuariosQuerySchema,
  crearUsuarioAdminSchema,
  actualizarUsuarioAdminSchema,
  usuarioIdParamSchema,
} from '../../../../src/domains/organicore/dto/usuarioAdmin.dto.js';

import {
  crearUsuariosAdminService,
  type UsuarioDirectorio,
} from '../../../../src/domains/organicore/usuariosAdmin.service.js';

/* =========================================================
 * DATOS DE PRUEBA
 * ========================================================= */

const PUESTO_ID = '11111111-1111-4111-8111-111111111111';
const AREA_ID = '22222222-2222-4222-8222-222222222222';
const SEDE_ID = '33333333-3333-4333-8333-333333333333';
const ROL_ID = '44444444-4444-4444-8444-444444444444';

const usuarioMock: UsuarioDirectorio = {
  id: 1,
  nombre: 'Leonardo Rodriguez Rodriguez',
  dni: '74851201',
  correo: 'leonardo@iestpsuiza.edu.pe',
  sede: 'Sede Principal',
  area: 'Administración',
  cargo: 'Administrador',
  rol: 'Administrador',
  estado: 'ACTIVO',
  ultimoAcceso: null,
};

/* =========================================================
 * DTO - CORREO INSTITUCIONAL
 * ========================================================= */

describe('correoInstitucionalSchema', () => {
  it('acepta correos del dominio institucional', () => {
    const resultado = correoInstitucionalSchema.parse(
      'leonardo@iestpsuiza.edu.pe',
    );

    expect(resultado).toBe(
      'leonardo@iestpsuiza.edu.pe',
    );
  });

  it('acepta el dominio institucional sin importar mayúsculas', () => {
    expect(() =>
      correoInstitucionalSchema.parse(
        'LEONARDO@IESTPSUIZA.EDU.PE',
      ),
    ).not.toThrow();
  });

  it('elimina espacios al inicio y al final', () => {
    const resultado = correoInstitucionalSchema.parse(
      '  leonardo@iestpsuiza.edu.pe  ',
    );

    expect(resultado).toBe(
      'leonardo@iestpsuiza.edu.pe',
    );
  });

  it('rechaza cuentas Gmail', () => {
    expect(() =>
      correoInstitucionalSchema.parse(
        'leonardo@gmail.com',
      ),
    ).toThrow();
  });

  it('rechaza cuentas Hotmail', () => {
    expect(() =>
      correoInstitucionalSchema.parse(
        'leonardo@hotmail.com',
      ),
    ).toThrow();
  });

  it('rechaza correos sin formato válido', () => {
    expect(() =>
      correoInstitucionalSchema.parse(
        'correo-invalido',
      ),
    ).toThrow();
  });

  it('rechaza subdominios del dominio institucional', () => {
    expect(() =>
      correoInstitucionalSchema.parse(
        'leonardo@sub.iestpsuiza.edu.pe',
      ),
    ).toThrow();
  });
});

/* =========================================================
 * DTO - LISTADO DE USUARIOS
 * ========================================================= */

describe('listarUsuariosQuerySchema', () => {
  it('aplica paginación por defecto', () => {
    const resultado =
      listarUsuariosQuerySchema.parse({});

    expect(resultado.pagina).toBe(1);
    expect(resultado.limite).toBe(20);
  });

  it('convierte pagina y limite desde string a number', () => {
    const resultado =
      listarUsuariosQuerySchema.parse({
        pagina: '2',
        limite: '10',
      });

    expect(resultado.pagina).toBe(2);
    expect(resultado.limite).toBe(10);
  });

  it('acepta filtros UUID válidos', () => {
    const resultado =
      listarUsuariosQuerySchema.parse({
        areaId: AREA_ID,
        sedeId: SEDE_ID,
        rolId: ROL_ID,
        estado: 'ACTIVO',
      });

    expect(resultado.areaId).toBe(AREA_ID);
    expect(resultado.sedeId).toBe(SEDE_ID);
    expect(resultado.rolId).toBe(ROL_ID);
    expect(resultado.estado).toBe('ACTIVO');
  });

  it('rechaza pagina menor que 1', () => {
    expect(() =>
      listarUsuariosQuerySchema.parse({
        pagina: 0,
      }),
    ).toThrow();
  });

  it('rechaza limite mayor que 100', () => {
    expect(() =>
      listarUsuariosQuerySchema.parse({
        limite: 101,
      }),
    ).toThrow();
  });

  it('rechaza UUID inválido', () => {
    expect(() =>
      listarUsuariosQuerySchema.parse({
        areaId: 'no-es-un-uuid',
      }),
    ).toThrow();
  });

  it('rechaza estado desconocido', () => {
    expect(() =>
      listarUsuariosQuerySchema.parse({
        estado: 'ELIMINADO',
      }),
    ).toThrow();
  });
});

/* =========================================================
 * DTO - CREACIÓN DE USUARIO
 * ========================================================= */

describe('crearUsuarioAdminSchema', () => {
  const payloadValido = {
    tipoDocumentoId: 1,
    numeroDocumento: '74851201',
    nombres: 'Leonardo',
    apellidoPaterno: 'Rodriguez',
    apellidoMaterno: 'Rodriguez',
    telefono: '999999999',
    correo: 'leonardo@iestpsuiza.edu.pe',
    username: 'leonardo.rodriguez',
    passwordInicial: 'ClaveSegura2026!',
    puestoLaboralId: PUESTO_ID,
    rolId: ROL_ID,
  };

  it('acepta un usuario institucional válido', () => {
    const resultado =
      crearUsuarioAdminSchema.parse(
        payloadValido,
      );

    expect(resultado.numeroDocumento).toBe(
      '74851201',
    );

    expect(resultado.correo).toBe(
      'leonardo@iestpsuiza.edu.pe',
    );
  });

  it('rechaza documento demasiado corto', () => {
    expect(() =>
      crearUsuarioAdminSchema.parse({
        ...payloadValido,
        numeroDocumento: '123',
      }),
    ).toThrow();
  });

  it('rechaza username con caracteres no permitidos', () => {
    expect(() =>
      crearUsuarioAdminSchema.parse({
        ...payloadValido,
        username: 'leonardo@admin',
      }),
    ).toThrow();
  });

  it('rechaza contraseña menor a 8 caracteres', () => {
    expect(() =>
      crearUsuarioAdminSchema.parse({
        ...payloadValido,
        passwordInicial: '123',
      }),
    ).toThrow();
  });

  it('rechaza correo no institucional', () => {
    expect(() =>
      crearUsuarioAdminSchema.parse({
        ...payloadValido,
        correo: 'leonardo@gmail.com',
      }),
    ).toThrow();
  });

  it('rechaza puesto laboral con UUID inválido', () => {
    expect(() =>
      crearUsuarioAdminSchema.parse({
        ...payloadValido,
        puestoLaboralId: 'puesto-invalido',
      }),
    ).toThrow();
  });

  it('rechaza rol con UUID inválido', () => {
    expect(() =>
      crearUsuarioAdminSchema.parse({
        ...payloadValido,
        rolId: 'rol-invalido',
      }),
    ).toThrow();
  });
});

/* =========================================================
 * DTO - ACTUALIZACIÓN
 * ========================================================= */

describe('actualizarUsuarioAdminSchema', () => {
  it('acepta una actualización parcial', () => {
    const resultado =
      actualizarUsuarioAdminSchema.parse({
        nombres: 'Leonardo Andres',
      });

    expect(resultado.nombres).toBe(
      'Leonardo Andres',
    );
  });

  it('acepta actualización de correo institucional', () => {
    const resultado =
      actualizarUsuarioAdminSchema.parse({
        correo: 'nuevo@iestpsuiza.edu.pe',
      });

    expect(resultado.correo).toBe(
      'nuevo@iestpsuiza.edu.pe',
    );
  });

  it('rechaza objeto vacío', () => {
    expect(() =>
      actualizarUsuarioAdminSchema.parse({}),
    ).toThrow();
  });

  it('rechaza nombre demasiado corto', () => {
    expect(() =>
      actualizarUsuarioAdminSchema.parse({
        nombres: 'A',
      }),
    ).toThrow();
  });

  it('rechaza correo externo', () => {
    expect(() =>
      actualizarUsuarioAdminSchema.parse({
        correo: 'usuario@gmail.com',
      }),
    ).toThrow();
  });
});

/* =========================================================
 * DTO - ID DEL USUARIO
 * ========================================================= */

describe('usuarioIdParamSchema', () => {
  it('convierte id string a number', () => {
    const resultado =
      usuarioIdParamSchema.parse({
        id: '15',
      });

    expect(resultado.id).toBe(15);
  });

  it('rechaza id igual a cero', () => {
    expect(() =>
      usuarioIdParamSchema.parse({
        id: '0',
      }),
    ).toThrow();
  });

  it('rechaza id negativo', () => {
    expect(() =>
      usuarioIdParamSchema.parse({
        id: '-5',
      }),
    ).toThrow();
  });

  it('rechaza id no numérico', () => {
    expect(() =>
      usuarioIdParamSchema.parse({
        id: 'abc',
      }),
    ).toThrow();
  });
});

/* =========================================================
 * SERVICE - DIRECTORIO DE USUARIOS
 * ========================================================= */

describe('crearUsuariosAdminService', () => {
  const mockQuery = vi.fn();

  const mockPool = {
    query: mockQuery,
  } as unknown as Pool;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function configurarConsulta(
    usuarios: UsuarioDirectorio[],
    total: number,
  ): void {
    mockQuery.mockImplementation(
      async (sql: string) => {
        if (sql.includes('COUNT(')) {
          return {
            rows: [{ total }],
            rowCount: 1,
          };
        }

        return {
          rows: usuarios,
          rowCount: usuarios.length,
        };
      },
    );
  }

  it('lista usuarios con paginación por defecto', async () => {
    configurarConsulta([usuarioMock], 1);

    const service =
      crearUsuariosAdminService(mockPool);

    const resultado =
      await service.listarUsuarios({
        pagina: 1,
        limite: 20,
      });

    expect(resultado.datos).toEqual([
      usuarioMock,
    ]);

    expect(resultado.paginacion).toEqual({
      pagina: 1,
      limite: 20,
      total: 1,
      totalPaginas: 1,
    });

    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('envía LIMIT y OFFSET correctamente', async () => {
    configurarConsulta([usuarioMock], 1);

    const service =
      crearUsuariosAdminService(mockPool);

    await service.listarUsuarios({
      pagina: 2,
      limite: 10,
    });

    const primeraLlamada =
      mockQuery.mock.calls[0];

    const sql =
      primeraLlamada[0] as string;

    const parametros =
      primeraLlamada[1] as unknown[];

    expect(sql).toContain('LIMIT');
    expect(sql).toContain('OFFSET');

    expect(parametros).toContain(10);
    expect(parametros).toContain(10);
  });

  it('calcula totalPaginas en cero cuando no existen registros', async () => {
    configurarConsulta([], 0);

    const service =
      crearUsuariosAdminService(mockPool);

    const resultado =
      await service.listarUsuarios({
        pagina: 1,
        limite: 20,
      });

    expect(resultado.datos).toEqual([]);

    expect(
      resultado.paginacion.total,
    ).toBe(0);

    expect(
      resultado.paginacion.totalPaginas,
    ).toBe(0);
  });

  it('calcula correctamente varias páginas', async () => {
    configurarConsulta([usuarioMock], 45);

    const service =
      crearUsuariosAdminService(mockPool);

    const resultado =
      await service.listarUsuarios({
        pagina: 1,
        limite: 20,
      });

    expect(
      resultado.paginacion.totalPaginas,
    ).toBe(3);
  });

  it('agrega búsqueda Full-Text Search cuando existe busqueda', async () => {
    configurarConsulta([usuarioMock], 1);

    const service =
      crearUsuariosAdminService(mockPool);

    await service.listarUsuarios({
      busqueda: '  Leonardo  ',
      pagina: 1,
      limite: 20,
    });

    const primeraLlamada =
      mockQuery.mock.calls[0];

    const sql =
      primeraLlamada[0] as string;

    const parametros =
      primeraLlamada[1] as unknown[];

    expect(sql).toContain(
      'to_tsvector',
    );

    expect(sql).toContain(
      'websearch_to_tsquery',
    );

    expect(sql).toContain('ILIKE');

    expect(parametros).toContain(
      'Leonardo',
    );
  });

  it('agrega filtro por área', async () => {
    configurarConsulta([usuarioMock], 1);

    const service =
      crearUsuariosAdminService(mockPool);

    await service.listarUsuarios({
      areaId: AREA_ID,
      pagina: 1,
      limite: 20,
    });

    const sql =
      mockQuery.mock.calls[0][0] as string;

    const parametros =
      mockQuery.mock.calls[0][1] as unknown[];

    expect(sql).toContain(
      'pl.id_area',
    );

    expect(parametros).toContain(
      AREA_ID,
    );
  });

  it('agrega filtro por sede', async () => {
    configurarConsulta([usuarioMock], 1);

    const service =
      crearUsuariosAdminService(mockPool);

    await service.listarUsuarios({
      sedeId: SEDE_ID,
      pagina: 1,
      limite: 20,
    });

    const sql =
      mockQuery.mock.calls[0][0] as string;

    const parametros =
      mockQuery.mock.calls[0][1] as unknown[];

    expect(sql).toContain(
      'pl.sede_id',
    );

    expect(parametros).toContain(
      SEDE_ID,
    );
  });

  it('agrega filtro por rol', async () => {
    configurarConsulta([usuarioMock], 1);

    const service =
      crearUsuariosAdminService(mockPool);

    await service.listarUsuarios({
      rolId: ROL_ID,
      pagina: 1,
      limite: 20,
    });

    const sql =
      mockQuery.mock.calls[0][0] as string;

    const parametros =
      mockQuery.mock.calls[0][1] as unknown[];

    expect(sql).toContain(
      'ur.rol_id',
    );

    expect(parametros).toContain(
      ROL_ID,
    );
  });

  it('construye filtro para usuarios ACTIVOS', async () => {
    configurarConsulta([usuarioMock], 1);

    const service =
      crearUsuariosAdminService(mockPool);

    await service.listarUsuarios({
      estado: 'ACTIVO',
      pagina: 1,
      limite: 20,
    });

    const sql =
      mockQuery.mock.calls[0][0] as string;

    expect(sql).toContain(
      'cu.estado = TRUE',
    );

    expect(sql).toContain(
      'cu.bloqueado_hasta',
    );
  });

  it('construye filtro para usuarios INACTIVOS', async () => {
    configurarConsulta([usuarioMock], 1);

    const service =
      crearUsuariosAdminService(mockPool);

    await service.listarUsuarios({
      estado: 'INACTIVO',
      pagina: 1,
      limite: 20,
    });

    const sql =
      mockQuery.mock.calls[0][0] as string;

    expect(sql).toContain(
      'cu.estado = FALSE',
    );
  });

  it('construye filtro para usuarios BLOQUEADOS', async () => {
    configurarConsulta([usuarioMock], 1);

    const service =
      crearUsuariosAdminService(mockPool);

    await service.listarUsuarios({
      estado: 'BLOQUEADO',
      pagina: 1,
      limite: 20,
    });

    const sql =
      mockQuery.mock.calls[0][0] as string;

    expect(sql).toContain(
      'cu.estado = TRUE',
    );

    expect(sql).toContain(
      'cu.bloqueado_hasta IS NOT NULL',
    );

    expect(sql).toContain(
      'cu.bloqueado_hasta > now()',
    );
  });

  it('permite combinar filtros', async () => {
    configurarConsulta([usuarioMock], 1);

    const service =
      crearUsuariosAdminService(mockPool);

    await service.listarUsuarios({
      busqueda: 'Leonardo',
      areaId: AREA_ID,
      sedeId: SEDE_ID,
      rolId: ROL_ID,
      estado: 'ACTIVO',
      pagina: 1,
      limite: 20,
    });

    const sql =
      mockQuery.mock.calls[0][0] as string;

    expect(sql).toContain(
      'to_tsvector',
    );

    expect(sql).toContain(
      'pl.id_area',
    );

    expect(sql).toContain(
      'pl.sede_id',
    );

    expect(sql).toContain(
      'ur.rol_id',
    );

    expect(sql).toContain(
      'cu.estado = TRUE',
    );
  });

  it('no incluye limite ni offset en los parámetros de conteo', async () => {
    configurarConsulta([usuarioMock], 1);

    const service =
      crearUsuariosAdminService(mockPool);

    await service.listarUsuarios({
      busqueda: 'Leonardo',
      pagina: 2,
      limite: 15,
    });

    expect(
      mockQuery,
    ).toHaveBeenCalledTimes(2);

    const parametrosDatos =
      mockQuery.mock.calls[0][1] as unknown[];

    const parametrosConteo =
      mockQuery.mock.calls[1][1] as unknown[];

    expect(parametrosDatos).toEqual([
      'Leonardo',
      15,
      15,
    ]);

    expect(parametrosConteo).toEqual([
      'Leonardo',
    ]);
  });

  it('propaga errores de PostgreSQL', async () => {
    const error = new Error(
      'Error de conexión PostgreSQL',
    );

    mockQuery.mockRejectedValue(error);

    const service =
      crearUsuariosAdminService(mockPool);

    await expect(
      service.listarUsuarios({
        pagina: 1,
        limite: 20,
      }),
    ).rejects.toThrow(
      'Error de conexión PostgreSQL',
    );
  });

  /* =========================================================
   * SERVICE - REVOCACIÓN DE SESIONES
   * ========================================================= */

  it('revoca las sesiones activas de un usuario', async () => {
    mockQuery.mockResolvedValue({
      rows: [],
      rowCount: 2,
    });

    const service =
      crearUsuariosAdminService(mockPool);

    const total =
      await service.revocarSesionesUsuario(15);

    expect(
      mockQuery,
    ).toHaveBeenCalledWith(
      expect.stringContaining(
        'DELETE FROM sigd_auth.sesion_usuario',
      ),
      [15],
    );

    expect(total).toBe(2);
  });

  it('retorna cero si el usuario no tiene sesiones activas', async () => {
    mockQuery.mockResolvedValue({
      rows: [],
      rowCount: 0,
    });

    const service =
      crearUsuariosAdminService(mockPool);

    const total =
      await service.revocarSesionesUsuario(15);

    expect(total).toBe(0);
  });

  /* =========================================================
   * SERVICE - VALIDACIÓN DE PUESTO / ALTA
   * ========================================================= */

  it('rechaza asignar un puesto laboral inactivo', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          activo: false,
        },
      ],
      rowCount: 1,
    });

    const service =
      crearUsuariosAdminService(mockPool);

    await expect(
      service.crearUsuario({
        tipoDocumentoId: 1,
        numeroDocumento: '74851201',
        nombres: 'Leonardo',
        apellidoPaterno: 'Rodriguez',
        apellidoMaterno: null,
        telefono: null,
        correo: 'leonardo@iestpsuiza.edu.pe',
        username: 'leonardo.rodriguez',
        passwordInicial: 'ClaveSegura2026!',
        puestoLaboralId: PUESTO_ID,
        rolId: ROL_ID,
      }),
    ).rejects.toMatchObject({
      status: 422,
      code: 'PUESTO_LABORAL_INACTIVO',
    });

    expect(
      mockQuery,
    ).toHaveBeenCalledWith(
      expect.stringContaining(
        'FROM sigd_org.puesto_laboral',
      ),
      [PUESTO_ID],
    );
  });

  it('rechaza un puesto laboral inexistente', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const service =
      crearUsuariosAdminService(mockPool);

    await expect(
      service.crearUsuario({
        tipoDocumentoId: 1,
        numeroDocumento: '74851201',
        nombres: 'Leonardo',
        apellidoPaterno: 'Rodriguez',
        apellidoMaterno: null,
        telefono: null,
        correo: 'leonardo@iestpsuiza.edu.pe',
        username: 'leonardo.rodriguez',
        passwordInicial: 'ClaveSegura2026!',
        puestoLaboralId: PUESTO_ID,
        rolId: ROL_ID,
      }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('documenta el bloqueo intermodular al crear con puesto activo', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          activo: true,
        },
      ],
      rowCount: 1,
    });

    const service =
      crearUsuariosAdminService(mockPool);

    await expect(
      service.crearUsuario({
        tipoDocumentoId: 1,
        numeroDocumento: '74851201',
        nombres: 'Leonardo',
        apellidoPaterno: 'Rodriguez',
        apellidoMaterno: null,
        telefono: null,
        correo: 'leonardo@iestpsuiza.edu.pe',
        username: 'leonardo.rodriguez',
        passwordInicial: 'ClaveSegura2026!',
        puestoLaboralId: PUESTO_ID,
        rolId: ROL_ID,
      }),
    ).rejects.toMatchObject({
      status: 503,
      code:
        'CONTRATO_INTERMODULAR_PENDIENTE',
    });
  });
});