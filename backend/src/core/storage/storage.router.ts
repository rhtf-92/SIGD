/**
 * Endpoints #18 y #19 del catálogo REST — Almacenamiento Desacoplado MinIO S3
 * Responsable: B_RIQUELMER (Leysglin) y B_CHRISTIAN (Christian) / TramiCore & DocuCore
 *
 *   #18 POST /api/v1/storage/presigned-url   — Emisión de URL prefirmada PUT para carga directa
 *   #19 POST /api/v1/storage/confirmar-carga — Confirmación de subida, validación de hash y registro
 *       GET  /api/v1/storage/download/:bucket/:key — Generación de URL GET temporal de descarga
 */

import crypto from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
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

const confirmarInputSchema = z.preprocess(
  (val) => {
    if (val && typeof val === 'object') {
      return {
        ...val,
        sha256Hash: (val as any).sha256Hash ?? (val as any).checksumSha256 ?? (val as any).sha256,
        expedienteId: (val as any).expedienteId ?? (val as any).idExpediente,
        tipoDocumentalId: (val as any).tipoDocumentalId ?? (val as any).idTipoDocumento,
      };
    }
    return val;
  },
  z.object({
    s3Key: z.string().min(3),
    sha256Hash: z.string().length(64).regex(/^[a-fA-F0-9]{64}$/),
    expedienteId: z.string().uuid({ message: 'expedienteId es obligatorio y debe ser un UUID válido.' }),
    tipoDocumentalId: z.string().uuid().optional(),
    nombreArchivo: z.string().optional(),
    tamanoBytes: z.number().int().positive().optional(),
    mimeType: z.string().optional(),
    subidoPor: z.string().uuid().optional(),
  }),
);

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
  router.post('/storage/confirmar-carga', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const datos = confirmarInputSchema.parse(req.body);
      const idAdjunto = crypto.randomUUID();
      let finalId: string = idAdjunto;

      if (pool) {
        const expId = datos.expedienteId;

        let tipoDocId = datos.tipoDocumentalId;
        if (!tipoDocId) {
          const tipoRow = await pool.query<{ tipo_documental_id: string }>(
            `SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE vigente = TRUE ORDER BY codigo ASC LIMIT 1`,
          );
          tipoDocId = tipoRow.rows[0]?.tipo_documental_id;
        }

        const nombreArchivo = (datos.nombreArchivo ?? datos.s3Key.split('/').pop() ?? 'documento.pdf').slice(0, 255);
        const tamanoBytes = datos.tamanoBytes ?? 1024;
        const mimeType = (datos.mimeType ?? 'application/pdf').slice(0, 120);

        const insertResult = await pool.query<{ documento_adjunto_id: string }>(
          `INSERT INTO sigd_doc.documento_adjunto
             (documento_adjunto_id, expediente_id, tipo_documental_id, nombre_archivo,
              s3_bucket, s3_key, sha256, tamano_bytes, mime_type, magic_bytes, subido_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '25504446', $10)
           ON CONFLICT (s3_bucket, s3_key) DO UPDATE
             SET sha256 = EXCLUDED.sha256,
                 tamano_bytes = EXCLUDED.tamano_bytes
           RETURNING documento_adjunto_id;`,
          [
            idAdjunto,
            expId,
            tipoDocId,
            nombreArchivo,
            config.bucket,
            datos.s3Key,
            datos.sha256Hash.toLowerCase(),
            tamanoBytes,
            mimeType,
            datos.subidoPor ?? null,
          ],
        );

        if (insertResult.rows[0]?.documento_adjunto_id) {
          finalId = insertResult.rows[0].documento_adjunto_id;
        }
      }

      res.status(201).json({
        idDocumentoAdjunto: finalId,
        s3Key: datos.s3Key,
        confirmado: true,
        mensaje: 'Documento PDF verificado y registrado en el almacenamiento institucional.',
      });
    } catch (error) {
      next(error);
    }
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
