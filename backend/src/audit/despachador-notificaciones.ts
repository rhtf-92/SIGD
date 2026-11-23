import type { Pool } from 'pg';
import type { BusSse } from '../modules/corelink/sseStream.service.js';
import type { BridgeNotificacion } from '../core/realtime/bridge-notificacion.js';
import type { EventoPendiente } from './outbox-worker.js';
import { EmailService } from '../domains/identicore/email.service.js';
import { descifrarTokenPayload, sanitizarObjetoParaLog } from '../core/security/cifrado-payload.js';
import { descifrarSecreto } from '../shared/crypto/cifradoOutbox.js';
import { WhatsAppNotificacionesService, type TipoCierreWhatsApp } from './whatsapp-notificaciones.service.js';

export interface DestinoNotificacion {
  readonly nombre: string;
  despachar(evento: EventoPendiente): Promise<void>;
}

export const EVENTOS_SENSIBLES_BLOQUEADOS_SSE = new Set([
  'verificacion_correo_solicitada',
]);

export const EVENTOS_INTERNOS_PROHIBIDOS = new Set([
  'ExpedienteEvaluadorAsignado',
  'ExpedienteEvaluadorReasignado',
  'EvaluacionIniciadaDocente',
  'EvaluacionReanudadaDocente',
  'anotacion_interna_registrada',
  'pase_area_interno',
  'DictamenDocenteEmitido',
]);

export const EVENTOS_EMAIL = new Set([
  'radicacion_exitosa',
  'orden_pago_generada',
  'pago_confirmado',
  'expediente_habilitado_recepcion',
  'ExpedienteRecepcionado',
  'calificacion_iniciada',
  'conformidad_documental',
  'tesoreria_notificacion',
  'ExpedienteDerivado',
  'recepcion_destino',
  'expediente_observado',
  'ExpedienteObservadoDocente',
  'TramiteSubsanado',
  'TramiteSubsanadoEstudiante',
  'evaluacion_iniciada',
  'evaluacion_concluida',
  'vinculacion_cuenta_aprobada',
  'vinculacion_cuenta_rechazada',
  'resolucion_emitida',
  'expediente_resuelto',
  'certificado_emitido',
  'cuenta_activada',
  'verificacion_correo_solicitada',
  'casilla_notificacion',
  'expediente_archivado_falta_pago',
  'expediente_archivado',
  'expediente_cerrado',
  'ExpedienteRechazado',
]);

export interface PlantillaCorreo {
  subject: string;
  html: string;
}

export function obtenerFrontendUrl(): string {
  const url = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5178';
  return url.replace(/\/+$/, '');
}

export function envolverPlantillaInstitucional(
  titulo: string,
  contenidoHtml: string,
  enlaceAccion?: { texto: string; url: string },
): string {
  const urlPortal = enlaceAccion?.url ?? `${obtenerFrontendUrl()}/tramites/mis-expedientes`;
  const textoBoton = enlaceAccion?.texto ?? 'Ver Trámite en SIGD RENATO';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          <!-- Header Institucional -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px; text-align: center; border-bottom: 4px solid #10b981;">
              <h1 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                IESTP «SUIZA» — PUCALLPA
              </h1>
              <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">
                SIGD RENATO — Sistema Integral de Gestión Documentaria
              </p>
            </td>
          </tr>

          <!-- Contenido Principal -->
          <tr>
            <td style="padding: 32px 28px;">
              ${contenidoHtml}

              <!-- Botón de Acción Seguro -->
              <div style="margin: 28px 0; text-align: center;">
                <a href="${urlPortal}" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(30, 58, 138, 0.25);">
                  ${textoBoton}
                </a>
              </div>

              <!-- Aviso Legal TUO Ley 27444 -->
              <div style="margin-top: 28px; padding: 14px 16px; background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px;">
                <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #475569;">
                  <strong>AVISO LEGAL OBLIGATORIO:</strong> El presente correo electrónico tiene carácter estrictamente informativo y no sustituye la notificación legal. De conformidad con el Texto Único Ordenado de la Ley N° 27444 (Ley del Procedimiento Administrativo General), la notificación formal de actos administrativos y el cómputo de plazos procesales se rigen exclusivamente por el depósito del documento en su <strong>Casilla Electrónica institucional</strong>.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer Institucional -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
              <p style="margin: 0 0 4px 0;">Instituto de Educación Superior Tecnológico Público «Suiza»</p>
              <p style="margin: 0 0 8px 0;">Jr. Guillermo Sisley N° 450, Pucallpa, Ucayali — Perú</p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Este es un mensaje automático del SIGD RENATO. Por favor, no responda a este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function resolverEnlaceAccionRadicacion(
  payload: Record<string, unknown>,
  cuerpo: Record<string, unknown>,
  codigoCut: string,
): { texto: string; url: string } {
  const cifrado =
    (typeof cuerpo.enlaceSeguroCifrado === 'string' && cuerpo.enlaceSeguroCifrado) ||
    (typeof payload.enlaceSeguroCifrado === 'string' && payload.enlaceSeguroCifrado);

  if (cifrado) {
    let enlaceDescifrado: string;
    try {
      enlaceDescifrado = descifrarSecreto(cifrado);
    } catch {
      // Regla de seguridad: Cero exposición de tokens, payloads o secretos en logs
      console.error('[Seguridad Notificaciones] Fallo crítico al descifrar el enlace seguro para CUT:', codigoCut);
      throw new Error(`FALLO_DESCIFRADO_ENLACE_SEGURO: No se pudo descifrar el enlace de seguimiento para el CUT ${codigoCut}.`);
    }

    try {
      const frontendUrl = obtenerFrontendUrl();
      const urlObj = new URL(enlaceDescifrado, frontendUrl);
      const frontendBase = new URL(frontendUrl);

      // Validación estricta de seguridad:
      // 1. Origen idéntico al frontend configurado (prevenir Open Redirect / enlaces maliciosos)
      if (urlObj.origin !== frontendBase.origin) {
        throw new Error('ORIGEN_NO_AUTORIZADO');
      }

      // 2. Ruta debe apuntar a la consulta pública
      if (!urlObj.pathname.startsWith('/tramites/consulta-publica/')) {
        throw new Error('RUTA_NO_AUTORIZADA');
      }

      // 3. Fragmento debe contener el token de seguimiento (#token=[0-9a-f]{64})
      if (!/#token=[0-9a-f]{64}$/i.test(urlObj.hash)) {
        throw new Error('FORMATO_TOKEN_INVALIDO');
      }

      return {
        texto: 'Consultar Estado del Trámite',
        url: enlaceDescifrado,
      };
    } catch {
      console.error('[Seguridad Notificaciones] Fallo crítico de validación del enlace seguro descifrado para CUT:', codigoCut);
      throw new Error('ENLACE_SEGURO_INVALIDO: El enlace de seguimiento descifrado no cumple con las políticas de seguridad institucional.');
    }
  }

  // Si no se proporcionó enlace cifrado en el payload:
  // Determinar si es ciudadano sin cuenta (radicación pública) o usuario con cuenta activa
  const esCiudadanoSinCuenta =
    payload.tipo_acto === 'RADICACION_PUBLICO' ||
    (!payload.usuario_id && !payload.idUsuario && Boolean(payload.correoDeclarado || cuerpo.correoDeclarado));

  if (esCiudadanoSinCuenta) {
    // REGLA INSTITUCIONAL DE FALLO SEGURO (MESA DE PARTES / LEY 27444):
    // La notificación de radicación ciudadana sin cuenta exige OBLIGATORIAMENTE
    // un enlace seguro con token criptográfico (#token=...).
    // Está terminantemente PROHIBIDO sustituir el token inexistente por una URL
    // pública sin autenticación (/tramites/consulta-publica/CUT) que termine en
    // HTTP 404 al ciudadano, o enviar un enlace roto.
    // Si falta el token, se falla de manera cerrada para impedir que el outbox
    // marque como entregada una notificación carente de credenciales.
    console.error(
      '[Seguridad Notificaciones] Fallo seguro: Se denegó la notificación para CUT %s. Falta el enlace seguro obligatorio con token de seguimiento para radicación pública sin cuenta.',
      codigoCut,
    );
    throw new Error(
      `TOKEN_SEGUIMIENTO_REQUERIDO: No se puede generar la notificación de radicación pública para el expediente ${codigoCut} sin el enlace seguro obligatorio con token de seguimiento.`,
    );
  }

  // Usuario registrado y autenticado
  return {
    texto: 'Consultar Estado del Trámite',
    url: `${obtenerFrontendUrl()}/tramites/mis-expedientes`,
  };
}

export function generarPlantillaNotificacionEmail(
  tipoEvento: string,
  payload: Record<string, unknown>,
  titularNombre: string,
  cut?: string | null,
): PlantillaCorreo {
  const codigoCut = cut ?? (payload.cut as string) ?? 'No especificado';
  const cuerpo = (payload.cuerpo ?? payload.datos_especificos ?? {}) as Record<string, unknown>;

  switch (tipoEvento) {
    case 'radicacion_exitosa':
    case 'ExpedienteRecepcionado': {
      const subject = `[SIGD] Trámite Radicado Exitosamente — CUT: ${codigoCut}`;
      const folios = cuerpo.totalFolios ?? payload.totalFolios ?? '1';
      const fechaRad = cuerpo.fechaRadicacionLegal ?? payload.fechaRadicacionLegal ?? new Date().toLocaleDateString('es-PE');
      const enlaceAccion = resolverEnlaceAccionRadicacion(payload, cuerpo, codigoCut);
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Trámite Registrado Formalmente</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>Le informamos que su solicitud ha sido formalmente radicada ante el IESTP «Suiza». Se ha generado el expediente institucional con los siguientes datos:</p>
        <div style="background-color: #f1f5f9; padding: 14px 18px; border-radius: 6px; margin: 18px 0;">
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
            <li><strong>Código Único de Trámite (CUT):</strong> <span style="color: #1e3a8a; font-weight: 700;">${codigoCut}</span></li>
            <li><strong>Fecha y Hora Legal de Radicación:</strong> ${fechaRad}</li>
            <li><strong>Folios Registrados:</strong> ${folios}</li>
          </ul>
        </div>
        <p>Puede consultar el estado de su trámite en todo momento desde la plataforma institucional.</p>
        `,
        enlaceAccion,
      );
      return { subject, html };
    }

    case 'orden_pago_generada': {
      const subject = `[SIGD] Orden de Pago Generada — Plazo de 15 Días Hábiles — CUT: ${codigoCut}`;
      const fechaRad = (cuerpo.fechaRadicacionLegal as string) ?? (payload.fechaRadicacionLegal as string) ?? new Date().toLocaleDateString('es-PE');
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Orden de Pago TUPA Emitida</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>Se ha generado la orden de pago por concepto de tasa TUPA para su expediente CUT <strong>${codigoCut}</strong>.</p>
        <div style="background-color: #f1f5f9; padding: 14px 18px; border-radius: 6px; margin: 18px 0;">
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
            <li><strong>Expediente CUT:</strong> <span style="color: #1e3a8a; font-weight: 700;">${codigoCut}</span></li>
            <li><strong>Fecha de Radicación:</strong> ${fechaRad}</li>
            <li><strong>Plazo Legal para Pago (LPAG Art. 143):</strong> 15 días hábiles.</li>
          </ul>
        </div>
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 4px; color: #1e40af;">
          <strong>Habilitación Inmediata:</strong> Al confirmar su pago en Tesorería dentro del plazo, su expediente se habilitará <strong>inmediatamente</strong> para la calificación formal en Mesa de Partes sin esperar a que transcurran los 15 días.
        </div>
        `,
        { texto: 'Consultar Estado y Pago', url: `${obtenerFrontendUrl()}/tramites/consulta-publica/${codigoCut}` },
      );
      return { subject, html };
    }

    case 'pago_confirmado': {
      const subject = `[SIGD] Pago Verificado — Expediente Habilitado para Mesa de Partes — CUT: ${codigoCut}`;
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #15803d; margin-top: 0; font-size: 20px;">Pago Verificado Satisfactoriamente</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>La Unidad de Tesorería ha verificado el abono de la tasa correspondiente a su expediente CUT <strong>${codigoCut}</strong>.</p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 14px 18px; margin: 18px 0; border-radius: 4px; color: #166534;">
          <strong>Habilitación Inmediata Concedida:</strong><br>
          <p style="margin: 6px 0 0 0; font-size: 14px;">El expediente ha sido derivado a la bandeja de calificación formal de la Mesa de Partes para la verificación de sus requisitos TUPA.</p>
        </div>
        `,
        { texto: 'Ver Trámite Habilitado', url: `${obtenerFrontendUrl()}/tramites/consulta-publica/${codigoCut}` },
      );
      return { subject, html };
    }

    case 'expediente_habilitado_recepcion': {
      const subject = `[SIGD] Trámite Habilitado para Mesa de Partes — CUT: ${codigoCut}`;
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Expediente Listo para Calificación</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>Su expediente CUT <strong>${codigoCut}</strong> se encuentra formalmente habilitado en la Mesa de Partes para el inicio de su calificación administrativa.</p>
        `,
        { texto: 'Consultar Estado', url: `${obtenerFrontendUrl()}/tramites/consulta-publica/${codigoCut}` },
      );
      return { subject, html };
    }

    case 'calificacion_iniciada':
    case 'conformidad_documental': {
      const subject = `[SIGD] Conformidad Documental Aprobada — CUT: ${codigoCut}`;
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #15803d; margin-top: 0; font-size: 20px;">Conformidad de Requisitos TUPA Aprobada</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>La Mesa de Partes ha calificado y otorgado la <strong>conformidad documental</strong> a los requisitos presentados para el expediente CUT <strong>${codigoCut}</strong>.</p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 14px 18px; margin: 18px 0; border-radius: 4px; color: #166534;">
          <p style="margin: 0; font-size: 14px;">El trámite queda formalmente admitido y expedito para su derivación a la unidad orgánica correspondiente.</p>
        </div>
        `,
        { texto: 'Consultar Expediente', url: `${obtenerFrontendUrl()}/tramites/consulta-publica/${codigoCut}` },
      );
      return { subject, html };
    }

    case 'recepcion_destino': {
      const subject = `[SIGD] Expediente Recepcionado en Área Competente — CUT: ${codigoCut}`;
      const destino = (cuerpo.areaDestino as string) ?? (payload.area_destino as string) ?? 'Área de Destino';
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Expediente Recepcionado por ${destino}</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>Le comunicamos que su expediente CUT <strong>${codigoCut}</strong> ha sido formalmente recepcionado por la unidad competente (<strong>${destino}</strong>) para la emisión del pronunciamiento técnico correspondiente.</p>
        `,
        { texto: 'Seguimiento de Trámite', url: `${obtenerFrontendUrl()}/tramites/consulta-publica/${codigoCut}` },
      );
      return { subject, html };
    }

    case 'evaluacion_iniciada':
    case 'evaluacion_concluida': {
      const subject = `[SIGD] Evaluación Técnica Concluida — Favorable — CUT: ${codigoCut}`;
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #15803d; margin-top: 0; font-size: 20px;">Evaluación Técnica Concluida</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>La unidad orgánica encargada ha concluido favorablemente la evaluación técnica de su solicitud con CUT <strong>${codigoCut}</strong>.</p>
        <div style="background-color: #f1f5f9; padding: 14px 18px; border-radius: 6px; margin: 18px 0;">
          <p style="margin: 0; font-size: 14px; line-height: 1.6;">El expediente pasa al Despacho de Dirección General para la expedición y suscripción del acto administrativo oficial.</p>
        </div>
        `,
        { texto: 'Ver Estado del Trámite', url: `${obtenerFrontendUrl()}/tramites/consulta-publica/${codigoCut}` },
      );
      return { subject, html };
    }

    case 'expediente_archivado_falta_pago': {
      const subject = `[SIGD] Trámite Archivado por Falta de Pago — Plazo Vencido — CUT: ${codigoCut}`;
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #b91c1c; margin-top: 0; font-size: 20px;">Trámite Archivado por Falta de Pago</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>Le notificamos formalmente que su expediente CUT <strong>${codigoCut}</strong> ha sido <strong>ARCHIVADO</strong> por causal de falta de pago, al haber transcurrido el plazo perentorio de 15 días hábiles previsto en el Art. 143 del TUO de la Ley N° 27444 sin haberse acreditado el pago de la tasa TUPA.</p>
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 14px 18px; margin: 18px 0; border-radius: 4px; color: #991b1b;">
          <strong>Efectos del Cierre:</strong><br>
          <p style="margin: 6px 0 0 0; font-size: 14px; line-height: 1.5;">La orden de pago ha caducado y las actuaciones han sido archivadas. Su CUT y documentos originales se preservan en custodia institucional con fines probatorios.</p>
        </div>
        <p>Si aún desea gestionar el procedimiento, puede radicar una nueva solicitud en cualquier momento.</p>
        `,
        { texto: 'Consultar Constancia de Archivo', url: `${obtenerFrontendUrl()}/tramites/consulta-publica/${codigoCut}` },
      );
      return { subject, html };
    }

    case 'expediente_archivado':
    case 'expediente_cerrado': {
      const subject = `[SIGD] Trámite Concluido y Transferido a Archivo Central — CUT: ${codigoCut}`;
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Trámite Concluido y Custodiado en Archivo Central</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>Le informamos que el expediente CUT <strong>${codigoCut}</strong> ha completado la totalidad de sus etapas procedimentales y normativas.</p>
        <div style="background-color: #f1f5f9; padding: 14px 18px; border-radius: 6px; margin: 18px 0;">
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
            <li><strong>Expediente CUT:</strong> <span style="color: #1e3a8a; font-weight: 700;">${codigoCut}</span></li>
            <li><strong>Ubicación Custodia:</strong> Archivo Central — IESTP «Suiza»</li>
            <li><strong>Estado Final:</strong> CONCLUIDO / CUSTODIADO DEFINITIVO</li>
          </ul>
        </div>
        <p>Sus resoluciones y constancias permanecen accesibles en su Casilla Electrónica institucional.</p>
        `,
        { texto: 'Ver Constancia en Casilla', url: `${obtenerFrontendUrl()}/casilla/inbox` },
      );
      return { subject, html };
    }

    case 'ExpedienteRechazado': {
      const subject = `[SIGD] Trámite Concluido — Rechazo Administrativo — CUT: ${codigoCut}`;
      const motivo = (cuerpo.motivo as string) ?? (payload.motivo as string) ?? 'No cumple con las condiciones administrativas requeridas.';
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #b91c1c; margin-top: 0; font-size: 20px;">Trámite Rechazado Administrativamente</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>Le informamos que su expediente CUT <strong>${codigoCut}</strong> ha concluido con pronunciamiento de rechazo administrativo emitido por la Mesa de Partes.</p>
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 14px 18px; margin: 18px 0; border-radius: 4px; color: #991b1b;">
          <strong>Motivo del Rechazo:</strong><br>
          <p style="margin: 6px 0 0 0; font-size: 14px; line-height: 1.5;">${motivo}</p>
        </div>
        <p>Los actuados y la motivación legal se encuentran depositados en su Casilla Electrónica institucional.</p>
        `,
        { texto: 'Consultar Expediente', url: `${obtenerFrontendUrl()}/tramites/consulta-publica/${codigoCut}` },
      );
      return { subject, html };
    }

    case 'tesoreria_notificacion': {
      const refOrden = (payload.referencia_orden as string) ?? codigoCut;
      const asuntoNotif = (payload.asunto as string) ?? 'Actualización de Orden Financiera';
      const subject = `[SIGD] Actualización de Tesorería — ${refOrden}`;
      const accion = (cuerpo.accion as string) ?? 'Gestión de Tesorería';
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Actualización de Tesorería</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>La Unidad de Tesorería ha registrado una actualización respecto a su trámite:</p>
        <div style="background-color: #f1f5f9; padding: 14px 18px; border-radius: 6px; margin: 18px 0;">
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
            <li><strong>Referencia Financiera:</strong> ${refOrden}</li>
            <li><strong>Detalle:</strong> ${asuntoNotif}</li>
            <li><strong>Operación:</strong> ${accion}</li>
          </ul>
        </div>
        <p>Para ver el estado de su orden o gestionar pagos y devoluciones, ingrese a la plataforma institucional.</p>
        `,
        { texto: 'Ver Detalle en SIGD RENATO', url: `${obtenerFrontendUrl()}/tramites/mis-expedientes` },
      );
      return { subject, html };
    }

    case 'ExpedienteDerivado': {
      const subject = `[SIGD] Trámite Derivado — CUT: ${codigoCut}`;
      const motivo = (cuerpo.motivo as string) ?? 'Pase por competencia funcional';
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Trámite Derivado</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>Le comunicamos que su expediente con CUT <strong>${codigoCut}</strong> ha sido derivado internamente a la unidad competente para continuar con su atención institucional.</p>
        <div style="background-color: #f1f5f9; padding: 14px 18px; border-radius: 6px; margin: 18px 0;">
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
            <li><strong>CUT:</strong> <span style="color: #1e3a8a; font-weight: 700;">${codigoCut}</span></li>
            <li><strong>Motivo / Proveído:</strong> ${motivo}</li>
          </ul>
        </div>
        <p>El flujo procesal continúa según los plazos establecidos en el TUPA institucional.</p>
        `,
        { texto: 'Ver Historial de Derivación', url: `${obtenerFrontendUrl()}/tramites/mis-expedientes` },
      );
      return { subject, html };
    }

    case 'expediente_observado':
    case 'ExpedienteObservadoDocente': {
      const subject = `[SIGD] Observación Formulada — Plazo de Subsanación — CUT: ${codigoCut}`;
      const motivo = (cuerpo.contenido as string) ?? (cuerpo.motivo as string) ?? (payload.asunto as string) ?? 'Requisitos documentales o técnicos pendientes de subsanación.';
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #b91c1c; margin-top: 0; font-size: 20px;">Observación Formulada en su Expediente</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>Durante la evaluación técnica de su expediente CUT <strong>${codigoCut}</strong>, el evaluador asignado ha emitido una observación técnica que requiere su subsanación:</p>
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 14px 18px; margin: 18px 0; border-radius: 4px; color: #991b1b;">
          <strong>Detalle de la Observación:</strong><br>
          <p style="margin: 6px 0 0 0; font-size: 14px; line-height: 1.5;">${motivo}</p>
        </div>
        <p><strong>Plazo legal de subsanación:</strong> Dispone de un plazo perentorio de <strong>cinco (5) días hábiles</strong> para adjuntar la subsanación correspondiente en la plataforma.</p>
        `,
        { texto: 'Subsanar Expediente Ahora', url: `${obtenerFrontendUrl()}/tramites/mis-expedientes` },
      );
      return { subject, html };
    }

    case 'TramiteSubsanado':
    case 'TramiteSubsanadoEstudiante': {
      const subject = `[SIGD] Constancia de Subsanación Recibida — CUT: ${codigoCut}`;
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Subsanación Registrada con Éxito</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>Confirmamos que su documentación de subsanación para el expediente CUT <strong>${codigoCut}</strong> ha sido recibida satisfactoriamente por el sistema.</p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 14px 18px; margin: 18px 0; border-radius: 4px; color: #166534;">
          <strong>Estado Procesal:</strong><br>
          <p style="margin: 6px 0 0 0; font-size: 14px;">El expediente reanuda su evaluación técnica por el área y evaluador competente.</p>
        </div>
        `,
        { texto: 'Ver Expediente Subsanado', url: `${obtenerFrontendUrl()}/tramites/mis-expedientes` },
      );
      return { subject, html };
    }

    case 'vinculacion_cuenta_aprobada': {
      const subject = `[SIGD] Vinculación de Expediente APROBADA — CUT: ${codigoCut}`;
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #15803d; margin-top: 0; font-size: 20px;">Solicitud de Vinculación Aprobada</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>Su solicitud para vincular el expediente CUT <strong>${codigoCut}</strong> a su cuenta ciudadana ha sido <strong>APROBADA</strong> por la Mesa de Partes.</p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 14px 18px; margin: 18px 0; border-radius: 4px; color: #166534;">
          <p style="margin: 0; font-size: 14px;">A partir de este momento, podrá visualizar el expediente, recibir notificaciones y gestionar actuaciones desde su sección «Mis Expedientes».</p>
        </div>
        `,
        { texto: 'Ir a Mis Expedientes', url: `${obtenerFrontendUrl()}/tramites/mis-expedientes` },
      );
      return { subject, html };
    }

    case 'vinculacion_cuenta_rechazada': {
      const subject = `[SIGD] Solicitud de Vinculación RECHAZADA — CUT: ${codigoCut}`;
      const motivo = (payload.motivo as string) ?? 'No se acreditó la titularidad documental requerida.';
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #b91c1c; margin-top: 0; font-size: 20px;">Solicitud de Vinculación Rechazada</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>Le comunicamos que su solicitud para vincular el expediente CUT <strong>${codigoCut}</strong> ha sido <strong>RECHAZADA</strong> por la Mesa de Partes.</p>
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 14px 18px; margin: 18px 0; border-radius: 4px; color: #991b1b;">
          <strong>Motivo del Rechazo:</strong><br>
          <p style="margin: 6px 0 0 0; font-size: 14px; line-height: 1.5;">${motivo}</p>
        </div>
        <p>Si considera que se trata de un error o dispone de documentación adicional, puede presentar una nueva solicitud con sustento.</p>
        `,
        { texto: 'Consultar Trámites', url: `${obtenerFrontendUrl()}/tramites/mis-expedientes` },
      );
      return { subject, html };
    }

    case 'resolucion_emitida':
    case 'expediente_resuelto':
    case 'certificado_emitido': {
      const subject = `[SIGD] Resolución Emitida Disponible en Casilla — CUT: ${codigoCut}`;
      const numResolucion = (payload.numero_resolucion as string) ?? (payload.numero_documento as string) ?? 'Resolución Directoral';
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Resolución Oficial Emitida</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>Le informamos que la autoridad institucional ha emitido y suscrito digitalmente el acto administrativo resolutivo que concluye su trámite:</p>
        <div style="background-color: #f1f5f9; padding: 14px 18px; border-radius: 6px; margin: 18px 0;">
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
            <li><strong>Expediente CUT:</strong> <span style="color: #1e3a8a; font-weight: 700;">${codigoCut}</span></li>
            <li><strong>Acto Administrativo:</strong> ${numResolucion}</li>
          </ul>
        </div>
        <p>El documento oficial con firma digital verificable y Código de Verificación Digital (CVD) se encuentra formalmente depositado en su <strong>Casilla Electrónica</strong> institucional.</p>
        `,
        { texto: 'Ingresar a Casilla Electrónica', url: `${obtenerFrontendUrl()}/casilla/inbox` },
      );
      return { subject, html };
    }

    case 'cuenta_activada': {
      const subject = `[SIGD] Bienvenido a SIGD RENATO — Casilla Electrónica Activada`;
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #15803d; margin-top: 0; font-size: 20px;">¡Bienvenido(a) al SIGD RENATO!</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>Su cuenta de usuario y su <strong>Casilla Electrónica institucional</strong> en el IESTP «Suiza» han sido activadas exitosamente.</p>
        <p>Desde su cuenta podrá gestionar trámites académicos y administrativos, radicar solicitudes virtuales 24x7 y recibir notificaciones formales con plena validez legal.</p>
        `,
        { texto: 'Ingresar a su Casilla', url: `${obtenerFrontendUrl()}/casilla/inbox` },
      );
      return { subject, html };
    }

    case 'verificacion_correo_solicitada': {
      const subject = `[SIGD] Verificación de Dirección de Correo Electrónico`;
      let token = '';
      if (payload.tokenCifrado) {
        token = descifrarTokenPayload(payload.tokenCifrado);
      } else if (typeof payload.token === 'string') {
        token = payload.token;
      }
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Verificación de Correo Electrónico</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>Hemos recibido una solicitud de verificación para su dirección de correo institucional en el SIGD RENATO.</p>
        ${token ? `<p>Su código de verificación es: <strong style="font-size: 18px; color: #1e3a8a; letter-spacing: 2px;">${token}</strong></p>` : ''}
        <p>Si usted no realizó esta solicitud, puede desestimar este mensaje.</p>
        `,
        { texto: 'Completar Verificación', url: `${obtenerFrontendUrl()}/login` },
      );
      return { subject, html };
    }

    default: {
      const subject = `[SIGD] Actualización de Trámite — CUT: ${codigoCut}`;
      const asuntoNotif = (payload.asunto as string) ?? 'Tiene una nueva notificación en su casilla institucional.';
      const html = envolverPlantillaInstitucional(
        subject,
        `
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Actualización Institucional</h2>
        <p>Estimado(a) <strong>${titularNombre}</strong>,</p>
        <p>${asuntoNotif}</p>
        <p>Consulte los detalles en su Casilla Electrónica o en la sección «Mis Expedientes».</p>
        `,
        { texto: 'Acceder a SIGD RENATO', url: `${obtenerFrontendUrl()}/casilla/inbox` },
      );
      return { subject, html };
    }
  }
}

export class DestinoEmail implements DestinoNotificacion {
  readonly nombre = 'email';
  constructor(private readonly pool: Pool, private readonly emailService: EmailService) {}

  async despachar(evento: EventoPendiente): Promise<void> {
    // 1. Prohibición estricta: eventos operativos internos NUNCA se notifican al ciudadano
    if (EVENTOS_INTERNOS_PROHIBIDOS.has(evento.tipo_evento)) {
      return;
    }

    // 2. Filtrar únicamente eventos institucionales destinados a correo
    if (!EVENTOS_EMAIL.has(evento.tipo_evento)) {
      return;
    }

    const payload = (evento.payload ?? {}) as Record<string, unknown>;
    const identidad = (payload.identidad ?? {}) as Record<string, unknown>;

    let usuarioId = typeof payload.usuario_id === 'string' ? payload.usuario_id :
                    (typeof payload.idUsuario === 'string' ? payload.idUsuario : null);
    let expedienteId = typeof payload.expediente_id === 'string' ? payload.expediente_id :
                      (typeof identidad.expediente_id === 'string' ? identidad.expediente_id : null);
    let cut = typeof payload.cut === 'string' ? payload.cut :
              (typeof identidad.cut === 'string' ? identidad.cut :
              (typeof payload.numero_documento === 'string' ? payload.numero_documento : null));

    let destinatarioCorreo: string | null = null;
    let titularNombre = 'Ciudadano';

    // 3. Resolución del destinatario y validación estricta de titularidad
    if (usuarioId) {
      const userRes = await this.pool.query<{
        id_usuario: string;
        correo: string;
        titular_nombre: string;
        activo: boolean;
        id_persona: string | null;
      }>(
        `SELECT cu.id_usuario,
                cu.id_persona,
                COALESCE(ca.correo, cu.correo) AS correo,
                COALESCE(pn.nombre_completo, pj.razon_social, 'Ciudadano') AS titular_nombre,
                cu.activo
           FROM sigd_auth.cuenta_usuario cu
           LEFT JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
           LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
           LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
           LEFT JOIN LATERAL (
             SELECT correo FROM sigd_auth.correos_adicionales
              WHERE id_usuario = cu.id_usuario AND verificado = TRUE
              ORDER BY preferido DESC, creado_en ASC
              LIMIT 1
           ) ca ON TRUE
          WHERE cu.id_usuario = $1::uuid`,
        [usuarioId],
      );

      const userRow = userRes.rows[0];
      if (!userRow || !userRow.activo) {
        return;
      }

      // Si el evento está ligado a un expediente, comprobar titularidad legítima
      if (expedienteId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expedienteId)) {
        const titularCheck = await this.pool.query<{ es_titular: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM sigd_doc.expediente e
              WHERE e.expediente_id = $1::uuid
                AND (
                  e.solicitante_id = $2::uuid
                  OR EXISTS (
                    SELECT 1 FROM sigd_tra.vinculacion_expediente_cuenta vec
                     WHERE vec.expediente_id = e.expediente_id
                       AND vec.id_usuario = $3::uuid
                       AND vec.estado = 'APROBADA'
                  )
                )
           ) AS es_titular`,
          [expedienteId, userRow.id_persona, usuarioId],
        );

        if (!titularCheck.rows[0]?.es_titular) {
          throw new Error(`El destinatario ${usuarioId} no es titular legítimo del expediente ${expedienteId}.`);
        }
      }

      destinatarioCorreo = userRow.correo;
      titularNombre = userRow.titular_nombre;
    } else if (expedienteId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expedienteId)) {
      // Resolución por titularidad del expediente (sin usuario_id explícito en el payload)
      const titularExpRes = await this.pool.query<{
        id_usuario: string;
        correo: string;
        titular_nombre: string;
        cut: string;
      }>(
        `SELECT cu.id_usuario,
                COALESCE(ca.correo, cu.correo) AS correo,
                COALESCE(pn.nombre_completo, pj.razon_social, 'Ciudadano') AS titular_nombre,
                e.codigo_expediente AS cut
           FROM sigd_doc.expediente e
           JOIN sigd_auth.cuenta_usuario cu ON cu.id_persona = e.solicitante_id AND cu.activo = TRUE
           LEFT JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
           LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
           LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
           LEFT JOIN LATERAL (
             SELECT correo FROM sigd_auth.correos_adicionales
              WHERE id_usuario = cu.id_usuario AND verificado = TRUE
              ORDER BY preferido DESC, creado_en ASC
              LIMIT 1
           ) ca ON TRUE
          WHERE e.expediente_id = $1::uuid
          UNION
         SELECT cu.id_usuario,
                COALESCE(ca.correo, cu.correo) AS correo,
                COALESCE(pn.nombre_completo, pj.razon_social, 'Ciudadano') AS titular_nombre,
                e.codigo_expediente AS cut
           FROM sigd_doc.expediente e
           JOIN sigd_tra.vinculacion_expediente_cuenta vec ON vec.expediente_id = e.expediente_id AND vec.estado = 'APROBADA'
           JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = vec.id_usuario AND cu.activo = TRUE
           LEFT JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
           LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
           LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
           LEFT JOIN LATERAL (
             SELECT correo FROM sigd_auth.correos_adicionales
              WHERE id_usuario = cu.id_usuario AND verificado = TRUE
              ORDER BY preferido DESC, creado_en ASC
              LIMIT 1
           ) ca ON TRUE
          WHERE e.expediente_id = $1::uuid`,
        [expedienteId],
      );

      let titularValido = titularExpRes.rows.find((r) => Boolean(r.correo));
      if (!titularValido) {
        // Fallback para administrados no registrados o sin cuenta de usuario: consultar persona_natural directamente
        const personaRes = await this.pool.query<{
          correo: string | null;
          titular_nombre: string;
          cut: string;
        }>(
          `SELECT pn.correo,
                  COALESCE(pn.nombre_completo, CONCAT(pn.nombres, ' ', pn.apellidos), pj.razon_social, 'Ciudadano') AS titular_nombre,
                  e.codigo_expediente AS cut
             FROM sigd_doc.expediente e
             LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = e.solicitante_id
             LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = e.solicitante_id
            WHERE e.expediente_id = $1::uuid
            LIMIT 1`,
          [expedienteId],
        );
        if (personaRes.rows[0]?.correo) {
          titularValido = {
            id_usuario: '',
            correo: personaRes.rows[0].correo,
            titular_nombre: personaRes.rows[0].titular_nombre,
            cut: personaRes.rows[0].cut,
          };
        }
      }

      if (titularValido && titularValido.correo) {
        destinatarioCorreo = titularValido.correo;
        titularNombre = titularValido.titular_nombre;
        cut = cut ?? titularValido.cut;
      } else if (payload.correoDeclarado && typeof payload.correoDeclarado === 'string') {
        destinatarioCorreo = payload.correoDeclarado;
        titularNombre = typeof payload.nombreDeclarado === 'string' ? payload.nombreDeclarado : 'Ciudadano';
      } else if (payload.correo && typeof payload.correo === 'string') {
        destinatarioCorreo = payload.correo;
        titularNombre = typeof payload.titular === 'string' ? payload.titular : 'Ciudadano';
      } else {
        // Solicitante presencial o sin cuenta registrada: registrar omisión justificada en bitácora
        await this.pool.query(
          `INSERT INTO sigd_audit.bitacora_auditoria
             (correlation_id, esquema, tabla, operacion, datos_antes, datos_despues, fecha_hora)
           VALUES ($1::uuid, 'sigd_auth', 'cuenta_usuario', 'OMISION_CORREO_NO_HABILITADO', $2::jsonb, $3::jsonb, clock_timestamp())`,
          [
            evento.correlation_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(evento.correlation_id)
              ? evento.correlation_id
              : '00000000-0000-0000-0000-000000000000',
            JSON.stringify({ id_evento: evento.id_evento, expediente_id: expedienteId, cut: cut ?? null }),
            JSON.stringify({ motivo: 'El expediente no cuenta con una dirección de correo activa para notificación' }),
          ],
        ).catch(() => null);
        return;
      }
    }

    if (!destinatarioCorreo) {
      return;
    }

    // 4. Generar plantilla institucional con aviso legal TUO Ley 27444
    const plantilla = generarPlantillaNotificacionEmail(evento.tipo_evento, payload, titularNombre, cut);

    // 5. Envío mediante EmailService con clave de idempotencia del evento outbox
    await this.emailService.enviar(
      {
        to: destinatarioCorreo,
        subject: plantilla.subject,
        html: plantilla.html,
      },
      evento.id_evento,
    );
  }
}

const EVENTOS_CASILLA = new Set([
  'casilla_notificacion',
  'expediente_observado',
  'expediente_resuelto',
  'resolucion_emitida',
  'certificado_emitido',
]);

export interface DestinoSseOptions {
  publicarFueraDeTransaccion?: (evento: string, datos: unknown) => Promise<void>;
}

export class DestinoSse implements DestinoNotificacion {
  readonly nombre = 'sse';
  private readonly bus: BusSse;
  private readonly publicar?: (evento: string, datos: unknown) => Promise<void>;

  constructor(bus: BusSse, bridge?: BridgeNotificacion | null) {
    this.bus = bus;
    this.publicar = bridge?.publicar.bind(bridge) ?? undefined;
  }

  async despachar(evento: EventoPendiente): Promise<void> {
    // 1. Prohibición estricta: eventos sensibles o internos jamás se transmiten por SSE
    if (EVENTOS_SENSIBLES_BLOQUEADOS_SSE.has(evento.tipo_evento) || EVENTOS_INTERNOS_PROHIBIDOS.has(evento.tipo_evento)) {
      return;
    }

    if (evento.tipo_evento === 'tesoreria_notificacion') {
      const aviso = { tipoEvento: 'tesoreria_notificacion', actualizar: true };
      this.bus.emitirEvento('casilla_notificacion', aviso);
      await this.publicar?.('casilla_notificacion', aviso);
      return;
    }

    // Sanitizar datos para el transporte SSE por defensa en profundidad
    const payloadSanitizado = sanitizarObjetoParaLog(evento.payload) as Record<string, unknown>;
    const datos = {
      ...payloadSanitizado,
      idEvento: evento.id_evento,
      correlationId: evento.correlation_id,
      tipoEvento: evento.tipo_evento,
    };
    this.bus.emitirEvento(evento.tipo_evento, datos);
    await this.publicar?.(evento.tipo_evento, datos);
  }
}

export interface DestinoCasillaOptions {
  tabla?: string;
}

export class DestinoCasilla implements DestinoNotificacion {
  readonly nombre = 'casilla';
  private readonly pool: Pool;
  private readonly tabla: string;
  private verificado: boolean | null = null;

  constructor(pool: Pool, opciones: DestinoCasillaOptions = {}) {
    this.pool = pool;
    this.tabla = opciones.tabla ?? 'sigd_auth.notificacion_casilla';
  }

  async disponible(): Promise<boolean> {
    if (this.verificado === true) return true;
    const resultado = await this.pool
      .query<{ existe: string | null }>('SELECT to_regclass($1)::text AS existe', [this.tabla])
      .catch(() => null);
    this.verificado = Boolean(resultado?.rows[0]?.existe);
    return this.verificado;
  }

  async despachar(evento: EventoPendiente): Promise<void> {
    if (evento.tipo_evento === 'tesoreria_notificacion') {
      await this.despacharFinanciera(evento);
      return;
    }
    if (!EVENTOS_CASILLA.has(evento.tipo_evento)) return;
    if (!(await this.disponible())) throw new Error('Casilla no disponible: no se puede confirmar la entrega del evento.');

    const payload = (evento.payload ?? {}) as Record<string, unknown>;
    const usuarioId = payload.usuario_id;
    const expedienteId = payload.expediente_id;
    const cut = payload.cut;
    const asunto = payload.asunto;

    const esUsuarioValido = typeof usuarioId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usuarioId);
    if (!esUsuarioValido) {
      if (typeof expedienteId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expedienteId)) {
        await this.pool.query(
          `INSERT INTO sigd_audit.bitacora_auditoria
             (correlation_id, esquema, tabla, operacion, datos_antes, datos_despues, fecha_hora)
           VALUES ($1::uuid, 'sigd_auth', 'notificacion_casilla', 'OMISION_CASILLA_NO_HABILITADA', $2::jsonb, $3::jsonb, clock_timestamp())`,
          [
            evento.correlation_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(evento.correlation_id)
              ? evento.correlation_id
              : '00000000-0000-0000-0000-000000000000',
            JSON.stringify({ id_evento: evento.id_evento, expediente_id: expedienteId, cut: cut ?? null, usuario_id_recibido: usuarioId ?? null }),
            JSON.stringify({ motivo: 'Administrado sin casilla electrónica institucional habilitada (trámite presencial o sin cuenta)' }),
          ],
        ).catch(() => null);
      }
      return;
    }
    if (typeof expedienteId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expedienteId)
      || typeof cut !== 'string' || !cut.trim() || typeof asunto !== 'string' || !asunto.trim()) {
      throw new Error(`El evento ${evento.tipo_evento} no contiene destinatario, expediente, CUT y asunto válidos para Casilla.`);
    }

    const existente = await this.pool.query<{ usuario_id: string | null; cut: string | null }>(
      `SELECT usuario_id, cut FROM ${this.tabla} WHERE referencia = $1 LIMIT 1`,
      [evento.id_evento],
    );
    if (existente.rows.length > 0) {
      if (existente.rows[0].usuario_id !== usuarioId || existente.rows[0].cut !== cut) {
        throw new Error(`La referencia Outbox ${evento.id_evento} ya está asociada a otra notificación.`);
      }
      return;
    }

    const titular = await this.pool.query<{ existe: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM sigd_doc.expediente e
         JOIN sigd_auth.cuenta_usuario c
           ON c.id_usuario = $3::uuid AND c.activo = TRUE
        WHERE e.expediente_id = $1::uuid AND e.codigo_expediente = $2
          AND (
            c.id_persona = e.solicitante_id
            OR EXISTS (
              SELECT 1 FROM sigd_tra.vinculacion_expediente_cuenta vec
               WHERE vec.expediente_id = e.expediente_id
                 AND vec.id_usuario = c.id_usuario
                 AND vec.estado = 'APROBADA'
            )
          )
       ) AS existe`,
      [expedienteId, cut, usuarioId],
    );
    if (!titular.rows[0]?.existe) {
      throw new Error(`El destinatario del evento ${evento.tipo_evento} no es el titular activo del expediente.`);
    }

    let documentoUrl: string | null = null;
    if (payload.documento_id !== undefined) {
      const documentoId = payload.documento_id;
      if (typeof documentoId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentoId)) {
        throw new Error(`El evento ${evento.tipo_evento} contiene una referencia documental inválida.`);
      }
      const adjunto = await this.pool.query<{ existe: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM sigd_doc.documento_adjunto a
           JOIN sigd_doc.expediente e ON e.expediente_id = a.expediente_id
          WHERE a.documento_adjunto_id = $1::uuid
            AND e.expediente_id = $2::uuid AND e.codigo_expediente = $3
         ) AS existe`,
        [documentoId, expedienteId, cut],
      );
      if (!adjunto.rows[0]?.existe) {
        throw new Error(`El documento indicado por ${evento.tipo_evento} no pertenece al expediente de Casilla.`);
      }
      documentoUrl = `/api/v1/storage/documentos/${documentoId}/download`;
    }

    const correo = typeof payload.correo_destinatario === 'string' ? payload.correo_destinatario : null;
    const tipoActo = typeof payload.tipo_acto === 'string' && payload.tipo_acto.trim()
      ? payload.tipo_acto : evento.tipo_evento;
    const numeroDocumento = typeof payload.numero_documento === 'string' ? payload.numero_documento : null;
    const cuerpo = payload.cuerpo && typeof payload.cuerpo === 'object'
      ? payload.cuerpo : payload;
    await this.pool.query(
      `INSERT INTO ${this.tabla}
         (usuario_id, correo_destinatario, cut, asunto, tipo_acto, numero_documento,
          cuerpo, referencia, estado, documento_url)
       SELECT $1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8::varchar, 'NO_LEIDO', $9
        WHERE NOT EXISTS (SELECT 1 FROM ${this.tabla} WHERE referencia = $8::varchar)`,
      [usuarioId, correo, cut, asunto, tipoActo, numeroDocumento,
        JSON.stringify(cuerpo), evento.id_evento, documentoUrl],
    );
  }

  private async despacharFinanciera(evento: EventoPendiente): Promise<void> {
    if (!(await this.disponible())) throw new Error('Casilla no disponible para comunicación financiera.');
    const p = evento.payload as Record<string, unknown>;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof p.usuario_id !== 'string' || !uuid.test(p.usuario_id) || typeof p.orden_id !== 'string' || !uuid.test(p.orden_id)
        || typeof p.asunto !== 'string' || !p.asunto.trim()) throw new Error('Evento financiero sin destinatario u orden válidos.');
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const orden = await c.query(`SELECT o.codigo FROM sigd_tes.orden_pago o JOIN sigd_auth.cuenta_usuario u ON u.id_usuario=o.ciudadano_id
        WHERE o.id=$1 AND u.id_usuario=$2 AND u.activo AND u.id_persona=o.persona_id FOR UPDATE OF o`, [p.orden_id, p.usuario_id]);
      if (orden.rows.length !== 1 || orden.rows[0].codigo !== p.referencia_orden) throw new Error('El destinatario no es titular de la orden financiera.');
      const existente = await c.query(`SELECT usuario_id,numero_documento FROM ${this.tabla} WHERE referencia=$1`, [evento.id_evento]);
      if (existente.rows.length) {
        if (existente.rows.length !== 1 || existente.rows[0].usuario_id !== p.usuario_id || existente.rows[0].numero_documento !== orden.rows[0].codigo) throw new Error('Referencia de notificación financiera contradictoria.');
      } else await c.query(`INSERT INTO ${this.tabla}(usuario_id,asunto,tipo_acto,numero_documento,cuerpo,referencia,estado)
        VALUES($1,$2,'COMUNICACION_FINANCIERA',$3,$4::jsonb,$5,'NO_LEIDO')`, [p.usuario_id,p.asunto,orden.rows[0].codigo,JSON.stringify(p.cuerpo ?? {}),evento.id_evento]);
      await c.query('COMMIT');
    } catch (error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); }
  }
}

export class DestinoWhatsApp implements DestinoNotificacion {
  readonly nombre = 'whatsapp';
  constructor(
    private readonly pool: Pool,
    private readonly whatsappService: WhatsAppNotificacionesService,
  ) {}

  async despachar(evento: EventoPendiente): Promise<void> {
    const tiposCierreValidos = new Set([
      'expediente_resuelto',
      'resolucion_emitida',
      'certificado_emitido',
      'expediente_archivado_falta_pago',
      'expediente_archivado',
      'expediente_cerrado',
      'ExpedienteRechazado',
    ]);

    if (!tiposCierreValidos.has(evento.tipo_evento)) {
      return;
    }

    const payload = (evento.payload ?? {}) as Record<string, unknown>;
    const cuerpo = (payload.cuerpo ?? {}) as Record<string, unknown>;
    const expedienteId = typeof payload.expediente_id === 'string' ? payload.expediente_id : null;
    let cut = typeof payload.cut === 'string' ? payload.cut : null;

    if (!expedienteId) {
      return;
    }

    // Resolver datos del titular y teléfono
    let telefono = typeof payload.telefonoDeclarado === 'string' ? payload.telefonoDeclarado :
                   (typeof payload.telefono === 'string' ? payload.telefono : null);
    let titularNombre = typeof payload.nombreDeclarado === 'string' ? payload.nombreDeclarado :
                        (typeof payload.titular === 'string' ? payload.titular : 'Ciudadano');

    if (!telefono) {
      const res = await this.pool.query<{
        telefono: string | null;
        titular_nombre: string;
        cut: string;
      }>(
        `SELECT COALESCE(pn.telefono, cu.telefono) AS telefono,
                COALESCE(pn.nombre_completo, CONCAT(pn.nombres, ' ', pn.apellidos), pj.razon_social, 'Ciudadano') AS titular_nombre,
                e.codigo_expediente AS cut
           FROM sigd_doc.expediente e
           LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = e.solicitante_id
           LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = e.solicitante_id
           LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_persona = e.solicitante_id
          WHERE e.expediente_id = $1::uuid
          LIMIT 1`,
        [expedienteId],
      );
      if (res.rows[0]) {
        telefono = res.rows[0].telefono;
        titularNombre = res.rows[0].titular_nombre;
        cut = cut ?? res.rows[0].cut;
      }
    }

    if (!telefono || !cut) {
      // Sin teléfono disponible para WhatsApp, omitir de forma segura
      return;
    }

    let tipoCierre: TipoCierreWhatsApp = 'FINALIZADO_SATISFACTORIO';
    if (evento.tipo_evento === 'expediente_archivado_falta_pago') {
      tipoCierre = 'ARCHIVADO_FALTA_PAGO';
    } else if (
      evento.tipo_evento === 'ExpedienteRechazado' ||
      ((evento.tipo_evento === 'expediente_cerrado' || evento.tipo_evento === 'expediente_archivado') &&
      (cuerpo.motivo === 'RECHAZADO' || cuerpo.motivo === 'INADMISIBLE' || cuerpo.motivo === 'FALTA_DE_PAGO'))
    ) {
      tipoCierre = cuerpo.motivo === 'FALTA_DE_PAGO' ? 'ARCHIVADO_FALTA_PAGO' : 'RECHAZADO_INADMISIBLE';
    }

    const resolucionNumero = (payload.numero_resolucion as string) ?? (payload.numero_documento as string) ?? (cuerpo.numero_resolucion as string);

    await this.whatsappService.enviarMensajeFinal({
      expedienteId,
      cut,
      telefono,
      tipoCierre,
      titularNombre,
      resolucionNumero,
      enlaceSeguro: `${obtenerFrontendUrl()}/tramites/consulta-publica/${cut}`,
      autorizadoPorTitular: true,
    });
  }
}

export interface ResumenDespacho {
  destinos: string[];
  omitidos: string[];
}

export interface OpcionesDespachador {
  destinos: DestinoNotificacion[];
  onFallo?: (destino: string, error: unknown) => void;
}

export class DespachadorNotificaciones {
  private readonly destinos: DestinoNotificacion[];

  constructor(opciones: OpcionesDespachador | DestinoNotificacion[]) {
    this.destinos = Array.isArray(opciones) ? opciones : opciones.destinos;
  }

  nombres(): string[] {
    return this.destinos.map((d) => d.nombre);
  }

  async despachar(evento: EventoPendiente): Promise<ResumenDespacho> {
    const errores: unknown[] = [];

    for (const destino of this.destinos) {
      try {
        await destino.despachar(evento);
      } catch (error) {
        errores.push(error);
        console.error(
          `[OUTBOX] Destino ${destino.nombre} falló para ${evento.id_evento}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    if (errores.length > 0) {
      throw errores[0];
    }

    return { destinos: this.nombres(), omitidos: [] };
  }
}

export function crearDespachadorPorDefecto(
  bus: BusSse,
  pool: Pool,
  bridge?: BridgeNotificacion | null,
): DespachadorNotificaciones {
  const emailService = new EmailService(process.env.RESEND_API_KEY || '', process.env.RESEND_FROM_EMAIL || '');
  const whatsappService = new WhatsAppNotificacionesService(pool);
  return new DespachadorNotificaciones([
    new DestinoSse(bus, bridge),
    new DestinoCasilla(pool),
    new DestinoEmail(pool, emailService),
    new DestinoWhatsApp(pool, whatsappService),
  ]);
}
