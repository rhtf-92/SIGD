import { AppError } from '../../shared/domain/errors/index.js';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface CorreoEnviadoRegistro {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
  enviadoEn: Date;
}

export class EmailService {
  private correosEnviados: CorreoEnviadoRegistro[] = [];
  private llavesIdempotencia: Set<string> = new Set();
  private simularFalloActivo = false;
  private simularFalloError: Error | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly from: string
  ) {}

  simularFallo(activo: boolean, error?: Error): void {
    this.simularFalloActivo = activo;
    this.simularFalloError = error ?? new AppError({
      code: 'RESEND_NETWORK_ERROR',
      status: 503,
      message: 'Fallo simulado de transporte de correo electrónico.',
    });
  }

  obtenerCorreosEnviados(): CorreoEnviadoRegistro[] {
    return [...this.correosEnviados];
  }

  obtenerUltimoCorreo(): CorreoEnviadoRegistro | undefined {
    return this.correosEnviados[this.correosEnviados.length - 1];
  }

  limpiarHistorial(): void {
    this.correosEnviados = [];
    this.llavesIdempotencia.clear();
    this.simularFalloActivo = false;
    this.simularFalloError = null;
  }

  async enviar(options: EmailOptions, idempotencyKey: string): Promise<void> {
    if (this.simularFalloActivo) {
      throw this.simularFalloError ?? new Error('Fallo simulado de transporte de correo electrónico.');
    }

    // Prevención de duplicados / idempotencia estricta por llave
    if (this.llavesIdempotencia.has(idempotencyKey)) {
      console.log(`[EMAIL] Correo ya procesado para idempotencyKey ${idempotencyKey}, omitiendo envío duplicado.`);
      return;
    }

    if (process.env.RESEND_ENABLED !== 'true') {
      console.log(`[EMAIL] Modo simulado (RESEND_ENABLED != true). Para: ${options.to} | Asunto: ${options.subject}`);
      this.llavesIdempotencia.add(idempotencyKey);
      this.correosEnviados.push({
        to: options.to,
        subject: options.subject,
        html: options.html,
        idempotencyKey,
        enviadoEn: new Date(),
      });
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new AppError({ code: 'RESEND_ERROR', status: response.status, message: `Error Resend: ${JSON.stringify(error)}` });
    }

    this.llavesIdempotencia.add(idempotencyKey);
    this.correosEnviados.push({
      to: options.to,
      subject: options.subject,
      html: options.html,
      idempotencyKey,
      enviadoEn: new Date(),
    });
  }
}
