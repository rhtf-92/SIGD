import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { TaypiProvider } from '../../../../src/domains/tesoreria/providers/taypi.provider.js';

describe('TaypiProvider — Integración Pasarela Sandbox', () => {
  const secretKey = 'taypi_sk_test_fake_secret_key_123456';
  const publicKey = 'taypi_pk_test_fake_public_key_abcdef';
  const webhookSecret = 'taypi_whsec_test_fake_webhook_secret';

  let provider: TaypiProvider;

  beforeEach(() => {
    provider = new TaypiProvider({
      secretKey,
      publicKey,
      webhookSecret,
      baseUrl: 'https://sandbox.taypi.pe',
      isSandbox: true,
      webhookEnabled: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. isConfigured exige ambas API keys y el secreto del webhook', () => {
    expect(provider.isConfigured()).toBe(true);

    const unconfigured = new TaypiProvider({ secretKey: undefined });
    expect(unconfigured.isConfigured()).toBe(false);
    expect(new TaypiProvider({ publicKey, secretKey, webhookSecret: '' }).isConfigured()).toBe(false);
    expect(new TaypiProvider({ publicKey: '', secretKey, webhookSecret }).isConfigured()).toBe(false);
  });

  it('2. getPublicConfig devuelve configuración pública sin exponer la secretKey', () => {
    const config = provider.getPublicConfig();
    expect(config.configured).toBe(true);
    expect(config.sandbox).toBe(true);
    expect(config.publicKey).toBe(publicKey);
    expect(config.simulatorUrl).toBe('https://sandbox.taypi.pe/simulator');
    expect((config as any).secretKey).toBeUndefined();
    expect((config as any).webhookSecret).toBeUndefined();
  });

  it('3. createPayment genera pago en sandbox con Idempotency-Key y cabeceras correctas', async () => {
    const mockApiResponse = {
      data: {
        payment_id: 'pay-uuid-9999',
        status: 'pending',
        qr_image: 'data:image/svg+xml;base64,PHN2Zz...',
        checkout_token: 'chk_token_123',
        checkout_url: 'https://sandbox.taypi.pe/checkout/chk_token_123',
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    const res = await provider.createPayment({
      ordenPagoId: 'ord-123',
      codigoPago: 'PAG-2026-000001',
      monto: 100.0,
      concepto: 'Certificado de Inglés',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://sandbox.taypi.pe/api/v1/payments');
    expect(options?.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publicKey}`,
      'Idempotency-Key': 'taypi:create:ord-123',
    });
    const headers = options?.headers as Record<string, string>;
    const expectedSignature = crypto.createHmac('sha256', secretKey)
      .update([headers['Taypi-Timestamp'], 'POST', '/api/v1/payments', options?.body].join('\n'))
      .digest('hex');
    expect(headers['Taypi-Signature']).toBe(expectedSignature);
    expect(headers.Authorization).not.toContain(secretKey);

    expect(res.paymentId).toBe('pay-uuid-9999');
    expect(res.qrImage).toBe('data:image/svg+xml;base64,PHN2Zz...');
    expect(res.checkoutToken).toBe('chk_token_123');
    expect(res.checkoutUrl).toBe('https://sandbox.taypi.pe/checkout/chk_token_123');
    expect(res.reference).toBe('PAG-2026-000001');
    expect(res.amount).toBe(100.0);
  });

  it('rechaza una respuesta sin payment_id en lugar de asociar un ID local ficticio', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { status: 'pending' } }),
    } as Response);
    await expect(provider.createPayment({
      ordenPagoId: 'ord-123', codigoPago: 'PAG-2026-000001', monto: 100, concepto: 'Certificado',
    })).rejects.toThrow(/payment_id/);
  });

  it('4. createPayment lanza error estructurado si el sandbox responde con status != 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Monto inválido para moneda PEN' }),
    } as Response);

    await expect(
      provider.createPayment({
        ordenPagoId: 'ord-123',
        codigoPago: 'PAG-2026-000001',
        monto: 0,
        concepto: 'Trámite',
      }),
    ).rejects.toThrow(/TAYPI_API_ERROR.*Monto inválido/);
  });

  it('5. verifyWebhookSignature valida correctamente firmas HMAC-SHA256 válidas y rechaza firmas alteradas', () => {
    const rawPayload = JSON.stringify({
      event: 'payment.completed',
      payment_id: 'pay-uuid-9999',
      amount: 100.0,
      currency: 'PEN',
      status: 'completed',
      reference: 'PAG-2026-000001',
    });

    const validHmac = crypto
      .createHmac('sha256', webhookSecret)
      .update(Buffer.from(rawPayload, 'utf-8'))
      .digest('hex');

    // Firma válida directa
    expect(provider.verifyWebhookSignature(rawPayload, validHmac)).toBe(true);
    expect(provider.verifyWebhookSignature(rawPayload, `sha256=${validHmac}`)).toBe(true);
    const signedWithApiSecret = crypto.createHmac('sha256', secretKey).update(rawPayload).digest('hex');
    expect(provider.verifyWebhookSignature(rawPayload, `sha256=${signedWithApiSecret}`)).toBe(false);

    // Firma válida con prefijo v1=
    expect(provider.verifyWebhookSignature(rawPayload, `v1=${validHmac}`)).toBe(true);

    // Firma con payload alterado
    const tamperedPayload = rawPayload.replace('pay-uuid-9999', 'pay-uuid-tampered');
    expect(provider.verifyWebhookSignature(tamperedPayload, validHmac)).toBe(false);

    // Firma vacía o inexistente
    expect(provider.verifyWebhookSignature(rawPayload, undefined)).toBe(false);
    expect(provider.verifyWebhookSignature(rawPayload, 'invalid_hex_string')).toBe(false);
  });

  it('6. parseWebhookEvent extrae y normaliza los campos esenciales del evento', () => {
    const rawEvent = {
      event: 'payment.completed',
      data: {
        payment_id: 'pay-12345',
        amount: '100.00',
        currency: 'pen',
        status: 'completed',
        reference: 'PAG-2026-000001',
        paid_at: '2026-10-29T11:00:00Z',
      },
    };

    const parsed = provider.parseWebhookEvent(rawEvent);
    expect(parsed).not.toBeNull();
    expect(parsed?.event).toBe('payment.completed');
    expect(parsed?.paymentId).toBe('pay-12345');
    expect(parsed?.amount).toBe(100);
    expect(parsed?.currency).toBe('PEN');
    expect(parsed?.status).toBe('completed');
    expect(parsed?.reference).toBe('PAG-2026-000001');
    expect(parsed?.paidAt?.toISOString()).toBe('2026-10-29T11:00:00.000Z');
  });
});
