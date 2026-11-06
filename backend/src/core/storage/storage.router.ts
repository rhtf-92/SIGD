/**
 * Endpoints #18 y #19 del catálogo REST — Almacenamiento Desacoplado MinIO S3
 * Responsable: B_RIQUELMER (Leysglin) y B_CHRISTIAN (Christian) / TramiCore & DocuCore
 *
 *   #18 POST /api/v1/storage/presigned-url   — Emisión de URL prefirmada PUT para carga directa
 *   #19 POST /api/v1/storage/confirmar-carga — Confirmación de subida, validación de hash y registro
 *       GET  /api/v1/storage/download/:bucket/:key — Generación de URL GET temporal de descarga
 */

import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned, headObject } from './s3-storage.service.js';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../shared/domain/errors/index.js';
import { autenticarJwt } from '../auth/auth.guard.js';
import { verificarAccesoExpediente } from '../../domains/docucore/docucore.security.js';

const presignedInputSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      return {
        ...val,
        sha256Hash: val.sha256Hash ?? val.checksumSha256,
      };
    }
    return val;
  },
  z.object({
    idExpediente: z.string().uuid(),
    nombreArchivo: z.string().min(1).max(255),
    tamanoBytes: z.number().int().positive().max(26_214_400), // Máximo 25 MB
    mimeType: z.literal('application/pdf'),
    sha256Hash: z.string().length(64).regex(/^[a-fA-F0-9]{64}$/),
  }),
);

const confirmarInputSchema = z.object({
  idExpediente: z.string().uuid(),
  tipoDocumentalId: z.string().uuid(),
  nombreArchivo: z.string().min(1).max(255),
  tamanoBytes: z.number().int().positive().max(26_214_400),
  s3Key: z.string().min(3),
  sha256Hash: z.string().length(64).regex(/^[a-fA-F0-9]{64}$/),
});

export function crearRouterStorage(pool: Pool): Router {
  const router = Router();
  const config = obtenerConfiguracionS3();
  router.use('/storage', autenticarJwt);
  const usuarioAutenticado = (req: Request): string => {
    const usuarioId = req.cuentaActual?.idUsuario;
    if (!usuarioId) throw new UnauthorizedError({ detail: 'Autenticación requerida.' });
    return usuarioId;
  };

  // #18 — POST /storage/presigned-url
  router.post('/storage/presigned-url', async (req: Request, res: Response) => {
    const datos = presignedInputSchema.parse(req.body);
    await verificarAccesoExpediente(pool, usuarioAutenticado(req), datos.idExpediente);
    const uuid = crypto.randomUUID();
    const s3Key = `expedientes/${datos.idExpediente}/${uuid}.pdf`;

    const uploadUrl = generarUrlPresigned(s3Key, config, {
      metodo: 'PUT',
      contentType: datos.mimeType,
      expiraSegundos: config.presignExpirationSegundos,
    });

    res.status(200).json({
      uploadUrl,
      s3Key,
      expiraEnSegundos: config.presignExpirationSegundos,
      expiresIn: config.presignExpirationSegundos,
    });
  });

  // #19 — POST /storage/confirmar-carga
  router.post('/storage/confirmar-carga', async (req: Request, res: Response) => {
    const datos = confirmarInputSchema.parse(req.body);
    const usuarioId = usuarioAutenticado(req);
    await verificarAccesoExpediente(pool, usuarioId, datos.idExpediente);
    if (!new RegExp(
      `^expedientes/${datos.idExpediente}/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\\.pdf$`,
      'i',
    ).test(datos.s3Key)) {
      throw new ValidationError({
        invalidParams: [{ name: 's3Key', reason: 'La clave no pertenece al expediente autorizado.' }],
      });
    }

    const objeto = await headObject(datos.s3Key, config);
    if (!objeto.existe) throw new NotFoundError({ detail: 'No se encontró el archivo en el almacenamiento.' });
    if (objeto.contentType !== 'application/pdf' || objeto.contentLength !== datos.tamanoBytes) {
      throw new ValidationError({
        invalidParams: [{ name: 'archivo', reason: 'El tipo o tamaño del objeto no coincide con los datos validados.' }],
      });
    }

    const insertado = await pool.query<{ documento_adjunto_id: string }>(
      `INSERT INTO sigd_doc.documento_adjunto
         (expediente_id, tipo_documental_id, nombre_archivo, s3_bucket, s3_key,
          sha256, tamano_bytes, mime_type, subido_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'application/pdf', $8)
       ON CONFLICT DO NOTHING
       RETURNING documento_adjunto_id`,
      [
        datos.idExpediente,
        datos.tipoDocumentalId,
        datos.nombreArchivo,
        config.bucket,
        datos.s3Key,
        datos.sha256Hash.toLowerCase(),
        datos.tamanoBytes,
        usuarioId,
      ],
    );
    let idAdjunto = insertado.rows[0]?.documento_adjunto_id;
    if (!idAdjunto) {
      const existente = await pool.query<{ documento_adjunto_id: string }>(
        `SELECT documento_adjunto_id
           FROM sigd_doc.documento_adjunto
          WHERE expediente_id = $1
            AND s3_bucket = $2
            AND s3_key = $3
            AND sha256 = $4`,
        [datos.idExpediente, config.bucket, datos.s3Key, datos.sha256Hash.toLowerCase()],
      );
      idAdjunto = existente.rows[0]?.documento_adjunto_id;
      if (!idAdjunto) {
        throw new ConflictError({
          detail: 'El archivo ya está registrado con metadatos incompatibles.',
        });
      }
    }

    res.status(201).json({
      idDocumentoAdjunto: idAdjunto,
      s3Key: datos.s3Key,
      confirmado: true,
      mensaje: 'Documento PDF verificado y registrado en el almacenamiento institucional.',
    });
  });

  // GET /storage/download/:bucket/:key
  router.get('/storage/download/:bucket/:key', async (req: Request, res: Response) => {
    const bucket = Array.isArray(req.params.bucket) ? req.params.bucket[0] : req.params.bucket;
    const rawKey = req.params.key;
    const key = Array.isArray(rawKey) ? rawKey.join('/') : rawKey;

    if (!bucket || !key) {
      throw new ValidationError({
        invalidParams: [{ name: 'key', reason: 'Bucket y clave requeridos' }],
      });
    }

    if (bucket !== config.bucket) {
      throw new NotFoundError({ detail: 'El archivo solicitado no existe.' });
    }
    const adjunto = await pool.query<{ expediente_id: string }>(
      `SELECT expediente_id
         FROM sigd_doc.documento_adjunto
        WHERE s3_bucket = $1 AND s3_key = $2`,
      [bucket, key],
    );
    const expedienteId = adjunto.rows[0]?.expediente_id;
    if (!expedienteId) throw new NotFoundError({ detail: 'El archivo solicitado no existe.' });

    // SEC-02: no se emite una URL física hasta comprobar el JWT y el acceso vigente.
    await verificarAccesoExpediente(pool, usuarioAutenticado(req), expedienteId);
    const downloadUrl = generarUrlPresigned(key, config, {
      metodo: 'GET',
      expiraSegundos: 900,
    });

    res.status(200).json({ downloadUrl, expiraEnSegundos: 900 });
  });

  return router;
}

export default crearRouterStorage;
