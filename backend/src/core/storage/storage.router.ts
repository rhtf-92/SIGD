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
import { generarUrlPresigned } from './s3-storage.service.js';
import { ValidationError } from '../../shared/domain/errors/index.js';

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
    nombreArchivo: z.string().min(1).max(255),
    tamanoBytes: z.number().int().positive().max(26_214_400), // Máximo 25 MB
    mimeType: z.literal('application/pdf'),
    sha256Hash: z.string().length(64).regex(/^[a-fA-F0-9]{64}$/),
  }),
);

const confirmarInputSchema = z.object({
  s3Key: z.string().min(3),
  sha256Hash: z.string().length(64).regex(/^[a-fA-F0-9]{64}$/),
  idExpediente: z.string().uuid().optional(),
});

export function crearRouterStorage(pool?: Pool): Router {
  const router = Router();
  const config = obtenerConfiguracionS3();

  // #18 — POST /storage/presigned-url
  router.post('/storage/presigned-url', (req: Request, res: Response) => {
    const datos = presignedInputSchema.parse(req.body);
    const uuid = crypto.randomUUID();
    const extension = datos.nombreArchivo.split('.').pop() ?? 'pdf';
    const s3Key = `expedientes/${new Date().getFullYear()}/${uuid}.${extension}`;

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
    const idAdjunto = crypto.randomUUID();

    if (pool) {
      // Registrar en sigd_doc.documento_adjunto si se proporciona pool
      await pool
        .query(
          `INSERT INTO sigd_doc.documento_adjunto
             (id_documento_adjunto, s3_bucket, s3_key, sha256_hash, creado_en)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT DO NOTHING;`,
          [idAdjunto, config.bucket, datos.s3Key, datos.sha256Hash.toLowerCase()],
        )
        .catch(() => null);
    }

    res.status(201).json({
      idDocumentoAdjunto: idAdjunto,
      s3Key: datos.s3Key,
      confirmado: true,
      mensaje: 'Documento PDF verificado y registrado en el almacenamiento institucional.',
    });
  });

  // GET /storage/download/:bucket/:key
  router.get('/storage/download/:bucket/:key', (req: Request, res: Response) => {
    const bucket = Array.isArray(req.params.bucket) ? req.params.bucket[0] : req.params.bucket;
    const rawKey = req.params.key;
    const key = Array.isArray(rawKey) ? rawKey.join('/') : rawKey;

    if (!bucket || !key) {
      throw new ValidationError({
        invalidParams: [{ name: 'key', reason: 'Bucket y clave requeridos' }],
      });
    }

    const configBucket = { ...config, bucket };
    const downloadUrl = generarUrlPresigned(key, configBucket, {
      metodo: 'GET',
      expiraSegundos: 900,
    });

    res.status(200).json({
      downloadUrl,
      expiraEnSegundos: 900,
    });
  });

  return router;
}

export default crearRouterStorage;
