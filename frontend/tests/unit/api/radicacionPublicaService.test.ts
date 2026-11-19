import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { completePublicSubmission, publicRequest, publicSession, publicTrackingHeaders, publicTrackingUrl,
  resetPublicSubmission, uploadPublicFile } from '@/services/radicacionPublicaService';

const TOKEN = 'a'.repeat(64);
const request = vi.fn<typeof fetch>();
beforeEach(() => {
  sessionStorage.clear(); localStorage.clear(); resetPublicSubmission();
  vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('fetch', request); request.mockReset();
  request.mockImplementation(async url => {
    const path = String(url);
    if (path.endsWith('/reto')) return Response.json({ id: '11111111-1111-4111-8111-111111111111', challenge: 'b'.repeat(48), prefix: '000' });
    if (path.endsWith('/sesion')) return Response.json({ token: TOKEN, expiresIn: 3600 }, { status: 201 });
    return Response.json({ s3Key: 'expedientes/2026/11111111-1111-4111-8111-111111111111.pdf', sha256: 'c'.repeat(64), tamanoBytes: 10 }, { status: 201 });
  });
});
afterEach(() => { resetPublicSubmission(); vi.unstubAllGlobals(); });

describe('cliente público independiente de JWT y cookies', () => {
  it('resuelve el reto y coalesce sesiones concurrentes sin autenticación', async () => {
    localStorage.setItem('sigd_token', 'JWT-NO-DEBE-ENVIARSE');
    const [one, two] = await Promise.all([publicSession(), publicSession()]);
    expect(one).toBe(TOKEN); expect(two).toBe(TOKEN);
    expect(request).toHaveBeenCalledTimes(2);
    for (const [, options] of request.mock.calls) {
      expect(options?.credentials).toBe('omit');
      expect(options?.headers).not.toHaveProperty('Authorization');
    }
  });
  it('sube un PDF con capacidad del formulario y conserva la consulta del cargo solo para ese CUT', async () => {
    const file = new File(['%PDF-demo'], 'demo.pdf', { type: 'application/pdf' });
    await uploadPublicFile(file, new AbortController().signal, '11111111-1111-4111-8111-111111111111');
    const call = request.mock.calls.find(([url]) => String(url).endsWith('/carga'))!;
    expect(call[1]?.body).toBe(file);
    expect(call[1]?.headers).toMatchObject({ 'Content-Type': 'application/pdf', 'X-SIGD-Public-Session': TOKEN });
    const cut = 'EXP-2026-000001'; const url = publicTrackingUrl(cut);
    expect(new URL(url).hash).toBe(`#constancia=${TOKEN}`); expect(new URL(url).search).toBe('');
    completePublicSubmission(cut);
    expect(sessionStorage.getItem('SIGD_PUBLIC_FORM_SESSION')).toBeNull();
    expect(publicTrackingHeaders(cut)).toEqual({ 'X-SIGD-Public-Session': TOKEN });
    expect(publicTrackingHeaders('EXP-2026-000002')).toEqual({});
  });
  it('mantiene el rechazo institucional y no transforma un pago pendiente en éxito', async () => {
    request.mockResolvedValueOnce(Response.json({ detail: 'Pago no verificado', code: 'PUBLIC_PAYMENT_UNAVAILABLE' }, { status: 422 }));
    await expect(publicRequest('/radicar', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 422, message: 'Pago no verificado' });
  });
});
