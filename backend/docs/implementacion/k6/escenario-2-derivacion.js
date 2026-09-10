// Escenario 2 · Operación Simultánea de Derivación (50 VU constantes)
// Umbrales (sección 6.1 del entregable 03):
//   Latencia P95   < 200 ms
//   Tasa de errores < 0.1 % (rate < 0.001)
// Ejecutar: k6 run k6/escenario-2-derivacion.js

import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    derivacion: {
      executor: 'constant-vus',
      vus: 50,
      duration: '1m30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.001'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

function idUnico() {
  return `${__VU}-${Date.now()}`;
}

export default function () {
  const token = idUnico();

  const creaArea = http.post(
    `${BASE_URL}/api/areas`,
    JSON.stringify({ nombre: `Area-${token}` }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(creaArea, { 'área creada 201': (r) => r.status === 201 });
  const areaDestino = creaArea.json('area_id');

  const payload = {
    numero: `EXP-DER-${token}`,
    dni_solicitante: String(__VU).padStart(8, '0'),
    numero_documento: `DOC-DER-${token}`,
    folios: (__VU % 50) + 1,
    tipo_documental_id: '00000000-0000-4000-8000-000000000001',
    solicitante_id: '00000000-0000-4000-8000-000000000002',
    area_destino_id: '00000000-0000-4000-8000-000000000003',
  };

  const radica = http.post(`${BASE_URL}/api/expedientes`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(radica, { 'expediente radicado 201': (r) => r.status === 201 });
  const expedienteId = radica.json('expediente_id');

  const deriva = http.post(
    `${BASE_URL}/api/expedientes/derivar`,
    JSON.stringify({ expediente_id: expedienteId, area_destino_id: areaDestino }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(deriva, { 'derivación 200': (r) => r.status === 200 });
}