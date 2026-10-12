import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

import { CalendarioService } from '../../../../src/domains/organicore/calendario.service.js';
import { OrganigramaService } from '../../../../src/domains/organicore/organigrama.service.js';
import { TablasMaestrasService } from '../../../../src/domains/organicore/tablasMaestras.service.js';
import { crearUsuariosAdminService } from '../../../../src/domains/organicore/usuariosAdmin.service.js';

describe('OrganiCore y Administración con PostgreSQL real', () => {
  let pool: Pool;

  beforeAll(() => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL no configurada por globalSetup');
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  });

  afterAll(async () => pool.end());

  it('persiste organigrama, tablas maestras, calendario y un usuario multirrol bloqueable', async () => {
    const organigrama = new OrganigramaService(pool);
    const maestras = new TablasMaestrasService(pool);
    const calendario = new CalendarioService(pool);
    const usuarios = crearUsuariosAdminService(pool);

    const area = await organigrama.crearUnidad({ codigo: 'QA_PR166', nombre: 'Área QA PR 166', padreId: null });
    await maestras.crear('cargos', { codigo: 'QA_PR166', nombre: 'Cargo QA PR 166' });
    const cargo = await pool.query<{ cargo_id: string }>("SELECT cargo_id FROM sigd_org.cargo WHERE codigo = 'QA_PR166'");
    const roles = await pool.query<{ rol_id: string; codigo: string }>(
      "SELECT rol_id, codigo FROM sigd_org.rol_sistema WHERE codigo IN ('ADMINISTRADOR', 'DIRECTOR') ORDER BY codigo",
    );
    expect(roles.rows).toHaveLength(2);

    const creado = await usuarios.crearUsuario({
      tipo: 'NATURAL', numeroDocumento: '99166123', nombres: 'Prueba', apellidos: 'Multirrol',
      correo: 'prueba.pr166@iestpsuiza.edu.pe', username: 'prueba.pr166', passwordInicial: 'ClaveSegura166!',
      areaId: area.id, cargoId: cargo.rows[0].cargo_id, rolIds: roles.rows.map((rol) => rol.rol_id),
    });
    expect(creado.roles).toHaveLength(2);

    const director = roles.rows.find((rol) => rol.codigo === 'DIRECTOR')!;
    const bloqueado = await usuarios.actualizarUsuario(creado.id, {
      rolesQuitar: [director.rol_id], estado: 'BLOQUEADO',
    });
    expect(bloqueado.estado).toBe('BLOQUEADO');
    expect(bloqueado.roles).toHaveLength(1);
    expect(bloqueado.roles[0].nombre).toContain('Administrador');

    const reactivado = await usuarios.actualizarUsuario(creado.id, {
      rolesAgregar: [director.rol_id], estado: 'ACTIVO',
    });
    expect(reactivado.estado).toBe('ACTIVO');
    expect(reactivado.roles).toHaveLength(2);

    await pool.query(
      `INSERT INTO sigd_org.calendario_laboral
       (fecha, tipo_feriado, descripcion, unidad_territorial, es_laborable, activo)
       VALUES ('2099-04-20', 'INSTITUCIONAL', 'Prueba PR 166', 'NACIONAL', FALSE, TRUE),
              ('2099-04-21', 'INSTITUCIONAL', 'Prueba inactiva PR 166', 'NACIONAL', FALSE, FALSE)`,
    );
    expect(await calendario.listar({ anio: 2099, estado: 'ACTIVO' })).toHaveLength(1);
    expect(await calendario.listar({ desde: '2099-04-20', hasta: '2099-04-21', estado: 'TODOS' })).toHaveLength(2);
    expect(await calendario.listar({ anio: 2099, estado: 'INACTIVO' })).toHaveLength(1);

    const catalogos = await maestras.listarMaestras(false, true);
    expect(catalogos.catalogos.find((catalogo) => catalogo.clave === 'cargos')?.items.some((item) => item.codigo === 'QA_PR166')).toBe(true);
    expect((await organigrama.obtenerOrganigrama()).some((nodo) => nodo.id === area.id)).toBe(true);
  });
});
