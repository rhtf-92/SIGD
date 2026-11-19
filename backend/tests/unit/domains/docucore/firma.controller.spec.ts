import express from 'express';
import request from 'supertest';
import type { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { crearFirmaRouter } from '../../../../src/domains/docucore/firma.controller.js';
import { resolverIdentidad, verificarFacultadFirma } from '../../../../src/core/auth/auth.guard.js';
import { UnauthorizedError } from '../../../../src/shared/domain/errors/index.js';
import type { ServicioFirmaService } from '../../../../src/domains/docucore/firma.service.js';

vi.mock('../../../../src/core/auth/auth.guard.js', () => ({ resolverIdentidad: vi.fn(), verificarFacultadFirma: vi.fn() }));

const pdf = Buffer.from('%PDF-1.7\nDocumento original de prueba');
const id = 'cb0af3db-614e-4379-975f-5547a8018e5a';
const expedienteId = 'cb0af3db-614e-4379-975f-5547a8018e5b';

function appFixture({
  activo = true,
  acceso = true,
  hash = createHash('sha256').update(pdf).digest('hex'),
  estadoExpediente = 'EN_FIRMA',
  esResolucionValida = true,
} = {}) {
  const query = vi.fn().mockImplementation(async (sql: string) => {
    if (sql.includes('cuenta_usuario')) return { rows: activo ? [{ nombre: 'Operador persistido', documento: '99000002' }] : [] };
    if (sql.includes('estado_actual_expediente')) return { rows: estadoExpediente ? [{ estado_nuevo: estadoExpediente }] : [] };
    if (sql.includes('sigd_doc.resolucion')) return { rows: esResolucionValida ? [{ resolucion_id: 'cb0af3db-614e-4379-975f-5547a8018e5c', numero_borrador: 'RD-2026-000001' }] : [] };
    return {
      rows: [{
        documento_adjunto_id: id,
        expediente_id: expedienteId,
        nombre_archivo: 'RD-2026-000001.pdf',
        mime_type: 'application/pdf',
        s3_bucket: 'sigd-seguridad-aislada',
        s3_key: 'resoluciones/RD-2026-000001.pdf',
        sha256: hash,
      }],
    };
  });
  const invocarRefirma = vi.fn().mockResolvedValue({ sesionId: 'sesion', uriProtocolar: 'refirma://sign?arguments=[abc]' });
  const registrarDocumentoFirmable = vi.fn();
  const app = express();
  app.use(express.json());
  app.use(crearFirmaRouter({ invocarRefirma, registrarDocumentoFirmable } as unknown as ServicioFirmaService,
    { query } as unknown as Pool, { obtenerActor: () => ({ id: 'cuenta', roles: [], unidadOrganicaId: null, puedeVerExpediente: async () => acceso }) }));
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.status ?? 500).json({ error: true }));
  return { app, query, invocarRefirma, registrarDocumentoFirmable };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('S3_BUCKET', 'sigd-seguridad-aislada');
  vi.mocked(resolverIdentidad).mockReturnValue({ idUsuario: '11111111-1111-4111-8111-111111111111', roles: [], via: 'bearer' });
  vi.mocked(verificarFacultadFirma).mockResolvedValue({ puedeFirmar: true, facultadGlobal: true, tiposAutorizados: [], roles: [], motivo: null });
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(pdf)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Invocacion de firma con identidad y documento persistidos', () => {
  it('rechaza solicitudes no autenticadas antes de consultar documentos', async () => {
    vi.mocked(resolverIdentidad).mockImplementation(() => { throw new UnauthorizedError(); });
    const f = appFixture();
    expect((await request(f.app).post('/invocar-refirma').send({ documentoId: id })).status).toBe(401);
    expect(f.query).not.toHaveBeenCalled();
    expect(f.invocarRefirma).not.toHaveBeenCalled();
  });

  it('rechaza cuentas inactivas', async () => {
    const f = appFixture({ activo: false });
    expect((await request(f.app).post('/invocar-refirma').send({ documentoId: id })).status).toBe(403);
    expect(f.invocarRefirma).not.toHaveBeenCalled();
  });

  it('rechaza operadores sin facultad persistida', async () => {
    vi.mocked(verificarFacultadFirma).mockResolvedValue({ puedeFirmar: false, facultadGlobal: false, tiposAutorizados: [], roles: [], motivo: null });
    const f = appFixture();
    expect((await request(f.app).post('/invocar-refirma').send({ documentoId: id })).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('no convierte una facultad por tipo en facultad global', async () => {
    vi.mocked(verificarFacultadFirma).mockResolvedValue({ puedeFirmar: true, facultadGlobal: false, tiposAutorizados: ['DIRECTORAL_TITULACION'], roles: [], motivo: null });
    const f = appFixture();
    expect((await request(f.app).post('/invocar-refirma').send({ documentoId: id })).status).toBe(403);
  });

  it('no entrega documentos ajenos aunque exista facultad de firma', async () => {
    const f = appFixture({ acceso: false });
    expect((await request(f.app).post('/invocar-refirma').send({ documentoId: id })).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
    expect(f.invocarRefirma).not.toHaveBeenCalled();
  });

  it('H-01: bloquea la invocación si el expediente está en EN_REVISION (no EN_FIRMA)', async () => {
    const f = appFixture({ estadoExpediente: 'EN_REVISION' });
    const res = await request(f.app).post('/invocar-refirma').send({ documentoId: id });
    expect(res.status).toBe(409);
    expect(f.invocarRefirma).not.toHaveBeenCalled();
  });

  it('H-01: bloquea la invocación si el expediente carece de estado en RutaDoc', async () => {
    const f = appFixture({ estadoExpediente: null as unknown as string });
    const res = await request(f.app).post('/invocar-refirma').send({ documentoId: id });
    expect(res.status).toBe(409);
    expect(f.invocarRefirma).not.toHaveBeenCalled();
  });

  it('H-02: bloquea si el expedienteId enviado no coincide con el expediente del documento', async () => {
    const f = appFixture();
    const res = await request(f.app).post('/invocar-refirma').send({
      documentoId: id,
      expedienteId: '11111111-2222-3333-4444-555555555555',
    });
    expect(res.status).toBe(409);
    expect(f.invocarRefirma).not.toHaveBeenCalled();
  });

  it('H-02: bloquea si el documento no corresponde al borrador de resolución del expediente', async () => {
    const f = appFixture({ esResolucionValida: false });
    const res = await request(f.app).post('/invocar-refirma').send({ documentoId: id });
    expect(res.status).toBe(409);
    expect(f.invocarRefirma).not.toHaveBeenCalled();
  });

  it('recupera el PDF real y utiliza el firmante persistido, no el afirmado por el cliente', async () => {
    const f = appFixture();
    expect((await request(f.app).post('/invocar-refirma').send({ documentoId: id, firmante: { id: 'ajeno', nombre: 'Falso', documento: '00000000' } })).status).toBe(200);
    expect(f.registrarDocumentoFirmable).toHaveBeenCalledWith(expect.objectContaining({ id, bytes: pdf }));
    expect(f.invocarRefirma).toHaveBeenCalledWith(expect.objectContaining({ firmante: { id: '11111111-1111-4111-8111-111111111111', nombre: 'Operador persistido', documento: '99000002' } }));
  });

  it('no invoca al proveedor si el hash original no coincide', async () => {
    const f = appFixture({ hash: 'a'.repeat(64) });
    expect((await request(f.app).post('/invocar-refirma').send({ documentoId: id })).status).toBe(409);
    expect(f.invocarRefirma).not.toHaveBeenCalled();
  });

  it('no invoca al proveedor si Storage no esta disponible', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 404 }));
    const f = appFixture();
    expect((await request(f.app).post('/invocar-refirma').send({ documentoId: id })).status).toBe(503);
    expect(f.invocarRefirma).not.toHaveBeenCalled();
  });
});
