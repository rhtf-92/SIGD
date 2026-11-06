import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/domain/errors/index.js';

export interface CallbackRefirma {
  documento_id: string;
  resolucion_id: string;
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

  const documento = await cliente.query<{
    documento_adjunto_id: string;
    expediente_id: string;
    sha256: string;
    s3_bucket: string;
    s3_key: string;
  }>(
    `SELECT documento_adjunto_id, expediente_id, sha256, s3_bucket, s3_key
       FROM sigd_doc.documento_adjunto
      WHERE documento_adjunto_id = $1
      FOR UPDATE`,
    [datos.documento_id],
  );

  const adjunto = documento.rows[0];
  if (!adjunto) {
    throw new NotFoundError({
      detail: 'El documento a firmar no existe.',
    });
  }

  if (
    datos.sha256_firmado.toLowerCase() === adjunto.sha256.toLowerCase() ||
    (datos.s3_bucket === adjunto.s3_bucket && datos.s3_key === adjunto.s3_key)
  ) {
    throw new ConflictError({
      code: 'INTEGRIDAD_FIRMA_INVALIDA',
      detail: 'El archivo firmado debe tener bytes y ubicación distintos del documento original.',
    });
  }

  const resoluciones = await cliente.query<{ resolucion_id: string }>(
    `SELECT resolucion_id
       FROM sigd_doc.resolucion
      WHERE resolucion_id = $1
        AND expediente_id = $2
        AND estado = 'EN_FIRMA'
      FOR UPDATE`,
    [datos.resolucion_id, adjunto.expediente_id],
  );
  if (resoluciones.rowCount !== 1) {
    throw new ConflictError({
      code: 'RESOLUCION_NO_FIRMABLE',
      detail: 'La resolución indicada no pertenece al expediente o no está en estado EN_FIRMA.',
    });
  }

  const firmaExistente = await cliente.query(
    `SELECT 1
       FROM sigd_doc.firma_digital_documento
      WHERE documento_id = $1`,
    [datos.documento_id],
  );
  if (firmaExistente.rowCount !== 0) {
    throw new ConflictError({
      code: 'DOCUMENTO_YA_FIRMADO',
      detail: 'El documento ya cuenta con evidencia de firma digital.',
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

  const actualizacion = await cliente.query(
    `UPDATE sigd_doc.resolucion
        SET estado = 'FIRMADA',
            firmado_en = $2,
            hash_pades = $3
      WHERE resolucion_id = $1
        AND estado = 'EN_FIRMA'`,
    [resoluciones.rows[0].resolucion_id, datos.fecha_sello_tsa, datos.sha256_firmado.toLowerCase()],
  );
  if (actualizacion.rowCount !== 1) {
    throw new ConflictError({
      code: 'RESOLUCION_ESTADO_CAMBIADO',
      detail: 'La resolución dejó de estar en estado EN_FIRMA durante el callback.',
    });
  }

  return resultado.rows[0].cvd;
}