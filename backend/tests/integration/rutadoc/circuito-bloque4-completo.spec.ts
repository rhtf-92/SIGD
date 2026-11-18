import 'dotenv/config';

process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'nKqasrFsaaDNEEQoEZ7_9MUcxDisFemA219Yp4mO94UuE-ausA7Eztrpy8P3eMoZKC3Z7-D5_4nM6h8SHfrL2g';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { construirApp } from '../../../src/app.js';
import { firmarTokenAcceso } from '../../../src/core/auth/jwt.service.js';
import { runWithContext } from '../../../src/shared/request-context/request-context.js';
import {
  resolverExpedienteConFirma,
  archivarExpediente,
  derivarExpediente,
} from '../../../src/domains/rutadoc/derivaciones.service.js';
import { DestinoCasilla } from '../../../src/audit/despachador-notificaciones.js';
import { ConflictError, DomainError, NotFoundError } from '../../../src/shared/domain/errors/index.js';

describe('SIGD — Bloque 4: Circuito Completo de Notificación, Casilla Electrónica y Archivado', () => {
  let realPool: Pool;
  let txClient: PoolClient;
  let pool: Pool;
  let app: any;
  let savepointCounter = 0;
  let queryChain: Promise<unknown> = Promise.resolve();

  function runSerialized<T>(fn: () => Promise<T>): Promise<T> {
    const next = queryChain.then(fn, fn);
    queryChain = next.catch(() => {});
    return next;
  }

  function createIsolatedPool(client: PoolClient): Pool {
    return {
      query: (text: any, params?: any) => runSerialized(() => client.query(text, params)),
      connect: async () => {
        const activeSavepoints: string[] = [];
        return {
          query: (text: any, params?: any) =>
            runSerialized(async () => {
              const sql = typeof text === 'string' ? text.trim().toUpperCase() : '';
              if (sql === 'BEGIN') {
                savepointCounter += 1;
                const sp = `sp_b4_${savepointCounter}`;
                activeSavepoints.push(sp);
                return client.query(`SAVEPOINT ${sp}`);
              }
              if (sql === 'COMMIT') {
                const sp = activeSavepoints.pop();
                return sp ? client.query(`RELEASE SAVEPOINT ${sp}`) : { rows: [], rowCount: 0 };
              }
              if (sql === 'ROLLBACK') {
                const sp = activeSavepoints.pop();
                return sp ? client.query(`ROLLBACK TO SAVEPOINT ${sp}`) : { rows: [], rowCount: 0 };
              }
              return client.query(text, params);
            }),
          release: () => {},
        } as unknown as PoolClient;
      },
      on: () => {},
    } as unknown as Pool;
  }

  const JWT_SECRET = process.env.AUTH_JWT_SECRET || 'nKqasrFsaaDNEEQoEZ7_9MUcxDisFemA219Yp4mO94UuE-ausA7Eztrpy8P3eMoZKC3Z7-D5_4nM6h8SHfrL2g';

  // Actores y Cuentas de Prueba
  const USER_DIRECTOR_DIR = '48b38966-150f-4fe6-8be6-ca9405c379b6';
  const AREA_DIR_ID = 'a0000000-0000-0000-0000-000000000002';

  const runSuffix = Math.floor(100000 + Math.random() * 899999);
  const userCiudadanoTitular = randomUUID();
  const personaTitularId = randomUUID();
  const dniTitular = `70${runSuffix}`;
  const correoTitular = `titular_${runSuffix}@iestp-suiza.edu.pe`;

  const userCiudadanoAjeno = randomUUID();
  const personaAjenaId = randomUUID();
  const dniAjeno = `80${runSuffix}`;
  const correoAjeno = `ajeno_${runSuffix}@iestp-suiza.edu.pe`;

  const userCiudadanoSinCuenta = randomUUID();
  const personaSinCuentaId = randomUUID();
  const dniSinCuenta = `90${runSuffix}`;
  const correoSinCuenta = `presencial_${runSuffix}@correo.com`;

  const testExpedienteTitularId = randomUUID();
  const testCutTitular = `EXP-2026-${Math.floor(800000 + Math.random() * 99999)}`;

  const testExpedienteSinCuentaId = randomUUID();
  const testCutSinCuenta = `EXP-2026-${Math.floor(700000 + Math.random() * 99999)}`;

  let resolucionDocId: string;
  let cvdResolucion: string;
  let hashResolucion: string;
  let tipoDocumentalResolucionId: string;
  let notificacionTitularId: string;

  function makeCtx(usuario_id: string) {
    return {
      correlation_id: randomUUID(),
      usuario_id,
      ip_origen: '127.0.0.1',
      user_agent: 'vitest-bloque4',
    };
  }

  const tokenTitular = () => firmarTokenAcceso({ sub: userCiudadanoTitular, roles: ['CIUDADANO'], secreto: JWT_SECRET });
  const tokenAjeno = () => firmarTokenAcceso({ sub: userCiudadanoAjeno, roles: ['CIUDADANO'], secreto: JWT_SECRET });
  const tokenSinCuenta = () => firmarTokenAcceso({ sub: userCiudadanoSinCuenta, roles: ['CIUDADANO'], secreto: JWT_SECRET });
  const tokenDirector = () => firmarTokenAcceso({ sub: USER_DIRECTOR_DIR, roles: ['DIRECTOR'], secreto: JWT_SECRET });

  beforeAll(async () => {
    realPool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres_password@172.20.157.19:5432/sigd_prueba',
    });
    txClient = await realPool.connect();
    await txClient.query('BEGIN');
    pool = createIsolatedPool(txClient);
    app = construirApp(pool);

    // 1. Obtener tipo documental para resoluciones
    const tdRes = await pool.query<{ tipo_documental_id: string }>(
      `SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE vigente = true LIMIT 1`,
    );
    tipoDocumentalResolucionId = tdRes.rows[0].tipo_documental_id;

    // 2. Registrar personas y cuentas de prueba para aislamiento
    // Persona A (Titular legítimo con cuenta activa)
    await pool.query(
      `INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento) VALUES ($1, 'NATURAL', $2)`,
      [personaTitularId, dniTitular],
    );
    await pool.query(
      `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo, telefono)
       VALUES ($1, 'Titular', 'Aprobado', 'Titular Aprobado', $2, '987111222')`,
      [personaTitularId, correoTitular],
    );
    await pool.query(
      `INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
       VALUES ($1, $2, $3, $4, '$argon2id$v=19$m=65536,t=3,p=4$fake_hash_titular', true)`,
      [userCiudadanoTitular, personaTitularId, `titular_${dniTitular}`, correoTitular],
    );

    // Persona B (Ciudadano ajeno con su propia cuenta)
    await pool.query(
      `INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento) VALUES ($1, 'NATURAL', $2)`,
      [personaAjenaId, dniAjeno],
    );
    await pool.query(
      `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo, telefono)
       VALUES ($1, 'Ajeno', 'Intruso', 'Ajeno Intruso', $2, '987333444')`,
      [personaAjenaId, correoAjeno],
    );
    await pool.query(
      `INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
       VALUES ($1, $2, $3, $4, '$argon2id$v=19$m=65536,t=3,p=4$fake_hash_ajeno', true)`,
      [userCiudadanoAjeno, personaAjenaId, `ajeno_${dniAjeno}`, correoAjeno],
    );

    // Persona C (Persona que tramitó en ventanilla presencial SIN cuenta creadora)
    await pool.query(
      `INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento) VALUES ($1, 'NATURAL', $2)`,
      [personaSinCuentaId, dniSinCuenta],
    );
    await pool.query(
      `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo, telefono)
       VALUES ($1, 'Presencial', 'SinCuenta', 'Presencial SinCuenta', $2, '987555666')`,
      [personaSinCuentaId, correoSinCuenta],
    );
    // Cuenta creada posteriormente por la persona C (para comprobar que no hereda por DNI sin vinculación)
    await pool.query(
      `INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
       VALUES ($1, $2, $3, $4, '$argon2id$v=19$m=65536,t=3,p=4$fake_hash_sincuenta', true)`,
      [userCiudadanoSinCuenta, personaSinCuentaId, `sincuenta_${dniSinCuenta}`, correoSinCuenta],
    );

    // 3. Crear Expediente del Titular en estado EN_FIRMA con creador autenticado
    await pool.query(
      `INSERT INTO sigd_tra.expediente (
         expediente_id, codigo_expediente, numero, tipo_documental_id,
         solicitante_id, area_destino_id, estado, fecha_radicacion, id_usuario_creador
       ) VALUES ($1, $2, $2, $3, $4, $5, 'EN_FIRMA', now(), $6)`,
      [testExpedienteTitularId, testCutTitular, tipoDocumentalResolucionId, personaTitularId, AREA_DIR_ID, userCiudadanoTitular],
    );
    await pool.query(
      `INSERT INTO sigd_tra.tramite (expediente_id, asunto, estado) VALUES ($1, 'Trámite con Resolución Directoral', 'EN_TRAMITE')`,
      [testExpedienteTitularId],
    );
    await pool.query(
      `INSERT INTO sigd_rut.movimiento_secuencia (expediente_id, ultima_secuencia) VALUES ($1, 1)
       ON CONFLICT (expediente_id) DO NOTHING`,
      [testExpedienteTitularId],
    );
    await pool.query(
      `INSERT INTO sigd_rut.estado_actual_expediente (
         expediente_id, secuencia, estado_nuevo, evento, area_actual_id, id_movimiento, fecha_hora, usuario_operador_id
       ) VALUES ($1, 1, 'EN_FIRMA', 'ENVIAR_A_FIRMA', $2, gen_random_uuid(), now(), 0)
       ON CONFLICT (expediente_id) DO UPDATE SET estado_nuevo = 'EN_FIRMA'`,
      [testExpedienteTitularId, AREA_DIR_ID],
    );

    // 4. Crear Expediente Presencial en estado RESUELTO SIN cuenta creadora (id_usuario_creador = NULL)
    await pool.query(
      `INSERT INTO sigd_tra.expediente (
         expediente_id, codigo_expediente, numero, tipo_documental_id,
         solicitante_id, area_destino_id, estado, fecha_radicacion, id_usuario_creador
       ) VALUES ($1, $2, $2, $3, $4, $5, 'RESUELTO', now(), NULL)`,
      [testExpedienteSinCuentaId, testCutSinCuenta, tipoDocumentalResolucionId, personaSinCuentaId, AREA_DIR_ID],
    );
    await pool.query(
      `INSERT INTO sigd_tra.tramite (expediente_id, asunto, estado) VALUES ($1, 'Trámite Presencial Sin Cuenta', 'REGISTRADO')`,
      [testExpedienteSinCuentaId],
    );
    await pool.query(
      `INSERT INTO sigd_rut.movimiento_secuencia (expediente_id, ultima_secuencia) VALUES ($1, 1)
       ON CONFLICT (expediente_id) DO NOTHING`,
      [testExpedienteSinCuentaId],
    );
    await pool.query(
      `INSERT INTO sigd_rut.estado_actual_expediente (
         expediente_id, secuencia, estado_nuevo, evento, area_actual_id, id_movimiento, fecha_hora, usuario_operador_id
       ) VALUES ($1, 1, 'RESUELTO', 'FIRMA', $2, gen_random_uuid(), now(), 0)
       ON CONFLICT (expediente_id) DO UPDATE SET estado_nuevo = 'RESUELTO'`,
      [testExpedienteSinCuentaId, AREA_DIR_ID],
    );
  });

  afterAll(async () => {
    try {
      if (txClient) {
        await txClient.query('ROLLBACK');
        txClient.release();
      }
    } finally {
      if (realPool) {
        await realPool.end();
      }
    }
  });

  // ===========================================================================
  // 1. RESUELTO sin evidencia válida de firma (Bloqueado)
  // ===========================================================================
  it('1. RESUELTO sin evidencia válida de firma: Intento de resolver expediente sin acto firmado es denegado con ConflictError', async () => {
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      await expect(
        runWithContext(makeCtx(USER_DIRECTOR_DIR), async () => {
          return await resolverExpedienteConFirma(tx, testExpedienteTitularId, {
            resultado_resumen: 'Intento de resolución sin acto firmado',
          });
        }),
      ).rejects.toThrow(ConflictError);
      await tx.query('ROLLBACK');

      // Verificar que el expediente sigue en EN_FIRMA
      const expRes = await pool.query('SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid', [testExpedienteTitularId]);
      expect(expRes.rows[0].estado).toBe('EN_FIRMA');
    } finally {
      tx.release();
    }
  });

  // ===========================================================================
  // 2. RESUELTO con resolución institucional firmada
  // ===========================================================================
  it('2. RESUELTO con resolución firmada: Firma institucional válida permite transición a RESUELTO y emite evento Outbox', async () => {
    resolucionDocId = randomUUID();
    cvdResolucion = `CVD-2026-B4-${Math.floor(100000 + Math.random() * 899999)}`;
    hashResolucion = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const s3KeyResolucion = `resoluciones/2026/${resolucionDocId}.pdf`;

    // A. Registrar documento oficial en sigd_doc.documento_adjunto (id_requisito IS NULL, resoluciones/)
    await pool.query(
      `INSERT INTO sigd_doc.documento_adjunto (
         documento_adjunto_id, expediente_tra_id, tipo_documental_id,
         nombre_archivo, s3_bucket, s3_key, sha256, tamano_bytes, mime_type, subido_por, creado_en
       ) VALUES ($1, $2, $3, 'Resolucion_RD-2026-000100.pdf', 'sigd-expedientes', $4, $5, 4096, 'application/pdf', $6, now())`,
      [resolucionDocId, testExpedienteTitularId, tipoDocumentalResolucionId, s3KeyResolucion, hashResolucion, USER_DIRECTOR_DIR],
    );

    // B. Registrar firma válida en sigd_doc.firma_digital_documento
    await pool.query(
      `INSERT INTO sigd_doc.firma_digital_documento (
         documento_id, cvd, sha256_firmado, firmante, estado, fecha_registro,
         fecha_sello_tsa, s3_bucket, s3_key, algoritmo_firma, proveedor_firma, documento_version
       ) VALUES ($1, $2, $3, 'DIRECTOR GENERAL IESTP SUIZA', 'FIRMADO_DIGITALMENTE', now(), now(), 'sigd-expedientes', $4, 'SHA256withRSA', 'DNIE_CANONICO', 1)`,
      [resolucionDocId, cvdResolucion, hashResolucion, s3KeyResolucion],
    );

    // C. Registrar resolución institucional en sigd_doc.resolucion
    await pool.query(
      `INSERT INTO sigd_doc.resolucion (
         resolucion_id, expediente_tra_id, numero_borrador, numero_resolucion, tipo_resolucion, asunto, estado, fecha_proyeccion, firmado_por, firmado_en
       ) VALUES ($1, $2, 'RD-2026-000100', 'RD-2026-000100', 'DIRECTORAL_ADMINISTRATIVA', 'Resolución Directoral de Aprobación', 'FIRMADA', CURRENT_DATE, $3, now())`,
      [resolucionDocId, testExpedienteTitularId, USER_DIRECTOR_DIR],
    );

    // D. Transición a RESUELTO vía resolverExpedienteConFirma
    const tx = await pool.connect();
    let resResolucion: any;
    try {
      await tx.query('BEGIN');
      resResolucion = await runWithContext(makeCtx(USER_DIRECTOR_DIR), async () => {
        return await resolverExpedienteConFirma(tx, testExpedienteTitularId, {
          resultado_resumen: 'Se aprueba formalmente la solicitud mediante RD-2026-000100',
          documento_respuesta_id: resolucionDocId,
        });
      });
      await tx.query('COMMIT');
    } catch (e) {
      await tx.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      tx.release();
    }

    expect(resResolucion.estado).toBe('RESUELTO');
    expect(resResolucion.movimiento_id).toBeDefined();

    // Comprobar estado en sigd_tra.expediente
    const expDb = await pool.query('SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid', [testExpedienteTitularId]);
    expect(expDb.rows[0].estado).toBe('RESUELTO');

    // Comprobar proyección en sigd_rut.estado_actual_expediente
    const rutDb = await pool.query('SELECT estado_nuevo FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid', [testExpedienteTitularId]);
    expect(rutDb.rows[0].estado_nuevo).toBe('RESUELTO');

    // Comprobar movimiento WORM registrado
    const movDb = await pool.query(
      'SELECT estado_anterior, evento, estado_nuevo FROM sigd_rut.movimiento_tramite WHERE id_movimiento = $1::uuid',
      [resResolucion.movimiento_id],
    );
    expect(movDb.rows[0]).toEqual({
      estado_anterior: 'EN_FIRMA',
      evento: 'FIRMA',
      estado_nuevo: 'RESUELTO',
    });
  });

  // ===========================================================================
  // 3. Notificación al destinatario correcto
  // ===========================================================================
  it('3. Notificación al destinatario correcto: Despachador asocia la notificación al titular legítimo de la cuenta creadora', async () => {
    const destinoCasilla = new DestinoCasilla(pool);
    const idEvento = randomUUID();

    const eventoResolutivo = {
      id_evento: idEvento,
      correlation_id: randomUUID(),
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteAtendido',
      payload: {
        cut: testCutTitular,
        expediente_id: testExpedienteTitularId,
        persona_id: personaTitularId,
        asunto: `Resolución de Trámite: ${testCutTitular}`,
        tipo_acto: 'RESOLUCION',
        subtipo: 'RESOLUCION_FIRMADA',
        resultado_resumen: 'Resolución aprobada y notificada a casilla electrónica',
        cvd: cvdResolucion,
        sha256: hashResolucion,
        documento_url: `resoluciones/2026/${resolucionDocId}.pdf`,
      },
      intentos: 0,
    };

    await destinoCasilla.despachar(eventoResolutivo as any);

    // Verificar en sigd_auth.notificacion_casilla
    const notifDb = await pool.query<{
      id: string;
      usuario_id: string;
      persona_id: string;
      cut: string;
      tipo_acto: string;
      estado: string;
      cvd: string;
      hash_sha256: string;
      idempotency_key: string;
    }>(
      `SELECT id, usuario_id, persona_id, cut, tipo_acto, estado, cvd, hash_sha256, idempotency_key
         FROM sigd_auth.notificacion_casilla
        WHERE cut = $1`,
      [testCutTitular],
    );

    expect(notifDb.rowCount).toBe(1);
    const notif = notifDb.rows[0];
    notificacionTitularId = notif.id;

    expect(notif.usuario_id).toBe(userCiudadanoTitular); // Destinatario legítimo
    expect(notif.persona_id).toBe(personaTitularId);
    expect(notif.cut).toBe(testCutTitular);
    expect(notif.tipo_acto).toBe('RESOLUCION');
    expect(notif.estado).toBe('PUESTA_A_DISPOSICION');
    expect(notif.cvd).toBe(cvdResolucion);
    expect(notif.hash_sha256).toBe(hashResolucion);
    expect(notif.idempotency_key).toBe(`notif:${idEvento}:casilla`);

    // Verificar evento en sigd_auth.notificacion_trazabilidad_evento
    const trazaDb = await pool.query<{ tipo_evento: string; canal: string; estado: string }>(
      `SELECT tipo_evento, canal, estado
         FROM sigd_auth.notificacion_trazabilidad_evento
        WHERE notificacion_id = $1::uuid`,
      [notificacionTitularId],
    );

    expect(trazaDb.rowCount).toBeGreaterThanOrEqual(1);
    expect(trazaDb.rows.some((r) => r.tipo_evento === 'PUESTA_A_DISPOSICION' && r.canal === 'CASILLA' && r.estado === 'REGISTRADO')).toBe(true);
  });

  // ===========================================================================
  // 4. Prevención de duplicados mediante clave idempotente
  // ===========================================================================
  it('4. Prevención de duplicados: Reintento del mismo evento con clave idempotente no duplica filas en casilla', async () => {
    const destinoCasilla = new DestinoCasilla(pool);
    const conteoInicial = await pool.query(
      `SELECT COUNT(*)::int AS total FROM sigd_auth.notificacion_casilla WHERE cut = $1`,
      [testCutTitular],
    );

    // Mismo evento (misma clave idempotency_key)
    const notifRow = await pool.query<{ idempotency_key: string }>(
      `SELECT idempotency_key FROM sigd_auth.notificacion_casilla WHERE cut = $1`,
      [testCutTitular],
    );
    const idEventoOriginal = notifRow.rows[0].idempotency_key.replace(/^notif:|:casilla$/g, '');

    const eventoDuplicado = {
      id_evento: idEventoOriginal,
      correlation_id: randomUUID(),
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteAtendido',
      payload: {
        cut: testCutTitular,
        expediente_id: testExpedienteTitularId,
        persona_id: personaTitularId,
        tipo_acto: 'RESOLUCION',
      },
      intentos: 1,
    };

    // Re-despacho
    await destinoCasilla.despachar(eventoDuplicado as any);

    const conteoFinal = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM sigd_auth.notificacion_casilla WHERE cut = $1`,
      [testCutTitular],
    );

    expect(conteoFinal.rows[0].total).toBe(conteoInicial.rows[0].total);
    expect(conteoFinal.rows[0].total).toBe(1);
  });

  // ===========================================================================
  // 5. Ciudadano sin cuenta y sin vinculación histórica
  // ===========================================================================
  it('5. Ciudadano sin cuenta y sin vinculación histórica: Notificación queda con usuario_id = NULL y NO es visible sin acreditación aprobada', async () => {
    const destinoCasilla = new DestinoCasilla(pool);
    const idEventoSinCuenta = randomUUID();

    const eventoPresencial = {
      id_evento: idEventoSinCuenta,
      correlation_id: randomUUID(),
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteAtendido',
      payload: {
        cut: testCutSinCuenta,
        expediente_id: testExpedienteSinCuentaId,
        persona_id: personaSinCuentaId,
        asunto: `Resolución Presencial: ${testCutSinCuenta}`,
        tipo_acto: 'RESOLUCION',
        subtipo: 'RESOLUCION_FIRMADA',
        resultado_resumen: 'Atención presencial registrada',
      },
      intentos: 0,
    };

    await destinoCasilla.despachar(eventoPresencial as any);

    // 1. En la base de datos, usuario_id queda estrictamente en NULL
    const notifPresencial = await pool.query<{ id: string; usuario_id: string | null; cut: string }>(
      `SELECT id, usuario_id, cut FROM sigd_auth.notificacion_casilla WHERE cut = $1`,
      [testCutSinCuenta],
    );
    expect(notifPresencial.rowCount).toBe(1);
    expect(notifPresencial.rows[0].usuario_id).toBeNull(); // NO asigna cuenta por mera coincidencia de DNI

    // 2. Consulta desde la API de Casilla por la cuenta sin vinculación formal: NO puede verla
    const resCasillaSinVinc = await request(app)
      .get('/api/v1/casilla/notificaciones')
      .set('Authorization', `Bearer ${tokenSinCuenta()}`);

    expect(resCasillaSinVinc.status).toBe(200);
    const veNotif = resCasillaSinVinc.body.notificaciones?.some((n: any) => n.cut === testCutSinCuenta);
    expect(veNotif).toBe(false);

    // 3. Cuando existe vinculación formal APROBADA por Mesa de Partes:
    await pool.query(
      `INSERT INTO sigd_tra.solicitud_vinculacion_expediente (
         id_solicitud, expediente_id, id_usuario, persona_id, estado, motivo_solicitud, solicitado_en, resuelto_en
       ) VALUES ($1, $2, $3, $4, 'APROBADA', 'Acreditación presencial de DNI en sede', now(), now())`,
      [randomUUID(), testExpedienteSinCuentaId, userCiudadanoSinCuenta, personaSinCuentaId],
    );

    // Ahora la consulta de Casilla autoriza el acceso legítimo conforme a la Ley N° 27444
    const resCasillaConVinc = await request(app)
      .get('/api/v1/casilla/notificaciones')
      .set('Authorization', `Bearer ${tokenSinCuenta()}`);

    expect(resCasillaConVinc.status).toBe(200);
    const veNotifAprobada = resCasillaConVinc.body.notificaciones?.some((n: any) => n.cut === testCutSinCuenta);
    expect(veNotifAprobada).toBe(true);
  });

  // ===========================================================================
  // 6. Acceso autorizado y denegado a documentos (BOLA)
  // ===========================================================================
  it('6. Acceso autorizado y denegado a documentos: BOLA bloquea acceso de terceros y genera URL presigned para titular', async () => {
    // A. Titular legítimo accede a su notificación
    const resDetalleTitular = await request(app)
      .get(`/api/v1/casilla/notificaciones/${notificacionTitularId}`)
      .set('Authorization', `Bearer ${tokenTitular()}`);

    expect(resDetalleTitular.status).toBe(200);
    expect(resDetalleTitular.body.id).toBe(notificacionTitularId);
    expect(resDetalleTitular.body.cut).toBe(testCutTitular);
    expect(resDetalleTitular.body.cvd).toBe(cvdResolucion);

    // B. Titular legítimo solicita enlace seguro de descarga de documento
    const resDescargaTitular = await request(app)
      .get(`/api/v1/casilla/notificaciones/${notificacionTitularId}/documento/descargar`)
      .set('Authorization', `Bearer ${tokenTitular()}`);

    expect(resDescargaTitular.status).toBe(200);
    expect(resDescargaTitular.body.downloadUrl).toBeDefined();
    expect(resDescargaTitular.body.expiraEnSegundos).toBe(900);
    // No expone credenciales ni rutas internas en texto plano
    expect(resDescargaTitular.body.downloadUrl).toContain('X-Amz-Signature');

    // C. Ciudadano ajeno intenta consultar la notificación de Titular (Protección BOLA)
    const resBOLA = await request(app)
      .get(`/api/v1/casilla/notificaciones/${notificacionTitularId}`)
      .set('Authorization', `Bearer ${tokenAjeno()}`);

    expect(resBOLA.status).toBe(404); // Fail-closed

    // D. Ciudadano ajeno intenta descargar el documento del Titular (Protección BOLA)
    const resDescargaBOLA = await request(app)
      .get(`/api/v1/casilla/notificaciones/${notificacionTitularId}/documento/descargar`)
      .set('Authorization', `Bearer ${tokenAjeno()}`);

    expect(resDescargaBOLA.status).toBe(404);
  });

  // ===========================================================================
  // 7. Registro fehaciente de entrega, acceso y acuse
  // ===========================================================================
  it('7. Registro de entrega, acceso y acuse: Distingue depósito, primera lectura y acuse inmutable', async () => {
    // A. Primera lectura / visualización
    const resLectura = await request(app)
      .patch(`/api/v1/casilla/notificaciones/${notificacionTitularId}/lectura`)
      .set('Authorization', `Bearer ${tokenTitular()}`);

    expect(resLectura.status).toBe(200);
    expect(resLectura.body.estado).toBe('LEIDO');
    expect(resLectura.body.leidoEn).toBeDefined();

    // B. Emisión de Cédula de Acuse Digital
    const resAcuse = await request(app)
      .post(`/api/v1/casilla/notificaciones/${notificacionTitularId}/acuse`)
      .set('Authorization', `Bearer ${tokenTitular()}`);

    expect([200, 201]).toContain(resAcuse.status);
    expect(resAcuse.body.data.idAcuse).toMatch(/^ACU-\d{4}-/);
    expect(resAcuse.body.data.hashSha256Acuse).toBeDefined();
    expect(resAcuse.body.data.destinatario.nombresCompletos).toBe('Titular Aprobado');

    // Inmutabilidad: una segunda llamada devuelve el acuse idéntico sin mutar el timestamp
    const resAcuseReintento = await request(app)
      .post(`/api/v1/casilla/notificaciones/${notificacionTitularId}/acuse`)
      .set('Authorization', `Bearer ${tokenTitular()}`);

    expect(resAcuseReintento.status).toBe(200);
    expect(resAcuseReintento.body.data.timestampGeneracionIso).toBe(resAcuse.body.data.timestampGeneracionIso);

    // C. Descarga de la Cédula Oficial de Acuse (PDF y TXT)
    const resDescargaAcuse = await request(app)
      .get(`/api/v1/casilla/notificaciones/${notificacionTitularId}/acuse/descargar?formato=pdf`)
      .set('Authorization', `Bearer ${tokenTitular()}`);

    expect(resDescargaAcuse.status).toBe(200);
    expect(resDescargaAcuse.body.downloadUrl).toBeDefined();

    // D. Trazabilidad WORM completa y diferenciada
    const trazas = await pool.query<{ tipo_evento: string; canal: string; estado: string }>(
      `SELECT tipo_evento, canal, estado
         FROM sigd_auth.notificacion_trazabilidad_evento
        WHERE notificacion_id = $1::uuid
        ORDER BY registrado_en ASC`,
      [notificacionTitularId],
    );

    const eventos = trazas.rows.map((t) => t.tipo_evento);
    expect(eventos).toContain('PUESTA_A_DISPOSICION');
    expect(eventos).toContain('VISUALIZADA');
    expect(eventos).toContain('ACUSE_GENERADO');
    expect(eventos).toContain('ENLACE_DE_DESCARGA_GENERADO');
  });

  // ===========================================================================
  // 8. Archivo prematuro bloqueado
  // ===========================================================================
  it('8. Archivo prematuro bloqueado: Un expediente en estado no RESUELTO no puede ser archivado', async () => {
    const testExpNoResuelto = randomUUID();
    const cutNoResuelto = `EXP-2026-${Math.floor(600000 + Math.random() * 99999)}`;

    await pool.query(
      `INSERT INTO sigd_tra.expediente (
         expediente_id, codigo_expediente, numero, tipo_documental_id, solicitante_id, area_destino_id, estado, fecha_radicacion
       ) VALUES ($1, $2, $2, $3, $4, $5, 'EN_REVISION', now())`,
      [testExpNoResuelto, cutNoResuelto, tipoDocumentalResolucionId, personaTitularId, AREA_DIR_ID],
    );

    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      await expect(
        runWithContext(makeCtx(USER_DIRECTOR_DIR), async () => {
          return await archivarExpediente(tx, testExpNoResuelto, {
            estante: 'E-01',
            balda: 'B-02',
            caja: 'C-03',
            observaciones: 'Intento de archivo prematuro',
          });
        }),
      ).rejects.toThrow(DomainError);
      await tx.query('ROLLBACK');
    } finally {
      tx.release();
      await pool.query('DELETE FROM sigd_tra.expediente WHERE expediente_id = $1::uuid', [testExpNoResuelto]);
    }
  });

  // ===========================================================================
  // 9. Archivo institucional autorizado
  // ===========================================================================
  it('9. Archivo autorizado: Expediente RESUELTO es archivado formalmente por funcionario institucional autorizado', async () => {
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      await runWithContext(makeCtx(USER_DIRECTOR_DIR), async () => {
        await archivarExpediente(tx, testExpedienteTitularId, {
          estante: 'ESTANTE-A4',
          balda: 'BALDA-02',
          caja: 'CAJA-2026-DIR',
          observaciones: 'Expediente con notificación y acuse completados formalmente en Casilla.',
        });
      });
      await tx.query('COMMIT');
    } catch (e) {
      await tx.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      tx.release();
    }

    // 1. Estado en sigd_tra.expediente actualizado a ARCHIVADO
    const expArchivado = await pool.query('SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid', [testExpedienteTitularId]);
    expect(expArchivado.rows[0].estado).toBe('ARCHIVADO');

    // 2. Movimiento WORM en sigd_rut.movimiento_tramite
    const movArchivo = await pool.query<{
      estado_anterior: string;
      evento: string;
      estado_nuevo: string;
      datos: any;
      usuario_operador_id: string;
    }>(
      `SELECT estado_anterior, evento, estado_nuevo, datos, usuario_operador_id
         FROM sigd_rut.movimiento_tramite
        WHERE expediente_id = $1::uuid AND estado_nuevo = 'ARCHIVADO'`,
      [testExpedienteTitularId],
    );

    expect(movArchivo.rowCount).toBe(1);
    expect(movArchivo.rows[0].estado_anterior).toBe('RESUELTO');
    expect(movArchivo.rows[0].evento).toBe('CIERRE');
    expect(movArchivo.rows[0].estado_nuevo).toBe('ARCHIVADO');
    expect(movArchivo.rows[0].datos.estante).toBe('ESTANTE-A4');
    expect(movArchivo.rows[0].datos.balda).toBe('BALDA-02');
    expect(movArchivo.rows[0].datos.caja).toBe('CAJA-2026-DIR');

    // 3. Proyección en sigd_rut.estado_actual_expediente actualizada a ARCHIVADO
    const rutArchivo = await pool.query('SELECT estado_nuevo FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid', [testExpedienteTitularId]);
    expect(rutArchivo.rows[0].estado_nuevo).toBe('ARCHIVADO');

    // 4. Invariante WORM: Un expediente ARCHIVADO rechaza derivaciones u otras transiciones salientes
    const txIntento = await pool.connect();
    try {
      await txIntento.query('BEGIN');
      await expect(
        runWithContext(makeCtx(USER_DIRECTOR_DIR), async () => {
          return await derivarExpediente(txIntento, testExpedienteTitularId, {
            destinos: [{ area_destino_id: AREA_DIR_ID, es_copia: false }],
            proveido: 'Intento de derivar expediente archivado',
          });
        }),
      ).rejects.toThrow(DomainError);
      await txIntento.query('ROLLBACK');
    } finally {
      txIntento.release();
    }
  });

  // ===========================================================================
  // 10. Integridad histórica y transacciones con rollback
  // ===========================================================================
  it('10. Integridad histórica: Expedientes canónicos de producción EXP-2026-000018 y EXP-2026-000148 permanecen inalterados', async () => {
    const histRes = await pool.query(`
      SELECT e.codigo_expediente, e.estado, u.estado_nuevo
      FROM sigd_tra.expediente e
      JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
      WHERE e.codigo_expediente IN ('EXP-2026-000018', 'EXP-2026-000148')
      ORDER BY e.codigo_expediente ASC
    `);

    expect(histRes.rows.length).toBe(2);
    for (const fila of histRes.rows) {
      expect(fila.estado).toBe('RESUELTO');
      expect(fila.estado_nuevo).toBe('RESUELTO');
    }
  });
});
