import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  ForbiddenError,
  NotFoundError,
} from '../../shared/domain/errors/index.js';

export interface CallbackRefirma {
  documento_id: string;
  sha256_firmado: string;
  firmante: string;
  fecha_sello_tsa: string;
  s3_bucket: string;
  s3_key: string;
}

export function verificarFirmaWebhook(
  rawBody: Buffer,
  firmaRecibida: string | undefined,
  secreto: string,
): void {
  if (!firmaRecibida || !secreto) {
    throw new ForbiddenError({
      detail: 'Callback de Refirma no autenticado.',
    });
  }

  const esperada = createHmac('sha256', secreto)
    .update(rawBody)
    .digest('hex');

  const recibida = firmaRecibida.replace(/^sha256=/i, '').toLowerCase();

  if (
    !/^[a-f0-9]{64}$/.test(recibida) ||
    recibida.length !== esperada.length ||
    !timingSafeEqual(Buffer.from(recibida), Buffer.from(esperada))
  ) {
    throw new ForbiddenError({
      detail: 'La firma del callback de Refirma es inválida.',
    });
  }
}

/**
 * Guarda la evidencia de firma devuelta por Refirma.
 * Esta función debe invocarse dentro de una transacción.
 */
export async function registrarCallbackRefirma(
  cliente: PoolClient,
  datos: CallbackRefirma,
): Promise<string> {
  if (
    !/^[0-9a-fA-F]{64}$/.test(datos.sha256_firmado) ||
    !datos.firmante.trim() ||
    !datos.s3_bucket.trim() ||
    !datos.s3_key.trim() ||
    Number.isNaN(Date.parse(datos.fecha_sello_tsa))
  ) {
    throw new Error('Los datos recibidos desde Refirma son inválidos.');
  }

  const documento = await cliente.query<{ id_documento_adjunto: string }>(
    `SELECT id_documento_adjunto
       FROM sigd_doc.documento_adjunto
      WHERE id_documento_adjunto = $1
      FOR UPDATE`,
    [datos.documento_id],
  );

  if (documento.rowCount !== 1) {
    throw new NotFoundError({
      detail: 'El documento a firmar no existe.',
    });
  }

  const resultado = await cliente.query<{ cvd: string }>(
    `INSERT INTO sigd_doc.firma_digital_documento
      (
        documento_id,
        sha256_firmado,
        firmante,
        fecha_sello_tsa,
        s3_bucket,
        s3_key,
        estado
      )
     VALUES ($1, $2, $3, $4, $5, $6, 'FIRMADO_DIGITALMENTE')
     ON CONFLICT (documento_id) DO UPDATE SET
       sha256_firmado = EXCLUDED.sha256_firmado,
       firmante = EXCLUDED.firmante,
       fecha_sello_tsa = EXCLUDED.fecha_sello_tsa,
       s3_bucket = EXCLUDED.s3_bucket,
       s3_key = EXCLUDED.s3_key,
       estado = EXCLUDED.estado
     RETURNING cvd`,
    [
      datos.documento_id,
      datos.sha256_firmado.toLowerCase(),
      datos.firmante.trim(),
      datos.fecha_sello_tsa,
      datos.s3_bucket.trim(),
      datos.s3_key.trim(),
    ],
  );

  return resultado.rows[0].cvd;
}