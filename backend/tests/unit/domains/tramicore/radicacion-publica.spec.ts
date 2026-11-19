import express from 'express';
import request from 'supertest';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import type { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearRouterRadicacionPublica, publicHash, validarPdfPublico } from '../../../../src/domains/tramicore/radicacionPublica.router.js';
import { radicacionPublicaSchema } from '../../../../src/domains/tramicore/radicacionPublica.schemas.js';
import { RadicacionVirtualService } from '../../../../src/domains/tramicore/radicacionVirtual.service.js';
import { admisibilidadPublica } from '../../../../src/domains/tramicore/admisibilidadPublica.js';
import type { PublicSubmissionStore } from '../../../../src/domains/tramicore/publicSubmission.store.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';
import { contextMiddleware } from '../../../../src/middleware/context-middleware.js';
import { crearRouterTramites } from '../../../../src/domains/tramicore/tramites.controller.js';
import { ConsultaPublicaService } from '../../../../src/domains/tramicore/consultaPublica.service.js';

const TUPA = '11111111-1111-4111-8111-111111111111';
const PERSON = '22222222-2222-4222-8222-222222222222';
const EXP = '33333333-3333-4333-8333-333333333333';
const KEY = 'expedientes/2026/44444444-4444-4444-8444-444444444444.pdf';
const FREE = 'Derecho de pago: S/ 0.00\nFuente verificada: FIXTURE UNITARIA, SIN VALOR INSTITUCIONAL';
const result = { expedienteId: EXP, cut: 'EXP-2026-000001', anio: 2026, fechaEnvioReal: '2026-10-30T12:00:00.000Z',
  fechaRadicacionLegal: '2026-10-30T12:00:00.000Z', fueraDeHorario: false, totalFolios: 1,
  mensajeLegal: 'FIXTURE', cargoDigital: { codigo: 'EXP-2026-000001', hashSha256: 'b'.repeat(64), qrContenido: '/consulta/EXP-2026-000001' } };
const input = () => ({ idTipoTramiteTupa: TUPA, asunto: 'Solicitud de prueba pública sin cuenta', tipoDocumento: 'DNI',
  numeroDocumento: '00000999', nombres: 'Persona', apellidos: 'Prueba', nombreSolicitante: 'Persona Prueba',
  correo: 'fixture@example.invalid', telefono: '999999999', totalFolios: 1,
  declaracionVeracidad: true, aceptaTerminos: true,
  documentos: [{ nombreArchivo: 'fixture.pdf', contentType: 'application/pdf', tamanoBytes: 100,
    hashSha256: 'a'.repeat(64), storagePath: KEY }] });

class TestStore implements PublicSubmissionStore {
  values = new Map<string, string>(); counters = new Map<string, number>(); allow = true;
  async leer(k: string) { return this.values.get(k) ?? null; }
  async guardar(k: string, v: string) { this.values.set(k, v); }
  async consumir(k: string) { const v = await this.leer(k); this.values.delete(k); return v; }
  async cuota(k: string, max: number, _ttl: number, amount = 1) {
    const n = (this.counters.get(k) ?? 0) + amount; this.counters.set(k, n); return this.allow && n <= max;
  }
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function routerFixture() {
  const store = new TestStore();
  const pool = { query: vi.fn(async (sql: string) => ({ rows: sql.includes("to_regclass('sigd_tes.orden_pago')")?[{tabla:'sigd_tes.orden_pago'}]:sql.includes('FROM sigd_tes.tarifa')?[{importe:'0.00'}]:sql.includes('SELECT descripcion') ? [{ descripcion: FREE }] : [] })) } as unknown as Pool;
  const service = { radicarPublico: vi.fn(async () => result) } as unknown as RadicacionVirtualService;
  const app = express(); app.use(express.json()); app.use(contextMiddleware);
  app.use('/publico', crearRouterRadicacionPublica(pool, store, service)); app.use(errorMiddleware);
  return { app, store, pool, service };
}
async function session(f: ReturnType<typeof routerFixture>) {
  const challenge = await request(f.app).post('/publico/reto').send({});
  expect(challenge.status).toBe(200);
  let nonce = 0; while (!publicHash(`${challenge.body.challenge}:${nonce}`).startsWith('000')) nonce++;
  const issued = await request(f.app).post('/publico/sesion').send({ id: challenge.body.id, nonce });
  expect(issued.status).toBe(201);
  return { token: issued.body.token as string, challenge, nonce };
}

describe('contrato y admisibilidad pública', () => {
  it('acepta identidad declarada sin usuario y conserva ceros del DNI', () => {
    const parsed = radicacionPublicaSchema.parse(input()); expect(parsed.numeroDocumento).toBe('00000999');
    expect(parsed).not.toHaveProperty('usuario_id');
  });
  it.each(['aceptaTerminos', 'declaracionVeracidad'])('exige aceptación de %s del lado servidor', key => {
    expect(radicacionPublicaSchema.safeParse({ ...input(), [key]: false }).success).toBe(false);
  });
  it('rechaza identidad contradictoria, RUC sin representación y cuenta inyectada', () => {
    expect(radicacionPublicaSchema.safeParse({ ...input(), nombreSolicitante: 'Tercero' }).success).toBe(false);
    expect(radicacionPublicaSchema.safeParse({ ...input(), tipoDocumento: 'RUC', numeroDocumento: '20123456789' }).success).toBe(false);
    expect(radicacionPublicaSchema.safeParse({ ...input(), usuario_id: PERSON }).success).toBe(false);
  });
  it('no confunde un comprobante opcional con gratuidad', () => {
    expect(admisibilidadPublica('Derecho de pago: S/ 124.00\nFuente verificada: fixture').habilitado).toBe(true);
    expect(admisibilidadPublica(null).habilitado).toBe(true);
    expect(admisibilidadPublica('No es gratuito').habilitado).toBe(true);
    expect(admisibilidadPublica(FREE).habilitado).toBe(true);
  });
});

describe('HTTP público sin credenciales institucionales', () => {
  it('admite localhost autorizado cross-site hacia 127.0.0.1 pero conserva rechazo de otros orígenes', async () => {
    const f = routerFixture();
    const allowed = await request(f.app).post('/publico/reto').set('Origin', 'http://localhost:5178')
      .set('Sec-Fetch-Site', 'cross-site').send({});
    expect(allowed.status).toBe(200); expect(allowed.body.challenge).toMatch(/^[0-9a-f]{48}$/);
    const denied = await request(f.app).post('/publico/reto').set('Origin', 'https://atacante.invalid')
      .set('Sec-Fetch-Site', 'cross-site').send({});
    expect(denied.status).toBe(403);
    const missing = await request(f.app).post('/publico/reto').set('Sec-Fetch-Site', 'cross-site').send({});
    expect(missing.status).toBe(403);
  });
  it('emite sesión anónima con reto y rechaza su repetición', async () => {
    const f = routerFixture(); const s = await session(f);
    expect(s.token).toMatch(/^[0-9a-f]{64}$/);
    expect((await request(f.app).post('/publico/sesion').send({ id: s.challenge.body.id, nonce: s.nonce })).status).toBe(403);
  });
  it('falla cerrado ante ausencia de token, origen externo, tipo simple y cuota agotada', async () => {
    const f = routerFixture();
    expect((await request(f.app).post('/publico/radicar').send(input())).status).toBe(403);
    expect((await request(f.app).post('/publico/reto').set('Origin', 'https://attacker.invalid').send({})).status).toBe(403);
    expect((await request(f.app).post('/publico/reto').type('form').send('x=y')).status).toBe(415);
    f.store.allow = false;
    expect((await request(f.app).post('/publico/reto').send({})).status).toBe(429);
  });
  it('rechaza referencia S3 de otro formulario antes de llamar al servicio', async () => {
    const f = routerFixture(); const s = await session(f);
    const response = await request(f.app).post('/publico/radicar').set('X-SIGD-Public-Session', s.token).send(input());
    expect(response.status).toBe(403); expect(f.service.radicarPublico).not.toHaveBeenCalled();
  });
  it('permite el envío sin JWT solo con documentos emitidos para la sesión', async () => {
    const f = routerFixture(); const s = await session(f);
    await f.store.guardar(`file:${publicHash(s.token)}:${publicHash(KEY)}`, JSON.stringify({
      s3Key: KEY, sha256: 'a'.repeat(64), bytes: 100, nombre: 'fixture.pdf', procedimiento: TUPA }));
    const response = await request(f.app).post('/publico/radicar').set('X-SIGD-Public-Session', s.token).send(input());
    expect(response.status).toBe(201); expect(response.body.cut).toBe(result.cut);
    expect(f.service.radicarPublico).toHaveBeenCalledWith(expect.objectContaining({ numeroDocumento: '00000999' }), publicHash(s.token));
  });
  it('carga PDF real a través del backend, con hash del servidor y estado acotado a la sesión', async () => {
    const f = routerFixture(); const s = await session(f);
    const pdf = await PDFDocument.create(); pdf.addPage(); const bytes = Buffer.from(await pdf.save());
    const put = vi.fn(async () => new Response(null, { status: 200 })); vi.stubGlobal('fetch', put);
    const response = await request(f.app).post('/publico/carga').set('X-SIGD-Public-Session', s.token)
      .set('X-SIGD-File-Name', 'fixture.pdf').set('X-SIGD-Tupa', TUPA).type('application/pdf').send(bytes);
    expect(response.status).toBe(201); expect(response.body.sha256).toBe(publicHash(bytes));
    expect(put).toHaveBeenCalledOnce();
    const invalid = await request(f.app).post('/publico/carga').set('X-SIGD-Public-Session', s.token)
      .set('X-SIGD-File-Name', 'fixture.pdf').set('X-SIGD-Tupa', TUPA).type('application/pdf').send(Buffer.from('not PDF'));
    expect(invalid.status).toBe(400); expect(put).toHaveBeenCalledOnce();
  });
  it('no acepta un PDF que contenga acciones JavaScript anidadas', async () => {
    const pdf = await PDFDocument.create(); pdf.addPage();
    pdf.catalog.set(PDFName.of('Names'), pdf.context.obj({ JavaScript: pdf.context.obj({ Names: [PDFString.of('x')] }) }));
    await expect(validarPdfPublico(Buffer.from(await pdf.save()))).rejects.toThrow();
  });
  it('no devuelve cargo de otro formulario', async () => {
    const f = routerFixture();
    expect((await request(f.app).get('/publico/cargo')).status).toBe(403);
    expect((await request(f.app).get('/publico/cargo').set('X-SIGD-Public-Session', 'c'.repeat(64))).status).toBe(404);
  });
  it('el CUT predecible no permite consultar una radicación pública sin la capacidad de su constancia', async () => {
    const token = 'e'.repeat(64);
    const pool = { query: vi.fn(async () => ({ rows: [{ sesion_hash: publicHash(token) }] })) } as unknown as Pool;
    const read = vi.spyOn(ConsultaPublicaService.prototype, 'consultarPorCut').mockResolvedValue({ cut: result.cut } as never);
    const app = express(); app.use(contextMiddleware); app.use(crearRouterTramites(pool)); app.use(errorMiddleware);
    expect((await request(app).get(`/tramites/consulta-publica/${result.cut}`)).status).toBe(404);
    expect((await request(app).get(`/tramites/consulta-publica/${result.cut}`).set('X-SIGD-Public-Session', 'f'.repeat(64))).status).toBe(404);
    expect(read).not.toHaveBeenCalled();
    expect((await request(app).get(`/tramites/consulta-publica/${result.cut}`).set('X-SIGD-Public-Session', token)).status).toBe(200);
    expect(read).toHaveBeenCalledOnce();
  });
});

function transactionFixture(options: { paid?: boolean; mismatch?: boolean; failAttachment?: boolean; demo?: boolean; onlyVoucher?: boolean } = {}) {
  if (options.demo) { vi.stubEnv('SIGD_DEMO_OMITIR_PAGO', 'true'); vi.stubEnv('NODE_ENV', 'test'); }
  const queries: { sql: string; values: unknown[] }[] = [];
  let fingerprint = ''; let previous: typeof result | null = null;
  const client = { query: vi.fn(async (sql: string, values: unknown[] = []) => {
    queries.push({ sql, values });
    // Explicit free tariff fixture; no inference of institutional gratuity.
    if (sql.includes("to_regclass('sigd_tes.orden_pago')")) return { rows: [{ tabla: 'sigd_tes.orden_pago' }] };
    if (sql.includes('FROM sigd_tes.tarifa')) return { rows: [{ importe: options.paid?'124.00':'0.00' }] };
    if (sql === 'SELECT current_database() AS db') return { rows: [{ db: 'sigd_jacobo_demo' }] };
    if (sql.includes("codigo='FUT'")) return { rows: [{ tipo_documental_id: TUPA }] };
    if (sql.includes('INSERT INTO sigd_tra.radicacion_publica')) { fingerprint ||= values[1] as string; return { rows: [] }; }
    if (sql.includes('SELECT payload_hash')) return { rows: [{ payload_hash: fingerprint, respuesta: previous }] };
    if (sql.includes('SELECT descripcion')) return { rows: [{ descripcion: options.paid ? 'Derecho de pago: S/ 124.00' : FREE }] };
    if (sql.includes('FROM sigd_doc.tipo_tramite_tupa')) return { rows: [{ activo: true }] };
    if (sql.includes('INSERT INTO sigd_auth.persona ')) return { rows: options.mismatch ? [] : [{ id_persona: PERSON }] };
    if (sql.includes('SELECT p.id_persona,pn.nombre_completo')) return { rows: [{ id_persona: PERSON, nombre_completo: 'Otra Persona' }] };
    if (sql.includes('FROM sigd_doc.requisito')) return { rows: [{ tipo_documental_id: options.onlyVoucher ? PERSON : TUPA, tipo_doc_codigo: options.onlyVoucher ? 'COMPROBANTE_PAGO' : 'FUT', obligatorio: !options.onlyVoucher, requiere_condicion: false }] };
    if (sql.includes('fn_generar_cut')) return { rows: [{ cut: result.cut }] };
    if (sql.includes('INSERT INTO sigd_doc.expediente')) return { rows: [{ expediente_id: EXP, fecha_registro: values[4] }] };
    if (sql.includes('INSERT INTO sigd_doc.documento_adjunto')) { if (options.failAttachment) throw new Error('FIXTURE_ATTACHMENT_FAILURE'); return { rows: [{ documento_adjunto_id: TUPA }] }; }
    if (sql.includes('MAX(f.folio_fin)')) return { rows: [{ folio_inicio: 1 }] };
    if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) return { rows: [{ id_auditoria: TUPA }] };
    if (sql.includes('UPDATE sigd_tra.radicacion_publica')) previous = JSON.parse(values[2] as string);
    return { rows: [], rowCount: 1 };
  }), release: vi.fn() };
  const service = new RadicacionVirtualService({ connect: async () => client } as unknown as Pool, async () => []);
  vi.spyOn(service as unknown as { verificarArchivo: () => Promise<{ bucket: string; key: string; paginas: number }> }, 'verificarArchivo')
    .mockResolvedValue({ bucket: 'fixture', key: KEY, paginas: 1 });
  return { service, queries, client };
}
describe('transacción de radicación pública (PostgreSQL simulado)', () => {
  it('recibe solicitud FUT sin voucher solo en demo comprobada y conserva pago NO VERIFICADO', async () => {
    const f = transactionFixture({ paid: true, demo: true, onlyVoucher: true });
    const data = radicacionPublicaSchema.parse(input());
    const response = await f.service.radicarPublico(data, 'c'.repeat(64));
    expect(response.mensajeLegal).toContain('RADICACIÓN DEMOSTRATIVA SIN VERIFICACIÓN DE PAGO');
    const metadata = JSON.parse(f.queries.find(q => q.sql.includes('INSERT INTO sigd_tra.radicacion_publica'))!.values[2] as string);
    expect(metadata.estado_economico).toBe('NO_VERIFICADO');
    expect(f.queries.find(q => q.sql.includes('INSERT INTO sigd_doc.documento_adjunto'))?.values).toContain(TUPA);
    expect(f.queries.some(q => /INSERT.*pago_transaccion|UPDATE.*tipo_tramite_tupa/.test(q.sql))).toBe(false);
  });
  it('rechaza un voucher presentado como tal incluso con excepción de pago demo', async () => {
    const f = transactionFixture({ paid: true, demo: true, onlyVoucher: true });
    const data = radicacionPublicaSchema.parse(input());
    data.documentos[0].tipoDocumentalCodigo = 'COMPROBANTE_PAGO';
    await expect(f.service.radicarPublico(data, 'c'.repeat(64))).rejects.toThrow();
    expect(f.queries.some(q => q.sql.includes('fn_generar_cut'))).toBe(false);
  });
  it('crea persona sin cuenta y registra documentos, auditoría y cargo; replay devuelve el mismo CUT', async () => {
    const f = transactionFixture(); const data = radicacionPublicaSchema.parse(input());
    const first = await f.service.radicarPublico(data, 'c'.repeat(64));
    const again = await f.service.radicarPublico(data, 'c'.repeat(64));
    expect(again).toEqual(first);
    expect(f.queries.filter(q => q.sql.includes('fn_generar_cut'))).toHaveLength(1);
    expect(f.queries.some(q => q.sql.includes('cuenta_usuario'))).toBe(false);
    expect(f.queries.find(q => q.sql.includes('INSERT INTO sigd_doc.documento_adjunto'))?.values.at(-1)).toBeNull();
    expect(f.queries.some(q => q.sql.includes('INSERT INTO sigd_audit.bitacora_auditoria'))).toBe(true);
    await expect(f.service.radicarPublico({ ...data, asunto: 'Datos modificados después del envío' }, 'c'.repeat(64))).rejects.toMatchObject({ status: 409 });
  });
  it('recibe un procedimiento sujeto a pago fuera de la excepción demo, sin pago previo',async()=>{
    const f=transactionFixture({paid:true});
    expect(await f.service.radicarPublico(radicacionPublicaSchema.parse(input()),'a'.repeat(64))).toHaveProperty('cut');
    expect(f.queries.some(q=>q.sql==='COMMIT')).toBe(true);
  });
  it.each([{ mismatch: true }, { failAttachment: true }])('revierte y no emite cargo ante fallo %j', async options => {
    const f = transactionFixture(options);
    await expect(f.service.radicarPublico(radicacionPublicaSchema.parse(input()), 'd'.repeat(64))).rejects.toThrow();
    expect(f.queries.some(q => q.sql === 'COMMIT')).toBe(false);
    expect(f.client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(f.client.release).toHaveBeenCalledOnce();
    if (!options.failAttachment) expect(f.queries.some(q => q.sql.includes('fn_generar_cut'))).toBe(false);
  });
});

describe('HTTP de órdenes públicas pendiente de migración',()=>{
  const orden=()=>({procedimientoId:TUPA,claveSolicitud:PERSON,tipoDocumento:'DNI',numeroDocumento:'00000999',nombres:'Persona',apellidos:'Prueba',correo:'fixture@example.invalid',telefono:'999999999',declaracionVeracidad:true,aceptaTerminos:true});
  it('no acepta una orden sin capacidad del formulario',async()=>{
    const f=routerFixture();expect((await request(f.app).post('/publico/ordenes').send(orden())).status).toBe(403);
  });
  it('devuelve 503 sin crear cuentas, personas ni órdenes si no está instalada',async()=>{
    const f=routerFixture(),s=await session(f);const r=await request(f.app).post('/publico/ordenes').set('X-SIGD-Public-Session',s.token).send(orden());
    expect(r.status).toBe(503);expect(r.body.code).toBe('PUBLIC_ORDER_NOT_INSTALLED');
    expect(vi.mocked(f.pool.query).mock.calls.some(([sql])=>String(sql).includes('INSERT'))).toBe(false);
  });
  it('rechaza un importe manipulado antes de consultar la tarifa',async()=>{
    const f=routerFixture(),s=await session(f);expect((await request(f.app).post('/publico/ordenes').set('X-SIGD-Public-Session',s.token).send({...orden(),importe:'0.01'})).status).toBe(400);
  });
  it('no expone una búsqueda pública de órdenes mediante DNI',async()=>{
    const f=routerFixture();expect((await request(f.app).get('/publico/ordenes?dni=00000999')).status).toBe(404);
  });
});
