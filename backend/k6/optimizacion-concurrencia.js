/**
 * Prueba de carga y concurrencia SIGD (k6).
 *
 * USO:
 *   1. Ejecución con token institucional:
 *      k6 run -e AUTH_TOKEN="<tu_jwt_aqui>" backend/k6/optimizacion-concurrencia.js
 *
 *   2. Ejecución pública (sin token):
 *      k6 run backend/k6/optimizacion-concurrencia.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.AUTH_TOKEN || '';

export const options = {
  vus: __ENV.VUS ? parseInt(__ENV.VUS, 10) : 10,
  duration: __ENV.DURATION || '15s',
  thresholds: {
    http_req_duration: ['p(95)<250'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // 1. Healthcheck & DB Pool Metrics probe (Público)
  const resHealth = http.get(`${BASE_URL}/health`);
  check(resHealth, {
    'health HTTP 200': (r) => r.status === 200,
    'health has pool': (r) => r.json('pool.totalConexiones') !== undefined,
  });

  // 2. TUPA Catálogo
  if (TOKEN) {
    const resTupa = http.get(`${BASE_URL}/api/v1/tramites/tupa`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    });
    check(resTupa, {
      'tupa HTTP 200': (r) => r.status === 200,
      'tupa has items': (r) => Array.isArray(r.json()) && r.json().length >= 72,
    });
  } else {
    // Si no hay token, verificar respuesta pública / protección 401
    const resTupaSinAuth = http.get(`${BASE_URL}/api/v1/tramites/tupa`);
    check(resTupaSinAuth, {
      'tupa responde adecuadamente (200 o 401)': (r) => r.status === 200 || r.status === 401,
    });
  }

  // 3. Ready check (ping a DB + Redis)
  const resReady = http.get(`${BASE_URL}/ready`);
  check(resReady, {
    'ready HTTP 200': (r) => r.status === 200,
  });

  sleep(0.05);
}
