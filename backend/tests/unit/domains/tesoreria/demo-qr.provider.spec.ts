import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { DemoQrProvider } from '../../../../src/domains/tesoreria/providers/demo-qr.provider.js';

describe('DEMO_QR provider', () => {
  beforeEach(() => {
    vi.stubEnv('DEMO_QR_ENABLED', 'true');
    vi.stubEnv('DEMO_QR_SECRET', 'test-only-secret-at-least-thirty-two-characters');
    vi.stubEnv('DEMO_QR_PUBLIC_URL', 'https://demo.example.test');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('genera URL móvil y QR PNG distintos por carga, sin guardar token en claro', async () => {
    const provider = new DemoQrProvider();
    const first = await provider.createPayment();
    const second = await provider.createPayment();
    expect(first.checkoutUrl).toMatch(/^https:\/\/demo\.example\.test\/demo-pay\/[A-Za-z0-9_-]{40,80}$/);
    expect(first.qrImage).toMatch(/^data:image\/png;base64,/);
    expect(first.checkoutUrl).not.toBe(second.checkoutUrl);
    expect(first.paymentId).not.toBe(second.paymentId);
    expect(first.paymentId.length).toBeLessThanOrEqual(20);
    expect(first.checkoutTokenHash).not.toBe(first.checkoutUrl.split('/').at(-1));
    expect(first.checkoutTokenHash).toHaveLength(64);
  });

  it('rechaza configuración incompleta y URL no pública insegura', async () => {
    vi.stubEnv('DEMO_QR_PUBLIC_URL', 'http://demo.example.test');
    expect(new DemoQrProvider().isConfigured()).toBe(false);
    vi.stubEnv('DEMO_QR_PUBLIC_URL', 'https://demo.example.test');
    vi.stubEnv('DEMO_QR_SECRET', 'short');
    await expect(new DemoQrProvider().createPayment()).rejects.toThrow('DEMO_QR_NOT_CONFIGURED');
  });

  it('resuelve token por hash y rechaza token inválido o expirado', async () => {
    const provider = new DemoQrProvider();
    const created = await provider.createPayment();
    const token = created.checkoutUrl.split('/').at(-1)!;
    const query = vi.fn().mockResolvedValue({ rows: [{
      orden_pago_id: 'order-1', provider_payment_id: created.paymentId,
      codigo_pago: 'PAG-2026-000001', concepto: 'Trámite de prueba', monto: '100.00',
      moneda: 'PEN', estado: 'PENDIENTE', codigo_recibo: null,
      provider_expires_at: new Date(Date.now() + 60_000),
      fecha_vencimiento: new Date(Date.now() + 120_000),
    }] });
    const pool = { query } as unknown as Pool;
    expect(await provider.getPayment(pool, 'invalid')).toBeNull();
    expect(query).not.toHaveBeenCalled();
    const payment = await provider.getPayment(pool, token);
    expect(query).toHaveBeenCalledWith(expect.any(String), [created.checkoutTokenHash]);
    expect(payment?.amount).toBe(100);
    expect(provider.isExpired(payment!)).toBe(false);
    expect(provider.isExpired({ ...payment!, expiresAt: new Date(0) })).toBe(true);
  });

  it('firma el cuerpo exacto con HMAC y rechaza alteración', async () => {
    const provider = new DemoQrProvider();
    const payment = { ordenPagoId: 'order-1', paymentId: 'demo-1', reference: 'PAG-2026-000001',
      concept: 'Trámite', amount: 100, currency: 'PEN', status: 'PENDIENTE',
      receipt: null, expiresAt: new Date(Date.now() + 60_000) };
    const { rawBody, signature } = provider.createSignedWebhook(payment);
    expect(provider.verifyWebhook(rawBody, signature)).toBe(true);
    expect(provider.verifyWebhook(Buffer.from(rawBody.toString().replace('100', '1')), signature)).toBe(false);
    expect(provider.verifyWebhook(rawBody, '00')).toBe(false);
    expect(provider.verifyWebhook(rawBody, undefined)).toBe(false);
  });
});
