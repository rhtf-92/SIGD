// Estas pruebas simulan exclusivamente el contrato de persistencia, no una firma real.
vi.mock('../../../../src/domains/docucore/verificadorPades.service.js', () => ({
  validarFirmaPades: vi.fn(async () => ({ valido: true, validacionCriptografica: true, detalles: {} })),
  obtenerPoliticaValidacionPades: vi.fn(() => ({ exigirTsa: false, exigirRevocacion: false })),
}));
import { createHash, createHmac } from 'node:crypto';
import type { PoolClient } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registrarCallbackRefirma, verificarFirmaWebhook } from '../../../../src/domains/docucore/callbackRefirma.service.js';
const pdf = Buffer.from('%PDF-1.7\nFixture de transporte, sin firma criptografica.');
const datos = { documento_id: 'cb0af3db-614e-4379-975f-5547a8018e5a', sha256_firmado: createHash('sha256').update(pdf).digest('hex'),
  firmante: 'Proveedor de prueba', fecha_sello_tsa: '2026-10-19T12:00:00Z', s3_bucket: 'sigd-seguridad-aislada', s3_key: 'firmados/prueba.pdf' };
function cliente(anterior?: { cvd: string; coincide: boolean }) {
  const query = vi.fn().mockImplementation(async (sql: string) => {
    if (sql.includes('FROM sigd_doc.documento_adjunto')) return { rowCount: 1, rows: [{ documento_adjunto_id: datos.documento_id, s3_bucket: datos.s3_bucket }] };
    if (sql.includes('FROM sigd_doc.firma_digital_documento')) return { rowCount: anterior ? 1 : 0, rows: anterior ? [anterior] : [] };
    if (sql.includes('INSERT INTO')) return { rowCount: 1, rows: [{ cvd: 'CVD-TEST-RETURNED-BY-DATABASE' }] };
    throw Error('Consulta inesperada');
  });
  return { db: { query } as unknown as PoolClient, query };
}
beforeEach(() => {
  vi.stubEnv('S3_BUCKET', datos.s3_bucket);
  vi.stubEnv('S3_ENDPOINT', 'http://127.0.0.1:9000');
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(pdf)));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('Persistencia del callback autenticado de Refirma', () => {
  it('usa la PK original y devuelve solo el CVD generado por PostgreSQL', async () => {
    const { db, query } = cliente();
    expect(await registrarCallbackRefirma(db, datos)).toBe('CVD-TEST-RETURNED-BY-DATABASE');
    expect(query.mock.calls[0][0]).toContain('WHERE documento_adjunto_id = $1');
    const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO'))!;
    expect(insert[0]).not.toContain('DO UPDATE'); expect(insert[1][0]).toBe(datos.documento_id);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('http://127.0.0.1:9000/sigd-seguridad-aislada/'), expect.objectContaining({ redirect: 'error' }));
  });
  it('un reintento identico conserva el CVD sin escribir', async () => {
    const { db, query } = cliente({ cvd: 'CVD-PERSISTIDO', coincide: true });
    expect(await registrarCallbackRefirma(db, datos)).toBe('CVD-PERSISTIDO');
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT'))).toBe(false);
  });
  it('rechaza reemplazar evidencia por un callback diferente', async () => {
    const { db } = cliente({ cvd: 'CVD-PERSISTIDO', coincide: false });
    await expect(registrarCallbackRefirma(db, datos)).rejects.toMatchObject({ status: 409 });
  });
  it('rechaza buckets ajenos antes de contactar Storage', async () => {
    const { db } = cliente();
    await expect(registrarCallbackRefirma(db, { ...datos, s3_bucket: 'compartido' })).rejects.toMatchObject({ status: 403 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rechaza referencias con segmentos de recorrido', async () => {
    const { db } = cliente();
    await expect(registrarCallbackRefirma(db, { ...datos, s3_key: '../ajeno.pdf' })).rejects.toMatchObject({ status: 403 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rechaza hash que no corresponde al PDF', async () => {
    const { db, query } = cliente();
    await expect(registrarCallbackRefirma(db, { ...datos, sha256_firmado: 'a'.repeat(64) })).rejects.toMatchObject({ status: 409 });
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT'))).toBe(false);
  });
  it('rechaza bytes que no son PDF aunque coincida su hash', async () => {
    const bytes = Buffer.from('no es PDF'); vi.mocked(fetch).mockResolvedValue(new Response(bytes));
    await expect(registrarCallbackRefirma(cliente().db, { ...datos, sha256_firmado: createHash('sha256').update(bytes).digest('hex') })).rejects.toMatchObject({ status: 409 });
  });
  it('no oculta la indisponibilidad del objeto como documento firmado', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 404 }));
    await expect(registrarCallbackRefirma(cliente().db, datos)).rejects.toMatchObject({ status: 503 });
  });
  it('documento inexistente no consulta Storage ni inserta evidencia', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(registrarCallbackRefirma({ query } as unknown as PoolClient, datos)).rejects.toMatchObject({ status: 404 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('propaga errores reales de PostgreSQL', async () => {
    const error = new Error('db unavailable'); const query = vi.fn().mockRejectedValue(error);
    await expect(registrarCallbackRefirma({ query } as unknown as PoolClient, datos)).rejects.toBe(error);
  });
  it('solo acepta HMAC del cuerpo exacto y secreto configurado', () => {
    const raw = Buffer.from(JSON.stringify(datos)); const secret = 'secreto-exclusivo-de-prueba';
    const signature = createHmac('sha256', secret).update(raw).digest('hex');
    expect(() => verificarFirmaWebhook(raw, 'sha256=' + signature, secret, new Date().toISOString())).not.toThrow();
    expect(() => verificarFirmaWebhook(Buffer.from('{}'), signature, secret, new Date().toISOString())).toThrow();
    expect(() => verificarFirmaWebhook(raw, undefined, secret, new Date().toISOString())).toThrow();
    expect(() => verificarFirmaWebhook(raw, signature, '', new Date().toISOString())).toThrow();
    expect(() => verificarFirmaWebhook(raw, signature, secret)).toThrow();
    expect(() => verificarFirmaWebhook(raw, signature, secret, new Date(Date.now() + 400_000).toISOString())).toThrow();
  });
  it('rechaza datos invalidos o incompletos con ValidationError (400)', async () => {
    const { db } = cliente();
    await expect(registrarCallbackRefirma(db, { ...datos, sha256_firmado: 'invalido' })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('rechaza con ValidationError (400) cuando la firma tiene confianza institucional pendiente', async () => {
    const { db } = cliente();
    const { validarFirmaPades } = await import('../../../../src/domains/docucore/verificadorPades.service.js');
    vi.mocked(validarFirmaPades).mockResolvedValueOnce({
      valido: false,
      tipoFirma: 'FIRMA_PADES_CONFIANZA_PENDIENTE',
      validacionCriptografica: true,
      integridadBytesProtegidos: true,
      detalles: { tieneFirmaCms: true, advertencia: 'Firma CMS sin cadena institucional' },
    });

    await expect(registrarCallbackRefirma(db, datos)).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('rechaza con ValidationError (400) cuando la validación PAdES detecta un certificado revocado (CRL)', async () => {
    const { db } = cliente();
    const { validarFirmaPades } = await import('../../../../src/domains/docucore/verificadorPades.service.js');
    vi.mocked(validarFirmaPades).mockResolvedValueOnce({
      valido: false,
      tipoFirma: 'FIRMA_PADES_CONFIANZA_PENDIENTE',
      validacionCriptografica: true,
      integridadBytesProtegidos: true,
      detalles: {
        tieneFirmaCms: true,
        motivoRechazo: 'El certificado del firmante ha sido revocado.',
        revocacion: { estado: 'REVOCADO_CONFIRMADO', motivo: 'CRL list' },
      },
    });

    await expect(registrarCallbackRefirma(db, datos)).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('rechaza con ValidationError (400) cuando la validación PAdES detecta que falta el sello de tiempo TSA exigido', async () => {
    const { db, query } = cliente();
    const { validarFirmaPades } = await import('../../../../src/domains/docucore/verificadorPades.service.js');
    vi.mocked(validarFirmaPades).mockResolvedValueOnce({
      valido: false,
      tipoFirma: 'FIRMA_PADES_CONFIANZA_PENDIENTE',
      validacionCriptografica: true,
      integridadBytesProtegidos: true,
      detalles: {
        tieneFirmaCms: true,
        advertencia: 'El documento no contiene una estampa de tiempo TSA RFC 3161 válida exigida por la política.',
      },
    });

    await expect(registrarCallbackRefirma(db, datos)).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
    expect(query.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('INSERT'))).toBe(false);
  });

  it('rechaza con ValidationError (400) y cero escrituras cuando la revocación queda NO_VERIFICADO_OFFLINE bajo exigencia estricta', async () => {
    const { db, query } = cliente();
    const { validarFirmaPades } = await import('../../../../src/domains/docucore/verificadorPades.service.js');
    vi.mocked(validarFirmaPades).mockResolvedValueOnce({
      valido: false,
      tipoFirma: 'FIRMA_PADES_CONFIANZA_PENDIENTE',
      validacionCriptografica: true,
      integridadBytesProtegidos: true,
      detalles: {
        tieneFirmaCms: true,
        motivoRechazo: 'Revocación no verificada (modo offline/red no disponible) y la política exige verificación estricta.',
        revocacion: { estado: 'NO_VERIFICADO_OFFLINE', motivo: 'Modo offline / red no disponible' },
      },
    });

    await expect(
      registrarCallbackRefirma(db, datos, { exigirRevocacion: true }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
    // Garantizar cero persistencia o mutación en base de datos tras rechazo
    expect(
      query.mock.calls.some(
        ([sql]) =>
          typeof sql === 'string' &&
          (sql.includes('INSERT INTO') || sql.trim().startsWith('UPDATE')),
      ),
    ).toBe(false);
  });

  it('propaga opciones de validación explícitas a validarFirmaPades', async () => {
    const { db } = cliente();
    const { validarFirmaPades } = await import('../../../../src/domains/docucore/verificadorPades.service.js');
    vi.mocked(validarFirmaPades).mockClear();

    await registrarCallbackRefirma(db, datos, {
      exigirTsa: true,
      exigirRevocacion: true,
    });

    expect(validarFirmaPades).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        exigirTsa: true,
        exigirRevocacion: true,
      }),
    );
  });

  it('transiciona legítimamente a RESUELTO cuando el expediente asociado se encuentra en EN_FIRMA', async () => {
    const mockExpedienteId = 'e0000000-0000-4000-8000-000000000001';
    const query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sigd_doc.documento_adjunto')) {
        return { rowCount: 1, rows: [{ documento_adjunto_id: datos.documento_id, expediente_id: mockExpedienteId, s3_bucket: datos.s3_bucket }] };
      }
      if (sql.includes('FROM sigd_doc.firma_digital_documento')) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('INSERT INTO sigd_doc.firma_digital_documento')) {
        return { rowCount: 1, rows: [{ cvd: 'CVD-FIRMADO-OK' }] };
      }
      if (sql.includes('UPDATE sigd_doc.resolucion')) {
        return { rowCount: 1, rows: [{ resolucion_id: 'r-1', numero_resolucion: 'RD-2026-000001' }] };
      }
      if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes('SELECT COALESCE(ultimo.estado_nuevo')) {
        return { rowCount: 1, rows: [{ estado_actual: 'EN_FIRMA' }] };
      }
      if (sql.includes('FROM sigd_auth.cuenta_usuario cu')) {
        return { rowCount: 1, rows: [{ operador_id: '990000002' }] };
      }
      if (sql.includes('INSERT INTO sigd_rut.movimiento_tramite')) {
        return { rowCount: 1, rows: [{ id_movimiento: 'm-resuelto-1' }] };
      }
      if (sql.includes('SELECT cu.id_usuario AS usuario_id')) {
        return { rowCount: 1, rows: [{ usuario_id: 'u-1', cut: 'EXP-2026-000001', correo: 'test@suiza.edu.pe' }] };
      }
      if (sql.includes('INSERT INTO sigd_audit.evento_outbox')) {
        return { rowCount: 1, rows: [{ id_evento: 'out-1' }] };
      }
      throw new Error('Consulta no esperada: ' + sql);
    });

    const cvd = await registrarCallbackRefirma({ query } as unknown as PoolClient, datos);
    expect(cvd).toBe('CVD-FIRMADO-OK');

    const callMovimiento = query.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('sigd_rut.movimiento_tramite'));
    expect(callMovimiento).toBeDefined();
    expect(callMovimiento![0]).toContain("'EN_FIRMA'");
    expect(callMovimiento![0]).toContain("'FIRMA'");
    expect(callMovimiento![0]).toContain("'RESUELTO'");
  });
});
