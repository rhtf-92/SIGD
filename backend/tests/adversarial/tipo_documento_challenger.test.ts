/**
 * CHALLENGER 1 — MILESTONE 1: EMPIRICAL VERIFICATION OF sigd_doc.tipo_documento CRUD & AUDIT WORM
 *
 * Target Scope:
 * 1. Duplicate code insertion & PostgreSQL 23505 unique constraint -> RFC 9457 mapping (HTTP 409).
 * 2. Invalid payloads & boundary stress testing (missing required fields, negative max size, invalid MIME, invalid UUIDs).
 * 3. Genuine audit records in sigd_audit.bitacora_auditoria with client-propagated correlation_id.
 * 4. WORM immutability on sigd_audit.bitacora_auditoria (SQLSTATE 23001) under direct UPDATE & DELETE attacks.
 */

import 'dotenv/config';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { construirApp } from '../../src/app.js';
import { BusSse } from '../../src/modules/corelink/sseStream.service.js';
import { serializeError } from '../../src/errors/error-mapper.js';
import { esErrorPostgresql, mapearErrorPostgresql } from '../../src/errors/postgres-error-mapper.js';

process.env.AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET ||
  'super_secret_sigd_iestp_suiza_jwt_entropy_2026_institutional_key_99';

const PG_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres_password@localhost:5433/sigd_prueba';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

interface AssertionResult {
  group: string;
  testId: string;
  description: string;
  passed: boolean;
  durationMs: number;
  details?: Record<string, unknown>;
  error?: string;
}

const suiteResults: AssertionResult[] = [];

async function assertStep(
  group: string,
  testId: string,
  description: string,
  fn: () => Promise<Record<string, unknown> | void>,
): Promise<void> {
  const start = Date.now();
  try {
    const details = (await fn()) || {};
    const durationMs = Date.now() - start;
    console.log(`  [PASS] ${testId}: ${description} (${durationMs}ms)`);
    suiteResults.push({ group, testId, description, passed: true, durationMs, details });
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    console.error(`  [FAIL] ${testId}: ${description} (${durationMs}ms)`);
    console.error(`         ${msg}`);
    suiteResults.push({ group, testId, description, passed: false, durationMs, error: msg });
  }
}

export async function runTipoDocumentoChallengerSuite(): Promise<boolean> {
  console.log('======================================================================');
  console.log('CHALLENGER 1: TIPO_DOCUMENTO CRUD, RFC 9457 & AUDIT WORM SUITE');
  console.log('Adversarial Stress Testing against Live PostgreSQL 18 & Express 5 API');
  console.log('======================================================================\n');

  const pool = new Pool({ connectionString: PG_URL });
  const redisClient = new Redis(REDIS_URL, { lazyConnect: true });
  await redisClient.connect().catch((e: any) => console.warn('Redis notice:', e.message));

  const busSse = new BusSse();
  const ubigeoCache = {
    get: async (k: string) => redisClient.get(k),
    set: async (k: string, v: string, ttl: number) => {
      await redisClient.set(k, v, 'EX', ttl);
    },
  };

  const app = construirApp(pool, { busSse, ubigeoCache });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('No se pudo enlazar el servidor de prueba a un puerto efímero');
  }
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  console.log(`[TEST HARNESS] API montada en: ${baseUrl}\n`);

  try {
    // =========================================================================
    // GROUP 1: DUPLICATE CODE INSERTION & POSTGRESQL 23505 RFC 9457 MAPPING
    // =========================================================================
    console.log('>>> GROUP 1: DUPLICATE CODE INSERTION & 23505 RFC 9457 MAPPING');

    const suffix = Date.now().toString(36).toUpperCase();
    const duplicateCode = `CHAL_DUP_${suffix}`;
    let createdDocId: string = '';

    await assertStep(
      'Group 1',
      'TC-DUP-01',
      'Crear primer tipo de documento legítimo con código único',
      async () => {
        const corrId = crypto.randomUUID();
        const res = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': corrId },
          body: JSON.stringify({
            codigo: duplicateCode,
            nombre: `Documento Desafío ${duplicateCode}`,
            extension: 'pdf',
            mimeType: 'application/pdf',
            tamanoMaximoMb: 20,
            exigeFirma: true,
            vigente: true,
          }),
        });
        assert.equal(res.status, 201, `Debe responder HTTP 201 Created, recibido: ${res.status}`);
        const data = (await res.json()) as any;
        assert.equal(data.codigo, duplicateCode);
        assert.ok(data.tipoDocumentalId);
        createdDocId = data.tipoDocumentalId;
        return { tipoDocumentalId: createdDocId, codigo: duplicateCode };
      },
    );

    await assertStep(
      'Group 1',
      'TC-DUP-02',
      'Inserción de código duplicado idéntico es rechazada con HTTP 409 y RFC 9457',
      async () => {
        const corrId = crypto.randomUUID();
        const res = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': corrId },
          body: JSON.stringify({
            codigo: duplicateCode,
            nombre: `Otro Documento con Mismo Código ${duplicateCode}`,
            extension: 'pdf',
            mimeType: 'application/pdf',
            tamanoMaximoMb: 15,
            exigeFirma: false,
          }),
        });

        assert.equal(res.status, 409, `Debe responder HTTP 409 Conflict, recibido: ${res.status}`);
        const contentType = res.headers.get('content-type') || '';
        assert.ok(
          contentType.includes('application/problem+json'),
          `Content-Type debe ser application/problem+json, recibido: ${contentType}`,
        );

        const problem = (await res.json()) as any;
        assert.equal(problem.status, 409);
        assert.ok(problem.type && problem.type.startsWith('https://'));
        assert.equal(problem.title, 'Conflict');
        assert.equal(problem.code, 'TIPO_DOCUMENTO_CODIGO_DUPLICADO');
        assert.equal(problem.codigo, 'TIPO_DOCUMENTO_CODIGO_DUPLICADO');
        assert.equal(problem.correlation_id, corrId);
        assert.equal(problem.correlationId, corrId);
        assert.match(problem.detail, new RegExp(duplicateCode));

        return { status: problem.status, code: problem.code, correlationId: corrId };
      },
    );

    await assertStep(
      'Group 1',
      'TC-DUP-03',
      'Inserción de código duplicado en minúsculas es normalizada y rechazada con HTTP 409',
      async () => {
        const corrId = crypto.randomUUID();
        const lowerCode = duplicateCode.toLowerCase();
        const res = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': corrId },
          body: JSON.stringify({
            codigo: lowerCode,
            nombre: `Intento en minúsculas ${lowerCode}`,
            extension: 'pdf',
            mimeType: 'application/pdf',
            tamanoMaximoMb: 10,
          }),
        });

        assert.equal(res.status, 409, `Debe responder HTTP 409 por colisión tras normalizar a mayúsculas, recibido: ${res.status}`);
        const problem = (await res.json()) as any;
        assert.equal(problem.code, 'TIPO_DOCUMENTO_CODIGO_DUPLICADO');
        return { normalizedCode: duplicateCode, attemptedLower: lowerCode };
      },
    );

    await assertStep(
      'Group 1',
      'TC-DUP-04',
      'Violación nativa de unicidad PostgreSQL 23505 se mapea con rigor a RFC 9457 DUPLICATE_KEY',
      async () => {
        // 1. Ejecutar INSERT SQL directo con código existente para generar excepción nativa 23505
        let pgErrorCaptured: any = null;
        try {
          await pool.query(
            `INSERT INTO sigd_doc.tipo_documento (codigo, nombre, extension, mime_type, tamano_maximo_mb)
             VALUES ($1, $2, 'pdf', 'application/pdf', 10)`,
            [duplicateCode, 'Intento Directo SQL Duplicado'],
          );
        } catch (err: any) {
          pgErrorCaptured = err;
        }

        assert.ok(pgErrorCaptured, 'PostgreSQL debió rechazar el INSERT directo con código duplicado');
        assert.equal(
          pgErrorCaptured.code,
          '23505',
          `El código SQLSTATE de error nativo de PostgreSQL debe ser 23505, recibido: ${pgErrorCaptured.code}`,
        );
        assert.ok(
          esErrorPostgresql(pgErrorCaptured),
          'La función guard esErrorPostgresql debe identificar el error como error de PostgreSQL',
        );

        // 2. Comprobar que postgres-error-mapper y serializeError mapean el 23505 a status 409
        const mapeoDirecto = mapearErrorPostgresql(pgErrorCaptured);
        assert.equal(mapeoDirecto.status, 409);
        assert.equal(mapeoDirecto.code, 'DUPLICATE_KEY');

        const serializado = serializeError(pgErrorCaptured);
        assert.equal(serializado.status, 409);
        assert.equal(serializado.code, 'DUPLICATE_KEY');
        assert.equal(serializado.detail, 'El registro ya se encuentra registrado.');

        return {
          sqlstate: pgErrorCaptured.code,
          constraint: pgErrorCaptured.constraint,
          mappedStatus: serializado.status,
          mappedCode: serializado.code,
        };
      },
    );

    await assertStep(
      'Group 1',
      'TC-DUP-05',
      'Carrera concurrente (Race Condition): 2 inserciones simultáneas resuelven una 201 y una 409',
      async () => {
        const raceSuffix = Date.now().toString(36).toUpperCase() + '_RACE';
        const raceCode = `CHAL_RACE_${raceSuffix}`;

        const payload = {
          codigo: raceCode,
          nombre: `Documento Concurrente ${raceCode}`,
          extension: 'pdf',
          mimeType: 'application/pdf',
          tamanoMaximoMb: 25,
          exigeFirma: false,
          vigente: true,
        };

        const [p1, p2] = await Promise.all([
          fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': crypto.randomUUID() },
            body: JSON.stringify(payload),
          }),
          fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': crypto.randomUUID() },
            body: JSON.stringify(payload),
          }),
        ]);

        const statuses = [p1.status, p2.status].sort();
        assert.deepEqual(
          statuses,
          [201, 409],
          `Ante dos inserciones simultáneas exactamente idénticas, una debe responder 201 y la otra 409, recibido: ${statuses.join(', ')}`,
        );

        // Limpiar registro de carrera
        await pool.query('DELETE FROM sigd_doc.tipo_documento WHERE codigo = $1', [raceCode]);

        return { raceCode, statuses };
      },
    );

    await assertStep(
      'Group 1',
      'TC-DUP-06',
      'Actualización (PUT) con código duplicado perteneciente a otro documento es rechazada con HTTP 409',
      async () => {
        // Crear Doc B
        const docBCode = `CHAL_DOCB_${suffix}`;
        const resB = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigo: docBCode,
            nombre: 'Documento B',
            extension: 'pdf',
            mimeType: 'application/pdf',
          }),
        });
        const docB = (await resB.json()) as any;
        const idDocB = docB.tipoDocumentalId;

        // Intentar actualizar Doc B con el código de Doc A (duplicateCode)
        const updateRes = await fetch(`${baseUrl}/api/v1/admin/tipos-documento/${idDocB}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: duplicateCode }),
        });
        assert.equal(updateRes.status, 409, `PUT con código de otro documento debe responder 409, recibido: ${updateRes.status}`);
        const updateProblem = (await updateRes.json()) as any;
        assert.equal(updateProblem.code, 'TIPO_DOCUMENTO_CODIGO_DUPLICADO');

        // Actualizar Doc B con su PROPIO código (idempotencia) -> Debe responder 200 OK
        const selfUpdateRes = await fetch(`${baseUrl}/api/v1/admin/tipos-documento/${idDocB}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: docBCode, nombre: 'Documento B Actualizado' }),
        });
        assert.equal(selfUpdateRes.status, 200, `PUT con su propio código no debe causar falso conflicto, recibido: ${selfUpdateRes.status}`);

        // Limpiar Doc B
        await pool.query('DELETE FROM sigd_doc.tipo_documento WHERE tipo_documental_id = $1', [idDocB]);

        return { idDocB, docBCode, conflictAttemptWith: duplicateCode };
      },
    );

    // =========================================================================
    // GROUP 2: INVALID PAYLOADS & BOUNDARY STRESS TESTING
    // =========================================================================
    console.log('\n>>> GROUP 2: INVALID PAYLOADS & BOUNDARY STRESS TESTING');

    await assertStep(
      'Group 2',
      'TC-VAL-01',
      'Payload vacío {} es rechazado con HTTP 400 y RFC 9457 listando campos requeridos',
      async () => {
        const corrId = crypto.randomUUID();
        const res = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': corrId },
          body: JSON.stringify({}),
        });

        assert.equal(res.status, 400, `Debe responder HTTP 400, recibido: ${res.status}`);
        const body = (await res.json()) as any;
        assert.equal(body.code, 'VALIDATION_ERROR');
        assert.equal(body.codigo, 'VALIDATION_ERROR');
        assert.equal(body.correlation_id, corrId);
        assert.ok(Array.isArray(body.invalid_params));
        const nombresCampos = body.invalid_params.map((p: any) => p.name || p.campo);
        assert.ok(nombresCampos.includes('codigo'), 'Debe reportar falta de campo "codigo"');
        assert.ok(nombresCampos.includes('nombre'), 'Debe reportar falta de campo "nombre"');
        return { invalidParams: body.invalid_params };
      },
    );

    await assertStep(
      'Group 2',
      'TC-VAL-02',
      'Payload sin campo "codigo" es rechazado con HTTP 400',
      async () => {
        const res = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: 'Documento Sin Código' }),
        });
        assert.equal(res.status, 400);
        const body = (await res.json()) as any;
        const paramNames = body.invalid_params.map((p: any) => p.name || p.campo);
        assert.ok(paramNames.includes('codigo'));
        return { reportedField: 'codigo' };
      },
    );

    await assertStep(
      'Group 2',
      'TC-VAL-03',
      'Payload sin campo "nombre" es rechazado con HTTP 400',
      async () => {
        const res = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: 'DOC_SIN_NOMBRE' }),
        });
        assert.equal(res.status, 400);
        const body = (await res.json()) as any;
        const paramNames = body.invalid_params.map((p: any) => p.name || p.campo);
        assert.ok(paramNames.includes('nombre'));
        return { reportedField: 'nombre' };
      },
    );

    await assertStep(
      'Group 2',
      'TC-VAL-04',
      'Tamaño máximo negativo (tamanoMaximoMb: -10) es rechazado con HTTP 400',
      async () => {
        const res = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigo: 'DOC_NEG_MB',
            nombre: 'Documento Tamaño Negativo',
            tamanoMaximoMb: -10,
          }),
        });
        assert.equal(res.status, 400);
        const body = (await res.json()) as any;
        const paramNames = body.invalid_params.map((p: any) => p.name || p.campo);
        assert.ok(paramNames.includes('tamanoMaximoMb'));
        return { reportedField: 'tamanoMaximoMb', testedValue: -10 };
      },
    );

    await assertStep(
      'Group 2',
      'TC-VAL-05',
      'Tamaño máximo cero (tamanoMaximoMb: 0) es rechazado con HTTP 400',
      async () => {
        const res = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigo: 'DOC_ZERO_MB',
            nombre: 'Documento Tamaño Cero',
            tamanoMaximoMb: 0,
          }),
        });
        assert.equal(res.status, 400);
        const body = (await res.json()) as any;
        const paramNames = body.invalid_params.map((p: any) => p.name || p.campo);
        assert.ok(paramNames.includes('tamanoMaximoMb'));
        return { reportedField: 'tamanoMaximoMb', testedValue: 0 };
      },
    );

    await assertStep(
      'Group 2',
      'TC-VAL-06',
      'Tamaño máximo superior a 100 MB (tamanoMaximoMb: 101) es rechazado con HTTP 400',
      async () => {
        const res = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigo: 'DOC_OVER_MB',
            nombre: 'Documento Tamaño Excesivo',
            tamanoMaximoMb: 101,
          }),
        });
        assert.equal(res.status, 400);
        const body = (await res.json()) as any;
        const paramNames = body.invalid_params.map((p: any) => p.name || p.campo);
        assert.ok(paramNames.includes('tamanoMaximoMb'));
        return { reportedField: 'tamanoMaximoMb', testedValue: 101 };
      },
    );

    await assertStep(
      'Group 2',
      'TC-VAL-07',
      'Código menor a 2 caracteres (codigo: "A") es rechazado con HTTP 400',
      async () => {
        const res = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: 'A', nombre: 'Documento Código Corto' }),
        });
        assert.equal(res.status, 400);
        const body = (await res.json()) as any;
        const paramNames = body.invalid_params.map((p: any) => p.name || p.campo);
        assert.ok(paramNames.includes('codigo'));
        return { testedCode: 'A' };
      },
    );

    await assertStep(
      'Group 2',
      'TC-VAL-08',
      'Código mayor a 30 caracteres es rechazado con HTTP 400',
      async () => {
        const longCode = 'A'.repeat(31);
        const res = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: longCode, nombre: 'Documento Código Largo' }),
        });
        assert.equal(res.status, 400);
        const body = (await res.json()) as any;
        const paramNames = body.invalid_params.map((p: any) => p.name || p.campo);
        assert.ok(paramNames.includes('codigo'));
        return { length: longCode.length };
      },
    );

    await assertStep(
      'Group 2',
      'TC-VAL-09',
      'Código con caracteres inválidos (espacios y símbolos especiales) es rechazado con HTTP 400',
      async () => {
        const resSpaces = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: 'CODIGO CON ESPACIOS', nombre: 'Documento Espacios' }),
        });
        assert.equal(resSpaces.status, 400);

        const resSymbols = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: 'COD#SIMBOLO$', nombre: 'Documento Símbolos' }),
        });
        assert.equal(resSymbols.status, 400);

        return { tested: ['CODIGO CON ESPACIOS', 'COD#SIMBOLO$'] };
      },
    );

    await assertStep(
      'Group 2',
      'TC-VAL-10',
      'Nombre menor a 3 caracteres o mayor a 160 caracteres es rechazado con HTTP 400',
      async () => {
        const resShort = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: 'DOC_SHORT_NAME', nombre: 'AB' }),
        });
        assert.equal(resShort.status, 400);

        const resLong = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: 'DOC_LONG_NAME', nombre: 'N'.repeat(161) }),
        });
        assert.equal(resLong.status, 400);

        return { shortLen: 2, longLen: 161 };
      },
    );

    await assertStep(
      'Group 2',
      'TC-VAL-11',
      'Tipo MIME inválido (vacío, menor a 3 caracteres o tipo no-string) es rechazado con HTTP 400',
      async () => {
        const resEmpty = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigo: 'DOC_EMPTY_MIME',
            nombre: 'Doc Empty MIME',
            mimeType: '',
          }),
        });
        assert.equal(resEmpty.status, 400);

        const resShort = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigo: 'DOC_SHORT_MIME',
            nombre: 'Doc Short MIME',
            mimeType: 'ab',
          }),
        });
        assert.equal(resShort.status, 400);

        const resNonString = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigo: 'DOC_NUM_MIME',
            nombre: 'Doc Numeric MIME',
            mimeType: 12345,
          }),
        });
        assert.equal(resNonString.status, 400);

        return { tests: ['empty', 'short_ab', 'numeric'] };
      },
    );

    await assertStep(
      'Group 2',
      'TC-VAL-12',
      'Parámetros :id que no cumplen formato UUID son rechazados con HTTP 400 RFC 9457',
      async () => {
        const resGet = await fetch(`${baseUrl}/api/v1/admin/tipos-documento/not-a-uuid`);
        assert.equal(resGet.status, 400, 'GET con ID no UUID debe responder 400');
        const probGet = (await resGet.json()) as any;
        assert.equal(probGet.code, 'VALIDATION_ERROR');

        const resPut = await fetch(`${baseUrl}/api/v1/admin/tipos-documento/12345`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: 'Nuevo Nombre' }),
        });
        assert.equal(resPut.status, 400, 'PUT con ID no UUID debe responder 400');

        const resPatch = await fetch(`${baseUrl}/api/v1/admin/tipos-documento/invalido/estado`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vigente: false }),
        });
        assert.equal(resPatch.status, 400, 'PATCH con ID no UUID debe responder 400');

        const resDel = await fetch(`${baseUrl}/api/v1/admin/tipos-documento/malformed`, {
          method: 'DELETE',
        });
        assert.equal(resDel.status, 400, 'DELETE con ID no UUID debe responder 400');

        return { verifiedMethods: ['GET', 'PUT', 'PATCH', 'DELETE'] };
      },
    );

    await assertStep(
      'Group 2',
      'TC-VAL-13',
      'UUIDs válidos pero inexistentes devuelven HTTP 404 RFC 9457 (Not Found)',
      async () => {
        const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
        const resGet = await fetch(`${baseUrl}/api/v1/admin/tipos-documento/${nonExistentUuid}`);
        assert.equal(resGet.status, 404, `GET de UUID inexistente debe responder 404, recibido: ${resGet.status}`);
        const probGet = (await resGet.json()) as any;
        assert.equal(probGet.code, 'NOT_FOUND');
        assert.equal(probGet.status, 404);

        const resPut = await fetch(`${baseUrl}/api/v1/admin/tipos-documento/${nonExistentUuid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: 'Actualizar Inexistente' }),
        });
        assert.equal(resPut.status, 404, 'PUT de UUID inexistente debe responder 404');

        const resDel = await fetch(`${baseUrl}/api/v1/admin/tipos-documento/${nonExistentUuid}`, {
          method: 'DELETE',
        });
        assert.equal(resDel.status, 404, 'DELETE de UUID inexistente debe responder 404');

        return { nonExistentUuid };
      },
    );

    // =========================================================================
    // GROUP 3: GENUINE AUDIT RECORDS WITH CORRELATION_ID
    // =========================================================================
    console.log('\n>>> GROUP 3: GENUINE AUDIT RECORDS WITH CORRELATION_ID');

    let auditTargetId: string = '';
    const auditCode = `CHAL_AUD_${suffix}`;
    const correlationPost = crypto.randomUUID();
    const correlationPut = crypto.randomUUID();
    const correlationPatch = crypto.randomUUID();
    const correlationDelete = crypto.randomUUID();

    await assertStep(
      'Group 3',
      'TC-AUD-01',
      'POST /api/v1/admin/tipos-documento registra asiento genuino INSERT en sigd_audit.bitacora_auditoria con correlation_id',
      async () => {
        const res = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationPost,
          },
          body: JSON.stringify({
            codigo: auditCode,
            nombre: `Documento Auditoría ${auditCode}`,
            extension: 'pdf',
            mimeType: 'application/pdf',
            tamanoMaximoMb: 35,
            exigeFirma: true,
            vigente: true,
          }),
        });
        assert.equal(res.status, 201);
        const data = (await res.json()) as any;
        auditTargetId = data.tipoDocumentalId;

        // Comprobar asiento en base de datos
        const auditRows = await pool.query(
          `SELECT id_auditoria, correlation_id, esquema, tabla, operacion, datos_antes, datos_despues, fecha_hora
             FROM sigd_audit.bitacora_auditoria
            WHERE correlation_id = $1`,
          [correlationPost],
        );
        assert.equal(auditRows.rowCount, 1, 'Debe existir exactamente 1 registro de auditoría para correlation_id');
        const fila = auditRows.rows[0];
        assert.equal(fila.esquema, 'sigd_doc');
        assert.equal(fila.tabla, 'tipo_documento');
        assert.equal(fila.operacion, 'INSERT');
        assert.equal(fila.datos_antes, null, 'En INSERT, datos_antes debe ser NULL');
        assert.equal(fila.datos_despues.codigo, auditCode);
        assert.equal(fila.datos_despues.tipo_documental_id, auditTargetId);
        assert.equal(fila.datos_despues.tamano_maximo_mb, 35);
        assert.ok(fila.fecha_hora instanceof Date, 'fecha_hora debe ser una fecha válida');

        return { idAuditoria: fila.id_auditoria, correlationId: correlationPost, operacion: fila.operacion };
      },
    );

    await assertStep(
      'Group 3',
      'TC-AUD-02',
      'PUT /api/v1/admin/tipos-documento/:id registra asiento genuino UPDATE con datos_antes y datos_despues',
      async () => {
        const nuevoNombre = `Documento Auditoría ${auditCode} Modificado`;
        const res = await fetch(`${baseUrl}/api/v1/admin/tipos-documento/${auditTargetId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationPut,
          },
          body: JSON.stringify({
            nombre: nuevoNombre,
            tamanoMaximoMb: 50,
          }),
        });
        assert.equal(res.status, 200);

        const auditRows = await pool.query(
          `SELECT id_auditoria, correlation_id, esquema, tabla, operacion, datos_antes, datos_despues
             FROM sigd_audit.bitacora_auditoria
            WHERE correlation_id = $1`,
          [correlationPut],
        );
        assert.equal(auditRows.rowCount, 1, 'Debe registrarse el UPDATE en bitácora con correlation_id');
        const fila = auditRows.rows[0];
        assert.equal(fila.operacion, 'UPDATE');
        assert.equal(fila.esquema, 'sigd_doc');
        assert.equal(fila.tabla, 'tipo_documento');
        assert.ok(fila.datos_antes !== null, 'datos_antes debe contener el estado previo');
        assert.equal(fila.datos_antes.tamano_maximo_mb, 35);
        assert.equal(fila.datos_despues.tamano_maximo_mb, 50);
        assert.equal(fila.datos_despues.nombre, nuevoNombre);

        return { idAuditoria: fila.id_auditoria, correlationId: correlationPut, operacion: fila.operacion };
      },
    );

    await assertStep(
      'Group 3',
      'TC-AUD-03',
      'PATCH /api/v1/admin/tipos-documento/:id/estado registra asiento UPDATE en bitácora',
      async () => {
        const res = await fetch(`${baseUrl}/api/v1/admin/tipos-documento/${auditTargetId}/estado`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationPatch,
          },
          body: JSON.stringify({ vigente: false }),
        });
        assert.equal(res.status, 200);

        const auditRows = await pool.query(
          `SELECT id_auditoria, correlation_id, operacion, datos_despues
             FROM sigd_audit.bitacora_auditoria
            WHERE correlation_id = $1`,
          [correlationPatch],
        );
        assert.equal(auditRows.rowCount, 1);
        const fila = auditRows.rows[0];
        assert.equal(fila.operacion, 'UPDATE');
        assert.equal(fila.datos_despues.vigente, false);

        return { idAuditoria: fila.id_auditoria, correlationId: correlationPatch, vigente: false };
      },
    );

    await assertStep(
      'Group 3',
      'TC-AUD-04',
      'DELETE físico de tipo de documento registra asiento DELETE en bitácora y remueve la fila',
      async () => {
        const res = await fetch(`${baseUrl}/api/v1/admin/tipos-documento/${auditTargetId}`, {
          method: 'DELETE',
          headers: { 'X-Correlation-ID': correlationDelete },
        });
        assert.equal(res.status, 200);
        const delData = (await res.json()) as any;
        assert.equal(delData.eliminado, true);

        // Comprobar eliminación física en sigd_doc.tipo_documento
        const rowCheck = await pool.query(
          'SELECT 1 FROM sigd_doc.tipo_documento WHERE tipo_documental_id = $1',
          [auditTargetId],
        );
        assert.equal(rowCheck.rowCount, 0, 'La fila debió ser eliminada físicamente de sigd_doc.tipo_documento');

        // Comprobar asiento de eliminación en bitácora
        const auditRows = await pool.query(
          `SELECT id_auditoria, correlation_id, operacion, datos_antes, datos_despues
             FROM sigd_audit.bitacora_auditoria
            WHERE correlation_id = $1`,
          [correlationDelete],
        );
        assert.equal(auditRows.rowCount, 1, 'Debe registrarse el DELETE en bitácora con correlation_id');
        const fila = auditRows.rows[0];
        assert.equal(fila.operacion, 'DELETE');
        assert.equal(fila.datos_antes.codigo, auditCode);
        assert.equal(fila.datos_despues.eliminado, true);

        return { idAuditoria: fila.id_auditoria, correlationId: correlationDelete, operacion: fila.operacion };
      },
    );

    await assertStep(
      'Group 3',
      'TC-AUD-05',
      'DELETE de tipo de documento con referencias en sigd_doc.documento_adjunto realiza baja lógica (vigente = false) y audita',
      async () => {
        // 1. Crear documento para prueba referencial
        const refCode = `CHAL_REF_${suffix}`;
        const createRes = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigo: refCode,
            nombre: 'Documento Con Referencias Adjuntas',
            extension: 'pdf',
            mimeType: 'application/pdf',
          }),
        });
        const created = (await createRes.json()) as any;
        const refDocId = created.tipoDocumentalId;

        // 2. Obtener un expediente para crear adjunto de prueba
        const expQuery = await pool.query('SELECT expediente_id FROM sigd_doc.expediente LIMIT 1');
        assert.ok(expQuery.rowCount && expQuery.rowCount > 0, 'Debe existir al menos un expediente');
        const expId = expQuery.rows[0].expediente_id;

        // Insertar adjunto referenciando este tipo documental
        const s3Key = `expedientes/test_adjunto_${Date.now()}.pdf`;
        const dummySha = crypto.createHash('sha256').update(s3Key).digest('hex');
        await pool.query(
          `INSERT INTO sigd_doc.documento_adjunto (
             expediente_id, tipo_documental_id, nombre_archivo, s3_bucket, s3_key, sha256, tamano_bytes, mime_type
           ) VALUES ($1, $2, 'archivo_prueba.pdf', 'sigd-expedientes', $3, $4, 1024, 'application/pdf')`,
          [expId, refDocId, s3Key, dummySha],
        );

        // 3. Invocar DELETE en el tipo documental referenciado
        const corrBajaLogica = crypto.randomUUID();
        const delRes = await fetch(`${baseUrl}/api/v1/admin/tipos-documento/${refDocId}`, {
          method: 'DELETE',
          headers: { 'X-Correlation-ID': corrBajaLogica },
        });
        assert.equal(delRes.status, 200);
        const delJson = (await delRes.json()) as any;
        assert.equal(delJson.eliminado, true);
        assert.match(delJson.mensaje, /baja lógica/i);

        // 4. Verificar que sigue existiendo en sigd_doc.tipo_documento con vigente = false
        const checkDoc = await pool.query(
          'SELECT vigente FROM sigd_doc.tipo_documento WHERE tipo_documental_id = $1',
          [refDocId],
        );
        assert.equal(checkDoc.rowCount, 1, 'El registro no se elimina físicamente para preservar integridad referencial');
        assert.equal(checkDoc.rows[0].vigente, false, 'El campo vigente debe ser false');

        // Limpieza de datos de prueba
        await pool.query('DELETE FROM sigd_doc.documento_adjunto WHERE s3_key = $1', [s3Key]);
        await pool.query('DELETE FROM sigd_doc.tipo_documento WHERE tipo_documental_id = $1', [refDocId]);

        return { refDocId, s3Key, preservedIntegrity: true };
      },
    );

    // =========================================================================
    // GROUP 4: WORM IMMUTABILITY ON sigd_audit.bitacora_auditoria (SQLSTATE 23001)
    // =========================================================================
    console.log('\n>>> GROUP 4: WORM IMMUTABILITY ON sigd_audit.bitacora_auditoria (SQLSTATE 23001)');

    await assertStep(
      'Group 4',
      'TC-WORM-01',
      'Intento de UPDATE directo en sigd_audit.bitacora_auditoria es abortado por trigger con SQLSTATE 23001',
      async () => {
        // Obtener un registro real de bitácora
        const { rows } = await pool.query(
          `SELECT id_auditoria, correlation_id, operacion, datos_despues
             FROM sigd_audit.bitacora_auditoria
            WHERE correlation_id = $1
            LIMIT 1`,
          [correlationPost],
        );
        assert.equal(rows.length, 1);
        const targetAudit = rows[0];

        let falloUpdate = false;
        let sqlState = '';
        let errorMessage = '';

        try {
          await pool.query(
            `UPDATE sigd_audit.bitacora_auditoria
                SET operacion = 'ALTERADO_HACK',
                    datos_despues = '{"tampered": true}'::jsonb
              WHERE id_auditoria = $1`,
            [targetAudit.id_auditoria],
          );
        } catch (err: any) {
          falloUpdate = true;
          sqlState = err.code;
          errorMessage = err.message;
        }

        assert.ok(falloUpdate, 'El UPDATE directo debió ser bloqueado por el trigger tr_bitacora_append_only');
        assert.equal(
          sqlState,
          '23001',
          `El error lanzado por la BD debe tener SQLSTATE 23001 (restrict_violation), recibido: ${sqlState}`,
        );
        assert.match(
          errorMessage,
          /WORM|inmutable|rechazad/i,
          'El mensaje de error debe confirmar la invariante de inmutabilidad WORM',
        );

        return { idAuditoria: targetAudit.id_auditoria, sqlState, errorMessage };
      },
    );

    await assertStep(
      'Group 4',
      'TC-WORM-02',
      'Intento de DELETE directo en sigd_audit.bitacora_auditoria es abortado por trigger con SQLSTATE 23001',
      async () => {
        const { rows } = await pool.query(
          `SELECT id_auditoria
             FROM sigd_audit.bitacora_auditoria
            WHERE correlation_id = $1
            LIMIT 1`,
          [correlationPost],
        );
        assert.equal(rows.length, 1);
        const targetId = rows[0].id_auditoria;

        let falloDelete = false;
        let sqlState = '';
        let errorMessage = '';

        try {
          await pool.query(
            `DELETE FROM sigd_audit.bitacora_auditoria WHERE id_auditoria = $1`,
            [targetId],
          );
        } catch (err: any) {
          falloDelete = true;
          sqlState = err.code;
          errorMessage = err.message;
        }

        assert.ok(falloDelete, 'El DELETE directo debió ser bloqueado por el trigger tr_bitacora_append_only');
        assert.equal(sqlState, '23001', `El SQLSTATE de error ante DELETE debe ser 23001, recibido: ${sqlState}`);
        assert.match(errorMessage, /WORM|inmutable|rechazad/i);

        return { idAuditoria: targetId, sqlState, errorMessage };
      },
    );

    await assertStep(
      'Group 4',
      'TC-WORM-03',
      'Intento masivo de UPDATE (ataque masivo de modificación de auditoría) es rechazado con SQLSTATE 23001',
      async () => {
        let fallo = false;
        let sqlState = '';
        try {
          await pool.query(
            `UPDATE sigd_audit.bitacora_auditoria
                SET esquema = 'sigd_comprometido'
              WHERE tabla = 'tipo_documento'`,
          );
        } catch (err: any) {
          fallo = true;
          sqlState = err.code;
        }
        assert.ok(fallo, 'UPDATE masivo debió ser bloqueado');
        assert.equal(sqlState, '23001');
        return { massUpdateBlocked: true, sqlState };
      },
    );

    await assertStep(
      'Group 4',
      'TC-WORM-04',
      'Intento masivo de DELETE (ataque de purga de auditoría) es rechazado con SQLSTATE 23001',
      async () => {
        let fallo = false;
        let sqlState = '';
        try {
          await pool.query(
            `DELETE FROM sigd_audit.bitacora_auditoria WHERE tabla = 'tipo_documento'`,
          );
        } catch (err: any) {
          fallo = true;
          sqlState = err.code;
        }
        assert.ok(fallo, 'DELETE masivo debió ser bloqueado');
        assert.equal(sqlState, '23001');
        return { massDeleteBlocked: true, sqlState };
      },
    );

    await assertStep(
      'Group 4',
      'TC-WORM-05',
      'Verificación pericial de integridad: los asientos de auditoría permanecen intactos tras los ataques',
      async () => {
        const { rows } = await pool.query(
          `SELECT id_auditoria, correlation_id, operacion, datos_despues, fecha_hora
             FROM sigd_audit.bitacora_auditoria
            WHERE correlation_id = $1`,
          [correlationPost],
        );

        assert.equal(rows.length, 1, 'El registro de auditoría debe continuar existiendo');
        const fila = rows[0];
        assert.equal(fila.operacion, 'INSERT', 'La columna operacion no fue adulterada');
        assert.equal(fila.datos_despues.codigo, auditCode, 'Los datos no sufrieron modificaciones');
        assert.ok(fila.fecha_hora instanceof Date, 'fecha_hora se mantiene inalterada');

        return { idAuditoria: fila.id_auditoria, verifiedUnmodified: true };
      },
    );
  } finally {
    // Limpieza de tipos de documento temporales creados durante las pruebas
    await pool
      .query(`DELETE FROM sigd_doc.tipo_documento WHERE codigo LIKE 'CHAL_%'`)
      .catch(() => {});

    server.close();
    await pool.end().catch(() => {});
    await redisClient.quit().catch(() => {});
  }

  // Resumen Consolidado
  console.log('\n======================================================================');
  console.log('CHALLENGER 1: AUDIT & ROBUSTNESS VERIFICATION SUMMARY');
  console.log('======================================================================');

  const passedCount = suiteResults.filter((r) => r.passed).length;
  const failedCount = suiteResults.filter((r) => !r.passed).length;

  for (const r of suiteResults) {
    const symbol = r.passed ? '✔ [PASS]' : '✖ [FAIL]';
    console.log(`  ${symbol} ${r.testId}: ${r.description} (${r.durationMs}ms)`);
    if (!r.passed && r.error) {
      console.log(`        Error: ${r.error.split('\n')[0]}`);
    }
  }

  console.log('----------------------------------------------------------------------');
  console.log(`Total Pruebas: ${suiteResults.length} | Aprobadas: ${passedCount} | Fallidas: ${failedCount}`);
  console.log('======================================================================\n');

  return failedCount === 0;
}

const isDirectRun =
  import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('tipo_documento_challenger.test.ts');

if (isDirectRun) {
  runTipoDocumentoChallengerSuite()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((err) => {
      console.error('Error fatal durante suite Challenger 1:', err);
      process.exit(1);
    });
}
