import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const baseUrl = process.env.SIGD_DEMO_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';
const password = process.env.ACADEMIC_DEMO_PASSWORD;

assert(password, 'ACADEMIC_DEMO_PASSWORD es obligatorio.');
assert(
  ['http://127.0.0.1:3000/api/v1', 'http://127.0.0.1:13001/api/v1'].includes(baseUrl),
  `URL demo no autorizada: ${baseUrl}`,
);

async function requestJson(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { response, body };
}

const runId = Date.now();
const pdf = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\n' +
    `trailer<</Root 1 0 R>>\n% prueba-academica-${runId}\n%%EOF\n`,
  'ascii',
);
const sha256 = createHash('sha256').update(pdf).digest('hex');
const fileName = `solicitud-academica-${runId}.pdf`;

const login = await requestJson('/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identificador: 'demo.academico', password }),
});
assert.equal(login.response.status, 200, `Login fallo: ${JSON.stringify(login.body)}`);
assert.notEqual(login.body.requiresRoleSelection, true, 'La cuenta demo exige seleccionar rol.');
const token = login.body.accessToken;
const personId = login.body.usuario?.idPersona;
assert(token && personId, 'El login no devolvio token o idPersona.');
const authHeaders = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

const presigned = await requestJson('/storage/presigned-url', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    nombreArchivo: fileName,
    tamanoBytes: pdf.length,
    mimeType: 'application/pdf',
    sha256Hash: sha256,
  }),
});
assert.equal(presigned.response.status, 200, `Presigned fallo: ${JSON.stringify(presigned.body)}`);

const upload = await fetch(presigned.body.uploadUrl, {
  method: 'PUT',
  headers: { 'content-type': 'application/pdf' },
  body: pdf,
});
assert(upload.ok, `Subida S3 fallo con HTTP ${upload.status}.`);

const confirmed = await requestJson('/storage/confirmar-carga', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({ s3Key: presigned.body.s3Key, sha256Hash: sha256 }),
});
assert.equal(confirmed.response.status, 201, `Confirmacion fallo: ${JSON.stringify(confirmed.body)}`);

const radicacion = await requestJson('/tramites/radicacion-virtual', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    idPersona: personId,
    idTipoTramiteTupa: '00000000-0000-0000-0000-000000000001',
    nombreSolicitante: 'Demo Academico',
    correo: 'demo-radicacion@example.invalid',
    asunto: 'Solicitud academica ficticia para verificar radicacion integral',
    totalFolios: 1,
    documentos: [
      {
        nombreArchivo: fileName,
        contentType: 'application/pdf',
        tamanoBytes: pdf.length,
        hashSha256: sha256,
        storagePath: confirmed.body.s3Key,
      },
    ],
  }),
});

const cargo = radicacion.response.status === 201
  ? await requestJson(`/tramites/ventanilla/cargo/${encodeURIComponent(radicacion.body.cut)}`, {
      headers: { authorization: `Bearer ${token}` },
    })
  : { response: { status: 0 }, body: null };

console.log(JSON.stringify({
  loginStatus: login.response.status,
  presignedStatus: presigned.response.status,
  uploadStatus: upload.status,
  confirmarStatus: confirmed.response.status,
  radicacionStatus: radicacion.response.status,
  radicacion: radicacion.body,
  cargoStatus: cargo.response.status,
  cargo: cargo.body,
}, null, 2));

assert.equal(radicacion.response.status, 201, `Radicacion fallo: ${JSON.stringify(radicacion.body)}`);
assert.match(radicacion.body.cut, /^EXP-\d{4}-\d{6}$/);
assert.match(radicacion.body.cargoDigital?.codigo ?? '', /^CARGO-/);
assert.ok(
  new Date(radicacion.body.fechaRadicacionLegal).getTime() >=
    new Date(radicacion.body.fechaEnvioReal).getTime(),
  'La fecha legal no puede preceder a la recepcion real.',
);
assert.equal(cargo.response.status, 200, `Consulta de cargo fallo: ${JSON.stringify(cargo.body)}`);
assert.equal(cargo.body.cut, radicacion.body.cut);
