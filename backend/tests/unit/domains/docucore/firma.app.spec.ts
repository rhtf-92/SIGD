// Doble del verificador SOLO para probar contratos HTTP. Criptografia real en verificadorPades.spec.ts.
vi.mock('../../../../src/domains/docucore/verificadorPades.service.js', () => ({ validarFirmaPades: vi.fn(async () => ({ valido: true, validacionCriptografica: true, integridadBytesProtegidos: true, tipoFirma: 'FIRMA_PADES_VALIDA', detalles: { tieneFirmaCms: true } })), obtenerPoliticaValidacionPades: vi.fn(() => ({ exigirTsa: false, exigirRevocacion: false })) }));
import { createHash, createHmac } from 'node:crypto';
import request from 'supertest';
import type { Pool } from 'pg';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
const pdf = Buffer.from('%PDF-1.7\nTransporte unitario sin firma real');
const datos = { documento_id: 'cb0af3db-614e-4379-975f-5547a8018e5a', sha256_firmado: createHash('sha256').update(pdf).digest('hex'), firmante: 'Proveedor unitario', fecha_sello_tsa: '2026-10-19T12:00:00Z', s3_bucket: 'sigd-seguridad-aislada', s3_key: 'firmados/prueba.pdf' };
const secret = 'secreto-unitario-callback-no-productivo';
function fixture(fallar = false) {
  const query = vi.fn().mockImplementation(async (sql: string) => {
    if (sql.includes('FROM sigd_doc.documento_adjunto')) return { rowCount: 1, rows: [{ documento_adjunto_id: datos.documento_id, s3_bucket: datos.s3_bucket }] };
    if (sql.includes('FROM sigd_doc.firma_digital_documento')) return { rowCount: 0, rows: [] };
    if (sql.includes('INSERT INTO')) { if (fallar) throw new Error('Fallo SQL de prueba'); return { rowCount: 1, rows: [{ cvd: 'CVD-RETORNADO-POR-PG' }] }; }
    return { rows: [], rowCount: 0 };
  });
  const release = vi.fn(); const pool = { query, connect: async () => ({ query, release }) } as unknown as Pool;
  return { app: construirApp(pool), query, release };
}
beforeEach(() => {
  vi.stubEnv('REDIS_URL', ''); vi.stubEnv('REFIRMA_WEBHOOK_SECRET', secret); vi.stubEnv('S3_BUCKET', datos.s3_bucket);
  vi.stubEnv('AUTH_JWT_SECRET', 'secreto-jwt-exclusivo-unitario-al-menos-32');
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(pdf)));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('Callback montado en la aplicacion original', () => {
  it.each(['ausente', 'invalido', 'expirado'])('rechaza JWT %s sin consultar documentos ni Storage', async tipo => {
    const f = fixture();
    const peticion = request(f.app).post('/api/v1/firma/invocar-refirma');
    if (tipo !== 'ausente') peticion.set('Authorization', 'Bearer ' + (tipo === 'invalido' ? 'token.invalido' :
      firmarTokenAcceso({ sub: '11111111-1111-4111-8111-111111111111', ahora: Date.now() - 60000, expiraSegundos: 1 })));
    expect((await peticion.send({ documentoId: datos.documento_id })).status).toBe(401);
    expect(f.query).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['ausente', 'invalido', 'expirado'])('la consulta de estado rechaza JWT %s antes de consultar PostgreSQL', async tipo => {
    const f = fixture();
    const peticion = request(f.app).get(`/api/v1/firma/documento/${datos.documento_id}/estado`);
    if (tipo !== 'ausente') peticion.set('Authorization', 'Bearer ' + (tipo === 'invalido' ? 'token.invalido' :
      firmarTokenAcceso({ sub: '11111111-1111-4111-8111-111111111111', ahora: Date.now() - 60000, expiraSegundos: 1 })));
    expect((await peticion).status).toBe(401);
    expect(f.query).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('acepta el HMAC de los bytes originales y confirma una sola persistencia', async () => {
    const f = fixture(); const raw = JSON.stringify(datos, null, 2);
    const sig = createHmac('sha256', secret).update(raw).digest('hex');
    const res = await request(f.app).post('/api/v1/firma/callback-refirma').set('Content-Type', 'application/json').set('x-refirma-signature', sig).set('x-refirma-timestamp', new Date().toISOString()).send(raw);
    expect(res.status).toBe(200); expect(res.body).toEqual({ estado: 'FIRMADO_DIGITALMENTE', cvd: 'CVD-RETORNADO-POR-PG' });
    expect(f.query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO'))).toHaveLength(1);
    expect(f.query).toHaveBeenCalledWith('COMMIT'); expect(f.release).toHaveBeenCalledOnce();
  });
  it('rechaza callbacks sin HMAC sin iniciar transacciones', async () => {
    const f = fixture(); const res = await request(f.app).post('/api/v1/firma/callback-refirma').send(datos);
    expect(res.status).toBe(403); expect(f.query).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('un HMAC de otro cuerpo no permite registrar evidencia', async () => {
    const f = fixture(); const sig = createHmac('sha256', secret).update('{}').digest('hex');
    const res = await request(f.app).post('/api/v1/firma/callback-refirma').set('x-refirma-signature', sig).set('x-refirma-timestamp', new Date().toISOString()).send(datos);
    expect(res.status).toBe(403); expect(f.query).not.toHaveBeenCalled();
  });
  it('ante un error SQL hace rollback y no publica un CVD', async () => {
    const f = fixture(true); const raw = JSON.stringify(datos); const sig = createHmac('sha256', secret).update(raw).digest('hex');
    const res = await request(f.app).post('/api/v1/firma/callback-refirma').set('Content-Type', 'application/json').set('x-refirma-signature', sig).set('x-refirma-timestamp', new Date().toISOString()).send(raw);
    expect(res.status).toBe(500); expect(res.body.cvd).toBeUndefined(); expect(f.query).toHaveBeenCalledWith('ROLLBACK');
    expect(f.query).not.toHaveBeenCalledWith('COMMIT'); expect(f.release).toHaveBeenCalledOnce();
  });
});
