import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  ConflictError,
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
 * Cumple política WORM:
 * - Si ya existe firma con la misma evidencia (hash y almacenamiento) -> Retorno idempotente del CVD.
 * - Si ya existe firma con evidencia diferente -> Conflicto (prohibida la mutación).
 * - Si no existe -> Inserción limpia sin sentencias UPDATE.
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

  // 1. Verificación previa de firma existente para garantizar inmutabilidad WORM e idempotencia
  const firmaExistente = await cliente.query<{
    cvd: string;
    sha256_firmado: string;
    s3_bucket: string;
    s3_key: string;
  }>(
    `SELECT cvd, sha256_firmado, s3_bucket, s3_key
       FROM sigd_doc.firma_digital_documento
      WHERE documento_id = $1::uuid`,
    [datos.documento_id],
  );

  if (firmaExistente.rowCount && firmaExistente.rowCount > 0) {
    const reg = firmaExistente.rows[0];
    const shaIgual = reg.sha256_firmado.toLowerCase() === datos.sha256_firmado.toLowerCase();
    const storageIgual = reg.s3_bucket === datos.s3_bucket.trim() && reg.s3_key === datos.s3_key.trim();

    if (shaIgual && storageIgual) {
      // Misma evidencia exacta -> retorno idempotente sin ejecutar UPDATE (WORM compliant)
      return reg.cvd;
    }

    // Evidencia diferente -> intento de mutación sobre registro firmado protegido
    throw new ConflictError({
      code: 'EVIDENCIA_FIRMA_CONFLICTO',
      detail: 'El documento ya cuenta con una firma digital asentada con evidencia diferente. Modificación prohibida bajo política WORM.',
    });
  }

  // 2. Inserción canónica sin cláusula DO UPDATE para respetar el trigger WORM
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
     VALUES ($1::uuid, $2, $3, $4, $5, $6, 'FIRMADO_DIGITALMENTE')
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
