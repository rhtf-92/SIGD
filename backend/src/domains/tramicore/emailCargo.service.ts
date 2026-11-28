import nodemailer from 'nodemailer';

export interface DatosCargoEmail {
  destinatario: string;
  solicitanteNombre: string;
  solicitanteDocumento: string;
  tipoDocumento?: string;
  cut: string;
  asunto: string;
  procedimientoTupa?: string;
  fechaPresentacion: string;
  canalIngreso: string;
  enlaceSeguimiento?: string;
  hashSha256?: string;
}

export interface ResultadoEnvioEmail {
  enviado: boolean;
  destinatario: string;
  mensajeId?: string;
  error?: string;
}

function obtenerTransporteSmtp(): any {
  const host = process.env.SMTP_HOST || process.env.EMAIL_SMTP_HOST || process.env.IDENTICORE_OTP_SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SMTP_PORT || process.env.IDENTICORE_OTP_SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.EMAIL_SMTP_USER || process.env.IDENTICORE_OTP_SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.EMAIL_SMTP_PASSWORD || process.env.IDENTICORE_OTP_SMTP_PASSWORD;
  const secure = port === 465 || process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
}

export function generarPlantillaHtmlCargo(datos: DatosCargoEmail): string {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const urlConsulta = datos.enlaceSeguimiento || `${frontendUrl}/tramites/consulta-publica/${encodeURIComponent(datos.cut)}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cargo de Recepción Digital - IESTP Suiza</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a; margin: 0; padding: 20px; }
    .container { max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: #ffffff; padding: 32px 28px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #93c5fd; }
    .badge { display: inline-block; background-color: #10b981; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; margin-top: 14px; letter-spacing: 0.05em; }
    .content { padding: 28px; }
    .cut-box { background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px; }
    .cut-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
    .cut-value { font-size: 22px; font-weight: 800; color: #0284c7; font-family: monospace; margin-top: 4px; }
    .table-info { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
    .table-info th { text-align: left; padding: 10px 12px; background-color: #f8fafc; color: #475569; width: 35%; border-bottom: 1px solid #e2e8f0; font-weight: 600; }
    .table-info td { padding: 10px 12px; color: #1e293b; border-bottom: 1px solid #e2e8f0; font-weight: 500; }
    .button-box { text-align: center; margin: 30px 0 10px; }
    .btn { display: inline-block; background-color: #0f766e; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 10px; text-decoration: none; box-shadow: 0 2px 6px rgba(15,118,110,0.3); }
    .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; font-size: 11px; color: #64748b; line-height: 1.5; text-align: center; }
    .legal-notice { font-size: 10px; color: #94a3b8; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>IESTP "SUIZA" — PUCALLPA</h1>
      <p>Sistema Integral de Gestión Documentaria (SIGD) · Mesa de Partes</p>
      <div class="badge">Cargo Oficial de Radicación</div>
    </div>
    <div class="content">
      <p>Estimado(a) <strong>${datos.solicitanteNombre}</strong>,</p>
      <p>Le confirmamos que su trámite ha sido radicado exitosamente en el sistema de Mesa de Partes del IESTP "Suiza" conforme al TUO de la Ley N° 27444 (LPAG).</p>
      
      <div class="cut-box">
        <div class="cut-label">Código Único de Trámite (CUT)</div>
        <div class="cut-value">${datos.cut}</div>
      </div>

      <table class="table-info">
        <tr>
          <th>Administrado / Titular</th>
          <td>${datos.solicitanteNombre}</td>
        </tr>
        <tr>
          <th>Documento Identidad</th>
          <td>${datos.tipoDocumento || 'DNI'}: ${datos.solicitanteDocumento}</td>
        </tr>
        <tr>
          <th>Procedimiento TUPA</th>
          <td>${datos.procedimientoTupa || 'Trámite Documentario General'}</td>
        </tr>
        <tr>
          <th>Asunto Declarado</th>
          <td>${datos.asunto}</td>
        </tr>
        <tr>
          <th>Canal de Recepción</th>
          <td>${datos.canalIngreso === 'VENTANILLA_PRESENCIAL' ? 'Ventanilla Presencial de Mesa de Partes' : 'Mesa de Partes Virtual (Atención Digital 24x7)'}</td>
        </tr>
        <tr>
          <th>Fecha y Hora Legal</th>
          <td>${new Date(datos.fechaPresentacion).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</td>
        </tr>
        ${datos.hashSha256 ? `
        <tr>
          <th>Integridad SHA-256</th>
          <td style="font-family: monospace; font-size: 11px; word-break: break-all;">${datos.hashSha256}</td>
        </tr>` : ''}
      </table>

      <div class="button-box">
        <a href="${urlConsulta}" class="btn" target="_blank" rel="noopener noreferrer">Consultar Estado de Trámite</a>
      </div>
    </div>
    <div class="footer">
      <p><strong>Instituto de Educación Superior Tecnológico Público "Suiza"</strong><br>Av. Túpac Amaru Km. 4.500 — Coronel Portillo, Ucayali, Perú</p>
      <p class="legal-notice">Este es un mensaje institucional automatizado generado por el SIGD con validez legal probatoria conforme al Art. 117 de la Ley N° 27444. Si usted no realizó esta solicitud, comuníquese de inmediato con mesadepartes@iestpsuiza.edu.pe.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function enviarCargoPorEmail(datos: DatosCargoEmail): Promise<ResultadoEnvioEmail> {
  const correoDestino = datos.destinatario?.trim().toLowerCase();
  if (!correoDestino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoDestino)) {
    return {
      enviado: false,
      destinatario: datos.destinatario,
      error: 'Dirección de correo electrónico inválida o no proporcionada.',
    };
  }

  const transporte = obtenerTransporteSmtp();
  if (!transporte) {
    console.warn(
      `[EMAIL_CARGO] SMTP no configurado en variables de entorno. Cargo generado para CUT ${datos.cut} hacia ${correoDestino} (simulación de envío conforme).`,
    );
    return {
      enviado: false,
      destinatario: correoDestino,
      error: 'SMTP no configurado en .env (configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).',
    };
  }

  try {
    const fromAddress = process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER || 'mesadepartes@iestpsuiza.edu.pe';
    const info = await transporte.sendMail({
      from: `"Mesa de Partes — IESTP Suiza" <${fromAddress}>`,
      to: correoDestino,
      subject: `[SIGD Suiza] Cargo Digital de Recepción — CUT: ${datos.cut}`,
      text: `IESTP SUIZA - CARGO DIGITAL DE RECEPCIÓN\n\nEstimado(a) ${datos.solicitanteNombre},\nSu trámite ha sido radicado exitosamente con el CUT: ${datos.cut}.\nAsunto: ${datos.asunto}\nFecha Legal: ${datos.fechaPresentacion}\nPuede consultar el avance de su expediente en: ${datos.enlaceSeguimiento || 'https://sigd.iestpsuiza.edu.pe'}`,
      html: generarPlantillaHtmlCargo(datos),
    });

    console.log(`[EMAIL_CARGO] Correo de cargo enviado con éxito a ${correoDestino} para el CUT ${datos.cut} (MessageId: ${info.messageId})`);
    return {
      enviado: true,
      destinatario: correoDestino,
      mensajeId: info.messageId,
    };
  } catch (err: unknown) {
    console.warn(`[EMAIL_CARGO] Advertencia: No se pudo despachar el correo SMTP a ${correoDestino}:`, (err as Error).message);
    return {
      enviado: false,
      destinatario: correoDestino,
      error: (err as Error).message,
    };
  }
}
