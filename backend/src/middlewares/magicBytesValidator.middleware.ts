import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../shared/domain/errors/index.js';

const MAGIC_BYTES_PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
const MIN_BUFFER_LENGTH = 5;

/**
 * Middleware validador de Magic Bytes para PDF.
 *
 * CONTRATO DE ENTRADA:
 * - Debe colocarse DESPUES del parser que materializa el archivo, y ANTES de
 *   cualquier handler de negocio.
 * - Requiere que el body parser exponga el buffer crudo del archivo en req.body.
 * - Si se usa express.raw({ type: 'application/pdf' }) o similar, req.body será Buffer.
 * - Con multipart/form-data: multer NO deposita el archivo en req.body sino en
 *   req.file/req.files. Por tanto este middleware solo puede validar multipart
 *   si el body es un Buffer; si no lo es, el archivo no fue extraido y el
 *   middleware RECHAZA en lugar de aprobar la peticion sin revisar.
 *
 * COMPORTAMIENTO:
 * - Content-Types que no transportan archivo (application/json, etc.): pasa sin validar.
 * - Content-Type gestionado (multipart/form-data, application/octet-stream,
 *   application/pdf) SIN buffer en req.body: rechaza 415 MAGIC_BYTES_UNAVAILABLE.
 *   No se aprueba silenciosamente una peticion que declara un archivo y no lo entrega.
 * - Buffer presente: valida los 5 primeros bytes == %PDF- (0x25 0x50 0x44 0x46 0x2d).
 * - Buffer < 5 bytes: rechaza 415 MAGIC_BYTES_INVALID.
 * - Magic bytes no coinciden: rechaza 415 MAGIC_BYTES_MISMATCH.
 *
 * LIMITACIÓN:
 * Solo valida la firma binaria. Un archivo con %PDF- válido pero estructura PDF inválida
 * o contenido malicioso incrustado PASARÁ esta validación. Es una primera barrera,
 * no un validador estructural/antimalware completo.
 */
export function magicBytesValidator(req: Request, _res: Response, next: NextFunction): void {
  const contentType = req.get('content-type') ?? '';
  const isMultipart = contentType.startsWith('multipart/form-data');
  const isOctetStream = contentType === 'application/octet-stream';
  const isPdf = contentType === 'application/pdf';

  if (!isMultipart && !isOctetStream && !isPdf) {
    return next();
  }

  const buffer = req.body as Buffer | undefined;

  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new AppError({
      status: 415,
      code: 'MAGIC_BYTES_UNAVAILABLE',
      message:
        'La peticion declara un archivo pero el cuerpo no contiene un buffer legible. ' +
        'No se puede validar la firma binaria, por lo que la peticion no se aprueba.',
      invalidParams: [{ name: 'file', reason: 'MAGIC_BYTES_UNAVAILABLE: buffer de archivo ausente o no extraido.' }],
    });
  }

  if (buffer.length < MIN_BUFFER_LENGTH) {
    throw new AppError({
      status: 415,
      code: 'MAGIC_BYTES_INVALID',
      message: 'El archivo no contiene suficientes bytes para validar la firma binaria.',
    });
  }

  const header = buffer.subarray(0, MIN_BUFFER_LENGTH);

  if (!header.equals(MAGIC_BYTES_PDF)) {
    throw new AppError({
      status: 415,
      code: 'MAGIC_BYTES_MISMATCH',
      message: 'El archivo no es un PDF válido. Se esperaba la firma binaria %PDF-.',
      invalidParams: [{ name: 'file', reason: 'MAGIC_BYTES_MISMATCH: firma binaria no corresponde a PDF.' }],
    });
  }

  next();
}