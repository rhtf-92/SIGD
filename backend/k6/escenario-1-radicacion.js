// Escenario 1 · Radicación Masiva en Mesa de Partes (100 VU)
// Umbrales (sección 6.1 del entregable 03):
//   Latencia P95   < 200 ms
//   Tasa de errores < 0.1 % (rate < 0.001)
// Ejecutar: k6 run k6/escenario-1-radicacion.js

import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    radicacion: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.001'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

function numeroUnico() {
  return `${__VU}-${Date.now()}`;
}

export default function () {
  const seed = numeroUnico();
  const payload = {
    numero: `EXP-${seed}`,
    dni_solicitante: String(__VU).padStart(8, '0'),
    numero_documento: `DOC-${seed}`,
    folios: (__VU % 50) + 1,
    tipo_documental_id: '00000000-0000-4000-8000-000000000001',
    solicitante_id: '00000000-0000-4000-8000-000000000002',
    area_destino_id: '00000000-0000-4000-8000-000000000003',
  };

  const respuesta = http.post(`${BASE_URL}/api/expedientes`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(respuesta, {
    'HTTP 201': (r) => r.status === 201,
  });
}