// Live negative acceptance checks. No JWT, payment, expediente or CUT creation.
const fs = require('node:fs'), path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { PDFDocument } = require('pdf-lib');
const ROOT = 'http://127.0.0.1:3008/api/v1';
async function main() {
  const checks = [];
  async function call(name, route, options = {}, expected) {
    const response = await fetch(ROOT + route, { ...options, signal: AbortSignal.timeout(10000) });
    const text = await response.text(); let body; try { body = JSON.parse(text); } catch { body = null; }
    checks.push({ name, status: response.status, code: body?.code, correlationId: body?.correlationId });
    if (expected !== undefined && response.status !== expected) throw new Error(`${name}:EXPECTED_${expected}_GOT_${response.status}`);
    return { response, body };
  }
  const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const catalog = (await call('catalogo publico sin login', '/tramites/publico/procedimientos', {}, 200)).body;
  const tupa = catalog.find(t => t.codigo === 'SUZ26-035');
  if (!tupa || tupa.habilitado) throw new Error('SUZ035_PAYMENT_POLICY_UNEXPECTED');
  const challenge = (await call('reto anonimo', '/tramites/publico/reto', json({}), 200)).body;
  let nonce = 0;
  while (!createHash('sha256').update(`${challenge.challenge}:${nonce}`).digest('hex').startsWith(challenge.prefix)) nonce++;
  const token = (await call('sesion sin JWT', '/tramites/publico/sesion', json({ id: challenge.id, nonce }), 201)).body.token;
  await call('replay de reto denegado', '/tramites/publico/sesion', json({ id: challenge.id, nonce }), 403);
  await call('origen externo denegado', '/tramites/publico/reto', { ...json({}), headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.invalid' } }, 403);
  await call('radicar sin capacidad denegado', '/tramites/publico/radicar', json({}), 403);
  const pdf = await PDFDocument.create(); const page = pdf.addPage(); page.drawText('DEMO - PRUEBA NEGATIVA SIN PAGO NI RADICACION');
  const bytes = Buffer.from(await pdf.save());
  await call('pago pendiente bloquea carga antes de MinIO', '/tramites/publico/carga', { method: 'POST',
    headers: { 'Content-Type': 'application/pdf', 'X-SIGD-Public-Session': token, 'X-SIGD-Tupa': tupa.id, 'X-SIGD-File-Name': 'demo-sin-pago.pdf' }, body: bytes }, 422);
  await call('referencia ajena denegada', '/tramites/publico/radicar', { ...json({
    idTipoTramiteTupa: tupa.id, asunto: 'DEMO: prueba negativa, no generar expediente', tipoDocumento: 'DNI', numeroDocumento: '00000999',
    nombres: 'Persona', apellidos: 'Prueba Publica', nombreSolicitante: 'Persona Prueba Publica', correo: 'fixture@example.invalid', telefono: '999999999',
    aceptaTerminos: true, declaracionVeracidad: true, totalFolios: 1,
    documentos: [{ nombreArchivo: 'demo.pdf', contentType: 'application/pdf', tamanoBytes: bytes.length,
      hashSha256: createHash('sha256').update(bytes).digest('hex'), storagePath: `expedientes/2026/${randomUUID()}.pdf` }],
  }), headers: { 'Content-Type': 'application/json', 'X-SIGD-Public-Session': token } }, 403);
  await call('cargo ajeno inexistente', '/tramites/publico/cargo', { headers: { 'X-SIGD-Public-Session': 'e'.repeat(64) } }, 404);
  await call('storage interno protegido', '/storage/presigned-url', json({}), 401);
  await call('ventanilla interna protegida', '/tramites/ventanilla-presencial', json({}), 401);
  await call('expedientes internos protegidos', '/expedientes', {}, 401);
  const result = { at: new Date().toISOString(), catalogCount: catalog.length, publicEnabled: catalog.filter(t => t.habilitado).length,
    checks, successfulFilings: 0, uploadedObjects: 0, generatedCuts: 0 };
  const output = path.resolve(__dirname, '../../scratch/evidencias-mpv-publica/http-publico.json');
  fs.writeFileSync(output, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error('HTTP_PUBLIC_TEST_FAILED', error.message); process.exitCode = 1; });
