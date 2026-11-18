import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import supertest from 'supertest';
import express, { type Express } from 'express';
import { crearUsuariosAdminRouter } from '../../../../src/domains/organicore/usuariosAdmin.routes.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';

describe('Integración — Administración de Usuarios Institucionales (IdentiCore ↔ OrganiCore)', () => {
  let pool: Pool;
  let app: Express;
  const SECRET_KEY = 'test_secret_key_with_at_least_32_characters_long_for_security';
  process.env.AUTH_JWT_SECRET = SECRET_KEY;

  let adminToken: string;
  let superadminToken: string;
  let adminUserId: string;

  let areaSdaId: string;
  let rolEspecialistaId: string;
  let rolDirectorId: string;

  const testDni1 = '87654321';
  const testUsuario1 = 'test_docente_2026';
  const testCorreo1 = 'test.docente@iestpsuiza.edu.pe';
  let createdUserId1: string;

  beforeAll(async () => {
    const databaseUrl =
      process.env.DATABASE_URL ||
      'postgres://postgres:postgres_password@172.20.157.19:5432/sigd_prueba';
    pool = new Pool({ connectionString: databaseUrl });

    // Resolver ID de administrador demo
    const adminRes = await pool.query<{ id_usuario: string }>(
      `SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE usuario = 'administrador_demo' LIMIT 1`,
    );
    adminUserId = adminRes.rows[0]?.id_usuario || 'a0000000-0000-4000-8000-000000000001';

    adminToken = firmarTokenAcceso({
      sub: adminUserId,
      roles: ['ADMINISTRADOR'],
      secreto: SECRET_KEY,
    });

    superadminToken = firmarTokenAcceso({
      sub: 'c1111111-1111-1111-1111-111111111111',
      roles: ['SUPERADMINISTRADOR'],
      secreto: SECRET_KEY,
    });

    // Resolver área SDA y roles
    const areaRes = await pool.query<{ area_id: string }>(
      `SELECT area_id FROM sigd_org.area WHERE codigo = 'SDA' AND vigente = TRUE LIMIT 1`,
    );
    areaSdaId = areaRes.rows[0]?.area_id;

    const rolEspRes = await pool.query<{ rol_id: string }>(
      `SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'ESPECIALISTA' LIMIT 1`,
    );
    rolEspecialistaId = rolEspRes.rows[0]?.rol_id;

    const rolDirRes = await pool.query<{ rol_id: string }>(
      `SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'DIRECTOR' LIMIT 1`,
    );
    rolDirectorId = rolDirRes.rows[0]?.rol_id;

    // Configurar app Express de prueba
    app = express();
    app.use(express.json());
    app.use('/api/v1/admin/usuarios', crearUsuariosAdminRouter(pool));
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err.status ?? err.statusCode ?? 500).json({
        message: err.message,
        code: err.code,
        status: err.status ?? 500,
      });
    });

    // Limpiar usuario de prueba si existiera de una ejecución previa
    await pool.query(
      `DELETE FROM sigd_auth.cuenta_usuario WHERE usuario IN ($1, 'test_worker_dos') OR correo IN ($2, 'test.dos@iestpsuiza.edu.pe')`,
      [testUsuario1, testCorreo1],
    );
    await pool.query(
      `DELETE FROM sigd_auth.vinculo_institucional WHERE id_persona IN (SELECT id_persona FROM sigd_auth.persona WHERE id_documento = $1)`,
      [testDni1],
    );
    await pool.query(
      `DELETE FROM sigd_auth.persona_natural WHERE id_persona IN (SELECT id_persona FROM sigd_auth.persona WHERE id_documento = $1)`,
      [testDni1],
    );
    await pool.query(
      `DELETE FROM sigd_auth.persona WHERE id_documento = $1`,
      [testDni1],
    );
  });

  afterAll(async () => {
    // Limpieza de datos de prueba
    if (createdUserId1) {
      await pool.query(`DELETE FROM sigd_org.asignacion_personal WHERE id_usuario = $1::uuid`, [createdUserId1]);
      await pool.query(`DELETE FROM sigd_org.usuario_rol WHERE id_usuario = $1::uuid`, [createdUserId1]);
      await pool.query(`DELETE FROM sigd_auth.perfil_usuario WHERE id_usuario = $1::uuid`, [createdUserId1]);
      await pool.query(`DELETE FROM sigd_auth.sesion_usuario WHERE id_usuario = $1::uuid`, [createdUserId1]);
      await pool.query(`DELETE FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`, [createdUserId1]);
    }
    await pool.query(`DELETE FROM sigd_auth.vinculo_institucional WHERE id_persona IN (SELECT id_persona FROM sigd_auth.persona WHERE id_documento = $1)`, [testDni1]);
    await pool.query(`DELETE FROM sigd_auth.persona_natural WHERE id_persona IN (SELECT id_persona FROM sigd_auth.persona WHERE id_documento = $1)`, [testDni1]);
    await pool.query(`DELETE FROM sigd_auth.persona WHERE id_documento = $1`, [testDni1]);
    await pool.end();
  });

  it('1. POST /api/v1/admin/usuarios registra un usuario institucional individual sin crear vínculos de estudiante', async () => {
    const res = await supertest(app)
      .post('/api/v1/admin/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tipoDocumento: 'DNI',
        numeroDocumento: testDni1,
        nombres: 'Carlos',
        apellidos: 'Bustamante',
        correo: testCorreo1,
        usuario: testUsuario1,
        password: 'PasswordSegura2026!',
        rolId: 'ESPECIALISTA',
        areaId: areaSdaId,
        activo: true,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('idUsuario');
    expect(res.body.usuario).toBe(testUsuario1);
    expect(res.body.correo).toBe(testCorreo1);
    createdUserId1 = res.body.idUsuario;

    // Verificar en BD que id_usuario e id_persona son UUID nativos
    const cuentaBd = await pool.query<{ id_usuario: string; id_persona: string; activo: boolean }>(
      `SELECT id_usuario, id_persona, activo FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`,
      [createdUserId1],
    );
    expect(cuentaBd.rows.length).toBe(1);
    const idPersona = cuentaBd.rows[0].id_persona;
    expect(cuentaBd.rows[0].activo).toBe(true);

    // Regla obligatoria: NO crear vínculos académicos de estudiante
    const vinculosEstudiante = await pool.query(
      `SELECT * FROM sigd_auth.vinculo_institucional WHERE id_persona = $1::uuid AND id_tipo_vinculo = 2`,
      [idPersona],
    );
    expect(vinculosEstudiante.rows.length).toBe(0);

    // Verificar que se registró el vínculo laboral formal ADMINISTRATIVO (id_tipo_vinculo = 6)
    const vinculoLaboral = await pool.query(
      `SELECT * FROM sigd_auth.vinculo_institucional WHERE id_persona = $1::uuid AND id_tipo_vinculo = 6 AND estado = 'ACTIVO'`,
      [idPersona],
    );
    expect(vinculoLaboral.rows.length).toBe(1);

    // Verificar rol institucional asignado en sigd_org.usuario_rol
    const rolBd = await pool.query(
      `SELECT * FROM sigd_org.usuario_rol WHERE id_usuario = $1::uuid AND rol_id = $2::uuid`,
      [createdUserId1, rolEspecialistaId],
    );
    expect(rolBd.rows.length).toBe(1);
  });

  it('2. POST /api/v1/admin/usuarios/institucional no duplica la Persona al registrar otra función con el mismo DNI', async () => {
    // Intentar registrar otra cuenta institucional para la misma persona física (mismo DNI)
    const usuarioDos = 'test_worker_dos';
    const correoDos = 'test.dos@iestpsuiza.edu.pe';

    const res = await supertest(app)
      .post('/api/v1/admin/usuarios/institucional')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tipoDocumento: 'DNI',
        numeroDocumento: testDni1, // Mismo DNI
        nombres: 'Carlos',
        apellidos: 'Bustamante',
        correo: correoDos,
        usuario: usuarioDos,
        password: 'PasswordSegura2026!',
        rolId: 'ESPECIALISTA',
        areaId: areaSdaId,
        activo: true,
      });

    expect(res.status).toBe(201);
    const userIdDos = res.body.idUsuario;

    // Verificar que ambas cuentas comparten la MISMA persona física (sin duplicados en sigd_auth.persona)
    const personasRes = await pool.query<{ id_persona: string }>(
      `SELECT id_persona FROM sigd_auth.persona WHERE id_documento = $1`,
      [testDni1],
    );
    expect(personasRes.rows.length).toBe(1); // Exactamente una persona

    // Limpieza de cuenta secundaria
    await pool.query(`DELETE FROM sigd_org.usuario_rol WHERE id_usuario = $1::uuid`, [userIdDos]);
    await pool.query(`DELETE FROM sigd_auth.perfil_usuario WHERE id_usuario = $1::uuid`, [userIdDos]);
    await pool.query(`DELETE FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`, [userIdDos]);
  });

  it('3. PUT /api/v1/admin/usuarios/:id bloquea auto-escalamiento si el solicitante intenta modificarse a sí mismo', async () => {
    const res = await supertest(app)
      .put(`/api/v1/admin/usuarios/${adminUserId}`)
      .set('Authorization', `Bearer ${adminToken}`) // Mismo adminUserId en token y en URL
      .send({
        rol: 'DIRECTOR',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTO_ESCALACION_PROHIBIDA');
  });

  it('4. PUT /api/v1/admin/usuarios/:id bloquea asignar rol DIRECTOR si el solicitante no es SUPERADMINISTRADOR', async () => {
    const res = await supertest(app)
      .put(`/api/v1/admin/usuarios/${createdUserId1}`)
      .set('Authorization', `Bearer ${adminToken}`) // Rol ADMINISTRADOR, no SUPERADMINISTRADOR
      .send({
        rolId: rolDirectorId,
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PRIVILEGIO_INSUFICIENTE_ASIGNACION_ROL');
  });

  it('5. PUT /api/v1/admin/usuarios/:id actualiza estado a INACTIVO y revoca sesiones', async () => {
    // Crear una sesión simulada para el usuario
    await pool.query(
      `INSERT INTO sigd_auth.sesion_usuario (id_usuario, refresh_token, emitido_en, expira_en)
       VALUES ($1::uuid, 'dummy_token_hash', now(), now() + interval '1 day')`,
      [createdUserId1],
    );

    const res = await supertest(app)
      .put(`/api/v1/admin/usuarios/${createdUserId1}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        estado: 'INACTIVO',
      });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('INACTIVO');

    // Verificar en BD que activo es false
    const cuentaBd = await pool.query<{ activo: boolean }>(
      `SELECT activo FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`,
      [createdUserId1],
    );
    expect(cuentaBd.rows[0].activo).toBe(false);

    // Verificar que la sesión activa fue revocada
    const sesionBd = await pool.query<{ revocado_en: Date | null }>(
      `SELECT revocado_en FROM sigd_auth.sesion_usuario WHERE id_usuario = $1::uuid`,
      [createdUserId1],
    );
    expect(sesionBd.rows[0].revocado_en).not.toBeNull();
  });

  it('6. PUT /api/v1/admin/usuarios/:id actualiza nombres, correo institucional y reactiva la cuenta', async () => {
    const nuevoCorreo = 'carlos.bustamante.nuevo@iestpsuiza.edu.pe';
    const res = await supertest(app)
      .put(`/api/v1/admin/usuarios/${createdUserId1}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombres: 'Carlos Alberto',
        apellidos: 'Bustamante Flores',
        correo: nuevoCorreo,
        estado: 'ACTIVO',
      });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Carlos Alberto Bustamante Flores');
    expect(res.body.correo).toBe(nuevoCorreo);
    expect(res.body.estado).toBe('ACTIVO');

    // Verificar en BD persona_natural
    const personaNat = await pool.query<{ nombre_completo: string; correo: string }>(
      `SELECT pn.nombre_completo, pn.correo FROM sigd_auth.persona_natural pn
       INNER JOIN sigd_auth.cuenta_usuario cu ON cu.id_persona = pn.id_persona
       WHERE cu.id_usuario = $1::uuid`,
      [createdUserId1],
    );
    expect(personaNat.rows[0].nombre_completo).toBe('Carlos Alberto Bustamante Flores');
    expect(personaNat.rows[0].correo).toBe(nuevoCorreo);
  });

  it('7. PUT /api/v1/admin/usuarios/:id permite a SUPERADMINISTRADOR asignar rol DIRECTOR', async () => {
    const res = await supertest(app)
      .put(`/api/v1/admin/usuarios/${createdUserId1}`)
      .set('Authorization', `Bearer ${superadminToken}`) // SUPERADMINISTRADOR
      .send({
        rolId: rolDirectorId,
      });

    expect(res.status).toBe(200);
    expect(res.body.rol).toBe('Director');

    // Verificar en sigd_org.usuario_rol que el nuevo rol es DIRECTOR
    const rolActual = await pool.query<{ codigo: string }>(
      `SELECT rs.codigo FROM sigd_org.usuario_rol ur
       INNER JOIN sigd_org.rol_sistema rs ON rs.rol_id = ur.rol_id
       WHERE ur.id_usuario = $1::uuid AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())`,
      [createdUserId1],
    );
    expect(rolActual.rows[0].codigo).toBe('DIRECTOR');
  });

  it('8. POST /api/v1/admin/usuarios rechaza crear usuario si el DNI pertenece a una persona con identidad discrepante', async () => {
    // testDni1 está registrado como Carlos Alberto Bustamante
    const res = await supertest(app)
      .post('/api/v1/admin/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tipoDocumento: 'DNI',
        numeroDocumento: testDni1, // Mismo DNI pero nombres totalmente diferentes
        nombres: 'Roberto',
        apellidos: 'Gomez Bolaños',
        correo: 'roberto.gomez@iestpsuiza.edu.pe',
        usuario: 'roberto_gomez_test',
        password: 'PasswordSegura2026!',
        rolId: 'ESPECIALISTA',
        areaId: areaSdaId,
        activo: true,
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DISCREPANCIA_IDENTIDAD_DOCUMENTO');
  });

  it('9. PUT /api/v1/admin/usuarios/:id bloquea modificar nombres si la persona tiene una cuenta ciudadana preexistente', async () => {
    const validHash = await Argon2Service.hash('PasswordSegura2026!');
    // Simular que esta misma persona física tiene una cuenta de ciudadano preexistente
    const cuentaCiudadanoRes = await pool.query<{ id_usuario: string }>(
      `INSERT INTO sigd_auth.cuenta_usuario (id_persona, usuario, correo, password_hash, activo)
       VALUES (
         (SELECT id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid),
         'ciudadano_test_dni1',
         'ciudadano.personal@gmail.com',
         $2,
         true
       ) RETURNING id_usuario`,
      [createdUserId1, validHash],
    );
    const idCuentaCiudadano = cuentaCiudadanoRes.rows[0].id_usuario;

    // Asignar rol CIUDADANO a esa cuenta secundaria
    const rolCiudadanoRes = await pool.query<{ rol_id: string }>(
      `SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'CIUDADANO' LIMIT 1`,
    );
    if (rolCiudadanoRes.rows[0]) {
      await pool.query(
        `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id, vigente_desde)
         VALUES ($1::uuid, $2::uuid, now())`,
        [idCuentaCiudadano, rolCiudadanoRes.rows[0].rol_id],
      );
    }

    try {
      // Intentar editar los nombres del trabajador institucional con nombres distintos
      const res = await supertest(app)
        .put(`/api/v1/admin/usuarios/${createdUserId1}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombres: 'Carlos Mutado',
          apellidos: 'Apellidos Ficticios',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SOBRESCRITURA_IDENTIDAD_CIUDADANA_PROHIBIDA');
    } finally {
      // Limpieza de cuenta ciudadana de prueba
      await pool.query(`DELETE FROM sigd_org.usuario_rol WHERE id_usuario = $1::uuid`, [idCuentaCiudadano]);
      await pool.query(`DELETE FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`, [idCuentaCiudadano]);
    }
  });
});
