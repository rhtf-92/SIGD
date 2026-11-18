import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import dotenv from 'dotenv';
import path from 'node:path';
import { TransactionalTestPool, type HashesTablas, type EstadoSecuencia } from '../helpers/transactional-pool.helper.js';
import { MinioTestHelper, type TestPdfArtifact } from '../helpers/minio-test.helper.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';
import { construirApp } from '../../src/app.js';
import type { Express } from 'express';

import fs from 'node:fs';

// Cargar variables de entorno del backend para claves de MinIO y JWT
const envPath = fs.existsSync(path.resolve('.env'))
  ? path.resolve('.env')
  : path.resolve('backend/.env');
dotenv.config({ path: envPath });
process.env.AUTH_JWT_SECRET ??= 'jrxd5PYrvRoesjxXyHin4dGieC_cF0X06l0d_EJ59YiKNPjx4e_9Dq430LowQpyL';
process.env.S3_BUCKET = 'sigd-sandbox-e2e';

describe('Microtarea 3.4 — Validación Integral E2E, Trazabilidad y Certificación de GESTOR_APOYO_AREA (TSK-DEV-03-INT)', () => {
  let txPool: TransactionalTestPool;
  let minioHelper: MinioTestHelper;
  let app: Express;
  let tokenGestorApoyoSec: string;
  let preHashes: HashesTablas;
  let preSecuencia: EstadoSecuencia;
  let conteoMinioInicial: number;

  // Constantes de fixtures institucionales
  const ID_PERSONA = '99999999-0000-0000-0000-000000000001';
  const ID_USUARIO = '99999999-0000-0000-0000-000000000002';
  const ID_CAP_ASIG = '99999999-0000-0000-0000-000000000003';
  const ID_CAPACIDAD_GESTOR = '4c010000-0000-4000-8000-000000000001'; // GESTOR_APOYO_AREA
  const AREA_SEC = '2b147b0d-7c8f-434f-b75a-598a1ccb855b'; // Secretaría Académica
  const AREA_DG = '05f2ee8f-c90f-4239-898c-3ac113afc424';  // Dirección General
  const AREA_AC = '13be7605-339d-4034-9688-07451fe40d02';  // Archivo Central
  const TIPO_DOC_FUT = 'b7f37bde-ec45-49d0-b28e-fc2ad4341b60';
  const TIPO_TRAMITE_TUPA = '18cc2baf-92e9-4834-bb1f-8e698fc417f2';

  const ID_EXP_SEC = '99999999-0000-0000-0000-000000000010';
  const ID_EXP_DG = '99999999-0000-0000-0000-000000000020';
  const DUMMY_HASH_ARGON2 = '$argon2id$v=19$m=65536,p=4,t=3$pZditvO4UISe7Gm8wqo9oA$BuLgyjSdHz1nfbwEN6J21QPg02eBpa6q/z7eaFLuSHs';

  let pdfDigitalizado: TestPdfArtifact;

  beforeAll(async () => {
    // 1. Inicializar MinIO Test Helper y verificar que el bucket contiene 347 objetos
    minioHelper = new MinioTestHelper();
    conteoMinioInicial = await minioHelper.contarObjetosEnBucket();
    expect(conteoMinioInicial).toBe(347);

    // 2. Inicializar TransactionalTestPool sobre sigd_jacobo_demo
    txPool = new TransactionalTestPool();
    preHashes = await txPool.obtenerHashesTablasCriticas();
    preSecuencia = await txPool.obtenerEstadoSecuenciaAsiento();
    expect(preSecuencia.last_value).toBe('10227');
    expect(preSecuencia.is_called).toBe(true);

    // Abrir transacción raíz aislada
    await txPool.init();
    const rawClient = txPool.getRawClient();

    // 3. Crear fixtures institucionales dentro de la transacción raíz
    // 3.1. Persona y Usuario Operador
    await rawClient.query(`
      INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
      VALUES ($1::uuid, 'NATURAL', '44445555')
    `, [ID_PERSONA]);

    await rawClient.query(`
      INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, sexo)
      VALUES ($1::uuid, 'Operador', 'Gestor Apoyo', 'Operador Gestor Apoyo', 'M')
    `, [ID_PERSONA]);

    await rawClient.query(`
      INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
      VALUES ($1::uuid, $2::uuid, 'gestor.apoyo.sec', 'gestor.apoyo@iestp-suiza.edu.pe', $3, true)
    `, [ID_USUARIO, ID_PERSONA, DUMMY_HASH_ARGON2]);

    await rawClient.query(`
      INSERT INTO sigd_auth.operador_identidad (id_usuario, operador_id)
      VALUES ($1::uuid, 999900001)
    `, [ID_USUARIO]);

    // 3.2. Asignar exclusivamente capacidad operativa GESTOR_APOYO_AREA en Secretaría Académica (sin roles estatutarios)
    await rawClient.query(`
      INSERT INTO sigd_org.usuario_capacidad (
        id_usuario_capacidad, id_usuario, id_capacidad, area_id, asignado_por, activo, vigente_desde, justificacion
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, true, now() - INTERVAL '1 day', 'Capacidad Operativa Gestor de Apoyo SEC'
      )
    `, [ID_CAP_ASIG, ID_USUARIO, ID_CAPACIDAD_GESTOR, AREA_SEC, ID_USUARIO]);

    // 3.3. Expediente Autorizado en Secretaría Académica (DERIVADO hacia SEC)
    await rawClient.query(`
      INSERT INTO sigd_tra.expediente (
        expediente_id, codigo_expediente, numero, tipo_documental_id, solicitante_id, area_destino_id, estado, fecha_radicacion
      ) VALUES (
        $1::uuid, 'EXP-2026-900001', 'EXP-2026-900001', $2::uuid, $3::uuid, $4::uuid, 'DERIVADO', now()
      )
    `, [ID_EXP_SEC, TIPO_DOC_FUT, ID_PERSONA, AREA_SEC]);

    await rawClient.query(`
      INSERT INTO sigd_doc.expediente (
        expediente_id, tipo_tramite_id, codigo_expediente, asunto, solicitante_id, fecha_registro
      ) VALUES (
        $1::uuid, $2::uuid, 'EXP-2026-900001', 'Expediente SEC Test E2E', $3::uuid, now()
      )
    `, [ID_EXP_SEC, TIPO_TRAMITE_TUPA, ID_PERSONA]);

    await rawClient.query(`
      INSERT INTO sigd_rut.movimiento_tramite (
        id_movimiento, expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, fecha_hora, datos
      ) VALUES (
        $1::uuid, $2::uuid, 'EN_CALIFICACION', 'DERIVACION', 'DERIVADO', 999900001, now(),
        json_build_object('areaId', $3::text, 'observaciones', 'Pase previo hacia Secretaría Académica')
      )
    `, ['99999999-0000-0000-0000-000000000011', ID_EXP_SEC, AREA_SEC]);

    // 3.4. Expediente No Autorizado en Dirección General (DERIVADO hacia DG)
    await rawClient.query(`
      INSERT INTO sigd_tra.expediente (
        expediente_id, codigo_expediente, numero, tipo_documental_id, solicitante_id, area_destino_id, estado, fecha_radicacion
      ) VALUES (
        $1::uuid, 'EXP-2026-900002', 'EXP-2026-900002', $2::uuid, $3::uuid, $4::uuid, 'DERIVADO', now()
      )
    `, [ID_EXP_DG, TIPO_DOC_FUT, ID_PERSONA, AREA_DG]);

    await rawClient.query(`
      INSERT INTO sigd_doc.expediente (
        expediente_id, tipo_tramite_id, codigo_expediente, asunto, solicitante_id, fecha_registro
      ) VALUES (
        $1::uuid, $2::uuid, 'EXP-2026-900002', 'Expediente DG Test E2E', $3::uuid, now()
      )
    `, [ID_EXP_DG, TIPO_TRAMITE_TUPA, ID_PERSONA]);

    await rawClient.query(`
      INSERT INTO sigd_rut.movimiento_tramite (
        id_movimiento, expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, fecha_hora, datos
      ) VALUES (
        $1::uuid, $2::uuid, 'EN_CALIFICACION', 'DERIVACION', 'DERIVADO', 999900001, now(),
        json_build_object('areaId', $3::text, 'observaciones', 'Pase previo hacia Dirección General')
      )
    `, ['99999999-0000-0000-0000-000000000021', ID_EXP_DG, AREA_DG]);

    // 4. Montar Express App con proxy transaccional
    app = construirApp(txPool.asPool());

    // 5. Generar token de acceso JWT con contexto de capacidad y sin roles estatutarios
    tokenGestorApoyoSec = firmarTokenAcceso({
      sub: ID_USUARIO,
      ctx: ID_CAP_ASIG,
      roles: [],
    });
  });

  afterAll(async () => {
    // 1. Limpiar objetos de prueba creados en MinIO
    if (minioHelper) {
      await minioHelper.limpiarClavesDePrueba();
      const conteoFinal = await minioHelper.contarObjetosEnBucket();
      expect(conteoFinal).toBe(conteoMinioInicial);
    }

    // 2. Revertir transacción raíz de prueba
    if (txPool) {
      await txPool.rollbackRootTransaction();

      // 3. Certificar criptográficamente que no hubo modificaciones en sigd_jacobo_demo
      const postHashes = await txPool.obtenerHashesTablasCriticas();
      const postSecuencia = await txPool.obtenerEstadoSecuenciaAsiento();

      await txPool.rollbackAndClose();

      for (const [tabla, hashPre] of Object.entries(preHashes)) {
        expect(postHashes[tabla], `Violación de inmutabilidad en la tabla ${tabla}`).toBe(hashPre);
      }

      expect(postSecuencia.last_value).toBe('10227');
      expect(postSecuencia.is_called).toBe(true);
    }
  });

  it('1. RBAC Negativo — Rechazar recepción formal de expediente perteneciente a otra área (Dirección General)', async () => {
    const respuesta = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_DG}/recepcionar`)
      .set('Authorization', `Bearer ${tokenGestorApoyoSec}`)
      .send({});

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.code).toBe('FORBIDDEN');
  });

  it('2. RBAC Negativo — Rechazar digitalización de expediente perteneciente a otra área (Dirección General)', async () => {
    const respuesta = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_DG}/documentos`)
      .set('Authorization', `Bearer ${tokenGestorApoyoSec}`)
      .send({
        nombreArchivo: 'DOCUMENTO_NO_AUTORIZADO.pdf',
        tamanoBytes: 500,
        mimeType: 'application/pdf',
        sha256Hash: 'a'.repeat(64),
        storagePath: 'expedientes/2026/00000000-0000-0000-0000-000000000000.pdf',
        folios: 1,
      });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.code).toBe('FORBIDDEN');
  });

  it('3. Caso A1 — Recepción formal de expediente en unidad orgánica autorizada (Secretaría Académica)', async () => {
    const respuesta = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_SEC}/recepcionar`)
      .set('Authorization', `Bearer ${tokenGestorApoyoSec}`)
      .send({ observaciones: 'Recepción formal por Gestor de Apoyo en Secretaría Académica' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    expect(respuesta.body.expediente_id).toBe(ID_EXP_SEC);
    expect(respuesta.body.nuevoEstado).toBe('EN_REVISION');
    expect(respuesta.body.secuencia).toBe('2');
  });

  it('4. Caso A2 — Digitalización en MinIO sigd-sandbox-e2e y foliación correlativa (1 a 3)', async () => {
    // Crear objeto físico PDF en el bucket MinIO
    pdfDigitalizado = await minioHelper.crearPdfPrueba();
    expect(minioHelper.estaRegistrada(pdfDigitalizado.key)).toBe(true);

    const respuesta = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_SEC}/documentos`)
      .set('Authorization', `Bearer ${tokenGestorApoyoSec}`)
      .send({
        nombreArchivo: 'DOCUMENTO_CERTIFICACION_E2E.pdf',
        tamanoBytes: pdfDigitalizado.tamanoBytes,
        mimeType: pdfDigitalizado.mimeType,
        sha256Hash: pdfDigitalizado.sha256Hash,
        storagePath: pdfDigitalizado.key,
        folios: 3,
      });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.expedienteId).toBe(ID_EXP_SEC);
    expect(respuesta.body.s3Bucket).toBe('sigd-sandbox-e2e');
    expect(respuesta.body.s3Key).toBe(pdfDigitalizado.key);
    expect(respuesta.body.folios.folioInicio).toBe(1);
    expect(respuesta.body.folios.folioFin).toBe(3);
    expect(respuesta.body.folios.cantidad).toBe(3);
  });

  it('5. Caso A4 — Auditoría y trazabilidad histórica documentada en ámbito autorizado', async () => {
    const respuesta = await request(app)
      .get(`/api/v1/expedientes/${ID_EXP_SEC}/trazabilidad`)
      .set('Authorization', `Bearer ${tokenGestorApoyoSec}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.expedienteId).toBe(ID_EXP_SEC);
    expect(Array.isArray(respuesta.body.actuaciones)).toBe(true);
    expect(respuesta.body.actuaciones.length).toBeGreaterThanOrEqual(2);

    // Comprobar que en la base de datos dentro de la transacción existen los registros inmutables
    const rawClient = txPool.getRawClient();
    const movs = await rawClient.query(
      `SELECT evento, estado_nuevo FROM sigd_rut.movimiento_tramite WHERE expediente_id = $1::uuid ORDER BY secuencia ASC`,
      [ID_EXP_SEC],
    );
    expect(movs.rows.map((r: { evento: string }) => r.evento)).toContain('RECEPCION');

    const folios = await rawClient.query(
      `SELECT folio_inicio, folio_fin FROM sigd_tra.expediente_documento_folio WHERE expediente_id = $1::uuid`,
      [ID_EXP_SEC],
    );
    expect(folios.rows.length).toBe(1);
    expect(folios.rows[0].folio_inicio).toBe(1);
    expect(folios.rows[0].folio_fin).toBe(3);
  });

  it('6. Caso A3 — Rederivación por GESTOR_APOYO_AREA hacia Archivo Central', async () => {
    const respuesta = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_SEC}/derivar`)
      .set('Authorization', `Bearer ${tokenGestorApoyoSec}`)
      .send({
        destinos: [{ area_destino_id: AREA_AC, es_copia: false }],
        proveido: 'Pase a Archivo Central para custodia documental y archivo',
      });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    expect(respuesta.body.nuevoEstado).toBe('DERIVADO');
    expect(respuesta.body.expediente_id).toBe(ID_EXP_SEC);
  });

  it('7. RBAC Negativo — Rechazar atención resolutiva (GESTOR_APOYO_AREA carece de EXPEDIENTE_RESOLVER)', async () => {
    const respuesta = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_SEC}/atender`)
      .set('Authorization', `Bearer ${tokenGestorApoyoSec}`)
      .send({ resultado_resumen: 'Intento resolutivo no autorizado por gestor de apoyo' });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.code).toBe('FORBIDDEN');
  });
});
