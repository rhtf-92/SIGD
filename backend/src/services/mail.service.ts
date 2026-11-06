import nodemailer, { type Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

export function obtenerTransporter(): Transporter {
  if (!transporter) {
    const host = process.env.MAIL_HOST;
    const port = Number(process.env.MAIL_PORT ?? 587);
    const secure = process.env.MAIL_SECURE === 'true';
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;

    if (!host || !user || !pass) {
      throw new Error(
        '[MAIL] SMTP no configurado: definí MAIL_HOST, MAIL_PORT, MAIL_USER y MAIL_PASS en .env',
      );
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(user ? { auth: { user, pass } } : {}),
    });
  }
  return transporter;
}

export interface OpcionesCorreo {
  a: string;
  asunto: string;
  texto?: string;
  html?: string;
}

export async function enviarCorreo(opciones: OpcionesCorreo): Promise<void> {
  const transport = obtenerTransporter();
  const info = await transport.sendMail({
    from: process.env.MAIL_FROM ?? '"SIGD" <noreply@iestp-suiza.edu.pe>',
    to: opciones.a,
    subject: opciones.asunto,
    text: opciones.texto,
    html: opciones.html,
  });
  console.log('[MAIL] Correo enviado:', info.messageId, 'para', opciones.a);
}

export async function verificarConexionCorreo(): Promise<boolean> {
  try {
    const transport = obtenerTransporter();
    await transport.verify();
    return true;
  } catch (error) {
    console.error('[MAIL] Error de conexión SMTP:', error);
    return false;
  }
}
