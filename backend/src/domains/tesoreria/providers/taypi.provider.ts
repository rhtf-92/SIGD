import crypto from 'node:crypto';

export interface TaypiConfig {
  baseUrl: string;
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  isSandbox: boolean;
  webhookEnabled: boolean;
}

export interface TaypiPaymentResult {
  paymentId: string;
  status: string;
  qrImage?: string | null;
  checkoutToken?: string | null;
  checkoutUrl?: string | null;
  expiresAt: Date;
  reference: string;
  amount: number;
}

export interface TaypiWebhookEvent {
  event: string;
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  reference: string;
  paidAt?: Date | null;
}

export class TaypiProvider {
  private config: TaypiConfig;

  constructor(customConfig?: Partial<TaypiConfig>) {
    this.config = {
      baseUrl: (
        customConfig?.baseUrl ??
        process.env.TAYPI_BASE_URL ??
        'https://sandbox.taypi.pe'
      ).replace(/\/$/, ''),
      publicKey: customConfig?.publicKey ?? process.env.TAYPI_PUBLIC_KEY,
      secretKey: customConfig?.secretKey ?? process.env.TAYPI_SECRET_KEY,
      webhookSecret: customConfig?.webhookSecret ?? process.env.TAYPI_WEBHOOK_SECRET,
      isSandbox: customConfig?.isSandbox ?? (process.env.TAYPI_SANDBOX !== 'false'),
      webhookEnabled: customConfig?.webhookEnabled ?? (process.env.TAYPI_WEBHOOK_ENABLED !== 'false'),
    };
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.isSandbox &&
      this.config.webhookEnabled &&
      this.config.publicKey?.trim() &&
      this.config.secretKey?.trim() &&
      this.config.webhookSecret?.trim()
    );
  }

  getPublicConfig() {
    return {
      configured: this.isConfigured(),
      sandbox: this.config.isSandbox,
      publicKey: this.config.publicKey ?? null,
      baseUrl: this.config.baseUrl,
      simulatorUrl: 'https://sandbox.taypi.pe/simulator',
    };
  }

  async createPayment(params: {
    ordenPagoId: string;
    codigoPago: string;
    monto: number;
    concepto: string;
  }): Promise<TaypiPaymentResult> {
    if (!this.isConfigured()) {
      throw new Error('TAYPI_NOT_CONFIGURED: La pasarela TAYPI no está configurada en este entorno.');
    }

    const idempotencyKey = `taypi:create:${params.ordenPagoId}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const endpoint = `${this.config.baseUrl}/api/v1/payments`;

    const bodyPayload = {
      amount: params.monto.toFixed(2),
      currency: 'PEN',
      reference: params.codigoPago,
      description: params.concepto.slice(0, 255),
      metadata: {
        orden_pago_id: params.ordenPagoId,
        sistema: 'SIGD',
      },
    };

    const serializedBody = JSON.stringify(bodyPayload);

    const signaturePayload = [timestamp, 'POST', '/api/v1/payments', serializedBody].join('\n');
    const outgoingSignature = crypto
      .createHmac('sha256', this.config.secretKey!)
      .update(signaturePayload)
      .digest('hex');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.publicKey}`,
      'Idempotency-Key': idempotencyKey,
      'Taypi-Timestamp': timestamp,
      'Taypi-Signature': outgoingSignature,
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: serializedBody,
      });
    } catch (networkError) {
      throw new Error(`TAYPI_NETWORK_ERROR: No se pudo conectar con el sandbox de TAYPI: ${(networkError as Error).message}`);
    }

    if (!response.ok) {
      let detalleError = 'Error desconocido en TAYPI';
      try {
        const errorJson = await response.json() as Record<string, unknown>;
        detalleError = String(errorJson.message ?? errorJson.error ?? JSON.stringify(errorJson));
      } catch {
        detalleError = await response.text();
      }
      throw new Error(`TAYPI_API_ERROR: [HTTP ${response.status}] ${detalleError}`);
    }

    const json = (await response.json()) as Record<string, any>;
    const data = (json.data ?? json) as Record<string, any>;

    if (!data.payment_id && !data.id) {
      throw new Error('TAYPI_API_ERROR: La respuesta no incluye payment_id.');
    }
    const paymentId = String(data.payment_id ?? data.id);
    const status = String(data.status ?? 'pending');
    const qrImage = data.qr_image ? String(data.qr_image) : null;
    const checkoutToken = data.checkout_token ? String(data.checkout_token) : null;
    const checkoutUrl = data.checkout_url ? String(data.checkout_url) : null;

    // Expiración: si no viene en la respuesta, se asumen 15 minutos estándar
    const expiresAt = data.expires_at
      ? new Date(data.expires_at)
      : new Date(Date.now() + 15 * 60 * 1000);

    return {
      paymentId,
      status,
      qrImage,
      checkoutToken,
      checkoutUrl,
      expiresAt,
      reference: params.codigoPago,
      amount: params.monto,
    };
  }

  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
    if (!this.config.webhookSecret || !signatureHeader) {
      return false;
    }

    const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf-8');
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(rawBuffer)
      .digest('hex');

    // Manejar firmas en formato directo hex o con prefijo "v1=" / "sha256="
    const cleanHeader = signatureHeader.includes('=')
      ? (signatureHeader.split(',').find((part) => part.trim().startsWith('v1='))?.split('=')[1] ??
         signatureHeader.split('=')[1] ??
         signatureHeader).trim()
      : signatureHeader.trim();

    try {
      const headerBuf = Buffer.from(cleanHeader, 'hex');
      const expectedBuf = Buffer.from(expectedSignature, 'hex');

      if (headerBuf.length !== expectedBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(headerBuf, expectedBuf);
    } catch {
      return false;
    }
  }

  parseWebhookEvent(body: Record<string, any>): TaypiWebhookEvent | null {
    if (!body || typeof body !== 'object') {
      return null;
    }

    const payload = (body.data ?? body) as Record<string, any>;
    const event = String(body.event ?? payload.event ?? '');
    const paymentId = String(payload.payment_id ?? payload.id ?? '');
    const rawAmount = payload.amount !== undefined ? Number(payload.amount) : NaN;
    const currency = String(payload.currency ?? '').toUpperCase();
    const status = String(payload.status ?? '').toLowerCase();
    const reference = String(payload.reference ?? '');
    const paidAt = payload.paid_at ? new Date(payload.paid_at) : null;

    if (!event || !paymentId || Number.isNaN(rawAmount)) {
      return null;
    }

    return {
      event,
      paymentId,
      amount: rawAmount,
      currency,
      status,
      reference,
      paidAt,
    };
  }
}
