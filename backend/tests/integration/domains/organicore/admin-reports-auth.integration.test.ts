import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import request from 'supertest';

import { construirApp } from '../../../../src/app.js';
import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';

process.env.AUTH_JWT_SECRET ??= 'test-only-jwt-secret-for-postgres-integration';

describe('Suite Integral: Administración, Reportes y Autenticación (PostgreSQL real)', () => {
  let pool: Pool;
  let app: ReturnType<typeof construirApp>;
  let superAdminToken: string;
  let superAdminRefresh: string;
  let areaDirId: string;
  let areaMesaId: string;
  let cargoEspId: string;
  let rolDirectorId: string;
  let rolEspecialistaId: string;
  let rolMesaId: string;
  let rolCiudadanoId: string;

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error('TEST_DATABASE_URL no configurada por globalSetup');
    }
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    app = construirApp(pool);

    // Crear un Superadministrador de prueba nominal (aislado en la BD de pruebas)
    const passwordHash = await Argon2Service.hash('SuperAdminQA2026!');
    const persona = await pool.query<{ id_persona: string }>(
      `INSERT INTO sigd_auth.persona (tipo, id_documento) VALUES ('NATURAL', '99000001') RETURNING id_persona`,
    );
    await pool.query(
      `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
       VALUES ($1, 'Admin', 'Pruebas', 'Admin Pruebas', 'admin.qa@iestpsuiza.edu.pe')`,
      [persona.rows[0].id_persona],
    );
    const cuenta = await pool.query<{ id_usuario: string }>(
      `INSERT INTO sigd_auth.cuenta_usuario (id_persona, usuario, correo, password_hash)
       VALUES ($1, 'admin.qa', 'admin.qa@iestpsuiza.edu.pe', $2) RETURNING id_usuario`,
      [persona.rows[0].id_persona, passwordHash],
    );
    const adminRol = await pool.query<{ rol_id: string }>(
      `SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'ADMINISTRADOR'`,
    );
    await pool.query(
      `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id) VALUES ($1, $2)`,
      [cuenta.rows[0].id_usuario, adminRol.rows[0].rol_id],
    );

    const areas = await pool.query<{ area_id: string; codigo: string }>(
      `SELECT area_id, codigo FROM sigd_org.area WHERE codigo IN ('DIR', 'MESA_PARTES')`,
    );
    areaDirId = areas.rows.find((r) => r.codigo === 'DIR')!.area_id;
    areaMesaId = areas.rows.find((r) => r.codigo === 'MESA_PARTES')!.area_id;

    const cargo = await pool.query<{ cargo_id: string }>(
      `SELECT cargo_id FROM sigd_org.cargo WHERE codigo = 'ESPECIALISTA' LIMIT 1`,
    );
    cargoEspId = cargo.rows[0].cargo_id;

    const roles = await pool.query<{ rol_id: string; codigo: string }>(
      `SELECT rol_id, codigo FROM sigd_org.rol_sistema WHERE codigo IN ('DIRECTOR', 'ESPECIALISTA', 'MESA_PARTES', 'CIUDADANO')`,
    );
    rolDirectorId = roles.rows.find((r) => r.codigo === 'DIRECTOR')!.rol_id;
    rolEspecialistaId = roles.rows.find((r) => r.codigo === 'ESPECIALISTA')!.rol_id;
    rolMesaId = roles.rows.find((r) => r.codigo === 'MESA_PARTES')!.rol_id;
    rolCiudadanoId = roles.rows.find((r) => r.codigo === 'CIUDADANO')!.rol_id;

    const loginAdmin = await request(app).post('/api/v1/auth/login').send({
      identificador: 'admin.qa@iestpsuiza.edu.pe',
      password: 'SuperAdminQA2026!',
    });
    expect(loginAdmin.status).toBe(200);
    superAdminToken = loginAdmin.body.accessToken;
    superAdminRefresh = loginAdmin.body.refreshToken;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM sigd_audit.evento_outbox');
    await pool.end();
  });

  it('permite que un usuario registrado por Superadmin inicie sesión con DNI y correo, con su rol asignado y sin escalamiento', async () => {
    const creado = await request(app)
      .post('/api/v1/admin/usuarios')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tipo: 'NATURAL',
        numeroDocumento: '71234901',
        nombres: 'Elena',
        apellidos: 'Rojas Silva',
        telefono: '961123456',
        correo: 'elena.rojas@iestpsuiza.edu.pe',
        passwordInicial: 'ClaveSegura2026!',
        areaId: areaMesaId,
        cargoId: cargoEspId,
        rolId: rolMesaId,
      });
    expect(creado.status).toBe(201);
    expect(creado.body.roles).toHaveLength(1);
    expect(creado.body.roles[0].id).toBe(rolMesaId);

    // Login por DNI
    const loginDni = await request(app).post('/api/v1/auth/login').send({
      identificador: '71234901',
      password: 'ClaveSegura2026!',
    });
    expect(loginDni.status).toBe(200);
    expect(loginDni.body.usuario.rol).toBe('MESA_PARTES');
    expect(loginDni.body.usuario.rol).not.toBe('SUPER_ADMIN');
    expect(loginDni.body.usuario.areaId).toBe(areaMesaId);

    // Login por correo institucional
    const loginCorreo = await request(app).post('/api/v1/auth/login').send({
      identificador: 'elena.rojas@iestpsuiza.edu.pe',
      password: 'ClaveSegura2026!',
    });
    expect(loginCorreo.status).toBe(200);

    // Usuario normal puede acceder a /auth/me pero NO a endpoints administrativos ni reportes directivos
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginCorreo.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.rol).toBe('MESA_PARTES');

    const adminDenegado = await request(app)
      .get('/api/v1/admin/usuarios')
      .set('Authorization', `Bearer ${loginCorreo.body.accessToken}`);
    expect(adminDenegado.status).toBe(403);

    const reportesDenegado = await request(app)
      .get('/api/v1/reportes/dashboard/resumen')
      .set('Authorization', `Bearer ${loginCorreo.body.accessToken}`);
    expect(reportesDenegado.status).toBe(403);

    // Editar usuario (nombre, área y estado) y verificar bloqueo + desbloqueo supervisado
    const editado = await request(app)
      .put(`/api/v1/admin/usuarios/${creado.body.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ nombres: 'Elena María', areaId: areaDirId, cargoId: cargoEspId, estado: 'BLOQUEADO' });
    expect(editado.status).toBe(200);
    expect(editado.body.estado).toBe('BLOQUEADO');
    expect(editado.body.area.id).toBe(areaDirId);

    // Sesión anterior revocada inmediatamente y nuevo login bloqueado (423)
    const tokenRevocado = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginCorreo.body.accessToken}`);
    expect(tokenRevocado.status).toBe(401);

    const loginBloqueado = await request(app).post('/api/v1/auth/login').send({
      identificador: '71234901',
      password: 'ClaveSegura2026!',
    });
    expect(loginBloqueado.status).toBe(423);

    // Desbloqueo desde Seguridad con justificación forense
    const bloqueadas = await request(app)
      .get('/api/v1/admin/seguridad/cuentas-bloqueadas')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(bloqueadas.status).toBe(200);
    expect(bloqueadas.body.cuentas.some((c: { id_usuario: string }) => c.id_usuario === creado.body.id)).toBe(true);

    const desbloqueo = await request(app)
      .post(`/api/v1/admin/seguridad/cuentas/${creado.body.id}/desbloquear`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ justificacion: 'Verificación de identidad aprobada por coordinación' });
    expect(desbloqueo.status).toBe(200);

    const loginDesbloqueado = await request(app).post('/api/v1/auth/login').send({
      identificador: '71234901',
      password: 'ClaveSegura2026!',
    });
    expect(loginDesbloqueado.status).toBe(200);

    // Cierre de sesión revoca el token
    const logout = await request(app).post('/api/v1/auth/logout').send({
      refreshToken: loginDesbloqueado.body.refreshToken,
    });
    expect(logout.status).toBe(200);
    const postLogout = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginDesbloqueado.body.accessToken}`);
    expect(postLogout.status).toBe(401);
  });

  it('permite login por múltiples roles (DIRECTOR, DOCENTE, ESTUDIANTE) y aplica RBAC real en backend', async () => {
    const perfiles = [
      { doc: '72000101', correo: 'director.qa@iestpsuiza.edu.pe', rolId: rolDirectorId, rolEsperado: 'DIRECTOR' },
      { doc: '72000102', correo: 'docente.qa@iestpsuiza.edu.pe', rolId: rolEspecialistaId, rolEsperado: 'DOCENTE' },
      { doc: '72000103', correo: 'estudiante.qa@iestpsuiza.edu.pe', rolId: rolCiudadanoId, rolEsperado: 'ESTUDIANTE' },
    ];
    let directorToken = '';
    for (const p of perfiles) {
      const alta = await request(app)
        .post('/api/v1/admin/usuarios')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          tipo: 'NATURAL',
          numeroDocumento: p.doc,
          nombres: 'Usuario',
          apellidos: p.rolEsperado,
          correo: p.correo,
          passwordInicial: 'ClaveMultiRol2026!',
          areaId: areaDirId,
          cargoId: cargoEspId,
          rolId: p.rolId,
        });
      expect(alta.status).toBe(201);
      const login = await request(app).post('/api/v1/auth/login').send({
        identificador: p.correo,
        password: 'ClaveMultiRol2026!',
      });
      expect(login.status).toBe(200);
      expect(login.body.usuario.rol).toBe(p.rolEsperado);
      if (p.rolEsperado === 'DIRECTOR') directorToken = login.body.accessToken;
    }

    // DIRECTOR puede consultar reportes, pero NO modificar roles ni políticas de seguridad
    const repDirector = await request(app)
      .get('/api/v1/reportes/dashboard/resumen')
      .set('Authorization', `Bearer ${directorToken}`);
    expect(repDirector.status).toBe(200);

    const secDirector = await request(app)
      .put('/api/v1/admin/seguridad/politicas')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ maxIntentosFallidos: 4, minutosBloqueo: 15, minutosSesion: 30 });
    expect(secDirector.status).toBe(403);

    // Crear rol personalizado, editarlo, asignarle permiso y desactivarlo
    const crearRol = await request(app)
      .post('/api/v1/admin/roles')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ codigo: 'AUDITOR_QA', nombre: 'Auditor QA', descripcion: 'Rol de auditoría de pruebas', permisos: ['admin:acceso', 'auditoria:leer'] });
    expect(crearRol.status).toBe(201);

    const editarRol = await request(app)
      .put('/api/v1/admin/roles/AUDITOR_QA')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ nombre: 'Auditor Interno QA', descripcion: 'Actualizado' });
    expect(editarRol.status).toBe(200);
    expect(editarRol.body.rol.nombre).toBe('Auditor Interno QA');

    const desactivarRol = await request(app)
      .patch('/api/v1/admin/roles/AUDITOR_QA/vigencia')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ vigente: false });
    expect(desactivarRol.status).toBe(200);
    expect(desactivarRol.body.rol.vigente).toBe(false);

    // No permite desactivar un rol con usuarios activos (DIRECTOR)
    const desactivarConUsuarios = await request(app)
      .patch('/api/v1/admin/roles/DIRECTOR/vigencia')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ vigente: false });
    expect(desactivarConUsuarios.status).toBe(409);
  });

  it('opera Tablas Maestras (sedes, áreas, cargos, tipos documentales), Calendario LPAG, Seguridad (sesiones) y Auditoría sin exponer secretos', async () => {
    // Sedes reales en BD
    const crearSede = await request(app)
      .post('/api/v1/admin/maestras/sede')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ codigo: 'SEDE_QA', nombre: 'Sede Pruebas QA', direccion: 'Av. Pruebas 123' });
    expect(crearSede.status).toBe(201);
    const sedes = await request(app)
      .get('/api/v1/admin/maestras/sede')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(sedes.status).toBe(200);
    expect(sedes.body.sedes.some((s: { codigo: string }) => s.codigo === 'SEDE_QA')).toBe(true);

    // Tipos documentales sin 500
    const tiposDoc = await request(app)
      .get('/api/v1/admin/maestras/tipo-documento')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(tiposDoc.status).toBe(200);
    expect(Array.isArray(tiposDoc.body)).toBe(true);

    // Calendario laboral: feriado + cálculo de plazo LPAG
    const feriado = await request(app)
      .post('/api/v1/admin/calendario-laboral/feriado-excepcional')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ fecha: '2026-08-17', descripcion: 'Feriado QA Institucional', tipo_feriado: 'INSTITUCIONAL', base_legal: 'RD 001-QA' });
    expect(feriado.status).toBe(201);

    const plazo = await request(app)
      .get('/api/v1/admin/calendario-laboral/calcular-plazo?desde=2026-08-14&diasHabiles=2')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(plazo.status).toBe(200);
    // 14 ago = viernes; 15-16 fin de semana; 17 feriado -> 1er día hábil = 18 ago, 2do = 19 ago
    expect(plazo.body.fecha_vencimiento).toBe('2026-08-19');

    // Control de sesiones activas
    const sesiones = await request(app)
      .get('/api/v1/admin/seguridad/sesiones')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(sesiones.status).toBe(200);
    expect(sesiones.body.sesiones.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(sesiones.body)).not.toContain('refresh_token');

    // Auditoría: eventos reales, enriquecidos y sin secretos
    const audit = await request(app)
      .get('/api/v1/admin/auditoria/bitacora?limite=50&offset=0')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(audit.status).toBe(200);
    expect(audit.body.total).toBeGreaterThan(0);
    expect(audit.body.resumen).toBeDefined();
    expect(JSON.stringify(audit.body.registros)).not.toContain('$argon2id$');
    expect(JSON.stringify(audit.body.registros)).not.toContain('ClaveSegura2026!');
    expect(JSON.stringify(audit.body.registros)).not.toContain(superAdminRefresh);
  });

  it('filtra Reportes por año, periodo y unidad orgánica con datos reales y genera exportaciones Excel y PDF válidas', async () => {
    const tipoDoc = await pool.query<{ tipo_documental_id: string }>(
      `SELECT tipo_documental_id FROM sigd_doc.tipo_documento LIMIT 1`,
    );
    const tipoDocId = tipoDoc.rows[0].tipo_documental_id;
    const persona = await pool.query<{ id_persona: string }>(`SELECT id_persona FROM sigd_auth.persona LIMIT 1`);
    const personaId = persona.rows[0].id_persona;

    // Insertar 2 expedientes en 2 áreas distintas en 2026-05 y 1 en 2026-06
    await pool.query(
      `INSERT INTO sigd_tra.expediente (codigo_expediente, numero, solicitante_id, area_destino_id, tipo_documental_id, estado, fecha_radicacion)
       VALUES
         ('EXP-2026-990001', 'NUM-QA-990001', $1, $2, $4, 'REGISTRADO', '2026-05-11T15:00:00Z'),
         ('EXP-2026-990002', 'NUM-QA-990002', $1, $3, $4, 'REGISTRADO', '2026-05-12T15:00:00Z'),
         ('EXP-2026-990003', 'NUM-QA-990003', $1, $2, $4, 'REGISTRADO', '2026-06-10T15:00:00Z')`,
      [personaId, areaDirId, areaMesaId, tipoDocId],
    );

    const refresh = await request(app)
      .post('/api/v1/reportes/vistas-materializadas/refresh')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(refresh.status).toBe(200);

    // Unidades disponibles reales
    const unidades = await request(app)
      .get('/api/v1/reportes/dashboard/unidades')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(unidades.status).toBe(200);
    expect(unidades.body.some((u: { id: string }) => u.id === areaDirId)).toBe(true);

    // Resumen global de 2026-05 -> 2 expedientes
    const resumenMayo = await request(app)
      .get('/api/v1/reportes/dashboard/resumen?periodo=2026-05')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(resumenMayo.status).toBe(200);
    expect(resumenMayo.body.contadores.nRadicados).toBe(2);

    // Resumen filtrado por unidad orgánica DIR en 2026-05 -> 1 expediente
    const resumenDir = await request(app)
      .get(`/api/v1/reportes/dashboard/resumen?periodo=2026-05&unidadOrganicaId=${areaDirId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(resumenDir.status).toBe(200);
    expect(resumenDir.body.contadores.nRadicados).toBe(1);

    // Tendencias 2026 consolidadas: mayo debe sumar 2 (sin sobrescritura entre áreas!) y junio 1
    const tendencias = await request(app)
      .get('/api/v1/reportes/dashboard/tendencias?anio=2026')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(tendencias.status).toBe(200);
    expect(tendencias.body[4].radicados).toBe(2);
    expect(tendencias.body[5].radicados).toBe(1);

    // Periodo vacío (2024-01) -> 200 sin 500, todos los contadores en 0
    const vacio = await request(app)
      .get('/api/v1/reportes/dashboard/resumen?periodo=2024-01')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(vacio.status).toBe(200);
    expect(vacio.body.contadores.nRadicados).toBe(0);

    // Exportación Excel y PDF desde backend respetando filtros
    const excel = await request(app)
      .get(`/api/v1/reportes/exportar-excel?anio=2026&periodo=2026-05&unidadOrganicaId=${areaDirId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(excel.status).toBe(200);
    expect(excel.headers['content-disposition']).toContain('tablero-ejecutivo-2026-05.xls');
    expect(excel.text).toContain('Workbook');
    expect(excel.text).toContain('Expedientes registrados');

    const pdf = await request(app)
      .get(`/api/v1/reportes/exportar-pdf?anio=2026&periodo=2026-05&unidadOrganicaId=${areaDirId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .buffer(true);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(pdf.body).subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
