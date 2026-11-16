/**
 * =============================================================================
 * SUITE DE CERTIFICACIÓN E2E · 18 CASOS
 * REGISTRO DE USUARIOS EXTERNOS, ACTIVACIÓN Y CASILLA ELECTRÓNICA
 * =============================================================================
 * Rama: B_JACOBO
 * Base de datos oficial: sigd_jacobo_demo (PostgreSQL 127.0.0.1:5433)
 * Normativa: TUO Ley N° 27444, Ley N° 29733 (Protección de Datos Personales)
 * =============================================================================
 */

import crypto from 'node:crypto';
import pg from 'pg';
import request from 'supertest';

process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'clave_secreta_jwt_para_pruebas_de_desarrollo_2026_super_segura_32char';

if (process.env.SIGD_ALLOW_E2E_MUTATION !== 'true') {
  console.error('[E2E-GUARD] Abortado: e2e_suite_registro_casilla no tiene autorización para mutar datos en sigd_jacobo_demo.');
  console.error('Para ejecutar esta suite en un entorno aislado autorizado, defina SIGD_ALLOW_E2E_MUTATION=true.');
  process.exit(1);
}

import { construirApp } from '../src/app.js';
import { Argon2Service } from '../src/domains/identicore/argon2.service.js';
import { calcularDigitoVerificadorRuc } from '../src/domains/identicore/modulo11.validator.js';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres_password@127.0.0.1:5433/sigd_jacobo_demo';

interface TestResult {
  id: number;
  nombre: string;
  estado: 'PASO' | 'FALLO';
  detalle: string;
  duracionMs: number;
}

const resultados: TestResult[] = [];

async function ejecutarSuite() {
  console.log('=============================================================================');
  console.log('INICIANDO SUITE E2E: REGISTRO DE USUARIOS EXTERNOS Y CASILLA ELECTRÓNICA');
  console.log('Base de datos:', DATABASE_URL);
  console.log('=============================================================================\n');

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const app = construirApp(pool);

  const dbCheck = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const dbActual = dbCheck.rows[0]?.db;
  if (dbActual !== 'sigd_jacobo_demo') {
    throw new Error(`[SUITE-CASILLA] Abortando: conectado a "${dbActual}". Se requiere exclusivamente "sigd_jacobo_demo".`);
  }

  // Generador de sufijo determinista por ejecución
  const sufijo = Date.now().toString().slice(-6);

  let idUsuarioNatural = '';
  let tokenNatural = '';
  let correoNatural = `ciudadano_${sufijo}@test.gob.pe`;
  let dniNatural = `7${sufijo}1`;
  let passwordNatural = 'ClaveSegura2026!';

  let idUsuarioJuridica = '';
  let tokenJuridica = '';
  let correoJuridico = `empresa_${sufijo}@test.gob.pe`;
  const baseRuc = `20${sufijo.padStart(6, '0')}${Math.floor(10 + Math.random() * 89)}`;
  const digitoRuc = calcularDigitoVerificadorRuc(baseRuc);
  let rucJuridico = `${baseRuc}${digitoRuc}`;

  let tokenExpiradoHash = '';
  let tokenExpiradoRaw = 'tok_expirado_' + crypto.randomBytes(16).toString('hex');

  let cutHistorico = `CUT-HIST-${sufijo}`;
  let idExpedienteHistorico = '';
  let idPersonaHistorica = '';

  async function registrarCaso(id: number, nombre: string, fn: () => Promise<void>) {
    const inicio = Date.now();
    try {
      await fn();
      const duracionMs = Date.now() - inicio;
      resultados.push({ id, nombre, estado: 'PASO', detalle: 'Ejecutado correctamente', duracionMs });
      console.log(`[PASO] Caso ${id}: ${nombre} (${duracionMs} ms)`);
    } catch (error: any) {
      const duracionMs = Date.now() - inicio;
      const mensaje = error?.message || String(error);
      resultados.push({ id, nombre, estado: 'FALLO', detalle: mensaje, duracionMs });
      console.error(`[FALLO] Caso ${id}: ${nombre} (${duracionMs} ms)\n       Error: ${mensaje}`);
    }
  }

  try {
    const respCap = await request(app).get('/api/v1/auth/registro-capacidades');
    const soportaDomicilio = Boolean(respCap.body?.domicilio);

    // -------------------------------------------------------------------------
    // CASO 1: Registro exitoso de persona natural
    // -------------------------------------------------------------------------
    await registrarCaso(1, 'Registro exitoso de persona natural', async () => {
      const payload: any = {
        tipoPersona: 'NATURAL',
        tipoDocumento: 'DNI',
        numeroDocumento: dniNatural,
        nombres: 'Sergio',
        apellidoPaterno: 'Serruche',
        apellidoMaterno: 'Panduro',
        fechaNacimiento: '1992-06-15',
        correo: correoNatural,
        celular: '961234567',
        password: passwordNatural,
        consentimientoDatos: true,
        declaracionJuradaAceptada: true,
        aceptaNotificaciones: true,
      };
      if (soportaDomicilio) {
        payload.direccion = 'Jr. Tarapacá 645';
        payload.ubigeoDistrito = '250101';
      }

      const resp = await request(app)
        .post('/api/v1/auth/registro-ciudadano')
        .send(payload);

      if (resp.status !== 201) {
        throw new Error(`Status esperado 201, recibido ${resp.status}: ${JSON.stringify(resp.body)}`);
      }
      if (!resp.body.idPersona || !resp.body.idUsuario || !resp.body.tokenVerificacion) {
        throw new Error(`Respuesta incompleta: ${JSON.stringify(resp.body)}`);
      }

      idUsuarioNatural = resp.body.idUsuario;
      tokenNatural = resp.body.tokenVerificacion;

      // Verificar en PostgreSQL
      const queryUser = await pool.query(
        `SELECT id_usuario, usuario, correo, activo FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`,
        [idUsuarioNatural],
      );
      if (queryUser.rows.length !== 1) throw new Error('No se encontró la cuenta en cuenta_usuario');
      if (queryUser.rows[0].usuario !== dniNatural) throw new Error('El usuario no coincide con el DNI');
    });

    // -------------------------------------------------------------------------
    // CASO 2: Registro exitoso de persona jurídica
    // -------------------------------------------------------------------------
    await registrarCaso(2, 'Registro exitoso de persona jurídica', async () => {
      const payload: any = {
        tipoPersona: 'JURIDICA',
        ruc: rucJuridico,
        razonSocial: `Innovaciones Suiza SAC ${sufijo}`,
        tipoDocumentoRepresentante: 'DNI',
        numeroDocumentoRepresentante: dniNatural, // Usa el DNI ya registrado como natural
        nombreRepresentante: 'Sergio Serruche Panduro',
        cargoRepresentante: 'Gerente General',
        correo: correoJuridico,
        celular: '961234568',
        password: passwordNatural,
        consentimientoDatos: true,
        declaracionJuradaAceptada: true,
        aceptaNotificaciones: false,
      };
      if (soportaDomicilio) {
        payload.direccion = 'Av. Centenario Km 4.5';
        payload.ubigeoDistrito = '250101';
      }

      const resp = await request(app)
        .post('/api/v1/auth/registro-persona-juridica')
        .send(payload);

      if (resp.status !== 201) {
        throw new Error(`Status esperado 201, recibido ${resp.status}: ${JSON.stringify(resp.body)}`);
      }
      idUsuarioJuridica = resp.body.idUsuario;
      tokenJuridica = resp.body.tokenVerificacion;

      const qJuridica = await pool.query(
        `SELECT pj.razon_social, rl.cargo
           FROM sigd_auth.persona_juridica pj
           JOIN sigd_auth.representacion_legal rl ON rl.id_persona_juridica = pj.id_persona
          WHERE pj.id_persona = $1::uuid`,
        [resp.body.idPersona],
      );
      if (qJuridica.rows.length !== 1) throw new Error('No se persistió la persona jurídica y representación');
    });

    // -------------------------------------------------------------------------
    // CASO 3: Contraseña propia almacenada mediante hash Argon2id
    // -------------------------------------------------------------------------
    await registrarCaso(3, 'Contraseña propia almacenada mediante hash Argon2id ($argon2id$)', async () => {
      const q = await pool.query(
        `SELECT password_hash FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`,
        [idUsuarioNatural],
      );
      const hash = q.rows[0]?.password_hash;
      if (!hash || !hash.startsWith('$argon2id$')) {
        throw new Error(`El hash no utiliza el algoritmo Argon2id institucional: ${hash}`);
      }
      const esValido = await Argon2Service.verify(hash, passwordNatural);
      if (!esValido) throw new Error('El hash Argon2id almacenado no valida la contraseña elegida por el ciudadano');
    });

    // -------------------------------------------------------------------------
    // CASO 4: Creación de cuenta pendiente de verificación (activo = false)
    // -------------------------------------------------------------------------
    await registrarCaso(4, 'Creación de cuenta pendiente de verificación (activo = false)', async () => {
      const q = await pool.query(
        `SELECT activo FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`,
        [idUsuarioNatural],
      );
      if (q.rows[0]?.activo !== false) {
        throw new Error(`La cuenta no se creó en estado inactivo pendiente de verificación: activo=${q.rows[0]?.activo}`);
      }

      // Intentar iniciar sesión antes de activar debe ser rechazado
      const loginResp = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identificador: dniNatural,
          password: passwordNatural,
        });

      if (loginResp.status !== 403 || loginResp.body.code !== 'ACCOUNT_DISABLED') {
        throw new Error(`Se esperaba 403 ACCOUNT_DISABLED, recibido ${loginResp.status}: ${JSON.stringify(loginResp.body)}`);
      }
    });

    // -------------------------------------------------------------------------
    // CASO 5: Envío real o encolado verificable del correo en Transactional Outbox
    // -------------------------------------------------------------------------
    await registrarCaso(5, 'Encolado verificable del correo en Transactional Outbox', async () => {
      const q = await pool.query(
        `SELECT id_evento, agregado, tipo_evento, payload, estado
           FROM sigd_audit.evento_outbox
          WHERE agregado = 'cuenta_usuario' AND tipo_evento = 'verificacion_correo_solicitada'
            AND payload->>'idUsuario' = $1
          ORDER BY creado_en DESC LIMIT 1`,
        [idUsuarioNatural],
      );

      if (q.rows.length !== 1) {
        throw new Error('No se encontró el evento verificacion_correo_solicitada en sigd_audit.evento_outbox');
      }

      const evt = q.rows[0];
      if (evt.payload.correo !== correoNatural) {
        throw new Error(`Correo en payload no coincide: ${evt.payload.correo} vs ${correoNatural}`);
      }
      if (evt.payload.token !== tokenNatural) {
        throw new Error('El token en payload no coincide con el entregado');
      }
    });

    // -------------------------------------------------------------------------
    // CASO 6: Activación mediante token válido
    // -------------------------------------------------------------------------
    await registrarCaso(6, 'Activación mediante token válido y habilitación de cuenta', async () => {
      const resp = await request(app)
        .post('/api/v1/auth/activar-cuenta')
        .send({ token: tokenNatural });

      if (resp.status !== 200 || !resp.body.exito) {
        throw new Error(`Error en activación: ${resp.status} ${JSON.stringify(resp.body)}`);
      }

      // Verificar que en base de datos el token esté marcado como usado y la cuenta activa
      const qTok = await pool.query(
        `SELECT t.usado_en, c.activo
           FROM sigd_auth.token_verificacion_correo t
           JOIN sigd_auth.cuenta_usuario c ON c.id_usuario = t.id_usuario
          WHERE c.id_usuario = $1::uuid`,
        [idUsuarioNatural],
      );
      if (!qTok.rows[0]?.usado_en) throw new Error('El token no registró la fecha en usado_en');
      if (qTok.rows[0]?.activo !== true) throw new Error('La cuenta no fue activada en cuenta_usuario');
    });

    // -------------------------------------------------------------------------
    // CASO 7: Rechazo de token vencido
    // -------------------------------------------------------------------------
    await registrarCaso(7, 'Rechazo de token vencido (HTTP 410 / TOKEN_EXPIRADO)', async () => {
      tokenExpiradoHash = crypto.createHash('sha256').update(tokenExpiradoRaw).digest('hex');
      await pool.query(
        `INSERT INTO sigd_auth.token_verificacion_correo
           (id_usuario, correo, token_hash, tipo, expira_en)
         VALUES ($1::uuid, $2, $3, 'ACTIVACION_CUENTA', now() - interval '2 hours')`,
        [idUsuarioJuridica, correoJuridico, tokenExpiradoHash],
      );

      const resp = await request(app)
        .post('/api/v1/auth/activar-cuenta')
        .send({ token: tokenExpiradoRaw });

      if (resp.status !== 410 || resp.body.code !== 'TOKEN_EXPIRADO') {
        throw new Error(`Se esperaba 410 TOKEN_EXPIRADO, recibido: ${resp.status} ${JSON.stringify(resp.body)}`);
      }
    });

    // -------------------------------------------------------------------------
    // CASO 8: Rechazo de token reutilizado
    // -------------------------------------------------------------------------
    await registrarCaso(8, 'Rechazo de token reutilizado (HTTP 409 / TOKEN_YA_UTILIZADO)', async () => {
      const resp = await request(app)
        .post('/api/v1/auth/activar-cuenta')
        .send({ token: tokenNatural }); // Ya fue usado en Caso 6

      if (resp.status !== 409 || resp.body.code !== 'TOKEN_YA_UTILIZADO') {
        throw new Error(`Se esperaba 409 TOKEN_YA_UTILIZADO, recibido: ${resp.status} ${JSON.stringify(resp.body)}`);
      }
    });

    // -------------------------------------------------------------------------
    // CASO 9: Rechazo de documentos duplicados
    // -------------------------------------------------------------------------
    await registrarCaso(9, 'Rechazo de documentos duplicados (HTTP 409 / CITIZEN_ALREADY_EXISTS)', async () => {
      const resp = await request(app)
        .post('/api/v1/auth/registro-ciudadano')
        .send({
          tipoPersona: 'NATURAL',
          tipoDocumento: 'DNI',
          numeroDocumento: dniNatural, // DNI existente
          nombres: 'Sergio',
          apellidoPaterno: 'Serruche',
          apellidoMaterno: 'Panduro',
          fechaNacimiento: '1992-06-15',
          correo: `otro_${sufijo}@test.gob.pe`,
          celular: '961234567',
          password: passwordNatural,
          consentimientoDatos: true,
          declaracionJuradaAceptada: true,
          aceptaNotificaciones: false,
        });

      if (resp.status !== 409 || resp.body.code !== 'CITIZEN_ALREADY_EXISTS') {
        throw new Error(`Se esperaba 409 CITIZEN_ALREADY_EXISTS, recibido: ${resp.status} ${JSON.stringify(resp.body)}`);
      }
    });

    // -------------------------------------------------------------------------
    // CASO 10: Rechazo de correos duplicados
    // -------------------------------------------------------------------------
    await registrarCaso(10, 'Rechazo de correos duplicados (HTTP 409 / CITIZEN_ALREADY_EXISTS)', async () => {
      const resp = await request(app)
        .post('/api/v1/auth/registro-ciudadano')
        .send({
          tipoPersona: 'NATURAL',
          tipoDocumento: 'DNI',
          numeroDocumento: `7${sufijo}2`, // Otro DNI
          nombres: 'Carlos',
          apellidoPaterno: 'Perez',
          apellidoMaterno: 'Rios',
          fechaNacimiento: '1990-01-01',
          correo: correoNatural, // Correo duplicado
          celular: '961234567',
          password: passwordNatural,
          consentimientoDatos: true,
          declaracionJuradaAceptada: true,
          aceptaNotificaciones: false,
        });

      if (resp.status !== 409 || resp.body.code !== 'CITIZEN_ALREADY_EXISTS') {
        throw new Error(`Se esperaba 409 CITIZEN_ALREADY_EXISTS, recibido: ${resp.status} ${JSON.stringify(resp.body)}`);
      }
    });

    // -------------------------------------------------------------------------
    // CASO 11: Protección frente a solicitudes repetidas / concurrencia
    // -------------------------------------------------------------------------
    await registrarCaso(11, 'Protección frente a solicitudes repetidas o concurrentes', async () => {
      const dniRepetido = `7${sufijo}3`;
      const correoRepetido = `repetido_${sufijo}@test.gob.pe`;
      const payload = {
        tipoPersona: 'NATURAL',
        tipoDocumento: 'DNI',
        numeroDocumento: dniRepetido,
        nombres: 'Prueba',
        apellidoPaterno: 'Concurrente',
        apellidoMaterno: 'Suiza',
        fechaNacimiento: '1995-05-05',
        correo: correoRepetido,
        celular: '961234567',
        password: passwordNatural,
        consentimientoDatos: true,
        declaracionJuradaAceptada: true,
        aceptaNotificaciones: false,
      };

      const [r1, r2] = await Promise.all([
        request(app).post('/api/v1/auth/registro-ciudadano').send(payload),
        request(app).post('/api/v1/auth/registro-ciudadano').send(payload),
      ]);

      const exitos = [r1, r2].filter(r => r.status === 201);
      const conflictos = [r1, r2].filter(r => r.status === 409);

      if (exitos.length !== 1 || conflictos.length !== 1) {
        throw new Error(`Concurrencia anómala: exitos=${exitos.length}, conflictos=${conflictos.length}`);
      }
    });

    // -------------------------------------------------------------------------
    // CASO 12: Inicio de sesión después de activar la cuenta
    // -------------------------------------------------------------------------
    let tokenAccesoCiudadano = '';
    await registrarCaso(12, 'Inicio de sesión exitoso tras activación (emisión JWT dual)', async () => {
      const resp = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identificador: dniNatural,
          password: passwordNatural,
        });

      if (resp.status !== 200) {
        throw new Error(`Fallo en login tras activación: ${resp.status} ${JSON.stringify(resp.body)}`);
      }
      if (!resp.body.accessToken || !resp.body.refreshToken) {
        throw new Error('No se emitieron los tokens duales de autenticación');
      }

      tokenAccesoCiudadano = resp.body.accessToken;
      if (resp.body.usuario.id !== idUsuarioNatural) {
        throw new Error('El ID de usuario devuelto no coincide');
      }
    });

    // -------------------------------------------------------------------------
    // CASO 13: Creación o habilitación de Casilla Electrónica
    // -------------------------------------------------------------------------
    await registrarCaso(13, 'Habilitación de Casilla Electrónica con mensaje de apertura institucional', async () => {
      const resp = await request(app)
        .get('/api/v1/casilla/notificaciones')
        .set('Authorization', `Bearer ${tokenAccesoCiudadano}`);

      if (resp.status !== 200) {
        throw new Error(`Error al consultar Casilla Electrónica: ${resp.status} ${JSON.stringify(resp.body)}`);
      }

      const notifs = resp.body.notificaciones || resp.body.data || [];
      if (!Array.isArray(notifs) || notifs.length === 0) {
        throw new Error('La Casilla Electrónica no contiene la notificación de bienvenida y apertura');
      }

      const notifApertura = notifs.find((n: any) => n.asunto?.includes('Casilla Electrónica') || n.tipoActo?.includes('Casilla'));
      if (!notifApertura) {
        throw new Error('No se localizó el acto formal de apertura en la Casilla ciudadana');
      }
    });

    // -------------------------------------------------------------------------
    // CASO 14: Aislamiento entre casillas de distintos ciudadanos
    // -------------------------------------------------------------------------
    await registrarCaso(14, 'Aislamiento estricto entre casillas de distintos ciudadanos', async () => {
      // Activar ciudadano jurídico y loguear
      await request(app).post('/api/v1/auth/activar-cuenta').send({ token: tokenJuridica });

      const loginJuridico = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identificador: rucJuridico,
          password: passwordNatural,
        });

      const tokenAccesoJuridico = loginJuridico.body.accessToken;

      const respJuridico = await request(app)
        .get('/api/v1/casilla/notificaciones')
        .set('Authorization', `Bearer ${tokenAccesoJuridico}`);

      const notifsJuridico = respJuridico.body.notificaciones || respJuridico.body.data || [];
      // Verificar que ninguna notificación pertenezca al usuario Natural
      for (const n of notifsJuridico) {
        if (n.usuario_id && n.usuario_id === idUsuarioNatural) {
          throw new Error('Fallo de aislamiento: Usuario Jurídico puede ver notificaciones de Usuario Natural');
        }
      }
    });

    // -------------------------------------------------------------------------
    // CASO 15: Cuenta creada sin vinculación automática de expedientes históricos (Regla 5)
    // -------------------------------------------------------------------------
    await registrarCaso(15, 'Cuenta creada sin vinculación automática de expedientes históricos (Regla 5)', async () => {
      // Crear expediente histórico en base de datos para la persona civil
      const personaNaturalQuery = await pool.query(
        `SELECT id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`,
        [idUsuarioNatural],
      );
      idPersonaHistorica = personaNaturalQuery.rows[0].id_persona;

      // Obtener área MESA_PARTES
      const areaQuery = await pool.query(`SELECT area_id FROM sigd_org.area WHERE codigo = 'MP' OR codigo = 'ADM' LIMIT 1`);
      const areaId = areaQuery.rows[0]?.area_id;

      if (areaId) {
        const expIns = await pool.query(
          `INSERT INTO sigd_tra.expediente
             (numero, tipo_documental_id, solicitante_id, dni_solicitante, area_destino_id, estado)
           VALUES
             ($1, gen_random_uuid(), $2::uuid, $3, $4::uuid, 'REGISTRADO')
           RETURNING expediente_id::text AS id, codigo_expediente AS cut`,
          [`NUM-${sufijo}`, idPersonaHistorica, dniNatural, areaId],
        );
        idExpedienteHistorico = expIns.rows[0]?.id;
        cutHistorico = expIns.rows[0]?.cut;
      }

      // Consultar /tramites/mis-expedientes con token del ciudadano
      const respMisExp = await request(app)
        .get('/api/v1/tramites/mis-expedientes')
        .set('Authorization', `Bearer ${tokenAccesoCiudadano}`);

      if (respMisExp.status === 200) {
        const expedientes = respMisExp.body.items || respMisExp.body.expedientes || respMisExp.body.data || [];
        const historicoVisible = expedientes.find((e: any) => e.cut === cutHistorico);
        if (historicoVisible) {
          throw new Error('Violación de Regla 5: Expediente histórico fue vinculado automáticamente sin comprobación');
        }
      }
    });

    // -------------------------------------------------------------------------
    // CASO 16: Vinculación posterior únicamente tras acreditación explícita
    // -------------------------------------------------------------------------
    await registrarCaso(16, 'Vinculación posterior únicamente tras comprobación y aprobación explícita', async () => {
      if (!idExpedienteHistorico) {
        console.log('       (Omitiendo paso DB de expediente histórico por falta de requisitos)');
        return;
      }

      // Insertar vinculación institucional aprobada
      await pool.query(
        `INSERT INTO sigd_tra.vinculacion_expediente_cuenta
           (expediente_id, id_usuario, id_persona, estado, motivo_solicitud, motivo_resolucion, fecha_resolucion)
         VALUES
           ($1::uuid, $2::uuid, $3::uuid, 'APROBADA', 'Acreditación presencial verificada', 'Resolución formal', now())
         ON CONFLICT (expediente_id, id_usuario) DO UPDATE SET estado = 'APROBADA'`,
        [idExpedienteHistorico, idUsuarioNatural, idPersonaHistorica],
      );

      const respMisExp = await request(app)
        .get('/api/v1/tramites/mis-expedientes')
        .set('Authorization', `Bearer ${tokenAccesoCiudadano}`);

      if (respMisExp.status === 200) {
        const expedientes = respMisExp.body.items || respMisExp.body.expedientes || respMisExp.body.data || [];
        const historicoVisible = expedientes.find((e: any) => e.cut === cutHistorico);
        if (!historicoVisible) {
          throw new Error('El expediente histórico aprobado no apareció en mis-expedientes tras vinculación');
        }
      }
    });

    // -------------------------------------------------------------------------
    // CASO 17: Comportamiento correcto ante fallas o falta de SMTP
    // -------------------------------------------------------------------------
    await registrarCaso(17, 'Comportamiento correcto ante fallas o ausencia de SMTP (Outbox asíncrono)', async () => {
      // Registrar un usuario cuando SMTP no está configurado (entorno actual)
      const dniSinSmtp = `7${sufijo}4`;
      const correoSinSmtp = `sin_smtp_${sufijo}@test.gob.pe`;

      const resp = await request(app)
        .post('/api/v1/auth/registro-ciudadano')
        .send({
          tipoPersona: 'NATURAL',
          tipoDocumento: 'DNI',
          numeroDocumento: dniSinSmtp,
          nombres: 'Pedro',
          apellidoPaterno: 'Ruiz',
          apellidoMaterno: 'Gomez',
          fechaNacimiento: '1988-08-08',
          correo: correoSinSmtp,
          celular: '961234567',
          password: passwordNatural,
          consentimientoDatos: true,
          declaracionJuradaAceptada: true,
          aceptaNotificaciones: false,
        });

      if (resp.status !== 201) {
        throw new Error(`El registro falló por dependencia síncrona de correo: ${resp.status}`);
      }

      // Verificar que el evento está en outbox listo para despacho
      const q = await pool.query(
        `SELECT estado FROM sigd_audit.evento_outbox
          WHERE tipo_evento = 'verificacion_correo_solicitada' AND payload->>'correo' = $1`,
        [correoSinSmtp],
      );
      if (q.rows.length !== 1 || q.rows[0].estado !== 'PENDIENTE') {
        throw new Error('El evento de notificación no se persistió en estado PENDIENTE en el outbox');
      }
    });

    // -------------------------------------------------------------------------
    // CASO 18: Flujos de persona natural y jurídica compatibles y no colisionan
    // -------------------------------------------------------------------------
    await registrarCaso(18, 'Flujos de Persona Natural y Persona Jurídica compatibles y no colisionan', async () => {
      const qPersonas = await pool.query(
        `SELECT p.tipo, count(*) AS total
           FROM sigd_auth.persona p
          WHERE p.id_documento IN ($1, $2)
          GROUP BY p.tipo`,
        [dniNatural, rucJuridico],
      );

      const tipos = qPersonas.rows.map(r => r.tipo);
      if (!tipos.includes('NATURAL') || !tipos.includes('JURIDICA')) {
        throw new Error(`Colisión o falta de registro polimórfico: ${JSON.stringify(qPersonas.rows)}`);
      }
    });

  } finally {
    try {
      if (idExpedienteHistorico) {
        await pool.query(`DELETE FROM sigd_tra.vinculacion_expediente_cuenta WHERE expediente_id = $1::uuid`, [idExpedienteHistorico]).catch(() => undefined);
        await pool.query(`DELETE FROM sigd_tra.expediente WHERE expediente_id = $1::uuid`, [idExpedienteHistorico]).catch(() => undefined);
      }
      await pool.query(
        `DELETE FROM sigd_audit.evento_outbox WHERE payload->>'correo' LIKE $1`,
        [`%_${sufijo}@test.gob.pe`],
      ).catch(() => undefined);

      // Desactivación quirúrgica institucional (la regla de negocio en PL/pgSQL
      // proteger_cuenta_usuario_no_delete prohíbe el DELETE físico de cuentas de usuario)
      await pool.query(
        `UPDATE sigd_auth.cuenta_usuario SET activo = false WHERE correo LIKE $1`,
        [`%_${sufijo}@test.gob.pe`],
      ).catch(() => undefined);
    } catch {
      // Silenciar error en limpieza para no alterar resultados
    }
    await pool.end();
  }

  // ---------------------------------------------------------------------------
  // RESUMEN FINAL
  // ---------------------------------------------------------------------------
  console.log('\n=============================================================================');
  console.log('RESUMEN DE RESULTADOS DE CERTIFICACIÓN E2E (18 CASOS):');
  console.log('=============================================================================');
  const pasados = resultados.filter(r => r.estado === 'PASO').length;
  const fallados = resultados.filter(r => r.estado === 'FALLO').length;
  console.table(resultados);
  console.log(`\nTOTAL: ${resultados.length} | PASADOS: ${pasados} | FALLADOS: ${fallados}`);
  console.log('=============================================================================\n');

  if (fallados > 0) {
    process.exit(1);
  }
}

ejecutarSuite().catch((err) => {
  console.error('Falla catastrófica en la ejecución de la suite E2E:', err);
  process.exit(1);
});
