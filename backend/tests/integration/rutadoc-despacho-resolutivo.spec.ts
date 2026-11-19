import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { TransactionalTestPool, type HashesTablas, type EstadoSecuencia } from '../helpers/transactional-pool.helper.js';
import { MinioTestHelper } from '../helpers/minio-test.helper.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';
import { construirApp } from '../../src/app.js';
import type { Express } from 'express';

const envPath = fs.existsSync(path.resolve('.env'))
  ? path.resolve('.env')
  : path.resolve('backend/.env');
dotenv.config({ path: envPath });
process.env.AUTH_JWT_SECRET ??= 'jrxd5PYrvRoesjxXyHin4dGieC_cF0X06l0d_EJ59YiKNPjx4e_9Dq430LowQpyL';
process.env.S3_BUCKET = 'sigd-sandbox-e2e';

describe('TSK-DEV-05.1 — Despacho Resolutivo, Ciclo de Vida y Reconciliación en Detalle de Expediente', () => {
  let txPool: TransactionalTestPool;
  let minioHelper: MinioTestHelper;
  let app: Express;
  let preHashes: HashesTablas;
  let preSecuencia: EstadoSecuencia;
  let conteoMinioInicial: number;

  // Tokens
  let tokenDirector: string;
  let tokenGestorApoyo: string;

  // IDs Fixtures
  const ID_INSTITUCION = '018f9805-51aa-7000-8111-2b00c3f00001';
  const AREA_MP = 'a1a3a496-ff7f-45d8-b63c-3e54fcf79de1';
  const AREA_SEC = '2b147b0d-7c8f-434f-b75a-598a1ccb855b';

  const ROL_DIRECTOR = 'bdb75c0c-6d3a-4801-8d3a-41084b26f926';
  const CAP_GESTOR = '4c010000-0000-4000-8000-000000000001';

  const USR_DIR_ID = '88888888-0000-0000-0000-000000000091';
  const USR_GEST_ID = '88888888-0000-0000-0000-000000000092';

  const PER_DIR_ID = '88888888-0000-0000-0000-000000000094';
  const PER_GEST_ID = '88888888-0000-0000-0000-000000000095';

  const CTX_DIR = '88888888-0000-0000-0000-000000000097';
  const CTX_GEST = '88888888-0000-0000-0000-000000000098';

  // Expedientes de prueba
  const ID_EXP_BORRADOR = '88888888-0000-0000-0000-000000000101';
  const ID_EXP_EN_FIRMA = '88888888-0000-0000-0000-000000000102';
  const ID_EXP_FIRMADA = '88888888-0000-0000-0000-000000000103';
  const ID_EXP_SIN_RES = '88888888-0000-0000-0000-000000000104';
  const ID_EXP_SIN_PDF = '88888888-0000-0000-0000-000000000105';

  // Resoluciones
  const ID_RES_BORRADOR = '88888888-0000-0000-0000-000000000201';
  const ID_RES_EN_FIRMA = '88888888-0000-0000-0000-000000000202';
  const ID_RES_FIRMADA = '88888888-0000-0000-0000-000000000203';
  const ID_RES_SIN_PDF = '88888888-0000-0000-0000-000000000205';

  // Documentos adjuntos
  const ID_DOC_PDF_BORRADOR = '88888888-0000-0000-0000-000000000301';
  const ID_DOC_PDF_EN_FIRMA = '88888888-0000-0000-0000-000000000302';
  const ID_DOC_PDF_FIRMADO = '88888888-0000-0000-0000-000000000303';

  const TIPO_DOC_FUT = 'b7f37bde-ec45-49d0-b28e-fc2ad4341b60';
  const TIPO_TRAMITE_TUPA = '18cc2baf-92e9-4834-bb1f-8e698fc417f2';
  const DUMMY_HASH_ARGON2 = '$argon2id$v=19$m=65536,p=4,t=3$pZditvO4UISe7Gm8wqo9oA$BuLgyjSdHz1nfbwEN6J21QPg02eBpa6q/z7eaFLuSHs';

  beforeAll(async () => {
    minioHelper = new MinioTestHelper();
    conteoMinioInicial = await minioHelper.contarObjetosEnBucket();
    expect(conteoMinioInicial).toBe(347);

    txPool = new TransactionalTestPool();
    preHashes = await txPool.obtenerHashesTablasCriticas();
    preSecuencia = await txPool.obtenerEstadoSecuenciaAsiento();
    expect(preSecuencia.last_value).toBe('10227');

    await txPool.init();
    const rawClient = txPool.getRawClient();

    // 1. Fixtures de Usuarios y Personas
    const usuarios = [
      { id: USR_DIR_ID, per: PER_DIR_ID, usr: 'director.m51', nom: 'Director General M51', doc: '80000091' },
      { id: USR_GEST_ID, per: PER_GEST_ID, usr: 'gestor.apoyo.m51', nom: 'Gestor Apoyo M51', doc: '80000092' },
    ];

    for (const u of usuarios) {
      await rawClient.query(`
        INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
        VALUES ($1::uuid, 'NATURAL', $2)
        ON CONFLICT (id_persona) DO NOTHING
      `, [u.per, u.doc]);

      await rawClient.query(`
        INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, sexo)
        VALUES ($1::uuid, $2, 'Test', $2, 'M')
        ON CONFLICT (id_persona) DO NOTHING
      `, [u.per, u.nom]);

      await rawClient.query(`
        INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, true)
        ON CONFLICT (id_usuario) DO NOTHING
      `, [u.id, u.per, u.usr, `${u.usr}@iestp-suiza.edu.pe`, DUMMY_HASH_ARGON2]);

      await rawClient.query(`
        INSERT INTO sigd_auth.usuario_institucion (id_usuario, institucion_id, activo)
        VALUES ($1::uuid, $2::uuid, true)
        ON CONFLICT (id_usuario, institucion_id) DO NOTHING
      `, [u.id, ID_INSTITUCION]);

      const opId = parseInt(u.doc, 10);
      await rawClient.query(`
        INSERT INTO sigd_auth.operador_identidad (id_usuario, operador_id)
        VALUES ($1::uuid, $2)
        ON CONFLICT (id_usuario) DO NOTHING
      `, [u.id, opId]);
    }

    // Roles y Facultades
    await rawClient.query(`
      INSERT INTO sigd_org.usuario_rol (
        id_usuario_rol, id_usuario, rol_id, area_id, institucion_id, vigente_desde
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, now() - INTERVAL '1 day')
    `, [CTX_DIR, USR_DIR_ID, ROL_DIRECTOR, AREA_MP, ID_INSTITUCION]);

    await rawClient.query(`
      INSERT INTO sigd_org.usuario_capacidad (
        id_usuario_capacidad, id_usuario, id_capacidad, area_id, asignado_por, activo, vigente_desde, justificacion
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, true, now(), 'Asignación Gestor Apoyo M51'
      )
    `, [CTX_GEST, USR_GEST_ID, CAP_GESTOR, AREA_SEC, USR_DIR_ID]);

    // 2. Expedientes de Prueba
    const exps = [
      { id: ID_EXP_BORRADOR, cut: 'EXP-2026-000501', num: 'NUM-M51-01', estado: 'EN_REVISION' },
      { id: ID_EXP_EN_FIRMA, cut: 'EXP-2026-000502', num: 'NUM-M51-02', estado: 'EN_FIRMA' },
      { id: ID_EXP_FIRMADA, cut: 'EXP-2026-000503', num: 'NUM-M51-03', estado: 'RESUELTO' },
      { id: ID_EXP_SIN_RES, cut: 'EXP-2026-000504', num: 'NUM-M51-04', estado: 'EN_REVISION' },
      { id: ID_EXP_SIN_PDF, cut: 'EXP-2026-000505', num: 'NUM-M51-05', estado: 'EN_REVISION' },
    ];

    for (const exp of exps) {
      await rawClient.query(`
        INSERT INTO sigd_tra.expediente (
          expediente_id, codigo_expediente, numero, tipo_documental_id,
          solicitante_id, area_destino_id, estado, fecha_radicacion
        ) VALUES (
          $1::uuid, $2, $7, $3::uuid,
          $4::uuid, $5::uuid, $6, CURRENT_TIMESTAMP
        )
      `, [exp.id, exp.cut, TIPO_DOC_FUT, PER_DIR_ID, AREA_MP, exp.estado, exp.num]);

      await rawClient.query(`
        INSERT INTO sigd_doc.expediente (
          expediente_id, tipo_tramite_id, codigo_expediente, asunto, solicitante_id, fecha_registro
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4, $5::uuid, CURRENT_TIMESTAMP
        )
      `, [exp.id, TIPO_TRAMITE_TUPA, exp.cut, `Expediente M51 ${exp.cut}`, PER_DIR_ID]);

      // Movimiento 1: EN_CALIFICACION -> EN_REVISION (valido para todos)
      await rawClient.query(`
        INSERT INTO sigd_rut.movimiento_tramite (
          expediente_id, estado_anterior, evento, estado_nuevo,
          usuario_operador_id, fecha_hora, datos
        ) VALUES (
          $1::uuid, 'EN_CALIFICACION', 'INICIAR_REVISION', 'EN_REVISION',
          80000091, now() - INTERVAL '3 hours', $2::jsonb
        )
      `, [exp.id, JSON.stringify({ areaId: AREA_MP, observaciones: 'Revisión inicial M51' })]);

      // Si el expediente debe quedar en EN_FIRMA o RESUELTO, registrar transiciones FSM canónicas
      if (exp.estado === 'EN_FIRMA' || exp.estado === 'RESUELTO') {
        await rawClient.query(`
          INSERT INTO sigd_rut.movimiento_tramite (
            expediente_id, estado_anterior, evento, estado_nuevo,
            usuario_operador_id, fecha_hora, datos
          ) VALUES (
            $1::uuid, 'EN_REVISION', 'ENVIAR_A_FIRMA', 'EN_FIRMA',
            80000091, now() - INTERVAL '2 hours', $2::jsonb
          )
        `, [exp.id, JSON.stringify({ areaId: AREA_MP, observaciones: 'Pase a firma M51' })]);
      }

      if (exp.estado === 'RESUELTO') {
        await rawClient.query(`
          INSERT INTO sigd_rut.movimiento_tramite (
            expediente_id, estado_anterior, evento, estado_nuevo,
            usuario_operador_id, fecha_hora, datos
          ) VALUES (
            $1::uuid, 'EN_FIRMA', 'FIRMA', 'RESUELTO',
            80000091, now() - INTERVAL '1 hour', $2::jsonb
          )
        `, [exp.id, JSON.stringify({ areaId: AREA_MP, observaciones: 'Suscripción digital M51' })]);
      }
    }

    // 3. Resoluciones Directorales en sigd_doc.resolucion
    // Res 1: BORRADOR_PENDIENTE_FIRMA (Exp 1)
    await rawClient.query(`
      INSERT INTO sigd_doc.resolucion (
        resolucion_id, expediente_id, numero_borrador, numero_resolucion,
        tipo_resolucion, asunto, estado, fecha_proyeccion, proyectado_por
      ) VALUES (
        $1::uuid, $2::uuid, 'RD-2026-000501', 'RD-2026-000501',
        'DIRECTORAL_ADMINISTRATIVA', 'Resolución de prueba en borrador',
        'BORRADOR_PENDIENTE_FIRMA', CURRENT_DATE, $3::uuid
      )
    `, [ID_RES_BORRADOR, ID_EXP_BORRADOR, USR_DIR_ID]);

    await rawClient.query(`
      INSERT INTO sigd_doc.documento_adjunto (
        documento_adjunto_id, expediente_id, tipo_documental_id, nombre_archivo,
        s3_bucket, s3_key, sha256, tamano_bytes, mime_type, magic_bytes, subido_por
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, 'RD-2026-000501.pdf',
        'sigd-sandbox-e2e', 'resoluciones/RD-2026-000501.pdf',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        2048, 'application/pdf', '%PDF-', $4::uuid
      )
    `, [ID_DOC_PDF_BORRADOR, ID_EXP_BORRADOR, TIPO_DOC_FUT, USR_DIR_ID]);

    // Res 2: EN_FIRMA (Exp 2)
    await rawClient.query(`
      INSERT INTO sigd_doc.resolucion (
        resolucion_id, expediente_id, numero_borrador, numero_resolucion,
        tipo_resolucion, asunto, estado, fecha_proyeccion, proyectado_por
      ) VALUES (
        $1::uuid, $2::uuid, 'RD-2026-000502', 'RD-2026-000502',
        'DIRECTORAL_TITULACION', 'Resolución en despacho para firma',
        'EN_FIRMA', CURRENT_DATE, $3::uuid
      )
    `, [ID_RES_EN_FIRMA, ID_EXP_EN_FIRMA, USR_DIR_ID]);

    await rawClient.query(`
      INSERT INTO sigd_doc.documento_adjunto (
        documento_adjunto_id, expediente_id, tipo_documental_id, nombre_archivo,
        s3_bucket, s3_key, sha256, tamano_bytes, mime_type, magic_bytes, subido_por
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, 'RD-2026-000502.pdf',
        'sigd-sandbox-e2e', 'resoluciones/RD-2026-000502.pdf',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        2048, 'application/pdf', '%PDF-', $4::uuid
      )
    `, [ID_DOC_PDF_EN_FIRMA, ID_EXP_EN_FIRMA, TIPO_DOC_FUT, USR_DIR_ID]);

    // Res 3: FIRMADA (Exp 3)
    await rawClient.query(`
      INSERT INTO sigd_doc.resolucion (
        resolucion_id, expediente_id, numero_borrador, numero_resolucion,
        tipo_resolucion, asunto, estado, fecha_proyeccion, proyectado_por,
        firmado_por, firmado_en, hash_pades
      ) VALUES (
        $1::uuid, $2::uuid, 'RD-2026-000503', 'RD-2026-000503-OFICIAL',
        'DIRECTORAL_CONVALIDACION', 'Resolución oficial firmada con PAdES',
        'FIRMADA', CURRENT_DATE - INTERVAL '2 days', $3::uuid,
        $3::uuid, now() - INTERVAL '1 day',
        'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0'
      )
    `, [ID_RES_FIRMADA, ID_EXP_FIRMADA, USR_DIR_ID]);

    await rawClient.query(`
      INSERT INTO sigd_doc.documento_adjunto (
        documento_adjunto_id, expediente_id, tipo_documental_id, nombre_archivo,
        s3_bucket, s3_key, sha256, tamano_bytes, mime_type, magic_bytes, subido_por
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, 'RD-2026-000503.pdf',
        'sigd-sandbox-e2e', 'resoluciones/RD-2026-000503.pdf',
        'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
        4096, 'application/pdf', '%PDF-', $4::uuid
      )
    `, [ID_DOC_PDF_FIRMADO, ID_EXP_FIRMADA, TIPO_DOC_FUT, USR_DIR_ID]);

    await rawClient.query(`
      INSERT INTO sigd_doc.firma_digital_documento (
        documento_id, cvd, sha256_firmado, firmante, fecha_sello_tsa,
        s3_bucket, s3_key, estado
      ) VALUES (
        $1::uuid, 'CVD-2026-M51TEST001',
        'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
        'Director General M51', now() - INTERVAL '1 day',
        'sigd-sandbox-e2e', 'resoluciones/RD-2026-000503.pdf',
        'FIRMADO_DIGITALMENTE'
      )
    `, [ID_DOC_PDF_FIRMADO]);

    // Res 5: BORRADOR SIN PDF (Exp 5)
    await rawClient.query(`
      INSERT INTO sigd_doc.resolucion (
        resolucion_id, expediente_id, numero_borrador, numero_resolucion,
        tipo_resolucion, asunto, estado, fecha_proyeccion, proyectado_por
      ) VALUES (
        $1::uuid, $2::uuid, 'RD-2026-000505', 'RD-2026-000505',
        'DIRECTORAL_ADMINISTRATIVA', 'Resolución sin documento PDF generado',
        'BORRADOR_PENDIENTE_FIRMA', CURRENT_DATE, $3::uuid
      )
    `, [ID_RES_SIN_PDF, ID_EXP_SIN_PDF, USR_DIR_ID]);

    // Tokens JWT
    tokenDirector = firmarTokenAcceso({
      sub: USR_DIR_ID,
      ctx: CTX_DIR,
      roles: ['DIRECTOR'],
    });

    tokenGestorApoyo = firmarTokenAcceso({
      sub: USR_GEST_ID,
      ctx: CTX_GEST,
      roles: ['GESTOR_APOYO_AREA'],
    });

    // App Express con pool transaccional
    app = construirApp(txPool.asPool());
  });

  afterAll(async () => {
    if (minioHelper) {
      await minioHelper.limpiarClavesDePrueba();
      const conteoFinal = await minioHelper.contarObjetosEnBucket();
      expect(conteoFinal).toBe(conteoMinioInicial);
    }

    if (txPool) {
      await txPool.rollbackRootTransaction();
      const postHashes = await txPool.obtenerHashesTablasCriticas();
      const postSecuencia = await txPool.obtenerEstadoSecuenciaAsiento();
      await txPool.rollbackAndClose();

      for (const [tabla, hashPre] of Object.entries(preHashes)) {
        expect(postHashes[tabla], `Violación de inmutabilidad en tabla ${tabla}`).toBe(hashPre);
      }
      expect(postSecuencia.last_value).toBe('10227');
    }
  });

  it('1. GET /api/v1/expedientes/:id expone resolucionInfo enriquecida para expediente con resolución FIRMADA', async () => {
    const res = await request(app)
      .get(`/api/v1/expedientes/${ID_EXP_FIRMADA}`)
      .set('Authorization', `Bearer ${tokenDirector}`);

    expect(res.status).toBe(200);
    expect(res.body.resolucionInfo).toBeDefined();
    expect(res.body.resolucionInfo.resolucionId).toBe(ID_RES_FIRMADA);
    expect(res.body.resolucionInfo.estado).toBe('FIRMADA');
    expect(res.body.resolucionInfo.numeroResolucion).toBe('RD-2026-000503-OFICIAL');
    expect(res.body.resolucionInfo.tipoResolucion).toBe('DIRECTORAL_CONVALIDACION');
    expect(res.body.resolucionInfo.cvd).toBe('CVD-2026-M51TEST001');
    expect(res.body.resolucionInfo.hashPades).toBe('a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0');
    expect(res.body.resolucionInfo.firmanteNombre).toBe('Director General M51');
    expect(res.body.resolucionInfo.documentoAdjuntoId).toBe(ID_DOC_PDF_FIRMADO);
    expect(res.body.resolucionInfo.s3Key).toBeUndefined();
  });

  it('2. GET /api/v1/expedientes/:id expone resolucionInfo: null para expediente sin resolución', async () => {
    const res = await request(app)
      .get(`/api/v1/expedientes/${ID_EXP_SIN_RES}`)
      .set('Authorization', `Bearer ${tokenDirector}`);

    expect(res.status).toBe(200);
    expect(res.body.resolucionInfo).toBeNull();
  });

  it('3. GET /api/v1/resoluciones/expediente/:expedienteId retorna metadatos canónicos de resolución', async () => {
    const res = await request(app)
      .get(`/api/v1/resoluciones/expediente/${ID_EXP_BORRADOR}`)
      .set('Authorization', `Bearer ${tokenDirector}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.resolucion).toBeDefined();
    expect(res.body.resolucion.resolucionId).toBe(ID_RES_BORRADOR);
    expect(res.body.resolucion.estado).toBe('BORRADOR_PENDIENTE_FIRMA');
    expect(res.body.resolucion.numeroBorrador).toBe('RD-2026-000501');
    expect(res.body.resolucion.tipoResolucion).toBe('DIRECTORAL_ADMINISTRATIVA');
    expect(res.body.resolucion.documentoAdjuntoId).toBe(ID_DOC_PDF_BORRADOR);
    expect(res.body.resolucion.s3Key).toBeUndefined();
  });

  it('4. GET /api/v1/resoluciones/expediente/:expedienteId retorna resolucion: null si no existe', async () => {
    const res = await request(app)
      .get(`/api/v1/resoluciones/expediente/${ID_EXP_SIN_RES}`)
      .set('Authorization', `Bearer ${tokenDirector}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.resolucion).toBeNull();
  });

  it('5. POST /api/v1/expedientes/:id/atender eleva a Despacho (EN_REVISION -> EN_FIRMA) y emite outbox', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_BORRADOR}/atender`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({ resultado_resumen: 'Pase a Despacho para firma de prueba M51' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verificar en BD que el expediente cambió a EN_FIRMA
    const rawClient = txPool.getRawClient();
    const expDb = await rawClient.query<{ estado: string }>(
      'SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid',
      [ID_EXP_BORRADOR],
    );
    expect(expDb.rows[0].estado).toBe('EN_FIRMA');

    // Verificar que el movimiento registrado fue ENVIAR_A_FIRMA -> EN_FIRMA
    const movDb = await rawClient.query<{ evento: string; estado_nuevo: string }>(
      'SELECT evento, estado_nuevo FROM sigd_rut.movimiento_tramite WHERE expediente_id = $1::uuid ORDER BY fecha_hora DESC, secuencia DESC LIMIT 1',
      [ID_EXP_BORRADOR],
    );
    expect(movDb.rows[0].evento).toBe('ENVIAR_A_FIRMA');
    expect(movDb.rows[0].estado_nuevo).toBe('EN_FIRMA');

    // Verificar que el evento Outbox ExpedienteEnviadoAFirma fue registrado
    const outboxDb = await rawClient.query<{ tipo_evento: string; payload: any }>(
      `SELECT tipo_evento, payload FROM sigd_audit.evento_outbox
        WHERE tipo_evento = 'ExpedienteEnviadoAFirma'
          AND (payload->'identidad'->>'expediente_id') = $1
        ORDER BY creado_en DESC LIMIT 1`,
      [ID_EXP_BORRADOR],
    );
    expect(outboxDb.rows.length).toBe(1);
    expect(outboxDb.rows[0].tipo_evento).toBe('ExpedienteEnviadoAFirma');
    expect(outboxDb.rows[0].payload.datos_especificos.resolucion_id).toBe(ID_RES_BORRADOR);
    expect(outboxDb.rows[0].payload.datos_especificos.numero_borrador).toBe('RD-2026-000501');
  });

  it('6. POST /api/v1/expedientes/:id/atender rechaza elevación si el expediente carece de borrador de resolución', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_SIN_RES}/atender`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({ resultado_resumen: 'Intento de elevar sin borrador' });

    expect(res.status).toBe(409);
    expect(res.body.code ?? res.body.detail).toMatch(/BORRADOR_RESOLUCION_REQUERIDO/);
  });

  it('7. POST /api/v1/expedientes/:id/atender rechaza elevación si la resolución carece de PDF generado', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_SIN_PDF}/atender`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({ resultado_resumen: 'Intento de elevar sin PDF' });

    expect(res.status).toBe(409);
    expect(res.body.code ?? res.body.detail).toMatch(/DOCUMENTO_FIRMABLE_REQUERIDO/);
  });

  it('8. RBAC: GESTOR_APOYO_AREA tiene prohibido elevar a despacho o proyectar resolución', async () => {
    // 8.1 Prohibido proyectar
    const resProyectar = await request(app)
      .post('/api/v1/resoluciones/proyectar')
      .set('Authorization', `Bearer ${tokenGestorApoyo}`)
      .send({
        expedienteId: ID_EXP_SIN_RES,
        tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
        visto: 'Visto técnico de prueba que excede diez caracteres',
        considerandos: ['Considerando 1 de prueba técnica'],
        articulos: [{ numero: 1, texto: 'Articulo 1 de prueba técnica' }],
      });
    expect([401, 403]).toContain(resProyectar.status);

    // 8.2 Prohibido elevar a despacho
    const resElevar = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_BORRADOR}/atender`)
      .set('Authorization', `Bearer ${tokenGestorApoyo}`)
      .send({ resultado_resumen: 'Intento por gestor de apoyo' });
    expect([401, 403]).toContain(resElevar.status);
  });

  it('9. Inmutabilidad: una resolución FIRMADA permanece protegida contra mutación', async () => {
    const resModificar = await request(app)
      .post('/api/v1/resoluciones/proyectar')
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({
        expedienteId: ID_EXP_FIRMADA,
        tipoResolucion: 'DIRECTORAL_TITULACION',
        visto: 'Visto nuevo intentando sobreescribir resolución firmada',
        considerandos: ['Considerando nuevo de prueba'],
        articulos: [{ numero: 1, texto: 'Articulo nuevo de prueba' }],
      });
    expect([400, 409]).toContain(resModificar.status);
    expect(resModificar.body.code ?? resModificar.body.message).toMatch(/EXPEDIENTE_YA_TIENE_RESOLUCION/);
  });
});
