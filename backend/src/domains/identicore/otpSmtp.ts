import nodemailer from 'nodemailer';
import type { EntregaOtp } from './identidadOtp.service.js';

/** Explicit opt-in, no provider credentials or default secrets. No startup I/O. */
export function crearEntregaOtpSmtp(env: NodeJS.ProcessEnv = process.env): EntregaOtp | undefined {
  const host = env.IDENTICORE_OTP_SMTP_HOST;
  const port = Number(env.IDENTICORE_OTP_SMTP_PORT);
  const user = env.IDENTICORE_OTP_SMTP_USER;
  const pass = env.IDENTICORE_OTP_SMTP_PASSWORD;
  const from = env.IDENTICORE_OTP_SMTP_FROM;
  if (env.IDENTICORE_OTP_ENABLED !== 'true' || !host || !/^[a-zA-Z0-9.-]+$/.test(host) ||
      ![465, 587].includes(port) || !user || !pass || !from || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from)) return undefined;
  const transporte = nodemailer.createTransport({ host, port, secure: port === 465, requireTLS: true,
    auth: { user, pass }, tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000, dnsTimeout: 5000,
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false,
  });
  return {
    async enviar(destinatario, codigo) {
      if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(destinatario) || !/^\d{6}$/.test(codigo)) throw new Error('OTP_DELIVERY_INVALID');
      try {
        const result = await transporte.sendMail({ from, to: destinatario,
          subject: 'SIGD Suiza - Verificación del contacto registrado',
          text: `Su código de verificación del contacto es: ${codigo}. Caduca en 10 minutos. No lo comparta. Esta comprobación acredita control del correo registrado; no es una validación oficial de identidad. Si no solicitó el código, ignore este mensaje.`,
          disableFileAccess: true, disableUrlAccess: true });
        if (!result.accepted?.some(address => address.toLowerCase() === destinatario.toLowerCase())) throw new Error('NOT_ACCEPTED');
      } catch { throw new Error('OTP_DELIVERY_UNAVAILABLE'); }
    },
  };
}
