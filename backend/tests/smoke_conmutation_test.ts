/**
 * Automated Smoke Test Harness for SIGD Conmutation & Fullstack Synchronization
 * 
 * Verifies live HTTP server behavior:
 * - Pure TypeScript CORS middleware (preflight 204, origin reflection, headers, credentials)
 * - X-Correlation-ID generation and propagation
 * - Exposed headers for legal cut-off timestamp (Date, X-Correlation-ID)
 * - Dual-casing RFC 7807/9457 error handling (code/codigo, correlation_id/correlationId, invalid_params/invalidParams)
 * - Health and readiness probes (/health, /ready)
 * - Realtime SSE stream route (/api/v1/realtime/stream) with authentication & BusSse singleton
 * - M01-M06 mounted routes (CVD verification, Casilla, Ubigeo, TUPA)
 */

import http from 'node:http';
import type { Pool } from 'pg';
import { construirApp } from '../src/app.js';
import { BusSse } from '../src/modules/corelink/sseStream.service.js';
import { firmarTokenAcceso } from '../src/core/auth/jwt.service.js';

interface TestAssertion {
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

const assertions: TestAssertion[] = [];

function assert(category: string, name: string, condition: boolean, errorMsg?: string) {
  if (!condition) {
    console.error(`  [FAIL] ${category} > ${name}: ${errorMsg || 'Condition failed'}`);
  } else {
    console.log(`  [PASS] ${category} > ${name}`);
  }
  assertions.push({
    category,
    name,
    passed: condition,
    error: condition ? undefined : (errorMsg || 'Condition failed'),
  });
}

async function runSmokeTests() {
  console.log('======================================================================');
  console.log('SIGD FULLSTACK CONMUTATION & LIVE HTTP SMOKE TEST HARNESS');
  console.log('======================================================================\n');

  // Ensure JWT secret is present for authentication tests
  process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'sigd_super_secret_jwt_key_iestp_suiza_2026_min_32_chars';

  const fakePool = {
    query: async (sql: string, params?: unknown[]) => {
      // Return realistic structure if querying firma_digital_documento
      if (typeof sql === 'string' && sql.includes('firma_digital_documento')) {
        return {
          rows: [
            {
              cvd: (params?.[0] as string) || 'CVD-TEST01',
              sha256_firmado: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
              firmante: 'Director General IESTP Suiza',
              fecha_sello_tsa: new Date().toISOString(),
              estado: 'FIRMADO_DIGITALMENTE',
              s3_bucket: 'sigd-docs',
              s3_key: 'resoluciones/rd-001.pdf',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    },
    connect: async () => ({
      query: async () => ({ rows: [{ '?column?': 1 }], rowCount: 1 }),
      release: () => {},
    }),
  } as unknown as Pool;

  const busSse = new BusSse();
  const app = construirApp(fakePool, { busSse });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to obtain server listening address');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Live test server listening on ${baseUrl}\n`);

  try {
    // -----------------------------------------------------------------------
    // TEST SUITE 1: CORS Middleware & Preflight Handshake
    // -----------------------------------------------------------------------
    console.log('>>> [1] Validating CORS Middleware & Preflight Handshake...');

    const preflightRes = await fetch(`${baseUrl}/api/v1/tramites/consulta-publica/EXP-2026-000001`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,content-type,x-correlation-id',
      },
    });

    assert('CORS', 'OPTIONS preflight returns 204 No Content', preflightRes.status === 204, `Got ${preflightRes.status}`);
    assert('CORS', 'Access-Control-Allow-Origin matches localhost:5173', preflightRes.headers.get('access-control-allow-origin') === 'http://localhost:5173');
    assert('CORS', 'Access-Control-Allow-Credentials is true', preflightRes.headers.get('access-control-allow-credentials') === 'true');
    
    const allowHeaders = preflightRes.headers.get('access-control-allow-headers')?.toLowerCase() || '';
    assert('CORS', 'Access-Control-Allow-Headers contains authorization', allowHeaders.includes('authorization'));
    assert('CORS', 'Access-Control-Allow-Headers contains x-correlation-id', allowHeaders.includes('x-correlation-id'));

    const exposeHeaders = preflightRes.headers.get('access-control-expose-headers')?.toLowerCase() || '';
    assert('CORS', 'Access-Control-Expose-Headers exposes Date for legal cut-off', exposeHeaders.includes('date'));
    assert('CORS', 'Access-Control-Expose-Headers exposes X-Correlation-ID', exposeHeaders.includes('x-correlation-id'));

    // Test with 127.0.0.1:5173
    const preflightRes2 = await fetch(`${baseUrl}/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://127.0.0.1:5173',
        'Access-Control-Request-Method': 'GET',
      },
    });
    assert('CORS', 'OPTIONS preflight supports 127.0.0.1:5173 origin', preflightRes2.headers.get('access-control-allow-origin') === 'http://127.0.0.1:5173');

    // -----------------------------------------------------------------------
    // TEST SUITE 2: Health Probes & X-Correlation-ID Propagation
    // -----------------------------------------------------------------------
    console.log('\n>>> [2] Validating Health Probes & X-Correlation-ID Propagation...');

    const customCorrelationId = 'custom-test-correlation-uuid-12345';
    const healthRes = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:5173',
        'X-Correlation-ID': customCorrelationId,
      },
    });

    assert('Health', 'GET /health returns HTTP 200', healthRes.status === 200, `Got ${healthRes.status}`);
    assert('Correlation', 'Echoes passed X-Correlation-ID header', healthRes.headers.get('x-correlation-id') === customCorrelationId);
    
    const healthBody = await healthRes.json() as Record<string, unknown>;
    assert('Health', 'Health status is "ok"', healthBody.status === 'ok');

    const readyRes = await fetch(`${baseUrl}/ready`);
    assert('Ready', 'GET /ready returns HTTP 200', readyRes.status === 200);
    const readyBody = await readyRes.json() as Record<string, unknown>;
    assert('Ready', 'Ready status is "ready"', readyBody.estado === 'READY');

    // -----------------------------------------------------------------------
    // TEST SUITE 3: Dual-Casing RFC 7807/9457 Error Handling
    // -----------------------------------------------------------------------
    console.log('\n>>> [3] Validating Dual-Casing RFC 7807/9457 Error Handling...');

    const errorRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
      },
      body: JSON.stringify({ identificadorInvalido: 'test' }), // Missing required fields
    });

    assert('Errors', 'Validation failure returns HTTP 400', errorRes.status === 400, `Got ${errorRes.status}`);
    assert('Errors', 'Content-Type is problem+json or json', (errorRes.headers.get('content-type') || '').includes('json'));

    const errorBody = await errorRes.json() as Record<string, unknown>;
    assert('Errors', 'Emits canonical RFC 7807 "type" URI', typeof errorBody.type === 'string');
    assert('Errors', 'Emits canonical RFC 7807 "title"', typeof errorBody.title === 'string');
    assert('Errors', 'Emits canonical RFC 7807 "status"', errorBody.status === 400);

    // Dual-casing checks
    assert('Dual-Casing', 'Contains "code"', typeof errorBody.code === 'string');
    assert('Dual-Casing', 'Contains "codigo" alias', typeof errorBody.codigo === 'string' && errorBody.codigo === errorBody.code);
    assert('Dual-Casing', 'Contains "correlation_id"', typeof errorBody.correlation_id === 'string');
    assert('Dual-Casing', 'Contains "correlationId" alias', typeof errorBody.correlationId === 'string' && errorBody.correlationId === errorBody.correlation_id);
    assert('Dual-Casing', 'Contains "timestamp" in ISO format', typeof errorBody.timestamp === 'string' && !isNaN(Date.parse(errorBody.timestamp as string)));
    assert('Dual-Casing', 'Contains "invalid_params" array', Array.isArray(errorBody.invalid_params));
    assert(
      'Dual-Casing',
      'Contains "invalidParams" alias array matching invalid_params',
      Array.isArray(errorBody.invalidParams) &&
        JSON.stringify(errorBody.invalidParams) === JSON.stringify(errorBody.invalid_params)
    );

    // -----------------------------------------------------------------------
    // TEST SUITE 4: M01-M06 Module Connectivity & DTO Verification
    // -----------------------------------------------------------------------
    console.log('\n>>> [4] Validating M01-M06 Module Connectivity & DTO Verification...');

    // M04: CVD Public Verification
    const cvdRes = await fetch(`${baseUrl}/api/v1/validador-cvd/verificar/CVD-123456`);
    assert('DocuCore', 'CVD endpoint is mounted and reachable', cvdRes.status === 200, `Got ${cvdRes.status}`);
    const cvdBody = await cvdRes.json() as Record<string, unknown>;
    assert('DocuCore', 'CVD endpoint returns dual valido/esValido flags', cvdBody.valido === true && cvdBody.esValido === true);
    assert('DocuCore', 'CVD endpoint returns structured documento metadata', typeof cvdBody.documento === 'object' && cvdBody.documento !== null);

    // M01: Casilla Digital
    const casillaRes = await fetch(`${baseUrl}/api/v1/casilla/estadisticas?personaId=00000000-0000-0000-0000-000000000000`);
    assert('Casilla', 'Casilla stats endpoint is mounted and reachable', casillaRes.status !== 404, `Got ${casillaRes.status}`);

    // M02: TUPA catalog
    const tupaRes = await fetch(`${baseUrl}/api/v1/tramites/tipos`);
    assert('TramiCore', 'TUPA catalog route is mounted and reachable', tupaRes.status !== 404, `Got ${tupaRes.status}`);

    // M06: SSE Realtime Stream Authentication & Connection
    // 1) Unauthenticated request rejected with 401
    const unauthSseRes = await fetch(`${baseUrl}/api/v1/realtime/stream`, {
      headers: { 'Accept': 'text/event-stream' },
    });
    assert('CoreLink', 'Unauthenticated SSE stream is rejected with HTTP 401', unauthSseRes.status === 401);

    // 2) Authenticated request with Bearer JWT connects with 200 text/event-stream
    const testToken = firmarTokenAcceso({ sub: 'admin-smoke-test-user', roles: ['SUPER_ADMIN'] });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      const sseRes = await fetch(`${baseUrl}/api/v1/realtime/stream`, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${testToken}`,
        },
      });
      assert('CoreLink', 'Authenticated SSE stream accepts connection with HTTP 200', sseRes.status === 200);
      assert('CoreLink', 'Content-Type is text/event-stream', (sseRes.headers.get('content-type') || '').includes('text/event-stream'));

      // Explicitly abort client stream and cancel response body to release socket
      controller.abort();
      await sseRes.body?.cancel().catch(() => {});
    } catch (e: any) {
      assert('CoreLink', 'SSE stream connected', false, e.message);
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }

  } finally {
    // 1. Close all active SSE subscribers from the server event bus
    busSse.cerrarTodos();

    // 2. Force-close any open keep-alive connections on Node HTTP server (Node >= 18.2.0)
    if (typeof (server as any).closeAllConnections === 'function') {
      (server as any).closeAllConnections();
    }
    if (typeof (server as any).closeIdleConnections === 'function') {
      (server as any).closeIdleConnections();
    }

    // 3. Gracefully close the HTTP listening socket with safety timeout
    await new Promise<void>((resolve) => {
      const forceCloseTimer = setTimeout(() => {
        if (typeof (server as any).closeAllConnections === 'function') {
          (server as any).closeAllConnections();
        }
        resolve();
      }, 1000);

      server.close(() => {
        clearTimeout(forceCloseTimer);
        resolve();
      });
    });
    console.log('\nLive test server closed gracefully.');
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log('SMOKE TEST HARNESS RESULTS SUMMARY');
  console.log('======================================================================');
  const total = assertions.length;
  const passed = assertions.filter((a) => a.passed).length;
  const failed = assertions.filter((a) => !a.passed).length;
  console.log(`Total assertions: ${total}`);
  console.log(`Passed:           ${passed}`);
  console.log(`Failed:           ${failed}`);

  if (failed > 0) {
    console.error('\nSmoke test harness encountered failures!');
    process.exit(1);
  } else {
    console.log('\nALL CONMUTATION ASSERTIONS PASSED SUCCESSFULLY!');
    process.exit(0);
  }
}

runSmokeTests().catch((err) => {
  console.error('Fatal error during smoke test execution:', err);
  process.exit(1);
});
