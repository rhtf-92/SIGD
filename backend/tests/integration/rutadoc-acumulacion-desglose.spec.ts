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

describe('Microtarea 4.2 (TSK-DEV-04.2) — Trazabilidad, Acumulación, Desacumulación y Desglose Documental', () => {
  let txPool: TransactionalTestPool;
  let minioHelper: MinioTestHelper;
  let app: Express;
  let preHashes: HashesTablas;
  let preSecuencia: EstadoSecuencia;
  let conteoMinioInicial: number;

  // Tokens
  let tokenDirector: string;
  let tokenGestorApoyo: string;

  // IDs Constantes de Fixtures
  const ID_INSTITUCION = '018f9805-51aa-7000-8111-2b00c3f00001';
  const AREA_MP = 'a1a3a496-ff7f-45d8-b63c-3e54fcf79de1';
  const AREA_SEC = '2b147b0d-7c8f-434f-b75a-598a1ccb855b';

  const ROL_DIRECTOR = 'bdb75c0c-6d3a-4801-8d3a-41084b26f926';
  const CAP_GESTOR = '4c010000-0000-4000-8000-000000000001';

  const USR_DIR_ID = '99999999-0000-0000-0000-000000000091';
  const USR_GEST_ID = '99999999-0000-0000-0000-000000000092';

  const PER_DIR_ID = '99999999-0000-0000-0000-000000000094';
  const PER_GEST_ID = '99999999-0000-0000-0000-000000000095';

  const CTX_DIR = '99999999-0000-0000-0000-000000000097';
  const CTX_GEST = '99999999-0000-0000-0000-000000000098';

  // Expedientes para Acumulación y Desacumulación
  const ID_EXP_PRINCIPAL = '99999999-0000-0000-0000-000000000201';
  const ID_EXP_ACCESORIO_1 = '99999999-0000-0000-0000-000000000202';
  const ID_EXP_ACCESORIO_2 = '99999999-0000-0000-0000-000000000203';
  const ID_EXP_DESGLOSE = '99999999-0000-0000-0000-000000000204';

  // Documentos adjuntos para desglose
  const DOC_ORIGINAL_ID = '99999999-0000-0000-0000-000000000301';
  const DOC_SUSTITUTO_ID = '99999999-0000-0000-0000-000000000302';

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

    // 1. Fixtures de Usuarios
    const usuarios = [
      { id: USR_DIR_ID, per: PER_DIR_ID, usr: 'director.m42', nom: 'Director General', doc: '70000091' },
      { id: USR_GEST_ID, per: PER_GEST_ID, usr: 'gestor.apoyo.m42', nom: 'Gestor de Apoyo', doc: '70000092' },
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

    // 2. Roles y Capacidades
    // 2.1 Director (posee rol DIRECTOR con facultades globales de derivar y resolver)
    await rawClient.query(`
      INSERT INTO sigd_org.usuario_rol (
        id_usuario_rol, id_usuario, rol_id, area_id, institucion_id, vigente_desde
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, now() - INTERVAL '1 day')
    `, [CTX_DIR, USR_DIR_ID, ROL_DIRECTOR, AREA_MP, ID_INSTITUCION]);

    // 2.2 Gestor de Apoyo al Área (posee exclusivamente capacidad GESTOR_APOYO_AREA en AREA_SEC)
    await rawClient.query(`
      INSERT INTO sigd_org.usuario_capacidad (
        id_usuario_capacidad, id_usuario, id_capacidad, area_id, asignado_por, activo, vigente_desde, justificacion
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, true, now(), 'Asignación de prueba Gestor Apoyo'
      )
    `, [CTX_GEST, USR_GEST_ID, CAP_GESTOR, AREA_SEC, USR_DIR_ID]);

    // 3. Crear Expedientes de Prueba
    const expedientes = [
      { id: ID_EXP_PRINCIPAL, cut: 'EXP-2026-000201', num: 'NUM-201', estado: 'EN_REVISION' },
      { id: ID_EXP_ACCESORIO_1, cut: 'EXP-2026-000202', num: 'NUM-202', estado: 'EN_REVISION' },
      { id: ID_EXP_ACCESORIO_2, cut: 'EXP-2026-000203', num: 'NUM-203', estado: 'EN_REVISION' },
      { id: ID_EXP_DESGLOSE, cut: 'EXP-2026-000204', num: 'NUM-204', estado: 'EN_REVISION' },
    ];

    for (const exp of expedientes) {
      await rawClient.query(`
        INSERT INTO sigd_tra.expediente (
          expediente_id, codigo_expediente, numero, tipo_documental_id,
          solicitante_id, area_destino_id, estado, fecha_radicacion
        ) VALUES (
          $1::uuid, $2, $3, $4::uuid,
          $5::uuid, $6::uuid, $7, CURRENT_TIMESTAMP
        )
      `, [exp.id, exp.cut, exp.num, TIPO_DOC_FUT, PER_DIR_ID, AREA_MP, exp.estado]);

      await rawClient.query(`
        INSERT INTO sigd_doc.expediente (
          expediente_id, tipo_tramite_id, codigo_expediente, asunto, solicitante_id, fecha_registro
        ) VALUES (
          $1::uuid, $2::uuid, $3, 'Expediente de prueba M4.2', $4::uuid, CURRENT_TIMESTAMP
        )
      `, [exp.id, TIPO_TRAMITE_TUPA, exp.cut, PER_DIR_ID]);

      await rawClient.query(`
        INSERT INTO sigd_rut.movimiento_tramite (
          expediente_id, estado_anterior, evento, estado_nuevo,
          usuario_operador_id, fecha_hora, datos
        ) VALUES (
          $1::uuid, 'EN_CALIFICACION', 'INICIAR_REVISION', 'EN_REVISION',
          70000091, now(), $2::jsonb
        )
      `, [exp.id, JSON.stringify({ areaId: AREA_MP, observaciones: 'Revisión técnica de expediente' })]);
    }

    // 4. Crear Documentos y Foliación para ID_EXP_DESGLOSE
    await rawClient.query(`
      INSERT INTO sigd_doc.documento_adjunto (
        documento_adjunto_id, expediente_id, tipo_documental_id, nombre_archivo,
        s3_bucket, s3_key, sha256, tamano_bytes, mime_type, magic_bytes, subido_por, creado_en
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, 'certificado_estudios_original.pdf',
        'sigd-sandbox-e2e', 'test/certificado_original.pdf',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        1024, 'application/pdf', '%PDF-', $4::uuid, CURRENT_TIMESTAMP
      )
    `, [DOC_ORIGINAL_ID, ID_EXP_DESGLOSE, TIPO_DOC_FUT, USR_DIR_ID]);

    await rawClient.query(`
      INSERT INTO sigd_tra.expediente_documento_folio (
        expediente_id, id_documento, folio_inicio, folio_fin, asignado_por
      ) VALUES ($1::uuid, $2::uuid, 1, 3, $3::uuid)
    `, [ID_EXP_DESGLOSE, DOC_ORIGINAL_ID, USR_DIR_ID]);

    await rawClient.query(`
      INSERT INTO sigd_doc.documento_adjunto (
        documento_adjunto_id, expediente_id, tipo_documental_id, nombre_archivo,
        s3_bucket, s3_key, sha256, tamano_bytes, mime_type, magic_bytes, subido_por, creado_en
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, 'copia_autenticada_fedateada.pdf',
        'sigd-sandbox-e2e', 'test/copia_fedateada.pdf',
        'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
        2048, 'application/pdf', '%PDF-', $4::uuid, CURRENT_TIMESTAMP
      )
    `, [DOC_SUSTITUTO_ID, ID_EXP_DESGLOSE, TIPO_DOC_FUT, USR_DIR_ID]);

    // 5. Emitir Tokens JWT
    tokenDirector = firmarTokenAcceso({
      sub: USR_DIR_ID,
      ctx: CTX_DIR,
      roles: ['DIRECTOR'],
    });

    tokenGestorApoyo = firmarTokenAcceso({
      sub: USR_GEST_ID,
      ctx: CTX_GEST,
      roles: [],
    });

    // Construir aplicación con pool transaccional
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

  it('01. Acumulación formal con payload canónico (expedienteAccesorioId) — vincula accesorio al principal', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_PRINCIPAL}/acumular`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({
        expedienteAccesorioId: ID_EXP_ACCESORIO_1,
        actoResolutivo: 'Resolución Directoral N° 045-2026-IESTP-SUIZA (Acumulación)',
        motivo: 'Conexidad objetiva y subjetiva entre los trámites según Art. 160 LPAG',
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.expedientePrincipalId).toBe(ID_EXP_PRINCIPAL);
    expect(res.body.expedienteAccesorioId).toBe(ID_EXP_ACCESORIO_1);
    expect(res.body.idAcumulacion).toBeDefined();

    const client = txPool.getRawClient();
    const dbAcum = await client.query<{ estado: string }>(
      'SELECT estado FROM sigd_tra.expediente_acumulacion WHERE id_acumulacion = $1::uuid',
      [res.body.idAcumulacion],
    );
    expect(dbAcum.rowCount).toBe(1);
    expect(dbAcum.rows[0].estado).toBe('ACUMULADO');
  });

  it('02. Acumulación formal con payload de frontend (expedientesConexos: string[]) — compatibilidad bidireccional', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_PRINCIPAL}/acumular`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({
        expedientesConexos: [ID_EXP_ACCESORIO_2],
        motivo: 'Acumulación de segundo expediente conexo desde el modal de frontend',
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.expedientePrincipalId).toBe(ID_EXP_PRINCIPAL);
    expect(res.body.expedienteAccesorioId).toBe(ID_EXP_ACCESORIO_2);
    expect(res.body.idAcumulacion).toBeDefined();
  });

  it('03. Prevención de auto-acumulación — rechaza acumular un expediente a sí mismo con HTTP 400', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_PRINCIPAL}/acumular`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({
        expedienteAccesorioId: ID_EXP_PRINCIPAL,
        motivo: 'Intento indebido de auto-acumulación',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body)).toMatch(/mismo/i);
  });

  it('04. Prevención de acumulación duplicada activa — rechaza acumular un accesorio ya acumulado con HTTP 409', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_PRINCIPAL}/acumular`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({
        expedienteAccesorioId: ID_EXP_ACCESORIO_1,
        motivo: 'Intento de acumular nuevamente el mismo accesorio',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EXPEDIENTE_YA_ACUMULADO');
  });

  it('05. Prevención de ciclos de acumulación — rechaza acumulación recíproca con HTTP 409', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_ACCESORIO_1}/acumular`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({
        expedienteAccesorioId: ID_EXP_PRINCIPAL,
        motivo: 'Intento de ciclo recíproco',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CICLO_ACUMULACION_DETECTADO');
  });

  it('06. Listar acumulaciones de expediente — devuelve principal y accesorios con rol correspondiente', async () => {
    const res = await request(app)
      .get(`/api/v1/expedientes/${ID_EXP_PRINCIPAL}/acumulaciones`)
      .set('Authorization', `Bearer ${tokenDirector}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.acumulaciones)).toBe(true);
    expect(res.body.acumulaciones.length).toBeGreaterThanOrEqual(2);
    expect(res.body.acumulaciones[0].rol_en_acumulacion).toBe('PRINCIPAL');
  });

  it('07. Desacumulación formal (Art. 160 LPAG) — revierte acumulación a DESACUMULADO registrando fecha, motivo y acto', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_PRINCIPAL}/desacumular`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({
        expedienteAccesorioId: ID_EXP_ACCESORIO_1,
        actoDesacumulacion: 'Resolución de Desacumulación N° 012-2026',
        motivo: 'Habiéndose resuelto la cuestión incidental conexa, procede trámite independiente',
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.expedientePrincipalId).toBe(ID_EXP_PRINCIPAL);
    expect(res.body.expedienteAccesorioId).toBe(ID_EXP_ACCESORIO_1);

    const client = txPool.getRawClient();
    const dbAcum = await client.query<{ estado: string; fecha_desacumulacion: string; motivo_desacumulacion: string }>(
      'SELECT estado, fecha_desacumulacion, motivo_desacumulacion FROM sigd_tra.expediente_acumulacion WHERE expediente_principal = $1::uuid AND expediente_accesorio = $2::uuid',
      [ID_EXP_PRINCIPAL, ID_EXP_ACCESORIO_1],
    );
    expect(dbAcum.rowCount).toBe(1);
    expect(dbAcum.rows[0].estado).toBe('DESACUMULADO');
    expect(dbAcum.rows[0].fecha_desacumulacion).not.toBeNull();
    expect(dbAcum.rows[0].motivo_desacumulacion).toContain('incidental');
  });

  it('08. Desacumulación de relación inexistente o ya desacumulada — rechaza con HTTP 404', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_PRINCIPAL}/desacumular`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({
        expedienteAccesorioId: ID_EXP_ACCESORIO_1,
        motivo: 'Intento de desacumular expediente ya desacumulado',
      });

    expect(res.status).toBe(404);
  });

  it('09. Desglose documental formal (Art. 170 LPAG) — registra retiro de original e individualiza solicitante y folios', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_DESGLOSE}/desglose`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({
        documentoAdjuntoId: DOC_ORIGINAL_ID,
        actoAutorizacion: 'Proveído Jefatura N° 108-2026-MP',
        motivoDesglose: 'Devolución de certificado de estudios original al administrado',
        solicitanteNombre: 'Juan Perez Administrado',
        solicitanteDocumento: '44556677',
        documentoSustitutorioId: DOC_SUSTITUTO_ID,
        observaciones: 'Se deja copia autenticada/fedateada en el mismo legajo',
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.idDesglose).toBeDefined();
    expect(res.body.folioInicio).toBe(1);
    expect(res.body.folioFin).toBe(3);
    expect(res.body.cantidadFolios).toBe(3);

    const client = txPool.getRawClient();
    const docDb = await client.query<{ desglosado: boolean }>(
      'SELECT desglosado FROM sigd_doc.documento_adjunto WHERE documento_adjunto_id = $1::uuid',
      [DOC_ORIGINAL_ID],
    );
    expect(docDb.rows[0].desglosado).toBe(true);
  });

  it('10. Inalterabilidad de la foliación continua (AGN) — comprueba que los folios en expediente_documento_folio se mantienen intactos', async () => {
    const client = txPool.getRawClient();
    const foliosDb = await client.query<{ folio_inicio: number; folio_fin: number }>(
      'SELECT folio_inicio, folio_fin FROM sigd_tra.expediente_documento_folio WHERE expediente_id = $1::uuid',
      [ID_EXP_DESGLOSE],
    );
    // La fila de foliación correlativa existe inmutable F. 1 a F. 3
    expect(foliosDb.rowCount).toBe(1);
    expect(foliosDb.rows[0].folio_inicio).toBe(1);
    expect(foliosDb.rows[0].folio_fin).toBe(3);
  });

  it('11. Prevención de re-desglose — rechaza desglosar un documento ya desglosado con HTTP 409', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_DESGLOSE}/desglose`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({
        documentoAdjuntoId: DOC_ORIGINAL_ID,
        actoAutorizacion: 'Proveído Reiterado',
        motivoDesglose: 'Intento de desglose duplicado',
        solicitanteNombre: 'Juan Perez',
        solicitanteDocumento: '44556677',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DOCUMENTO_YA_DESGLOSADO');
  });

  it('12. Listar desgloses de un expediente — devuelve historial completo de piezas retiradas', async () => {
    const res = await request(app)
      .get(`/api/v1/expedientes/${ID_EXP_DESGLOSE}/desgloses`)
      .set('Authorization', `Bearer ${tokenDirector}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.desgloses)).toBe(true);
    expect(res.body.desgloses.length).toBe(1);
    expect(res.body.desgloses[0].documento_nombre).toBe('certificado_estudios_original.pdf');
    expect(res.body.desgloses[0].sustitutorio_nombre).toBe('copia_autenticada_fedateada.pdf');
    expect(res.body.desgloses[0].solicitante_nombre).toBe('Juan Perez Administrado');
  });

  it('13. RBAC: Gestor de Apoyo al Área no puede desacumular (restringido con HTTP 403)', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP_PRINCIPAL}/desacumular`)
      .set('Authorization', `Bearer ${tokenGestorApoyo}`)
      .send({
        expedienteAccesorioId: ID_EXP_ACCESORIO_2,
        motivo: 'Intento de desacumular sin facultades de resolución',
      });

    expect(res.status).toBe(403);
  });
});
