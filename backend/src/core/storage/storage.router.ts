import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import express, { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned, validarMagicBytes } from './s3-storage.service.js';
import { ValidationError, NotFoundError } from '../../shared/domain/errors/index.js';
import { resolverIdentidad } from '../auth/auth.guard.js';
import { AppError } from '../../shared/domain/errors/index.js';

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
    tamanoBytes: z.number().int().positive().max(26_214_400),
    mimeType: z.literal('application/pdf'),
    sha256Hash: z.string().length(64).regex(/^[a-fA-F0-9]{64}$/),
  }),
);

const confirmarInputSchema = z.object({
  s3Key: z.string().min(3),
  sha256Hash: z.string().length(64).regex(/^[a-fA-F0-9]{64}$/),
  expedienteId: z.string().uuid(),
  tipoDocumentalId: z.string().uuid(),
  nombreArchivo: z.string().min(1).max(255),
  tamanoBytes: z.number().int().positive(),
  mimeType: z.string().min(1).max(120),
});

const CLAVE_UPLOAD_LOCAL = /^expedientes\/\d{4}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;
const DIRECTORIO_UPLOADS = path.resolve(process.cwd(), 'uploads');

export function crearRouterStorage(pool?: Pool): Router {
  const router = Router();
  const config = obtenerConfiguracionS3();

  router.post('/storage/presigned-url', (req: Request, res: Response) => {
    resolverIdentidad(req);
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

  router.put(
    '/storage/upload-binario',
    express.raw({ type: '*/*', limit: '26mb' }),
    async (req: Request, res: Response) => {
      resolverIdentidad(req);
      const s3Key = typeof req.query.s3Key === 'string' ? req.query.s3Key : '';
      const sha256Hash = req.get('x-sha256') ?? '';

      if (!CLAVE_UPLOAD_LOCAL.test(s3Key)) {
        throw new ValidationError({
          invalidParams: [{ name: 's3Key', reason: 'CLAVE_UPLOAD_INVALIDA.' }],
        });
      }
      if (!/^[0-9a-f]{64}$/i.test(sha256Hash)) {
        throw new ValidationError({
          invalidParams: [{ name: 'sha256Hash', reason: 'HASH_SHA256_INVALIDO.' }],
        });
      }

      const contenido = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!validarMagicBytes(contenido, 'PDF')) {
        throw new ValidationError({
          invalidParams: [{ name: 'archivo', reason: 'PDF_INVALIDO.' }],
        });
      }

      const calculado = crypto.createHash('sha256').update(contenido).digest('hex').toLowerCase();
      if (calculado !== sha256Hash.toLowerCase()) {
        throw new ValidationError({
          invalidParams: [{ name: 'sha256Hash', reason: 'HASH_NO_COINCIDE_CON_PDF.' }],
        });
      }

      const destino = path.join(DIRECTORIO_UPLOADS, ...s3Key.split('/'));
      await fs.mkdir(path.dirname(destino), { recursive: true });
      await fs.writeFile(destino, contenido);

      res.status(201).json({
        s3Key,
        bucket: 'local',
        confirmado: true,
        sha256Hash: calculado,
      });
    },
  );

  router.post('/storage/confirmar-carga', async (req: Request, res: Response) => {
    const identidad = resolverIdentidad(req);
    const datos = confirmarInputSchema.parse(req.body);

    if (!pool) {
      throw new AppError({
        status: 500,
        code: 'STORAGE_POOL_NO_DISPONIBLE',
        message: 'No se puede registrar el adjunto sin conexión a base de datos.',
      });
    }

    const idAdjunto = crypto.randomUUID();
    await pool.query(
      `INSERT INTO sigd_doc.documento_adjunto
         (documento_adjunto_id, expediente_id, tipo_documental_id, nombre_archivo, s3_bucket, s3_key, sha256, tamano_bytes, mime_type, subido_por, creado_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
       ON CONFLICT DO NOTHING;`,
      [
        idAdjunto,
        datos.expedienteId,
        datos.tipoDocumentalId,
        datos.nombreArchivo,
        config.bucket,
        datos.s3Key,
        datos.sha256Hash.toLowerCase(),
        datos.tamanoBytes,
        datos.mimeType,
        identidad.idUsuario,
      ],
    );

    res.status(201).json({
      idDocumentoAdjunto: idAdjunto,
      s3Key: datos.s3Key,
      confirmado: true,
      mensaje: 'Documento PDF verificado y registrado en el almacenamiento institucional.',
    });
  });

  router.get('/storage/download/:bucket/:key', (req: Request, res: Response) => {
    resolverIdentidad(req);
    const bucket = Array.isArray(req.params.bucket) ? req.params.bucket[0] : req.params.bucket;
    const rawKey = req.params.key;
    const key = Array.isArray(rawKey) ? rawKey.join('/') : rawKey;

    if (!bucket || !key) {
      throw new ValidationError({
        invalidParams: [{ name: 'key', reason: 'Bucket y clave requeridos' }],
      });
    }

    const bucketsPermitidos = [config.bucket].filter(Boolean);
    if (!bucketsPermitidos.includes(bucket)) {
      throw new AppError({
        status: 400,
        code: 'BUCKET_NO_PERMITIDO',
        message: 'Bucket no permitido.',
        detail: `El bucket '${bucket}' no está permitido por configuración.`,
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
