/**
 * Live Persistence & Infrastructure Validation Script
 * Verifies PostgreSQL 18 tables, WORM SQLSTATE 23001 trigger,
 * MinIO S3 bucket `sigd-expedientes`, and Redis 7 connectivity.
 */

import 'dotenv/config';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import {
  S3Client,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Redis } from 'ioredis';

const PG_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres_password@localhost:5433/sigd_prueba';
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9000';
const S3_BUCKET = process.env.S3_BUCKET || 'sigd-expedientes';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minioadmin';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'minioadminpassword';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function validateLivePersistence() {
  console.log('======================================================================');
  console.log('SIGD LIVE PERSISTENCE & INFRASTRUCTURE VALIDATION');
  console.log('======================================================================\n');

  const pool = new Pool({ connectionString: PG_URL });
  const s3Client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: 'us-east-1',
    credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
    forcePathStyle: true,
  });
  const redisClient = new Redis(REDIS_URL, { lazyConnect: true });

  const report: Record<string, any> = {};

  try {
    // -------------------------------------------------------------------------
    // 1. PostgreSQL 18 Tables Validation
    // -------------------------------------------------------------------------
    console.log('>>> [1] Validating PostgreSQL 18 Tables...');

    // A. sigd_doc.tipo_documento
    const tipoDocRes = await pool.query(
      `SELECT tipo_documental_id, codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente
       FROM sigd_doc.tipo_documento
       ORDER BY codigo ASC LIMIT 5`,
    );
    const tipoDocCount = await pool.query(`SELECT count(*)::int AS count FROM sigd_doc.tipo_documento`);
    console.log(`  [OK] sigd_doc.tipo_documento: ${tipoDocCount.rows[0].count} registros encontrados.`);
    report.tipo_documento = {
      total: tipoDocCount.rows[0].count,
      sample: tipoDocRes.rows,
    };

    // B. sigd_audit.bitacora_auditoria
    const auditRes = await pool.query(
      `SELECT id_auditoria, correlation_id, esquema, tabla, operacion, fecha_hora
       FROM sigd_audit.bitacora_auditoria
       ORDER BY fecha_hora DESC LIMIT 5`,
    );
    const auditCount = await pool.query(`SELECT count(*)::int AS count FROM sigd_audit.bitacora_auditoria`);
    console.log(`  [OK] sigd_audit.bitacora_auditoria: ${auditCount.rows[0].count} registros encontrados.`);
    report.bitacora_auditoria = {
      total: auditCount.rows[0].count,
      sample: auditRes.rows,
    };

    // C. sigd_tra.expediente - Inserción y verificación en vivo
    const cutGenerado = (await pool.query(`SELECT sigd_tra.generar_cut_expediente(2026) AS cut`)).rows[0].cut;
    const testExpId = crypto.randomUUID();
    const persona = (await pool.query(`SELECT id_persona, id_documento FROM sigd_auth.persona LIMIT 1`)).rows[0];
    const tipoDoc = (await pool.query(`SELECT tipo_documental_id FROM sigd_doc.tipo_documento LIMIT 1`)).rows[0];

    await pool.query(
      `INSERT INTO sigd_tra.expediente (
         expediente_id, codigo_expediente, numero, dni_solicitante,
         tipo_documental_id, solicitante_id, estado, fecha_radicacion
       ) VALUES ($1, $2, $2, $3, $4, $5, 'REGISTRADO', now())`,
      [testExpId, cutGenerado, persona.id_documento, tipoDoc.tipo_documental_id, persona.id_persona],
    );
    console.log(`  [OK] Registro insertado en sigd_tra.expediente con CUT ${cutGenerado}.`);

    const expTraRes = await pool.query(
      `SELECT expediente_id, id_expediente, codigo_expediente, numero, dni_solicitante, estado, fecha_radicacion
       FROM sigd_tra.expediente
       WHERE expediente_id = $1`,
      [testExpId],
    );
    assert.equal(expTraRes.rowCount, 1, 'El expediente debe existir en sigd_tra.expediente');
    assert.equal(expTraRes.rows[0].codigo_expediente, cutGenerado);
    assert.equal(expTraRes.rows[0].id_expediente, testExpId);

    const expTraCount = await pool.query(`SELECT count(*)::int AS count FROM sigd_tra.expediente`);
    console.log(`  [OK] sigd_tra.expediente: ${expTraCount.rows[0].count} registros encontrados.`);
    report.expediente = {
      total: expTraCount.rows[0].count,
      sample: expTraRes.rows,
    };

    // D. sigd_doc.documento_adjunto
    const docAdjRes = await pool.query(
      `SELECT documento_adjunto_id, expediente_id, s3_bucket, s3_key, sha256, mime_type, tamano_bytes, creado_en
       FROM sigd_doc.documento_adjunto
       ORDER BY creado_en DESC LIMIT 5`,
    );
    const docAdjCount = await pool.query(`SELECT count(*)::int AS count FROM sigd_doc.documento_adjunto`);
    console.log(`  [OK] sigd_doc.documento_adjunto: ${docAdjCount.rows[0].count} registros encontrados.`);
    report.documento_adjunto = {
      total: docAdjCount.rows[0].count,
      sample: docAdjRes.rows,
    };

    // -------------------------------------------------------------------------
    // 2. WORM SQLSTATE 23001 Invariant Validation
    // -------------------------------------------------------------------------
    console.log('\n>>> [2] Validating WORM Immutability (SQLSTATE 23001)...');

    const testAuditId = crypto.randomUUID();
    const testCorrId = crypto.randomUUID();

    // Insert legitimate record
    await pool.query(
      `INSERT INTO sigd_audit.bitacora_auditoria (
         id_auditoria, correlation_id, esquema, tabla, operacion, datos_despues, fecha_hora
       ) VALUES ($1, $2, 'sigd_audit_test', 'live_validation_worm', 'INSERT', '{"test": true}'::jsonb, now())`,
      [testAuditId, testCorrId],
    );
    console.log(`  [OK] Fila de prueba insertada en sigd_audit.bitacora_auditoria (${testAuditId}).`);

    // Test UPDATE refusal
    let updateSqlState = '';
    let updateErrMsg = '';
    try {
      await pool.query(
        `UPDATE sigd_audit.bitacora_auditoria
            SET operacion = 'TAMPERED'
          WHERE id_auditoria = $1`,
        [testAuditId],
      );
    } catch (err: any) {
      updateSqlState = err.code;
      updateErrMsg = err.message;
    }
    assert.equal(updateSqlState, '23001', `UPDATE debe fallar con SQLSTATE 23001, obtenido: ${updateSqlState}`);
    console.log(`  [OK] UPDATE rechazado con SQLSTATE ${updateSqlState}: "${updateErrMsg}".`);

    // Test DELETE refusal
    let deleteSqlState = '';
    let deleteErrMsg = '';
    try {
      await pool.query(
        `DELETE FROM sigd_audit.bitacora_auditoria
          WHERE id_auditoria = $1`,
        [testAuditId],
      );
    } catch (err: any) {
      deleteSqlState = err.code;
      deleteErrMsg = err.message;
    }
    assert.equal(deleteSqlState, '23001', `DELETE debe fallar con SQLSTATE 23001, obtenido: ${deleteSqlState}`);
    console.log(`  [OK] DELETE rechazado con SQLSTATE ${deleteSqlState}: "${deleteErrMsg}".`);

    report.worm_validation = {
      testAuditId,
      updateSqlState,
      updateErrMsg,
      deleteSqlState,
      deleteErrMsg,
      status: 'VERIFIED_STRICT_WORM_23001',
    };

    // -------------------------------------------------------------------------
    // 3. MinIO S3 Storage Validation
    // -------------------------------------------------------------------------
    console.log('\n>>> [3] Validating MinIO S3 Storage...');

    // HeadBucket
    await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
    console.log(`  [OK] Bucket "${S3_BUCKET}" existe y es accesible.`);

    // List objects
    const listRes = await s3Client.send(new ListObjectsV2Command({ Bucket: S3_BUCKET, MaxKeys: 10 }));
    console.log(`  [OK] Objetos encontrados en el bucket: ${listRes.KeyCount ?? 0}.`);
    const objectKeys = listRes.Contents?.map((c) => ({ key: c.Key, size: c.Size, lastModified: c.LastModified })) || [];

    // Probe write/read/delete
    const probeKey = `live-probe/validation_${Date.now()}.txt`;
    const probeBody = Buffer.from('IESTP SUIZA - PERSISTENCIA MINIO LIVE VALIDATION ' + new Date().toISOString(), 'utf-8');
    const probeSha256 = crypto.createHash('sha256').update(probeBody).digest('hex');

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: probeKey,
        Body: probeBody,
        ContentType: 'text/plain',
      }),
    );
    console.log(`  [OK] Objeto sonda subido a MinIO (${probeKey}).`);

    const getRes = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: probeKey }));
    const readBytes = await getRes.Body?.transformToByteArray();
    const readSha256 = crypto.createHash('sha256').update(readBytes!).digest('hex');
    assert.equal(readSha256, probeSha256, 'El hash SHA-256 del objeto leído debe coincidir');
    console.log(`  [OK] Objeto sonda verificado con integridad SHA-256 (${readSha256}).`);

    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: probeKey }));
    console.log(`  [OK] Objeto sonda limpiado.`);

    report.minio_validation = {
      bucket: S3_BUCKET,
      endpoint: S3_ENDPOINT,
      sampleObjects: objectKeys,
      probeValidation: {
        probeKey,
        sha256: probeSha256,
        status: 'VERIFIED',
      },
    };

    // -------------------------------------------------------------------------
    // 4. Redis 7 Connectivity Validation
    // -------------------------------------------------------------------------
    console.log('\n>>> [4] Validating Redis 7 Connectivity...');
    await redisClient.connect().catch(() => {});
    const ping = await redisClient.ping();
    assert.equal(ping, 'PONG', 'Redis ping debe retornar PONG');
    console.log(`  [OK] Redis PING -> ${ping}.`);

    const testRedisKey = `probe:test:${Date.now()}`;
    await redisClient.set(testRedisKey, 'VALIDATED', 'EX', 60);
    const retrievedVal = await redisClient.get(testRedisKey);
    assert.equal(retrievedVal, 'VALIDATED');
    await redisClient.del(testRedisKey);
    console.log(`  [OK] Redis SET/GET/DEL operaciones comprobadas.`);

    report.redis_validation = {
      url: REDIS_URL,
      ping: 'PONG',
      status: 'VERIFIED',
    };

    console.log('\n======================================================================');
    console.log('ALL LIVE PERSISTENCE & INFRASTRUCTURE CHECKS PASSED (100% SUCCESS)');
    console.log('======================================================================\n');
    console.log('SUMMARY REPORT:\n', JSON.stringify(report, null, 2));

    return true;
  } finally {
    await pool.end().catch(() => {});
    await redisClient.quit().catch(() => {});
  }
}

validateLivePersistence()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Validation failed with error:', err);
    process.exit(1);
  });
