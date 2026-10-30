import crypto from 'node:crypto';
import type { Pool } from 'pg';
import QRCode from 'qrcode';

export interface DemoQrPayment {
  paymentId: string;
  checkoutTokenHash: string;
  checkoutUrl: string;
  qrImage: string;
  expiresAt: Date;
}

export interface DemoQrCheckout {
  ordenPagoId: string;
  paymentId: string;
  reference: string;
  concept: string;
  amount: number;
  currency: string;
  status: string;
  receipt: string | null;
  expiresAt: Date;
}

export class DemoQrProvider {
  private readonly secret = process.env.DEMO_QR_SECRET?.trim() ?? '';
  private readonly enabled = process.env.DEMO_QR_ENABLED === 'true';
  private readonly publicUrl = process.env.DEMO_QR_PUBLIC_URL?.trim().replace(/\/$/, '') ?? '';

  isConfigured(): boolean {
    if (!this.enabled || this.secret.length < 32) return false;
    try {
      const url = new URL(this.publicUrl);
      const protocolAllowed = url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
      return protocolAllowed && url.origin === this.publicUrl && !url.username && !url.password;
    } catch {
      return false;
    }
  }

  getPublicConfig() {
    return { configured: this.isConfigured(), sandbox: true, publicUrl: this.publicUrl || null };
  }

  async createPayment(): Promise<DemoQrPayment> {
    if (!this.isConfigured()) throw new Error('DEMO_QR_NOT_CONFIGURED');
    const token = crypto.randomBytes(32).toString('base64url');
    const checkoutUrl = `${this.publicUrl}/demo-pay/${token}`;
    return {
      // referencia_operacion en orden_pago es VARCHAR(20); el ID no es un secreto.
      paymentId: `dqr_${crypto.randomBytes(10).toString('base64url')}`,
      checkoutTokenHash: DemoQrProvider.hashToken(token),
      checkoutUrl,
      qrImage: await QRCode.toDataURL(checkoutUrl, { errorCorrectionLevel: 'M', margin: 4, width: 360 }),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    };
  }

  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async getPayment(pool: Pool, token: string): Promise<DemoQrCheckout | null> {
    if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) return null;
    const result = await pool.query<{
      orden_pago_id: string; provider_payment_id: string; codigo_pago: string;
      concepto: string; monto: string; moneda: string; estado: string;
      codigo_recibo: string | null; provider_expires_at: Date; fecha_vencimiento: Date;
    }>(`
      SELECT orden_pago_id, provider_payment_id, codigo_pago, concepto, monto::text,
             moneda, estado, codigo_recibo, provider_expires_at, fecha_vencimiento
        FROM sigd_tra.orden_pago
       WHERE payment_provider = 'DEMO_QR'
         AND provider_checkout_token = $1
       LIMIT 1`, [DemoQrProvider.hashToken(token)]);
    const row = result.rows[0];
    if (!row) return null;
    return {
      ordenPagoId: row.orden_pago_id,
      paymentId: row.provider_payment_id,
      reference: row.codigo_pago,
      concept: row.concepto,
      amount: Number(row.monto),
      currency: row.moneda,
      status: row.estado,
      receipt: row.codigo_recibo,
      expiresAt: new Date(Math.min(row.provider_expires_at.getTime(), row.fecha_vencimiento.getTime())),
    };
  }

  isExpired(payment: DemoQrCheckout): boolean {
    return Date.now() >= payment.expiresAt.getTime();
  }

  createSignedWebhook(payment: DemoQrCheckout): { rawBody: Buffer; signature: string } {
    if (!this.isConfigured()) throw new Error('DEMO_QR_NOT_CONFIGURED');
    const rawBody = Buffer.from(JSON.stringify({
      event_id: crypto.randomUUID(),
      event: 'payment.completed',
      payment_id: payment.paymentId,
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      status: 'completed',
      paid_at: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    }));
    return { rawBody, signature: crypto.createHmac('sha256', this.secret).update(rawBody).digest('hex') };
  }

  verifyWebhook(rawBody: Buffer, signature: string | undefined): boolean {
    if (!this.isConfigured() || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
    const expected = crypto.createHmac('sha256', this.secret).update(rawBody).digest();
    const supplied = Buffer.from(signature, 'hex');
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  }
}
