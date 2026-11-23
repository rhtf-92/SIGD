import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';

export type TipoCierreWhatsApp =
  | 'FINALIZADO_SATISFACTORIO'
  | 'ARCHIVADO_FALTA_PAGO'
  | 'RECHAZADO_INADMISIBLE';

export interface ParametrosMensajeFinalWhatsApp {
  expedienteId: string;
  cut: string;
  telefono: string;
  tipoCierre: TipoCierreWhatsApp;
  titularNombre: string;
  resolucionNumero?: string;
  enlaceSeguro?: string;
  autorizadoPorTitular?: boolean;
}

export interface ResultadoEnvioWhatsApp {
  id: string;
  messageId: string;
  proveedor: string;
  telefono: string;
  cut: string;
  tipoCierre: TipoCierreWhatsApp;
  estadoEnvio: 'ENVIADO' | 'OMITIDO_NO_AUTORIZADO';
  mensaje: string;
}

/**
 * Adaptador de Notificaciones de WhatsApp para el cierre definitivo de expedientes.
 * CLASIFICACIÓN ESTRICTA: SANDBOX_WHATSAPP_CLOUD_API.
 *
 * Directrices institucionales:
 * 1. Se activa ÚNICAMENTE al concluir el procedimiento (resolución/archivo/cierre).
 * 2. Requiere autorización previa o teléfono registrado del administrado.
 * 3. En modo SANDBOX simula la entrega registrando metadatos y message_id criptográfico
 *    en sigd_auth.notificacion_whatsapp y sigd_audit.bitacora_auditoria.
 */
export class WhatsAppNotificacionesService {
  readonly proveedor = 'SANDBOX_WHATSAPP_CLOUD_API';

  constructor(private readonly pool: Pool) {}

  formatearPlantilla(params: ParametrosMensajeFinalWhatsApp): string {
    const enlace = params.enlaceSeguro ?? `http://localhost:5178/tramites/consulta-publica/${params.cut}`;
    const nombre = params.titularNombre || 'Ciudadano';

    switch (params.tipoCierre) {
      case 'FINALIZADO_SATISFACTORIO': {
        const resolucion = params.resolucionNumero ?? 'Resolución Directoral Oficial';
        return [
          '🏛️ *IESTP «SUIZA» — SIGD RENATO*',
          '',
          `Estimado(a) *${nombre}*:`,
          `Le comunicamos que su trámite institucional con expediente *CUT: ${params.cut}* ha sido concluido satisfactoriamente.`,
          `Acto Resolutivo: *${resolucion}*.`,
          'El expediente y sus credenciales digitales han sido formalmente transferidos a custodia en Archivo Central.',
          `Acceda a su Casilla Electrónica o consulte su constancia digital aquí:`,
          `${enlace}`,
          '',
          '_Notificación institucional conforme al TUO de la Ley N° 27444._',
        ].join('\n');
      }

      case 'ARCHIVADO_FALTA_PAGO': {
        return [
          '🏛️ *IESTP «SUIZA» — SIGD RENATO*',
          '',
          `Estimado(a) *${nombre}*:`,
          `Le comunicamos que su expediente *CUT: ${params.cut}* ha sido ARCHIVADO por falta de pago al haber transcurrido el plazo perentorio de 15 días hábiles (LPAG Art. 143).`,
          'La orden de pago ha caducado. Si requiere tramitar una nueva solicitud, puede radicar un nuevo trámite en:',
          `${enlace}`,
          '',
          '_Notificación institucional conforme al TUO de la Ley N° 27444._',
        ].join('\n');
      }

      case 'RECHAZADO_INADMISIBLE': {
        return [
          '🏛️ *IESTP «SUIZA» — SIGD RENATO*',
          '',
          `Estimado(a) *${nombre}*:`,
          `Le comunicamos que su expediente *CUT: ${params.cut}* ha concluido con pronunciamiento de Mesa de Partes.`,
          `Puede revisar los actuados y el informe motivado en:`,
          `${enlace}`,
          '',
          '_Notificación institucional conforme al TUO de la Ley N° 27444._',
        ].join('\n');
      }
    }
  }

  async enviarMensajeFinal(params: ParametrosMensajeFinalWhatsApp): Promise<ResultadoEnvioWhatsApp> {
    const autorizado = params.autorizadoPorTitular ?? true;
    const telLimpio = params.telefono.replace(/\s+/g, '').replace(/[^\d+]/g, '');

    if (!autorizado) {
      console.info(JSON.stringify({
        msg: '[WHATSAPP_SANDBOX] Envío omitido por falta de autorización del titular',
        cut: params.cut,
      }));
      return {
        id: '',
        messageId: '',
        proveedor: this.proveedor,
        telefono: telLimpio,
        cut: params.cut,
        tipoCierre: params.tipoCierre,
        estadoEnvio: 'OMITIDO_NO_AUTORIZADO',
        mensaje: '',
      };
    }

    const mensaje = this.formatearPlantilla(params);
    const messageId = `wamid.HBgM${randomBytes(16).toString('hex').toUpperCase()}`;

    // Registrar en sigd_auth.notificacion_whatsapp
    const res = await this.pool.query<{ id: string }>(
      `INSERT INTO sigd_auth.notificacion_whatsapp
         (expediente_id, cut, telefono, mensaje, tipo_cierre, proveedor, message_id, estado_envio, autorizado_por_titular)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, 'ENVIADO', TRUE)
       RETURNING id`,
      [
        params.expedienteId,
        params.cut,
        telLimpio,
        mensaje,
        params.tipoCierre,
        this.proveedor,
        messageId,
      ],
    );

    const registroId = res.rows[0]?.id ?? '';

    // Registrar en bitácora de auditoría
    await this.pool.query(
      `INSERT INTO sigd_audit.bitacora_auditoria
         (esquema, tabla, operacion, datos_despues, fecha_hora)
       VALUES ('sigd_auth', 'notificacion_whatsapp', 'INSERT', $1::jsonb, clock_timestamp())`,
      [
        JSON.stringify({
          notificacion_id: registroId,
          expediente_id: params.expedienteId,
          cut: params.cut,
          telefono: telLimpio,
          proveedor: this.proveedor,
          message_id: messageId,
          tipo_cierre: params.tipoCierre,
        }),
      ],
    ).catch(() => null);

    console.info(JSON.stringify({
      msg: `[WHATSAPP_SANDBOX] Mensaje final registrado con éxito`,
      cut: params.cut,
      messageId,
      proveedor: this.proveedor,
      telefono: telLimpio,
      tipoCierre: params.tipoCierre,
    }));

    return {
      id: registroId,
      messageId,
      proveedor: this.proveedor,
      telefono: telLimpio,
      cut: params.cut,
      tipoCierre: params.tipoCierre,
      estadoEnvio: 'ENVIADO',
      mensaje,
    };
  }
}
