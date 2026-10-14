import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';

import { construirApp } from '../../../../src/app.js';
import { verificarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { CalendarioService } from '../../../../src/domains/organicore/calendario.service.js';
import { OrganigramaService } from '../../../../src/domains/organicore/organigrama.service.js';
import { TablasMaestrasService } from '../../../../src/domains/organicore/tablasMaestras.service.js';
import { crearUsuariosAdminService } from '../../../../src/domains/organicore/usuariosAdmin.service.js';

process.env.AUTH_JWT_SECRET ??= 'test-only-jwt-secret-for-postgres-integration';
process.env.S3_ACCESS_KEY ??= 'test-s3-access-key';
process.env.S3_SECRET_KEY ??= 'test-s3-secret-key-segura';

describe('OrganiCore y Administración con PostgreSQL real', () => {
  let pool: Pool;
  let usuarioCreadoId: string | undefined;
  const sufijo = randomUUID().replaceAll('-', '').slice(0, 12);
  const codigoPrueba = `QA_${sufijo.toUpperCase()}`;
  const usernamePrueba = `prueba.${sufijo}`;
  const correoPrueba = `${usernamePrueba}@iestpsuiza.edu.pe`;
  const numeroDocumento = String(10_000_000 + (Number.parseInt(sufijo.slice(0, 8), 16) % 90_000_000));
  const anioPrueba = 2200 + (Number.parseInt(sufijo.slice(8, 12), 16) % 700);
  const fechaActiva = `${anioPrueba}-04-20`;
  const fechaInactiva = `${anioPrueba}-04-21`;
  const descripcionActiva = `Prueba PR 167 ${sufijo}`;
  const descripcionInactiva = `Prueba inactiva PR 167 ${sufijo}`;

  beforeAll(() => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL no configurada por globalSetup');
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  });

  afterAll(async () => {
    await pool.query('DELETE FROM sigd_org.calendario_laboral WHERE descripcion IN ($1, $2)', [
      descripcionActiva,
      descripcionInactiva,
    ]);
    if (usuarioCreadoId) {
      const persona = await pool.query<{ id_persona: string }>(
        'DELETE FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1 RETURNING id_persona',
        [usuarioCreadoId],
      );
      if (persona.rows[0]) {
        await pool.query('DELETE FROM sigd_auth.persona WHERE id_persona = $1', [persona.rows[0].id_persona]);
      }
    }
    await pool.query('DELETE FROM sigd_org.cargo WHERE codigo = $1', [codigoPrueba]);
    await pool.query('DELETE FROM sigd_org.area WHERE codigo = $1', [codigoPrueba]);
    await pool.end();
  });

  it('persiste organigrama, tablas maestras, calendario y un usuario multirrol bloqueable', async () => {
    const organigrama = new OrganigramaService(pool);
    const maestras = new TablasMaestrasService(pool);
    const calendario = new CalendarioService(pool);
    const usuarios = crearUsuariosAdminService(pool);

    const area = await organigrama.crearUnidad({ codigo: codigoPrueba, nombre: `Área QA PR 167 ${sufijo}`, padreId: null });
    await maestras.crear('cargos', { codigo: codigoPrueba, nombre: `Cargo QA PR 167 ${sufijo}` });
    const cargo = await pool.query<{ cargo_id: string }>('SELECT cargo_id FROM sigd_org.cargo WHERE codigo = $1', [codigoPrueba]);
    const roles = await pool.query<{ rol_id: string; codigo: string }>(
      "SELECT rol_id, codigo FROM sigd_org.rol_sistema WHERE codigo IN ('ADMINISTRADOR', 'DIRECTOR') ORDER BY codigo",
    );
    expect(roles.rows).toHaveLength(2);

    const creado = await usuarios.crearUsuario({
      tipo: 'NATURAL', numeroDocumento, nombres: 'Prueba', apellidos: 'Multirrol',
      correo: correoPrueba, username: usernamePrueba, passwordInicial: 'ClaveSegura166!',
      areaId: area.id, cargoId: cargo.rows[0].cargo_id, rolIds: roles.rows.map((rol) => rol.rol_id),
    });
    usuarioCreadoId = creado.id;
    expect(creado.roles).toHaveLength(2);

    const app = construirApp(pool);
    const login = await request(app).post('/api/v1/auth/login').send({
      identificador: usernamePrueba, password: 'ClaveSegura166!',
    });
    expect(login.status).toBe(200);
    expect(login.body.requiresRoleSelection).toBe(true);
    expect(login.body).not.toHaveProperty('accessToken');

    const seleccion = await request(app).post('/api/v1/auth/select-role').send({
      selectionToken: login.body.selectionToken,
      rol: 'SUPER_ADMIN',
    });
    expect(seleccion.status).toBe(200);
    expect(verificarTokenAcceso(seleccion.body.accessToken).roles).toEqual(['SUPER_ADMIN']);

    const intentosRefresh = await Promise.all([
      request(app).post('/api/v1/auth/refresh').send({ refreshToken: seleccion.body.refreshToken }),
      request(app).post('/api/v1/auth/refresh').send({ refreshToken: seleccion.body.refreshToken }),
    ]);
    expect(intentosRefresh.map((respuesta) => respuesta.status).sort()).toEqual([200, 401]);
    const refresh = intentosRefresh.find((respuesta) => respuesta.status === 200)!;
    expect(refresh.status).toBe(200);
    expect(verificarTokenAcceso(refresh.body.accessToken).roles).toEqual(['SUPER_ADMIN']);

    const cambio = await request(app).post('/api/v1/auth/switch-role')
      .set('Authorization', `Bearer ${refresh.body.accessToken}`)
      .send({ refreshToken: refresh.body.refreshToken, rol: 'DIRECTOR' });
    expect(cambio.status).toBe(200);
    expect(verificarTokenAcceso(cambio.body.accessToken).roles).toEqual(['DIRECTOR']);

    const bloqueado = await usuarios.actualizarUsuario(creado.id, {
      estado: 'BLOQUEADO',
    });
    expect(bloqueado.estado).toBe('BLOQUEADO');
    expect(bloqueado.roles).toHaveLength(2);
    const sesionesVigentesBloqueado = await pool.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM sigd_auth.sesion_usuario WHERE id_usuario = $1 AND revocado_en IS NULL',
      [creado.id],
    );
    expect(sesionesVigentesBloqueado.rows[0].total).toBe(0);
    const loginBloqueado = await request(app).post('/api/v1/auth/login').send({
      identificador: usernamePrueba, password: 'ClaveSegura166!',
    });
    expect(loginBloqueado.status).toBe(423);
    const refreshBloqueado = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: cambio.body.refreshToken,
    });
    expect(refreshBloqueado.status).toBe(401);

    const reactivado = await usuarios.actualizarUsuario(creado.id, {
      estado: 'ACTIVO',
    });
    expect(reactivado.estado).toBe('ACTIVO');
    expect(reactivado.roles).toHaveLength(2);
    const loginDesbloqueado = await request(app).post('/api/v1/auth/login').send({
      identificador: usernamePrueba, password: 'ClaveSegura166!',
    });
    expect(loginDesbloqueado.status).toBe(200);
    expect(loginDesbloqueado.body.requiresRoleSelection).toBe(true);

    const seleccionTrasDesbloqueo = await request(app).post('/api/v1/auth/select-role').send({
      selectionToken: loginDesbloqueado.body.selectionToken,
      rol: 'SUPER_ADMIN',
    });
    expect(seleccionTrasDesbloqueo.status).toBe(200);
    const logout = await request(app).post('/api/v1/auth/logout').send({
      refreshToken: seleccionTrasDesbloqueo.body.refreshToken,
    });
    expect(logout.status).toBe(200);
    const refreshTrasLogout = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: seleccionTrasDesbloqueo.body.refreshToken,
    });
    expect(refreshTrasLogout.status).toBe(401);

    await pool.query(
      `INSERT INTO sigd_org.calendario_laboral
       (fecha, tipo_feriado, descripcion, unidad_territorial, es_laborable, activo)
       VALUES ($1, 'INSTITUCIONAL', $3, 'NACIONAL', FALSE, TRUE),
              ($2, 'INSTITUCIONAL', $4, 'NACIONAL', FALSE, FALSE)`,
      [fechaActiva, fechaInactiva, descripcionActiva, descripcionInactiva],
    );
    const activos = await calendario.listar({ anio: anioPrueba, estado: 'ACTIVO' });
    const todos = await calendario.listar({ desde: fechaActiva, hasta: fechaInactiva, estado: 'TODOS' });
    const inactivos = await calendario.listar({ anio: anioPrueba, estado: 'INACTIVO' });
    expect(activos.some((item) => item.descripcion === descripcionActiva)).toBe(true);
    expect(todos.filter((item) => [descripcionActiva, descripcionInactiva].includes(item.descripcion))).toHaveLength(2);
    expect(inactivos.some((item) => item.descripcion === descripcionInactiva)).toBe(true);

    const catalogos = await maestras.listarMaestras(false, true);
    expect(catalogos.catalogos.find((catalogo) => catalogo.clave === 'cargos')?.items.some((item) => item.codigo === codigoPrueba)).toBe(true);
    expect((await organigrama.obtenerOrganigrama()).some((nodo) => nodo.id === area.id)).toBe(true);
  });
});
