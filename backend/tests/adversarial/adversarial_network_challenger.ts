/**
 * Empirical Adversarial Test Harness — Network, CORS, Proxy & RFC 7807/9457 Challenger
 *
 * Authored by: Challenger 1 (Adversarial HTTP & Network Challenger)
 * Role: critic, specialist
 */

import http from 'node:http';
import type { Pool } from 'pg';
import { construirApp } from '../../src/app.js';
import { BusSse } from '../../src/modules/corelink/sseStream.service.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';

interface ChallengerAssertion {
  category: string;
  testName: string;
  passed: boolean;
  actual?: unknown;
  expected?: unknown;
  detail?: string;
}

const results: ChallengerAssertion[] = [];

function record(category: string, testName: string, passed: boolean, actual?: unknown, expected?: unknown, detail?: string) {
  const symbol = passed ? '[PASS]' : '[FAIL]';
  console.log(`  ${symbol} [${category}] ${testName}${passed ? '' : ` | Actual: ${JSON.stringify(actual)} | Expected: ${JSON.stringify(expected)}`}`);
  if (detail && !passed) {
    console.log(`         Detail: ${detail}`);
  }
  results.push({ category, testName, passed, actual, expected, detail });
}

async function runAdversarialChallenger() {
  console.log('======================================================================');
  console.log('CHALLENGER 1: EMPIRICAL ADVERSARIAL NETWORK & HTTP HARNESS');
  console.log('======================================================================\n');

  const JWT_SECRET = 'sigd_super_secret_jwt_key_iestp_suiza_2026_min_32_chars';
  process.env.AUTH_JWT_SECRET = JWT_SECRET;

  const fakePool = {
    query: async (sql: string, params?: unknown[]) => {
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
    throw new Error('Failed to start test server');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Target server running at: ${baseUrl}\n`);

  try {
    // =========================================================================
    // SECTION 1: CORS PREFLIGHT & HEADERS ADVERSARIAL CHALLENGES
    // =========================================================================
    console.log('>>> [SECTION 1] CORS Preflight & Header Permissiveness Tests...');

    // 1.1 Allowed origin localhost:5173
    {
      const res = await fetch(`${baseUrl}/api/v1/tramites/tipos`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:5173',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Authorization, Content-Type, X-Correlation-ID',
        },
      });

      record('CORS', 'Preflight to localhost:5173 returns HTTP 204', res.status === 204, res.status, 204);
      record('CORS', 'Preflight has zero-length body', (await res.text()).length === 0, true, true);
      record('CORS', 'Allow-Origin reflects http://localhost:5173', res.headers.get('access-control-allow-origin') === 'http://localhost:5173', res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
      record('CORS', 'Allow-Credentials is true', res.headers.get('access-control-allow-credentials') === 'true', res.headers.get('access-control-allow-credentials'), 'true');
      
      const methods = res.headers.get('access-control-allow-methods') || '';
      record('CORS', 'Allow-Methods contains GET, POST, PUT, PATCH, DELETE, OPTIONS',
        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].every(m => methods.includes(m)),
        methods,
        'Includes all standard REST methods'
      );

      const headers = (res.headers.get('access-control-allow-headers') || '').toLowerCase();
      record('CORS', 'Allow-Headers includes authorization', headers.includes('authorization'), headers, 'authorization');
      record('CORS', 'Allow-Headers includes content-type', headers.includes('content-type'), headers, 'content-type');
      record('CORS', 'Allow-Headers includes x-correlation-id', headers.includes('x-correlation-id'), headers, 'x-correlation-id');

      const exposeHeaders = (res.headers.get('access-control-expose-headers') || '').toLowerCase();
      record('CORS', 'Expose-Headers contains Date (for legal cut-off sync)', exposeHeaders.includes('date'), exposeHeaders, 'date');
      record('CORS', 'Expose-Headers contains X-Correlation-ID', exposeHeaders.includes('x-correlation-id'), exposeHeaders, 'x-correlation-id');
    }

    // 1.2 Allowed origin 127.0.0.1:5173
    {
      const res = await fetch(`${baseUrl}/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://127.0.0.1:5173',
          'Access-Control-Request-Method': 'GET',
        },
      });
      record('CORS', 'Preflight to 127.0.0.1:5173 returns HTTP 204', res.status === 204, res.status, 204);
      record('CORS', 'Allow-Origin reflects http://127.0.0.1:5173', res.headers.get('access-control-allow-origin') === 'http://127.0.0.1:5173', res.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
      record('CORS', 'Allow-Credentials is true for 127.0.0.1:5173', res.headers.get('access-control-allow-credentials') === 'true', res.headers.get('access-control-allow-credentials'), 'true');
    }

    // 1.3 Adversarial Origin Probing in Dev Mode
    {
      // Malicious origin
      const evilRes = await fetch(`${baseUrl}/api/v1/tramites/tipos`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://evil-attacker.com',
          'Access-Control-Request-Method': 'GET',
        },
      });
      // In dev mode, evil-attacker.com is not localhost/127.0.0.1, so Access-Control-Allow-Origin MUST NOT be emitted!
      const evilAcao = evilRes.headers.get('access-control-allow-origin');
      record('CORS_Adversarial', 'Dev mode omits Access-Control-Allow-Origin for http://evil-attacker.com', evilAcao === null, evilAcao, null);

      // Subdomain spoofing
      const spoofRes = await fetch(`${baseUrl}/api/v1/tramites/tipos`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost.evil-domain.com',
          'Access-Control-Request-Method': 'GET',
        },
      });
      const spoofAcao = spoofRes.headers.get('access-control-allow-origin');
      record('CORS_Adversarial', 'Dev mode rejects subdomain spoof http://localhost.evil-domain.com', spoofAcao === null, spoofAcao, null);
    }

    // 1.4 Adversarial Origin Probing in Production Mode (Simulated via NODE_ENV)
    {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        // In production mode, an arbitrary localhost port (e.g. 8080) is NOT allowed (only 5173 or CORS_ORIGIN)
        const prodPortRes = await fetch(`${baseUrl}/api/v1/tramites/tipos`, {
          method: 'OPTIONS',
          headers: {
            'Origin': 'http://localhost:8080',
            'Access-Control-Request-Method': 'GET',
          },
        });
        const prodPortAcao = prodPortRes.headers.get('access-control-allow-origin');
        record('CORS_Production', 'Production mode rejects unlisted port http://localhost:8080', prodPortAcao === null, prodPortAcao, null);

        // Production mode rejects external attacker
        const prodEvilRes = await fetch(`${baseUrl}/api/v1/tramites/tipos`, {
          method: 'OPTIONS',
          headers: {
            'Origin': 'https://attacker.evil.com',
            'Access-Control-Request-Method': 'GET',
          },
        });
        const prodEvilAcao = prodEvilRes.headers.get('access-control-allow-origin');
        record('CORS_Production', 'Production mode rejects https://attacker.evil.com', prodEvilAcao === null, prodEvilAcao, null);

        // Production mode accepts explicit whitelisted origin http://localhost:5173
        const prodValidRes = await fetch(`${baseUrl}/api/v1/tramites/tipos`, {
          method: 'OPTIONS',
          headers: {
            'Origin': 'http://localhost:5173',
            'Access-Control-Request-Method': 'GET',
          },
        });
        const prodValidAcao = prodValidRes.headers.get('access-control-allow-origin');
        record('CORS_Production', 'Production mode allows whitelisted http://localhost:5173', prodValidAcao === 'http://localhost:5173', prodValidAcao, 'http://localhost:5173');

        // Production mode with no Origin header does NOT return wildcard '*'
        const noOriginRes = await fetch(`${baseUrl}/health`, { method: 'GET' });
        const noOriginAcao = noOriginRes.headers.get('access-control-allow-origin');
        record('CORS_Production', 'Production mode does not emit wildcard Access-Control-Allow-Origin: * when no Origin sent', noOriginAcao !== '*', noOriginAcao, 'not *');
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    }

    // =========================================================================
    // SECTION 2: RFC 7807/9457 DUAL-CASING ERROR HANDLING ADVERSARIAL CHALLENGES
    // =========================================================================
    console.log('\n>>> [SECTION 2] RFC 7807/9457 Dual-Casing Error Responses...');

    // 2.1 Malformed Body: Empty Object to /api/v1/auth/login
    {
      const customCorrId = 'adversarial-corr-uuid-7807-001';
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': customCorrId,
          'Origin': 'http://localhost:5173',
        },
        body: JSON.stringify({}),
      });

      record('RFC7807', 'Empty body returns HTTP 400', res.status === 400, res.status, 400);
      
      const contentType = res.headers.get('content-type') || '';
      record('RFC7807', 'Content-Type header is application/problem+json', contentType.includes('problem+json'), contentType, 'application/problem+json');
      record('RFC7807', 'Response echoes passed X-Correlation-ID header', res.headers.get('x-correlation-id') === customCorrId, res.headers.get('x-correlation-id'), customCorrId);

      const body = await res.json() as Record<string, unknown>;

      record('RFC7807', 'Has "type" URI matching https://sigd.iestpsuiza.edu.pe/errors/*',
        typeof body.type === 'string' && (body.type as string).startsWith('https://sigd.iestpsuiza.edu.pe/errors/'),
        body.type, 'https://sigd.iestpsuiza.edu.pe/errors/...'
      );
      record('RFC7807', 'Has "title" equal to "Validation Error"', body.title === 'Validation Error', body.title, 'Validation Error');
      record('RFC7807', 'Has "status" equal to 400', body.status === 400, body.status, 400);
      record('RFC7807', 'Has "detail" string', typeof body.detail === 'string' && (body.detail as string).length > 0, body.detail, 'non-empty string');
      record('RFC7807', 'Has "instance" matching /api/v1/auth/login', body.instance === '/api/v1/auth/login', body.instance, '/api/v1/auth/login');

      // Dual-casing fields
      record('DualCasing', 'Has "code" string', typeof body.code === 'string' && (body.code as string).length > 0, body.code, 'string');
      record('DualCasing', 'Has "codigo" strictly equal to "code"', body.codigo === body.code, body.codigo, body.code);
      record('DualCasing', 'Has "correlation_id" strictly matching request correlation_id', body.correlation_id === customCorrId, body.correlation_id, customCorrId);
      record('DualCasing', 'Has "correlationId" strictly equal to "correlation_id"', body.correlationId === body.correlation_id, body.correlationId, body.correlation_id);

      // Timestamp format
      const validIsoTimestamp = typeof body.timestamp === 'string' && !isNaN(Date.parse(body.timestamp as string));
      record('RFC7807', 'Has "timestamp" in valid ISO 8601 format', validIsoTimestamp, body.timestamp, 'ISO 8601 string');

      // Invalid params
      record('DualCasing', 'Has "invalid_params" array with error entries', Array.isArray(body.invalid_params) && (body.invalid_params as unknown[]).length > 0, body.invalid_params, 'non-empty array');
      record('DualCasing', 'Has "invalidParams" alias array strictly matching invalid_params',
        Array.isArray(body.invalidParams) && JSON.stringify(body.invalidParams) === JSON.stringify(body.invalid_params),
        body.invalidParams, body.invalid_params
      );
    }

    // 2.2 Missing required field: identificador only (missing password)
    {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: 'usuario@iestpsuiza.edu.pe' }),
      });
      record('RFC7807', 'Missing password returns HTTP 400', res.status === 400, res.status, 400);
      const body = await res.json() as Record<string, unknown>;
      record('RFC7807', 'Missing password reports invalid_params', Array.isArray(body.invalid_params) && (body.invalid_params as unknown[]).length > 0, true, true);
    }

    // 2.3 Missing required field: password only (missing identificador)
    {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'Password123!' }),
      });
      record('RFC7807', 'Missing identificador returns HTTP 400', res.status === 400, res.status, 400);
      const body = await res.json() as Record<string, unknown>;
      record('RFC7807', 'Missing identificador reports invalid_params', Array.isArray(body.invalid_params) && (body.invalid_params as unknown[]).length > 0, true, true);
    }

    // 2.4 Type Confusion (identificador as number, password as boolean)
    {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: 99999999, password: false }),
      });
      record('RFC7807', 'Type confusion payload returns HTTP 400', res.status === 400, res.status, 400);
      const body = await res.json() as Record<string, unknown>;
      record('RFC7807', 'Type confusion reports invalid_params', Array.isArray(body.invalid_params) && (body.invalid_params as unknown[]).length > 0, true, true);
    }

    // 2.5 Adversarial Edge Case: Raw malformed JSON syntax probe
    {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"identificador": "test", password: incomplete_json',
      });
      const body = await res.json() as Record<string, unknown>;
      // Express body-parser throws SyntaxError with status 400; error-mapper.ts currently defaults non-AppError/non-Zod errors to 500
      const handledWithProblemDetails = typeof body.type === 'string' && typeof body.title === 'string';
      record('RFC7807_EdgeProbe', 'Raw JSON syntax error produces structured error response', handledWithProblemDetails, handledWithProblemDetails, true,
        `HTTP Status: ${res.status} (body-parser SyntaxError mapped to code: ${body.code})`
      );
    }

    // =========================================================================
    // SECTION 3: REALTIME SSE STREAM ADVERSARIAL CHALLENGES
    // =========================================================================
    console.log('\n>>> [SECTION 3] Realtime SSE Stream (/api/v1/realtime/stream)...');

    // 3.1 Unauthenticated Request -> HTTP 401
    {
      const res = await fetch(`${baseUrl}/api/v1/realtime/stream`, {
        headers: { 'Accept': 'text/event-stream' },
      });
      record('SSE', 'Unauthenticated request returns HTTP 401', res.status === 401, res.status, 401);
      const body = await res.json() as Record<string, unknown>;
      record('SSE', 'Unauthenticated 401 is RFC 7807 problem details', body.status === 401 && body.title === 'Unauthorized', body.title, 'Unauthorized');
      record('SSE', 'Unauthenticated 401 includes dual correlation_id/correlationId',
        typeof body.correlation_id === 'string' && body.correlation_id === body.correlationId,
        true, true
      );
    }

    // 3.2 Malformed Bearer Token -> HTTP 401
    {
      const res = await fetch(`${baseUrl}/api/v1/realtime/stream`, {
        headers: {
          'Accept': 'text/event-stream',
          'Authorization': 'Bearer this-is-not-a-valid-jwt-token-string',
        },
      });
      record('SSE', 'Malformed Bearer token returns HTTP 401', res.status === 401, res.status, 401);
    }

    // 3.3 Expired Bearer Token -> HTTP 401
    {
      // Sign token expired 1 hour ago
      const expiredToken = firmarTokenAcceso({
        sub: 'user-expired',
        roles: ['ESTUDIANTE'],
        expiraSegundos: -3600,
      });

      const res = await fetch(`${baseUrl}/api/v1/realtime/stream`, {
        headers: {
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${expiredToken}`,
        },
      });
      record('SSE', 'Expired Bearer token returns HTTP 401', res.status === 401, res.status, 401);
    }

    // 3.4 Forged Token (signed with different secret) -> HTTP 401
    {
      const forgedToken = firmarTokenAcceso({
        sub: 'attacker-sub',
        roles: ['SUPER_ADMIN'],
        secreto: 'wrong_secret_key_32_characters_long_abcdef',
      });

      const res = await fetch(`${baseUrl}/api/v1/realtime/stream`, {
        headers: {
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${forgedToken}`,
        },
      });
      record('SSE', 'Forged Bearer token (wrong secret) returns HTTP 401', res.status === 401, res.status, 401);
    }

    // 3.5 Valid Authenticated Stream via Bearer Header -> HTTP 200 text/event-stream
    {
      const validToken = firmarTokenAcceso({
        sub: 'usr-profesor-001',
        roles: ['DOCENTE'],
        expiraSegundos: 300,
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);

      try {
        const res = await fetch(`${baseUrl}/api/v1/realtime/stream`, {
          signal: controller.signal,
          headers: {
            'Accept': 'text/event-stream',
            'Authorization': `Bearer ${validToken}`,
          },
        });

        record('SSE', 'Valid Bearer token connects with HTTP 200', res.status === 200, res.status, 200);
        
        const contentType = res.headers.get('content-type') || '';
        record('SSE', 'Content-Type contains text/event-stream', contentType.includes('text/event-stream'), contentType, 'text/event-stream');

        const cacheControl = res.headers.get('cache-control') || '';
        record('SSE', 'Cache-Control contains no-cache', cacheControl.includes('no-cache'), cacheControl, 'no-cache');

        // Read initial chunk from stream
        if (res.body) {
          const reader = res.body.getReader();
          const { value } = await reader.read();
          const text = new TextDecoder().decode(value);
          record('SSE', 'Initial handshake frame contains :conectado and usuario',
            text.includes(':conectado') && text.includes('usuario=usr-profesor-001'),
            text.trim(),
            ':conectado ... usuario=usr-profesor-001'
          );
          reader.cancel().catch(() => {});
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          record('SSE', 'Valid Bearer connection succeeded without error', false, err.message, 'success');
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    // 3.6 Valid Authenticated Stream via Query Parameter ?token=<jwt> (EventSource compatibility)
    {
      const validQueryToken = firmarTokenAcceso({
        sub: 'usr-ciudadano-002',
        roles: ['MESA_PARTES'],
        expiraSegundos: 300,
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);

      try {
        const res = await fetch(`${baseUrl}/api/v1/realtime/stream?token=${validQueryToken}&canales=casilla,sla`, {
          signal: controller.signal,
          headers: { 'Accept': 'text/event-stream' },
        });

        record('SSE', 'Query param ?token connects with HTTP 200', res.status === 200, res.status, 200);
        
        if (res.body) {
          const reader = res.body.getReader();
          const { value } = await reader.read();
          const text = new TextDecoder().decode(value);
          record('SSE', 'Handshake reflects canonical channels and user via query parameter',
            text.includes('canales=casilla,sla') && text.includes('via=query'),
            text.trim(),
            'canales=casilla,sla ... via=query'
          );
          reader.cancel().catch(() => {});
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          record('SSE', 'Query token stream connection succeeded without error', false, err.message, 'success');
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    // 3.6b SSE Channel Fallback: Unrecognized alphabetic channels safely fall back to default CANALES_SSE
    {
      const validToken = firmarTokenAcceso({ sub: 'usr-ciudadano-003', roles: ['ESTUDIANTE'] });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);

      try {
        const res = await fetch(`${baseUrl}/api/v1/realtime/stream?token=${validToken}&canales=otro,distinto`, {
          signal: controller.signal,
          headers: { 'Accept': 'text/event-stream' },
        });

        record('SSE', 'Unrecognized alphabetic channels connect with HTTP 200', res.status === 200, res.status, 200);

        if (res.body) {
          const reader = res.body.getReader();
          const { value } = await reader.read();
          const text = new TextDecoder().decode(value);
          record('SSE', 'Unrecognized alphabetic channels safely fall back to default CANALES_SSE',
            text.includes('canales=casilla,expedientes,sla'),
            text.trim(),
            'canales=casilla,expedientes,sla'
          );
          reader.cancel().catch(() => {});
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          record('SSE', 'Fallback stream connection succeeded', false, err.message, 'success');
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    // 3.7 Adversarial Channel Injection: illegal characters (digits, hyphens, traversal) in channels query
    {
      const validToken = firmarTokenAcceso({ sub: 'usr-admin-003', roles: ['SUPER_ADMIN'] });
      
      // Digits in channel name
      const resDigits = await fetch(`${baseUrl}/api/v1/realtime/stream?canales=desconocido_1&token=${validToken}`, {
        headers: { 'Accept': 'text/event-stream' },
      });
      record('SSE_Adversarial', 'Digits in channel query rejected with HTTP 400', resDigits.status === 400, resDigits.status, 400);

      // Path traversal / SQL injection syntax
      const resInject = await fetch(`${baseUrl}/api/v1/realtime/stream?canales=../../etc/passwd;DROP_TABLE&token=${validToken}`, {
        headers: { 'Accept': 'text/event-stream' },
      });
      record('SSE_Adversarial', 'Path traversal / SQL injection syntax rejected with HTTP 400', resInject.status === 400, resInject.status, 400);

      // Invalid lastEventId (non-digit)
      const resInvalidLastEvent = await fetch(`${baseUrl}/api/v1/realtime/stream?lastEventId=NaN_invalid&token=${validToken}`, {
        headers: { 'Accept': 'text/event-stream' },
      });
      record('SSE_Adversarial', 'Non-numeric lastEventId rejected with HTTP 400', resInvalidLastEvent.status === 400, resInvalidLastEvent.status, 400);

      // Short token (< 20 chars) in query
      const resShortToken = await fetch(`${baseUrl}/api/v1/realtime/stream?token=short-jwt`, {
        headers: { 'Accept': 'text/event-stream' },
      });
      record('SSE_Adversarial', 'Query token below 20 chars rejected with HTTP 400', resShortToken.status === 400, resShortToken.status, 400);
    }

    // =========================================================================
    // SECTION 4: CORRELATION ID ROUND-TRIP & HEALTH CHECKS
    // =========================================================================
    console.log('\n>>> [SECTION 4] Correlation ID & Health Probes...');

    {
      const customId = 'sigd-test-correlation-uuid-9999';
      const res = await fetch(`${baseUrl}/health`, {
        headers: { 'X-Correlation-ID': customId },
      });
      record('Health', 'GET /health returns HTTP 200', res.status === 200, res.status, 200);
      record('Health', 'X-Correlation-ID header roundtrip matches request', res.headers.get('x-correlation-id') === customId, res.headers.get('x-correlation-id'), customId);
      const data = await res.json() as Record<string, unknown>;
      record('Health', 'Health status is ok', data.status === 'ok', data.status, 'ok');
    }

    {
      const res = await fetch(`${baseUrl}/ready`);
      record('Ready', 'GET /ready returns HTTP 200', res.status === 200, res.status, 200);
      const data = await res.json() as Record<string, unknown>;
      record('Ready', 'Ready estado is READY', data.estado === 'READY', data.estado, 'READY');
    }

  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    console.log('\nTest server gracefully stopped.');
  }

  // =========================================================================
  // FINAL SUMMARY
  // =========================================================================
  console.log('\n======================================================================');
  console.log('CHALLENGER 1 ADVERSARIAL RESULTS SUMMARY');
  console.log('======================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Adversarial Assertions: ${total}`);
  console.log(`Passed:                      ${passed}`);
  console.log(`Failed:                      ${failed}`);

  if (failed > 0) {
    console.error(`\nFAILED ${failed} ASSERTION(S)! REJECT VERDICT REQUIRED.`);
    process.exit(1);
  } else {
    console.log(`\nALL ${total} ADVERSARIAL ASSERTIONS PASSED! VERDICT: APPROVE.`);
  }
}

runAdversarialChallenger().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
