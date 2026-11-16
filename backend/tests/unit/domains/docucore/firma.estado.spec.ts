// Doble del verificador SOLO para probar contratos HTTP. Criptografia real en verificadorPades.spec.ts.
vi.mock('../../../../src/domains/docucore/verificadorPades.service.js', () => ({ validarFirmaPades: vi.fn(async () => ({ valido: true, validacionCriptografica: true, integridadBytesProtegidos: true, tipoFirma: 'FIRMA_PADES_VALIDA', detalles: { tieneFirmaCms: true } })), obtenerPoliticaValidacionPades: vi.fn(() => ({ exigirTsa: false, exigirRevocacion: false })) }));
import express from 'express';
import request from 'supertest';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { crearFirmaRouter } from '../../../../src/domains/docucore/firma.controller.js';
import { ServicioFirmaService } from '../../../../src/domains/docucore/firma.service.js';
import { crearRouterDocuCore } from '../../../../src/domains/docucore/docucore.router.js';
import { InMemoryFirmaSessionStore } from '../../../../src/domains/docucore/firmaSession.store.js';
import { InMemoryAlmacenDocumentosFirmables } from '../../../../src/domains/docucore/documentoFirmable.store.js';
import { RefirmaGatewayService } from '../../../../src/domains/docucore/refirmaGateway.service.js';
import { resolverIdentidad, verificarFacultadFirma } from '../../../../src/core/auth/auth.guard.js';
import { UnauthorizedError } from '../../../../src/shared/domain/errors/index.js';
vi.mock('../../../../src/core/auth/auth.guard.js', () => ({ resolverIdentidad: vi.fn(), verificarFacultadFirma: vi.fn() }));
const id = 'cb0af3db-614e-4379-975f-5547a8018e5a';
const pdf = Buffer.from('%PDF-1.7\nPrueba de contrato, sin firma criptografica');
const evidencia = { estado: 'FIRMADO_DIGITALMENTE', cvd: 'CVD-2026-0123456789ABCDEF', sha256_firmado: createHash('sha256').update(pdf).digest('hex'), firmante: 'Proveedor unitario', fecha_sello_tsa: '2026-10-19T12:00:00Z', s3_bucket: 'sigd-seguridad-aislada', s3_key: 'firmados/prueba.pdf' };
function fixture({ activo = true, acceso = true, existe = true, firma = evidencia as typeof evidencia | null, fallo = false } = {}) {
  const query = vi.fn().mockImplementation(async (sql: string) => {
    if (sql.includes('FROM sigd_auth.cuenta_usuario')) return { rows: activo ? [{ nombre: 'Operador persistido', documento: '99000002' }] : [], rowCount: activo ? 1 : 0 };
    if (sql.includes('FROM sigd_doc.documento_adjunto')) return { rows: existe ? [{ documento_adjunto_id: id, expediente_id: 'expediente' }] : [], rowCount: existe ? 1 : 0 };
    if (sql.includes('FROM sigd_doc.firma_digital_documento')) {
      if (fallo) throw new Error('Error real de SQL simulado');
      return { rows: firma ? [firma] : [], rowCount: firma ? 1 : 0 };
    }
    throw new Error('Consulta no esperada');
  });
  const pool = { query } as unknown as Pool;
  const sesiones = new InMemoryFirmaSessionStore();
  const servicio = new ServicioFirmaService({ sesiones, almacen: new InMemoryAlmacenDocumentosFirmables(sesiones), pasarela: new RefirmaGatewayService({ hostsPermitidos: ['sigd.iestp-suiza.edu.pe'], exigirHttps: true }) });
  const app = express(); app.use(express.json());
  app.use(crearFirmaRouter(servicio, pool, { obtenerActor: () => ({ id: 'operador', roles: [], unidadOrganicaId: null, puedeVerExpediente: async () => acceso }) }));
  app.use('/api', crearRouterDocuCore(pool));
  app.use((error: { status?: number; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.status ?? 500).json({ code: error.code ?? 'INTERNAL_ERROR' }));
  return { app, query };
}
const ruta = `/documento/${id}/estado`;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('S3_BUCKET', evidencia.s3_bucket); vi.stubEnv('S3_ENDPOINT', 'http://127.0.0.1:9000');
  vi.mocked(resolverIdentidad).mockReturnValue({ idUsuario: '11111111-1111-4111-8111-111111111111', roles: [], via: 'bearer' });
  vi.mocked(verificarFacultadFirma).mockResolvedValue({ puedeFirmar: true, facultadGlobal: true, tiposAutorizados: [], roles: [], motivo: null });
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(pdf)));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('Consulta protegida de evidencia persistida de firma', () => {
  it('el CVD del resultado se consulta con el validador original y la misma evidencia cotejada', async () => {
    const f = fixture();
    const estado = await request(f.app).get(ruta);
    const verificacion = await request(f.app).get(`/api/v1/validador-cvd/verificar/${estado.body.resultado.cvd}`);
    expect(verificacion.status).toBe(200); expect(verificacion.body.cvd).toBe(estado.body.resultado.cvd);
    expect(verificacion.body.valido).toBe(true); expect(verificacion.body.sha256_firmado).toBe(evidencia.sha256_firmado);
    expect(estado.body.validacionCriptografica).toBe(false);
  });
  it('devuelve ausencia de evidencia sin inventar un estado persistido', async () => {
    const f = fixture({ firma: null }); const res = await request(f.app).get(ruta);
    expect(res.status).toBe(200); expect(res.body).toEqual({ documentoId: id, estado: null, resultado: null, integridadVerificada: false, validacionCriptografica: false });
    expect(fetch).not.toHaveBeenCalled(); expect(res.headers['cache-control']).toBe('no-store');
  });
  it('devuelve el registro cotejado y una descarga autorizada sin exponer tokens ni campos internos', async () => {
    const f = fixture(); const res = await request(f.app).get(ruta);
    expect(res.status).toBe(200); expect(res.body.estado).toBe('FIRMADO_DIGITALMENTE'); expect(res.body.integridadVerificada).toBe(true);
    expect(res.body.resultado).toMatchObject({ cvd: evidencia.cvd, timestamp: '2026-10-19T12:00:00.000Z' });
    expect(res.body.resultado.urlFirmado).toContain('http://127.0.0.1:9000/');
    expect(res.body.validacionCriptografica).toBe(false); expect(res.body.s3_key).toBeUndefined(); expect(res.body.token).toBeUndefined();
    expect(f.query.mock.calls.every(([sql]) => sql.trim().startsWith('SELECT'))).toBe(true);
  });
  it('recupera la evidencia sin necesitar una sesion temporal de firma en memoria', async () => {
    const f = fixture(); const primero = await request(f.app).get(ruta); const segundo = await request(fixture().app).get(ruta);
    expect(primero.body.resultado.cvd).toBe(segundo.body.resultado.cvd); expect(segundo.body.integridadVerificada).toBe(true);
  });
  it('rechaza JWT ausente antes de consultar PostgreSQL', async () => {
    vi.mocked(resolverIdentidad).mockImplementation(() => { throw new UnauthorizedError(); });
    const f = fixture(); expect((await request(f.app).get(ruta)).status).toBe(401); expect(f.query).not.toHaveBeenCalled();
  });
  it('rechaza cuenta inactiva antes de consultar la evidencia', async () => {
    const f = fixture({ activo: false }); expect((await request(f.app).get(ruta)).status).toBe(403); expect(fetch).not.toHaveBeenCalled();
  });
  it('no eleva facultades restringidas a facultades globales', async () => {
    vi.mocked(verificarFacultadFirma).mockResolvedValue({ puedeFirmar: true, facultadGlobal: false, tiposAutorizados: ['DIRECTORAL_TITULACION'], roles: [], motivo: null });
    const f = fixture(); expect((await request(f.app).get(ruta)).status).toBe(403); expect(fetch).not.toHaveBeenCalled();
  });
  it('expediente ajeno e inexistente son indistinguibles y no consultan evidencia', async () => {
    const a = fixture({ acceso: false }); const b = fixture({ existe: false });
    const ajeno = await request(a.app).get(ruta); const inexistente = await request(b.app).get(ruta);
    expect(ajeno.status).toBe(404); expect(inexistente.status).toBe(404); expect(ajeno.body).toEqual(inexistente.body);
    expect(a.query.mock.calls.some(([sql]) => sql.includes('FROM sigd_doc.firma_digital_documento'))).toBe(false); expect(fetch).not.toHaveBeenCalled();
  });
  it.each([{ cvd: 'invalido' }, { firmante: '' }, { fecha_sello_tsa: '' }, { estado: 'PENDIENTE' }, { sha256_firmado: 'invalido' }])('rechaza evidencia incompleta %j', async parcial => {
    const f = fixture({ firma: { ...evidencia, ...parcial } }); const res = await request(f.app).get(ruta);
    expect(res.status).toBe(409); expect(res.body.resultado).toBeUndefined(); expect(fetch).not.toHaveBeenCalled();
  });
  it('no confirma evidencia cuyo PDF no coincide con el SHA-256 registrado', async () => {
    const f = fixture({ firma: { ...evidencia, sha256_firmado: 'a'.repeat(64) } }); expect((await request(f.app).get(ruta)).status).toBe(409);
  });
  it('rechaza referencias a un bucket no configurado antes de descargar', async () => {
    const f = fixture({ firma: { ...evidencia, s3_bucket: 'compartido-no-autorizado' } }); expect((await request(f.app).get(ruta)).status).toBe(403); expect(fetch).not.toHaveBeenCalled();
  });
  it('un objeto ausente produce 503 sin un resultado de firma exitoso', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 404 })); const res = await request(fixture().app).get(ruta);
    expect(res.status).toBe(503); expect(res.body.resultado).toBeUndefined();
  });
  it('no oculta fallos SQL como evidencia ausente', async () => {
    const res = await request(fixture({ fallo: true }).app).get(ruta); expect(res.status).toBe(500); expect(res.body.estado).toBeUndefined(); expect(fetch).not.toHaveBeenCalled();
  });
});
