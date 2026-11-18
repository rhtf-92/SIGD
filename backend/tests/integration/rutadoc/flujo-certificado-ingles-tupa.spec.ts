import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Pool, type PoolClient } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { crearRouterDerivaciones } from '../../../src/domains/rutadoc/derivaciones.controller.js';
import { errorMiddleware } from '../../../src/middleware/error-middleware.js';
import { runWithContext } from '../../../src/shared/request-context/request-context.js';
import { resolverExpedienteConFirma } from '../../../src/domains/rutadoc/derivaciones.service.js';
import { TesoreriaRepository } from '../../../src/domains/tesoreria/tesoreria.repository.js';

describe('SIGD — Circuito Completo Certificado de Inglés (TUPA p1-fila-06) y Bloqueo de Derivación Prematura', () => {
  let realPool: Pool;
  let txClient: PoolClient;
  let savepointSeq = 0;

  const AREA_SDA_ID = 'a0000000-0000-0000-0000-000000000001';
  const AREA_DIR_ID = 'a0000000-0000-0000-0000-000000000002';

  const USER_DIRECTOR_DIR = '48b38966-150f-4fe6-8be6-ca9405c379b6';
  const USER_SECRETARIO_SDA = 'f62b07fa-6257-4d06-be7d-940b7305ae67';
  const USER_RESPONSABLE_INGLES = 'b5ef5f9f-6963-4bcc-b2bc-621c1aa22702';
  const USER_OTRO_ESPECIALISTA = '008feadd-98f6-4787-b655-a766623ac154';

  const expId = randomUUID();
  const expCorrId = randomUUID();
  let testPersonaSolicitante: string;
  let personaRespIngles: string;
  let tipoDocId: string;
  let regVersionId: string;

  /**
   * Crea un Pool wrapper que ejecuta todas las consultas HTTP dentro de txClient
   * usando SAVEPOINT para garantizar 100% rollback al finalizar la suite.
   */
  function crearPoolAislado(): Pool {
    const proxyClient = {
      query: async (text: any, params?: any) => {
        const sql = typeof text === 'string' ? text.trim().toUpperCase() : '';
        if (sql === 'BEGIN') {
          savepointSeq += 1;
          return txClient.query(`SAVEPOINT sp_http_${savepointSeq}`);
        }
        if (sql === 'COMMIT') {
          return txClient.query(`RELEASE SAVEPOINT sp_http_${savepointSeq}`);
        }
        if (sql === 'ROLLBACK') {
          return txClient.query(`ROLLBACK TO SAVEPOINT sp_http_${savepointSeq}`);
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

  function crearAppConActor(actor: {
    id: string;
    idPersona?: string;
    roles: string[];
    unidadOrganicaId: string;
  }) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      runWithContext(
        {
          correlation_id: randomUUID(),
          usuario_id: actor.id,
          ip_origen: '127.0.0.1',
          user_agent: 'vitest-p1-fila-06',
        },
        () => next(),
      );
    });
    app.use(
      '/api/v1/expedientes',
      crearRouterDerivaciones(crearPoolAislado(), {
        obtenerActor: async () => ({
          ...actor,
          contextoOperacion: 'INSTITUCIONAL',
        }),
      } as any),
    );
    app.use(errorMiddleware);
    return app;
  }

  async function sembrarExpedienteTupaIngles(id: string, cut: string) {
    await txClient.query(
      `INSERT INTO sigd_tra.expediente (
         expediente_id, codigo_expediente, numero, tipo_documental_id, solicitante_id, area_destino_id, estado, fecha_radicacion
       ) VALUES ($1::uuid, $2, $2, $3::uuid, $4::uuid, $5::uuid, 'REGISTRADO', now())`,
      [id, cut, tipoDocId, testPersonaSolicitante, AREA_DIR_ID],
    );
    await txClient.query(
      `INSERT INTO sigd_tra.tramite (expediente_id, asunto, estado) VALUES ($1::uuid, 'Certificado de Inglés Sintético', 'REGISTRADO')`,
      [id],
    );
    await txClient.query(
      `INSERT INTO sigd_rut.estado_actual_expediente (
         expediente_id, secuencia, estado_nuevo, evento, area_actual_id, id_movimiento, fecha_hora, usuario_operador_id
       ) VALUES ($1::uuid, 1, 'REGISTRADO', 'RADICACION_DIGITAL_PUBLICA', $2, gen_random_uuid(), now(), 0)`,
      [id, AREA_DIR_ID],
    );
    await txClient.query(
      `INSERT INTO sigd_rut.movimiento_secuencia (expediente_id, ultima_secuencia)
       VALUES ($1::uuid, 1) ON CONFLICT (expediente_id) DO UPDATE SET ultima_secuencia = 1`,
      [id],
    );
    await txClient.query(
      `INSERT INTO sigd_doc.expediente_tupa_vinculo (
         expediente_id, registro_version_id, tupa_codigo, tupa_anio, codigo_ref,
         denominacion_snapshot, monto_efectivo, plazo_dias_snapshot,
         unidad_responsable_id, unidad_resolutiva_id
       ) VALUES ($1::uuid, $2::uuid, 'TUPA-2026', 2026, 'p1-fila-06', 'Certificado de Inglés', 100.00, 15, $3::uuid, $4::uuid)`,
      [id, regVersionId, AREA_SDA_ID, AREA_DIR_ID],
    );
    const tesoreriaRepo = new TesoreriaRepository();
    const orden = await tesoreriaRepo.insertarOrdenPago(txClient, {
      codigoPago: `PAG-T-${Math.floor(100000 + Math.random() * 899999)}`,
      expedienteId: id,
      registroVersionId: regVersionId,
      solicitanteId: testPersonaSolicitante,
      concepto: 'Certificado de Inglés',
      codigoTupa: 'p1-fila-06',
      monto: 100.00,
      moneda: 'PEN',
      fechaVencimiento: new Date(Date.now() + 86400000),
    });
    await tesoreriaRepo.actualizarOrdenAConfirmada(txClient, {
      ordenPagoId: orden.orden_pago_id,
      metodoPago: 'EFECTIVO',
      referenciaOperacion: null,
      montoRecibido: 100.00,
      vuelto: 0,
      codigoRecibo: `REC-T-${Math.floor(100000 + Math.random() * 899999)}`,
      tesoreroId: USER_DIRECTOR_DIR,
      fechaPago: new Date(),
      confirmedSource: 'TESORERIA',
    });
    const wfVer = await txClient.query<{ id_version: string; total_pasos: number }>(
      `SELECT v.id_version, jsonb_array_length(v.pasos) AS total_pasos
         FROM sigd_rut.workflow_procedimiento_config c
         JOIN sigd_rut.workflow_version v ON v.id_version = c.id_version_workflow
        WHERE (c.id_procedimiento = $1::uuid OR c.id_procedimiento IN (
          SELECT p.id_procedimiento FROM sigd_doc.tupa_procedimiento p WHERE p.registro_version_id = $1::uuid
        )) AND c.activo = true AND v.activo = true LIMIT 1`,
      [regVersionId],
    );
    if (wfVer.rows.length > 0) {
      await txClient.query(
        `INSERT INTO sigd_rut.workflow_instancia (
           expediente_id, id_version_workflow, paso_actual, total_pasos, estado_instancia
         ) VALUES ($1::uuid, $2::uuid, 1, $3, 'EN_CURSO')`,
        [id, wfVer.rows[0].id_version, wfVer.rows[0].total_pasos],
      );
    }
  }

  beforeAll(async () => {
    realPool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/sigd_prueba',
    });
    txClient = await realPool.connect();
    await txClient.query('BEGIN');

    const pRes = await txClient.query<{ id_persona: string }>('SELECT id_persona FROM sigd_auth.persona LIMIT 1');
    testPersonaSolicitante = pRes.rows[0].id_persona;

    const espRes = await txClient.query<{ id_persona: string }>(
      'SELECT id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid',
      [USER_RESPONSABLE_INGLES],
    );
    personaRespIngles = espRes.rows[0].id_persona;

    const tdRes = await txClient.query<{ tipo_documental_id: string }>(
      'SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE vigente = true LIMIT 1',
    );
    tipoDocId = tdRes.rows[0].tipo_documental_id;

    const tupaRes = await txClient.query<{ registro_version_id: string }>(`
      SELECT r.registro_version_id
        FROM sigd_doc.tupa_registro_version r
        JOIN sigd_doc.tupa_procedimiento p ON p.registro_version_id = r.registro_version_id
       WHERE r.referencia_fila = 'p1-fila-06' OR p.codigo_ref = 'p1-fila-06'
       LIMIT 1
    `);
    regVersionId = tupaRes.rows[0].registro_version_id;

    await sembrarExpedienteTupaIngles(expId, `EXP-2026-98${Math.floor(1000 + Math.random() * 8999)}`);
    await sembrarExpedienteTupaIngles(expCorrId, `EXP-2026-97${Math.floor(1000 + Math.random() * 8999)}`);
  });

  afterAll(async () => {
    if (txClient) {
      await txClient.query('ROLLBACK').catch(() => {});
      txClient.release();
    }
    if (realPool) {
      await realPool.end();
    }
  });

  it('1. DIR deriva a SDA y Secretaría SDA recepciona formalmente', async () => {
    const appDir = crearAppConActor({
      id: USER_DIRECTOR_DIR,
      roles: ['DIRECTOR'],
      unidadOrganicaId: AREA_DIR_ID,
    });
    const resDer = await request(appDir)
      .post(`/api/v1/expedientes/${expId}/derivar`)
      .send({
        destinos: [{ area_destino_id: AREA_SDA_ID, es_copia: false }],
        proveido: 'Derivar a Subdirección Académica para evaluación técnica',
      });
    expect(resDer.status).toBe(200);
    expect(resDer.body.nuevoEstado).toBe('DERIVADO');

    const appSec = crearAppConActor({
      id: USER_SECRETARIO_SDA,
      roles: ['SECRETARIO'],
      unidadOrganicaId: AREA_SDA_ID,
    });
    const resRec = await request(appSec).post(`/api/v1/expedientes/${expId}/recepcionar`).send({});
    expect(resRec.status).toBe(200);
    expect(resRec.body.nuevoEstado).toBe('EN_REVISION');
  });

  it('2. Rechaza derivación prematura SDA -> DIR sin asignación/dictamen y rechaza dictamen sin asignación', async () => {
    const appEsp = crearAppConActor({
      id: USER_OTRO_ESPECIALISTA,
      roles: ['ESPECIALISTA'],
      unidadOrganicaId: AREA_SDA_ID,
    });

    // Derivación ordinaria SDA -> DIR bloqueada
    const resPrematura = await request(appEsp)
      .post(`/api/v1/expedientes/${expId}/derivar`)
      .send({
        destinos: [{ area_destino_id: AREA_DIR_ID, es_copia: false }],
        proveido: 'Intento de retorno prematuro sin dictamen',
      });
    expect(resPrematura.status).toBe(422);
    expect(resPrematura.body.code).toBe('DERIVACION_PREMATURA_EVALUACION_PENDIENTE');

    // Especialista sin asignación no puede emitir dictamen
    const resAtenderSinAsig = await request(appEsp)
      .post(`/api/v1/expedientes/${expId}/atender`)
      .send({ resultado_resumen: 'Dictamen sin asignación formal previa' });
    expect(resAtenderSinAsig.status).toBe(403);
    expect(resAtenderSinAsig.body.code).toBe('EXPEDIENTE_NO_ASIGNADO_AL_ESPECIALISTA');

    // Secretaría SDA no puede enviar a firma sin dictamen
    const appSec = crearAppConActor({
      id: USER_SECRETARIO_SDA,
      roles: ['SECRETARIO'],
      unidadOrganicaId: AREA_SDA_ID,
    });
    const resFirmaSinDictamen = await request(appSec)
      .post(`/api/v1/expedientes/${expId}/enviar-a-firma`)
      .send({ resultado_resumen: 'Intento de envío a firma sin evaluación académica' });
    expect(resFirmaSinDictamen.status).toBe(422);
    expect(resFirmaSinDictamen.body.code).toBe('ATENCION_TECNICA_REQUERIDA');
  });

  it('3. Secretaría SDA asigna especialista, otro especialista sigue bloqueado y asignado registra dictamen', async () => {
    const appSec = crearAppConActor({
      id: USER_SECRETARIO_SDA,
      roles: ['SECRETARIO'],
      unidadOrganicaId: AREA_SDA_ID,
    });
    const resAsig = await request(appSec)
      .post(`/api/v1/expedientes/${expId}/asignar`)
      .send({
        idPersona: personaRespIngles,
        idUsuario: USER_RESPONSABLE_INGLES,
        motivo: 'Asignación formal a especialista de idiomas',
      });
    expect(resAsig.status).toBe(200);

    // Otro especialista (no asignado) es rechazado
    const appOtroEsp = crearAppConActor({
      id: USER_OTRO_ESPECIALISTA,
      roles: ['ESPECIALISTA'],
      unidadOrganicaId: AREA_SDA_ID,
    });
    const resOtroAtender = await request(appOtroEsp)
      .post(`/api/v1/expedientes/${expId}/atender`)
      .send({ resultado_resumen: 'Dictamen por especialista equivocado' });
    expect(resOtroAtender.status).toBe(403);
    expect(resOtroAtender.body.code).toBe('EXPEDIENTE_NO_ASIGNADO_AL_ESPECIALISTA');

    // Especialista asignado registra dictamen con éxito
    const appAsigEsp = crearAppConActor({
      id: USER_RESPONSABLE_INGLES,
      roles: ['ESPECIALISTA'],
      unidadOrganicaId: AREA_SDA_ID,
    });
    const resDictamen = await request(appAsigEsp)
      .post(`/api/v1/expedientes/${expId}/atender`)
      .send({
        resultado_resumen: 'Dictamen técnico favorable tras revisión académica de actas.',
        observacion_interna: 'Cumple requisitos académicos TUPA.',
      });
    expect(resDictamen.status).toBe(200);
    expect(resDictamen.body.nuevoEstado).toBe('EN_REVISION');

    // Con dictamen completado, derivación ordinaria SDA -> DIR también exige usar Enviar a Firma
    const resDerivarConDictamen = await request(appSec)
      .post(`/api/v1/expedientes/${expId}/derivar`)
      .send({
        destinos: [{ area_destino_id: AREA_DIR_ID, es_copia: false }],
        proveido: 'Pase ordinario en vez de elevar a firma',
      });
    expect(resDerivarConDictamen.status).toBe(422);
    expect(resDerivarConDictamen.body.code).toBe('USAR_ENVIO_A_FIRMA');
  });

  it('4. Secretaría SDA eleva a Dirección (EN_FIRMA) y Director resuelve únicamente con firma y dictamen válidos', async () => {
    const appSec = crearAppConActor({
      id: USER_SECRETARIO_SDA,
      roles: ['SECRETARIO'],
      unidadOrganicaId: AREA_SDA_ID,
    });

    // Especialista NO puede elevar a firma
    const appEsp = crearAppConActor({
      id: USER_RESPONSABLE_INGLES,
      roles: ['ESPECIALISTA'],
      unidadOrganicaId: AREA_SDA_ID,
    });
    const resEspFirma = await request(appEsp)
      .post(`/api/v1/expedientes/${expId}/enviar-a-firma`)
      .send({ resultado_resumen: 'Especialista intentando elevar' });
    expect(resEspFirma.status).toBe(403);
    expect(resEspFirma.body.code).toBe('ESPECIALISTA_NO_PUEDE_ELEVAR_A_FIRMA');

    // Secretaría eleva a firma -> EN_FIRMA en DIR
    const resFirma = await request(appSec)
      .post(`/api/v1/expedientes/${expId}/enviar-a-firma`)
      .send({ resultado_resumen: 'Pase formal con dictamen favorable SDA' });
    expect(resFirma.status).toBe(200);
    expect(resFirma.body.nuevoEstado).toBe('EN_FIRMA');

    // Director sin evidencia de firma es bloqueado (409 EVIDENCIA_FIRMA_REQUERIDA)
    const appDir = crearAppConActor({
      id: USER_DIRECTOR_DIR,
      roles: ['DIRECTOR'],
      unidadOrganicaId: AREA_DIR_ID,
    });
    const resResolverSinFirma = await request(appDir)
      .post(`/api/v1/expedientes/${expId}/resolver`)
      .send({ resultado_resumen: 'Intento sin documento firmado' });
    expect(resResolverSinFirma.status).toBe(409);
    expect(resResolverSinFirma.body.code).toBe('EVIDENCIA_FIRMA_REQUERIDA');

    // Sembrar firma institucional válida para completar resolución
    const docId = randomUUID();
    const sha = createHash('sha256').update('PDF_RESOLUTIVO_TEST').digest('hex');
    await txClient.query(
      `INSERT INTO sigd_doc.documento_adjunto (
         documento_adjunto_id, expediente_tra_id, tipo_documental_id, nombre_archivo,
         s3_bucket, s3_key, sha256, tamano_bytes, mime_type, subido_por, id_requisito
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'RD-SYNTH-INGLES.pdf', 'sigd-expedientes', $4, $5, 4096, 'application/pdf', $6::uuid, NULL)`,
      [docId, expId, tipoDocId, `resoluciones/2026/${docId}.pdf`, sha, USER_DIRECTOR_DIR],
    );
    await txClient.query(
      `INSERT INTO sigd_doc.firma_digital_documento (
         documento_id, cvd, sha256_firmado, firmante, estado, fecha_registro,
         fecha_sello_tsa, s3_bucket, s3_key, algoritmo_firma, proveedor_firma, documento_version
       ) VALUES ($1::uuid, $2, $3, 'Director General', 'FIRMADO_DIGITALMENTE', now(), now(), 'sigd-expedientes', $4, 'SHA256withRSA', 'LAB_TEST', 1)`,
      [docId, `CVD-SYN-${Math.floor(100000 + Math.random() * 899999)}`, sha, `resoluciones/2026/${docId}.pdf`],
    );

    const resResolver = await request(appDir)
      .post(`/api/v1/expedientes/${expId}/resolver`)
      .send({
        resultado_resumen: 'Resolución Directoral emitida y suscrita tras dictamen SDA.',
        documento_respuesta_id: docId,
      });
    expect(resResolver.status).toBe(200);
    expect(resResolver.body.nuevoEstado).toBe('RESUELTO');
  });

  it('5. Derivación correctiva excepcional con autorización y justificación mantiene auditoría y NO marca evaluación técnica completada', async () => {
    const appDir = crearAppConActor({
      id: USER_DIRECTOR_DIR,
      roles: ['DIRECTOR'],
      unidadOrganicaId: AREA_DIR_ID,
    });
    const appSec = crearAppConActor({
      id: USER_SECRETARIO_SDA,
      roles: ['SECRETARIO'],
      unidadOrganicaId: AREA_SDA_ID,
    });
    const appEsp = crearAppConActor({
      id: USER_OTRO_ESPECIALISTA,
      roles: ['ESPECIALISTA'],
      unidadOrganicaId: AREA_SDA_ID,
    });

    await request(appDir)
      .post(`/api/v1/expedientes/${expCorrId}/derivar`)
      .send({
        destinos: [{ area_destino_id: AREA_SDA_ID, es_copia: false }],
        proveido: 'Pase inicial a SDA',
      });
    await request(appSec).post(`/api/v1/expedientes/${expCorrId}/recepcionar`).send({});

    // Especialista sin jefatura NO puede hacer derivación correctiva
    const resEspCorr = await request(appEsp)
      .post(`/api/v1/expedientes/${expCorrId}/derivar`)
      .send({
        destinos: [{ area_destino_id: AREA_DIR_ID, es_copia: false }],
        proveido: 'Corrección sin autorización',
        es_correccion: true,
        justificacion_desviacion: 'Intento de corrección de ruta por especialista',
      });
    expect(resEspCorr.status).toBe(403);
    expect(resEspCorr.body.code).toBe('SIN_FACULTAD_CORRECCION_DERIVACION');

    // Secretaría SDA ejecuta derivación correctiva con justificación y auditoría
    const resSecCorr = await request(appSec)
      .post(`/api/v1/expedientes/${expCorrId}/derivar`)
      .send({
        destinos: [{ area_destino_id: AREA_DIR_ID, es_copia: false }],
        proveido: 'Devolución excepcional a Dirección por rectificación administrativa',
        es_correccion: true,
        justificacion_desviacion: 'Rectificación excepcional de error en folio de ingreso antes de dictaminar.',
      });
    expect(resSecCorr.status).toBe(200);

    // Recepción en DIR queda EN_REVISION sin dictamen técnico
    await request(appDir).post(`/api/v1/expedientes/${expCorrId}/recepcionar`).send({});

    // Dirección NO puede elevar a firma ni resolver porque la evaluación académica sigue pendiente
    const resEnviarDir = await request(appDir)
      .post(`/api/v1/expedientes/${expCorrId}/enviar-a-firma`)
      .send({ resultado_resumen: 'Intento de elevar desde DIR sin dictamen SDA' });
    expect(resEnviarDir.status).toBe(422);
    expect(resEnviarDir.body.code).toBe('ATENCION_TECNICA_REQUERIDA');

    // Incluso forzando EN_FIRMA en BD, resolverExpedienteConFirma bloquea por falta de asignación/dictamen
    await expect(
      runWithContext(
        { correlation_id: randomUUID(), usuario_id: USER_DIRECTOR_DIR, ip_origen: '127.0.0.1', user_agent: 'vitest' },
        async () => {
          await txClient.query(
            `UPDATE sigd_tra.expediente SET estado = 'EN_FIRMA' WHERE expediente_id = $1::uuid`,
            [expCorrId],
          );
          await txClient.query(
            `UPDATE sigd_rut.estado_actual_expediente SET estado_nuevo = 'EN_FIRMA' WHERE expediente_id = $1::uuid`,
            [expCorrId],
          );
          return resolverExpedienteConFirma(txClient, expCorrId, {
            resultado_resumen: 'Intento resolver sin evaluación SDA',
          });
        },
      ),
    ).rejects.toMatchObject({ code: 'ATENCION_TECNICA_REQUERIDA' });
  });
});
