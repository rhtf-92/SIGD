import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Pool, type PoolClient } from 'pg';
import crypto, { randomUUID, createHash, createSign } from 'node:crypto';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { PDFDocument } from 'pdf-lib';

import { VentanillaPresencialService } from '../../../src/domains/tramicore/ventanillaPresencial.service.js';
import { TesoreriaService } from '../../../src/domains/tesoreria/tesoreria.service.js';
import { crearRouterDerivaciones } from '../../../src/domains/rutadoc/derivaciones.controller.js';
import {
  atenderExpediente,
  enviarAFirmaExpediente,
  resolverExpedienteConFirma,
  archivarExpediente,
} from '../../../src/domains/rutadoc/derivaciones.service.js';
import { ExpedienteAsignacionService } from '../../../src/domains/rutadoc/expedienteAsignacion.service.js';
import { generarActoResolutivoInstitucional } from '../../../src/domains/docucore/resoluciones.service.js';
import {
  prepararFirmaDnie,
  verificarYRegistrarFirmaDnie,
  DnieTrustStore,
} from '../../../src/domains/docucore/dnieFirma.service.js';
import { crearVerificadorCvd } from '../../../src/domains/docucore/validadorCvd.controller.js';
import { DestinoCasilla } from '../../../src/audit/despachador-notificaciones.js';
import { crearRouterCasilla } from '../../../src/domains/identicore/casilla.router.js';
import { runWithContext } from '../../../src/shared/request-context/request-context.js';
import { errorMiddleware } from '../../../src/middleware/error-middleware.js';
import { firmarTokenAcceso } from '../../../src/core/auth/jwt.service.js';
import { obtenerConfiguracionS3 } from '../../../src/config/s3.config.js';
import { generarUrlPresigned } from '../../../src/core/storage/s3-storage.service.js';
import {
  CERT_VALIDO_DIRECTOR_PEM,
  KEY_VALIDO_DIRECTOR_PEM,
  SIGD_TEST_CA_PEM,
} from '../../fixtures/dnie-test-certs.js';

describe('SIGD — Circuito Completo Certificado de Inglés (TUPA p1-fila-06) + Documentos Reales MinIO/SHA-256/CVD', () => {
  let realPool: Pool;
  let txClient: PoolClient;
  let isolatedPool: Pool;
  let savepointSeq = 0;

  const JWT_SECRET =
    process.env.AUTH_JWT_SECRET ||
    'sigd-dev-jwt-secret-key-at-least-32-chars-2026';
  const AREA_SDA_ID = 'a0000000-0000-0000-0000-000000000001';
  const AREA_DIR_ID = 'a0000000-0000-0000-0000-000000000002';

  const USER_MESA_PARTES = 'a01038b7-7905-4803-9b01-62cbc2d58cca';
  const USER_TESORERIA = '7fc19f9b-ad07-41d7-bc70-51f570c79ce8';
  const USER_DIRECTOR_DIR = '48b38966-150f-4fe6-8be6-ca9405c379b6';
  const USER_SECRETARIO_SDA = 'f62b07fa-6257-4d06-be7d-940b7305ae67';
  const USER_RESPONSABLE_INGLES = 'b5ef5f9f-6963-4bcc-b2bc-621c1aa22702';

  const s3KeysCreadas = new Set<string>();

  function crearPoolAislado(): Pool {
    const proxyClient = {
      query: async (text: any, params?: any) => {
        const sql = typeof text === 'string' ? text.trim().toUpperCase() : '';
        if (sql === 'BEGIN') {
          savepointSeq += 1;
          return txClient.query(`SAVEPOINT sp_e2e_${savepointSeq}`);
        }
        if (sql === 'COMMIT') {
          return txClient.query(`RELEASE SAVEPOINT sp_e2e_${savepointSeq}`);
        }
        if (sql === 'ROLLBACK') {
          return txClient.query(`ROLLBACK TO SAVEPOINT sp_e2e_${savepointSeq}`);
        }
        return txClient.query(text, params);
      },
      release: () => {},
    } as unknown as PoolClient;

    return {
      query: (text: any, params?: any) => txClient.query(text, params),
      connect: async () => proxyClient,
    } as unknown as Pool;
  }

  function crearActor(id: string, rol: string, areaId: string | null) {
    return {
      id,
      roles: [rol],
      unidadOrganicaId: areaId,
      puedeVerExpediente: async () => true,
    };
  }

  function crearAppDerivaciones(actor: ReturnType<typeof crearActor>) {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/expedientes', (req, _res, next) => {
      (req as any).actor = actor;
      (req as any).usuario = actor;
      runWithContext(
        {
          correlation_id: randomUUID(),
          usuario_id: actor.id,
          ip_origen: '127.0.0.1',
          user_agent: 'vitest-e2e',
        },
        () => next(),
      );
    });
    app.use('/api/v1/expedientes', crearRouterDerivaciones(isolatedPool, undefined as any));
    app.use(errorMiddleware);
    return app;
  }

  function makeCtx(usuarioId: string) {
    return {
      correlation_id: randomUUID(),
      usuario_id: usuarioId,
      ip_origen: '127.0.0.1',
      user_agent: 'vitest-e2e',
    };
  }

  const dniSintetico = `${Math.floor(71000000 + Math.random() * 1999999)}`;
  let regVersionInglesId: string;
  let personaRespInglesId: string;
  let expedienteId: string;
  let cut: string;
  let ordenPagoId: string;
  let documentoResolucionId: string;
  let hashResolucionReal: string;
  let cvdResolucion: string;
  let s3KeyResolucion: string;
  let solicitantePersonaId: string;
  let notificacionId: string;
  let cuentaCiudadanoPosteriorId: string;

  beforeAll(async () => {
    realPool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgres://postgres:postgres_password@172.20.157.19:5432/sigd_prueba',
    });
    txClient = await realPool.connect();
    await txClient.query('BEGIN');
    isolatedPool = crearPoolAislado();
    DnieTrustStore.registrarRootCA(SIGD_TEST_CA_PEM);

    const tupaRes = await txClient.query<{ registro_version_id: string }>(
      `SELECT r.registro_version_id
         FROM sigd_doc.tupa_registro_version r
         JOIN sigd_doc.tupa_procedimiento p ON p.registro_version_id = r.registro_version_id
        WHERE r.referencia_fila = 'p1-fila-06' OR p.codigo_ref = 'p1-fila-06'
        LIMIT 1`,
    );
    regVersionInglesId = tupaRes.rows[0].registro_version_id;

    const espRes = await txClient.query<{ id_persona: string }>(
      `SELECT id_persona::text FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`,
      [USER_RESPONSABLE_INGLES],
    );
    personaRespInglesId = espRes.rows[0].id_persona;
  });

  afterAll(async () => {
    try {
      const configS3 = obtenerConfiguracionS3();
      const s3 = new S3Client({
        region: configS3.region,
        endpoint: configS3.endpoint,
        forcePathStyle: configS3.forcePathStyle,
        credentials: {
          accessKeyId: configS3.accessKey,
          secretAccessKey: configS3.secretKey,
        },
      });
      for (const key of s3KeysCreadas) {
        await s3.send(new DeleteObjectCommand({ Bucket: configS3.bucket, Key: key })).catch(() => {});
      }
    } catch {
      // ignore cleanup errors
    } finally {
      if (txClient) {
        await txClient.query('ROLLBACK').catch(() => {});
        txClient.release();
      }
      await realPool?.end();
    }
  });

  it('1. Mesa de Partes radica Certificado de Inglés (p1-fila-06) para ciudadano sin cuenta y valida bloqueo previo al pago', async () => {
    const ventanilla = new VentanillaPresencialService(isolatedPool);
    const resultado = await ventanilla.registrarExpedienteVentanilla(
      {
        tipoDocumento: 'DNI',
        numeroDocumento: dniSintetico,
        nombres: 'Luciana',
        apellidos: 'Paredes Soto',
        datosRemitente: 'Luciana Paredes Soto',
        correo: `luciana_${dniSintetico}@correo.test`,
        asunto: 'Solicitud presencial de Certificado de Inglés TUPA p1-fila-06',
        foliosTotales: 2,
        registroVersionId: regVersionInglesId,
        idOperadorVentanilla: USER_MESA_PARTES,
      },
      txClient,
    );

    expedienteId = resultado.expedienteId;
    cut = resultado.cut;
    expect(cut).toMatch(/^EXP-\d{4}-\d{6}$/);
    expect(resultado.ordenPago).not.toBeNull();
    expect(Number(resultado.ordenPago!.monto)).toBe(100);
    ordenPagoId = resultado.ordenPago!.ordenPagoId;

    const docs = await txClient.query<{ s3_key: string }>(
      `SELECT s3_key FROM sigd_doc.documento_adjunto WHERE expediente_tra_id = $1::uuid`,
      [expedienteId],
    );
    for (const d of docs.rows) s3KeysCreadas.add(d.s3_key);

    const expRow = await txClient.query<{ estado: string; area_destino_id: string; solicitante_id: string; id_usuario_creador: string | null }>(
      `SELECT estado, area_destino_id::text, solicitante_id::text, id_usuario_creador FROM sigd_tra.expediente WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    expect(expRow.rows[0].estado).toBe('PENDIENTE_PAGO');
    expect(expRow.rows[0].area_destino_id).toBe(AREA_DIR_ID);
    expect(expRow.rows[0].id_usuario_creador).toBeNull();
    solicitantePersonaId = expRow.rows[0].solicitante_id;

    // Bloqueo de derivación previo al pago
    const appMesa = crearAppDerivaciones(crearActor(USER_MESA_PARTES, 'MESA_PARTES', AREA_DIR_ID));
    const resDerivarSinPago = await request(appMesa)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .send({
        destinos: [{ area_destino_id: AREA_SDA_ID, es_copia: false }],
        proveido: 'Intento derivar antes de pago',
      });
    expect(resDerivarSinPago.status).toBe(409);
    expect(resDerivarSinPago.body.code).toBe('PAGO_PENDIENTE');
  });

  it('2. Tesorería confirma pago y desbloquea expediente; 3. Mesa de Partes / DIR deriva a SDA', async () => {
    const tesoreria = new TesoreriaService(isolatedPool);
    const pagoConfirmado = await tesoreria.confirmarPago(
      ordenPagoId,
      { metodoPago: 'EFECTIVO', montoRecibido: 100 },
      USER_TESORERIA,
    );
    expect(pagoConfirmado.estado).toBe('CONFIRMADO');
    expect(pagoConfirmado.codigoRecibo).toMatch(/^REC-\d{4}-/);

    const expPostPago = await txClient.query<{ estado: string }>(
      `SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    expect(expPostPago.rows[0].estado).toBe('REGISTRADO');

    // Mesa de Partes / DIR deriva hacia DIR primero o directamente autorizado a SDA
    const appDirector = crearAppDerivaciones(crearActor(USER_DIRECTOR_DIR, 'DIRECTOR', AREA_DIR_ID));
    const resDerivar = await request(appDirector)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .send({
        destinos: [{ area_destino_id: AREA_SDA_ID, es_copia: false }],
        proveido: 'Derivado a Subdirección Académica para evaluación técnica de Certificado de Inglés.',
      });
    expect(resDerivar.status).toBe(200);

    const estadoPostDer = await txClient.query<{ estado_nuevo: string; area_actual_id: string }>(
      `SELECT estado_nuevo, area_actual_id FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    expect(estadoPostDer.rows[0].estado_nuevo).toBe('DERIVADO');
    expect(estadoPostDer.rows[0].area_actual_id).toBe(AREA_SDA_ID);
  });

  it('4. Secretaría SDA recepciona y asigna al especialista responsable de Inglés; 5. Especialista emite dictamen técnico', async () => {
    const appSec = crearAppDerivaciones(crearActor(USER_SECRETARIO_SDA, 'SECRETARIO', AREA_SDA_ID));
    const resRec = await request(appSec).post(`/api/v1/expedientes/${expedienteId}/recepcionar`).send({});
    expect(resRec.status).toBe(200);

    const asigSvc = new ExpedienteAsignacionService(isolatedPool);
    await asigSvc.asignarExpediente(
      {
        expedienteId,
        idPersona: personaRespInglesId,
        idUsuario: USER_RESPONSABLE_INGLES,
        motivo: 'Evaluación académica de Certificado de Inglés',
        asignadoPorUsuarioId: USER_SECRETARIO_SDA,
      },
      txClient,
    );

    await runWithContext(makeCtx(USER_RESPONSABLE_INGLES), async () => {
      await atenderExpediente(txClient, expedienteId, {
        resultado_resumen: 'Dictamen técnico favorable N° 2026-ING: acredita suficiencia Nivel B2.',
        observacion_interna: 'Verificado en actas académicas internas.',
      });
    });

    const wfRes = await txClient.query<{ historial_pasos: any }>(
      `SELECT historial_pasos FROM sigd_rut.workflow_instancia WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    expect(wfRes.rows[0].historial_pasos.some((h: any) => h.evento === 'ATENCION_TECNICA')).toBe(true);
  });

  it('6. Secretaría SDA eleva a firma en DIR', async () => {
    let resElev: any;
    await runWithContext(makeCtx(USER_SECRETARIO_SDA), async () => {
      resElev = await enviarAFirmaExpediente(txClient, expedienteId, {
        resultado_resumen: 'Elevación formal a Dirección General con dictamen favorable.',
        actor_unidad_organica_id: AREA_SDA_ID,
        actor_roles: ['SECRETARIO'],
        exigir_custodia: true,
        actor_id: USER_SECRETARIO_SDA,
      });
    });
    expect(resElev.estado).toBe('EN_FIRMA');
  });

  it('7. Director genera PDF real en MinIO con SHA-256 exacto, firma con DNIe de laboratorio, valida CVD y resuelve', async () => {
    // Generar acto resolutivo dos veces para confirmar preservación idempotente del mismo CVD
    const acto1 = await generarActoResolutivoInstitucional(
      isolatedPool,
      expedienteId,
      USER_DIRECTOR_DIR,
      { resultadoResumen: 'Dictamen favorable Nivel B2' },
      txClient,
    );
    documentoResolucionId = acto1.documentoId;
    s3KeyResolucion = acto1.s3Key;
    s3KeysCreadas.add(acto1.s3Key);
    s3KeysCreadas.add(`firmados/${acto1.documentoId}.pdf`);

    const acto2 = await generarActoResolutivoInstitucional(
      isolatedPool,
      expedienteId,
      USER_DIRECTOR_DIR,
      undefined,
      txClient,
    );
    expect(acto2.documentoId).toBe(acto1.documentoId);
    expect(acto2.cvd).toBe(acto1.cvd);
    expect(acto2.cvd).toMatch(/^CVD-2026-[0-9A-F]{16}$/);
    cvdResolucion = acto1.cvd;

    // Descargar objeto físico real desde MinIO usando URL presigned GET y verificar encabezado %PDF-, páginas y SHA-256
    const configS3 = obtenerConfiguracionS3();
    const downloadUrl = generarUrlPresigned(s3KeyResolucion, { ...configS3, bucket: acto1.s3Bucket }, { metodo: 'GET', expiraSegundos: 300 });
    const httpPdf = await fetch(downloadUrl);
    expect(httpPdf.status).toBe(200);
    const downloadedBytes = Buffer.from(await httpPdf.arrayBuffer());
    expect(downloadedBytes.length).toBeGreaterThan(1000);
    expect(downloadedBytes.subarray(0, 5).toString('utf8')).toBe('%PDF-');

    const parsedPdf = await PDFDocument.load(downloadedBytes);
    expect(parsedPdf.getPageCount()).toBeGreaterThanOrEqual(1);

    hashResolucionReal = createHash('sha256').update(downloadedBytes).digest('hex');
    expect(hashResolucionReal).toBe(acto1.hashSha256);
    expect(hashResolucionReal).not.toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

    // Preparar y firmar criptográficamente con certificado de laboratorio del Director
    const prep = await prepararFirmaDnie(
      isolatedPool,
      { expedienteId },
      USER_DIRECTOR_DIR,
      'INSTITUCIONAL',
      ['DIRECTOR'],
      undefined,
      txClient,
    );
    expect(prep.cvd).toBe(cvdResolucion);
    expect(prep.hashSha256).toBe(hashResolucionReal);

    const signer = createSign('SHA256');
    signer.update(Buffer.from(prep.hashSha256, 'hex'));
    signer.end();
    const firmaB64 = signer.sign(KEY_VALIDO_DIRECTOR_PEM, 'base64');

    const regFirma = await verificarYRegistrarFirmaDnie(
      isolatedPool,
      {
        preparacionId: prep.preparacionId,
        expedienteId,
        documentoId: documentoResolucionId,
        hashSha256: prep.hashSha256,
        firmaB64,
        certificadoPem: CERT_VALIDO_DIRECTOR_PEM,
        algoritmo: 'SHA256withRSA',
        proveedor: 'MOCK_TEST',
      },
      USER_DIRECTOR_DIR,
      'INSTITUCIONAL',
      undefined,
      txClient,
    );
    expect(regFirma.ok).toBe(true);
    expect(regFirma.cvd).toBe(cvdResolucion);

    // Validar CVD distingue firma de laboratorio vs oficial y confirma artefacto íntegro
    const appCvd = express();
    appCvd.get('/api/v1/validador-cvd/verificar/:cvd', (req, res, next) => {
      crearVerificadorCvd(isolatedPool)(req, res).catch(next);
    });
    appCvd.use(errorMiddleware);

    const resCvd = await request(appCvd).get(`/api/v1/validador-cvd/verificar/${cvdResolucion}`);
    expect(resCvd.status).toBe(200);
    expect(resCvd.body.valido).toBe(true);
    expect(resCvd.body.naturalezaFirma).toBe('FIRMA_LABORATORIO');
    expect(resCvd.body.esFirmaLaboratorio).toBe(true);
    expect(resCvd.body.integridadArchivo).toBe('VERIFICADA');
    expect(resCvd.body.sha256_firmado.trim()).toBe(hashResolucionReal);

    // Resolver expediente con firma
    let resolved: any;
    await runWithContext(makeCtx(USER_DIRECTOR_DIR), async () => {
      resolved = await resolverExpedienteConFirma(txClient, expedienteId, {
        resultado_resumen: 'Se declara procedente la emisión del Certificado de Inglés.',
        documento_respuesta_id: documentoResolucionId,
      });
    });
    expect(resolved.estado).toBe('RESUELTO');
  });

  it('8. Notificación al ciudadano sin cuenta (Casilla usuario_id=NULL + acceso tras vinculación) y 9. Archivado FSM', async () => {
    const outboxRes = await txClient.query<{
      id_evento: string;
      correlation_id: string;
      agregado: string;
      tipo_evento: string;
      payload: any;
      intentos: number;
    }>(
      `SELECT id_evento::text, correlation_id::text, agregado, tipo_evento, payload, intentos
         FROM sigd_audit.evento_outbox
        WHERE tipo_evento = 'ExpedienteAtendido'
          AND payload->>'expediente_id' = $1
        ORDER BY creado_en DESC LIMIT 1`,
      [expedienteId],
    );
    expect(outboxRes.rows.length).toBe(1);

    const destinoCasilla = new DestinoCasilla(isolatedPool);
    await destinoCasilla.despachar(outboxRes.rows[0] as any);

    const notifRes = await txClient.query<{ id: string; usuario_id: string | null; cvd: string; hash_sha256: string }>(
      `SELECT id::text, usuario_id, cvd, hash_sha256 FROM sigd_auth.notificacion_casilla WHERE cut = $1`,
      [cut],
    );
    expect(notifRes.rows.length).toBe(1);
    expect(notifRes.rows[0].usuario_id).toBeNull();
    expect(notifRes.rows[0].cvd).toBe(cvdResolucion);
    expect(notifRes.rows[0].hash_sha256).toBe(hashResolucionReal);
    notificacionId = notifRes.rows[0].id;

    // Crear cuenta ciudadana posterior y probar que sin vinculación aprobada NO ve ni descarga; tras vinculación APROBADA sí ve y descarga PDF real
    cuentaCiudadanoPosteriorId = randomUUID();
    await txClient.query(
      `INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
       VALUES ($1::uuid, $2::uuid, $3, $4, '$argon2id$v=19$m=65536,t=3,p=1$c2lnZHRlc3RzYWx0$c2lnZHRlc3RoYXNo', true)`,
      [cuentaCiudadanoPosteriorId, solicitantePersonaId, `ciu_${dniSintetico}`, `luciana_${dniSintetico}@correo.test`],
    );

    const tokenCiu = firmarTokenAcceso({ sub: cuentaCiudadanoPosteriorId, roles: ['CIUDADANO'], secreto: JWT_SECRET });
    const appCasilla = express();
    appCasilla.use('/api/v1', crearRouterCasilla(isolatedPool));
    appCasilla.use(errorMiddleware);

    const sinVinc = await request(appCasilla)
      .get('/api/v1/casilla/notificaciones')
      .set('Authorization', `Bearer ${tokenCiu}`);
    expect(sinVinc.status).toBe(200);
    expect(sinVinc.body.notificaciones.some((n: any) => n.cut === cut)).toBe(false);

    await txClient.query(
      `INSERT INTO sigd_tra.solicitud_vinculacion_expediente (id_solicitud, expediente_id, id_usuario, persona_id, estado, motivo_solicitud, solicitado_en, resuelto_en)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'APROBADA', 'Acreditación presencial en ventanilla', now(), now())`,
      [randomUUID(), expedienteId, cuentaCiudadanoPosteriorId, solicitantePersonaId],
    );

    const statsRes = await request(appCasilla)
      .get('/api/v1/casilla/estadisticas')
      .set('Authorization', `Bearer ${tokenCiu}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.total).toBe(1);

    const descRes = await request(appCasilla)
      .get(`/api/v1/casilla/notificaciones/${notificacionId}/documento/descargar`)
      .set('Authorization', `Bearer ${tokenCiu}`);
    expect(descRes.status).toBe(200);
    expect(descRes.body.downloadUrl).toBeDefined();

    // Verificar descarga física desde la URL entregada por Casilla
    const pdfDescargado = await fetch(descRes.body.downloadUrl);
    expect(pdfDescargado.status).toBe(200);
    const bytesCasilla = Buffer.from(await pdfDescargado.arrayBuffer());
    expect(createHash('sha256').update(bytesCasilla).digest('hex')).toBe(hashResolucionReal);

    // Paso 9: Archivado conforme a la FSM (RESUELTO -> CIERRE -> ARCHIVADO)
    await runWithContext(makeCtx(USER_DIRECTOR_DIR), async () => {
      await archivarExpediente(txClient, expedienteId, {
        estante: 'EST-ING-01',
        balda: 'B-02',
        caja: 'C-2026',
        observaciones: 'Cierre completo Certificado de Inglés',
      });
    });

    const expFinal = await txClient.query<{ estado: string }>(
      `SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    expect(expFinal.rows[0].estado).toBe('ARCHIVADO');
  });
});
