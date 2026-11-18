/**
 * Endpoints #18 y #19 del catálogo REST — Almacenamiento Desacoplado MinIO S3
 * Responsable: B_RIQUELMER (Leysglin) y B_CHRISTIAN (Christian) / TramiCore & DocuCore
 *
 *   #18 POST /api/v1/storage/presigned-url   — Emisión de URL prefirmada PUT para carga directa (PDF, Word, Imágenes)
 *   #19 POST /api/v1/storage/confirmar-carga — Confirmación de subida y registro flexible
 *       GET  /api/v1/storage/download/:bucket/:key — Generación de URL GET temporal de descarga
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import {
  generarUrlPresigned,
  verificarMagicBytesPdfEnS3,
} from './s3-storage.service.js';
import { middlewareSubidaPdf, EXPEDIENTES_DIR, UPLOADS_ROOT_DIR } from './upload.middleware.js';
import { ValidationError } from '../../shared/domain/errors/index.js';

const MAX_FILE_BYTES_25MB = 25 * 1024 * 1024; // 26,214,400 bytes

export const ALLOWED_STORAGE_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/octet-stream',
] as const;

const presignedInputSchema = z.preprocess(
  (val: unknown) => {
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      return {
        ...obj,
        sha256Hash: obj.sha256Hash ?? obj.checksumSha256,
        mimeType:
          typeof obj.mimeType === 'string' && obj.mimeType.trim().length > 0
            ? obj.mimeType.trim().toLowerCase()
            : 'application/pdf',
      };
    }
    return val;
  },
  z.object({
    nombreArchivo: z
      .string()
      .trim()
      .min(1, 'El nombre del archivo es obligatorio.')
      .max(255, 'El nombre del archivo es demasiado largo.')
      .refine((v) => !/[\\/]/.test(v) && !v.includes('..'), 'Nombre de archivo no permitido.'),
    tamanoBytes: z
      .number()
      .int()
      .positive('El archivo seleccionado parece estar vacío.')
      .max(MAX_FILE_BYTES_25MB, 'Tu archivo supera el tamaño máximo permitido de 25 MB.'),
    mimeType: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine(
        (m) => (ALLOWED_STORAGE_MIME_TYPES as readonly string[]).includes(m.toLowerCase()),
        'Formato de archivo no compatible. Puedes adjuntar PDF, Word (.doc, .docx) o imágenes (.png, .jpg).',
      ),
    sha256Hash: z
      .string()
      .trim()
      .length(64)
      .regex(/^[a-fA-F0-9]{64}$/, 'El código de seguridad SHA-256 del archivo no es válido.'),
    categoria: z.string().trim().max(64).optional(),
    checksumSha256: z.string().optional(),
  }),
);

const confirmarInputSchema = z.object({
  s3Key: z
    .string()
    .trim()
    .min(3, 'La ruta del archivo es obligatoria.')
    .max(500, 'La ruta del archivo es demasiado larga.')
    .refine((v) => !v.includes('..') && !v.startsWith('/'), 'Ruta de archivo no válida.'),
  sha256Hash: z
    .string()
    .trim()
    .length(64)
    .regex(/^[a-fA-F0-9]{64}$/, 'El código de seguridad SHA-256 del archivo no es válido.'),
  idExpediente: z.string().uuid().optional(),
  nombreArchivo: z.string().trim().min(1).max(255).optional(),
  tamanoBytes: z.number().int().positive().max(MAX_FILE_BYTES_25MB).optional(),
  mimeType: z.string().trim().min(1).max(120).optional(),
});

export function crearRouterStorage(pool?: Pool): Router {
  const router = Router();
  const config = obtenerConfiguracionS3();

  // Endpoint de subida real directa en Express con Multer (Mesa de Partes Virtual y módulos SIGD)
  router.post('/storage/upload', middlewareSubidaPdf);
  router.post('/upload', middlewareSubidaPdf);

  // #18 — POST /storage/presigned-url
  router.post('/storage/presigned-url', (req: Request, res: Response) => {
    const datos = presignedInputSchema.parse(req.body);
    const uuid = crypto.randomUUID();
    const extension = datos.nombreArchivo.split('.').pop()?.toLowerCase() ?? 'pdf';
    const s3Key = `expedientes/${new Date().getFullYear()}/${uuid}.${extension}`;

    const endpointParaCliente = new URL(config.endpoint);
    const origen = req.get('origin');
    if (endpointParaCliente.hostname === 'minio' && origen) {
      try {
        const urlOrigen = new URL(origen);
        if (urlOrigen.hostname === 'localhost' || urlOrigen.hostname === '127.0.0.1') {
          endpointParaCliente.hostname = urlOrigen.hostname;
        }
      } catch {
        // Un Origin inválido no altera el endpoint S3 configurado.
      }
    }

    const uploadUrl = generarUrlPresigned(s3Key, {
      ...config,
      endpoint: endpointParaCliente.origin,
    }, {
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

  // Manejador PUT para subidas directas tipo streaming/raw hacia almacenamiento local
  router.put('/storage/upload-raw', (req: Request, res: Response) => {
    const rawKey = (req.query.key as string) || `expedientes/${new Date().getFullYear()}/${crypto.randomUUID()}.pdf`;
    const cleanKey = rawKey.replace(/^uploads\//, '').replace(/^\/+/, '');
    const anio = String(new Date().getFullYear());
    const folder = path.join(EXPEDIENTES_DIR, anio);
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    const destPath = path.join(UPLOADS_ROOT_DIR, cleanKey.startsWith('expedientes/') ? cleanKey : `expedientes/${cleanKey}`);
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const writeStream = fs.createWriteStream(destPath);
    req.pipe(writeStream);
    writeStream.on('finish', () => {
      res.status(200).json({ ok: true, s3Key: cleanKey });
    });
    writeStream.on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
  });

  // #19 — POST /storage/confirmar-carga
  router.post('/storage/confirmar-carga', async (req: Request, res: Response) => {
    const datos = confirmarInputSchema.parse(req.body);

    const verificacionS3 = await verificarMagicBytesPdfEnS3(datos.s3Key, config, {
      mimeType: datos.mimeType,
    });
    const idAdjunto = crypto.randomUUID();

    if (pool && datos.idExpediente) {
      const nombreDerivado =
        datos.nombreArchivo ?? datos.s3Key.split('/').pop() ?? 'documento.pdf';
      const tamano = datos.tamanoBytes ?? 1;
      const mime = datos.mimeType ?? 'application/pdf';

      await pool
        .query(
          `WITH td AS (
             SELECT tipo_documental_id
               FROM sigd_doc.tipo_documento
              WHERE vigente = TRUE
              ORDER BY codigo ASC
              LIMIT 1
           )
           INSERT INTO sigd_doc.documento_adjunto
             (documento_adjunto_id, expediente_id, tipo_documental_id, nombre_archivo,
              s3_bucket, s3_key, sha256, tamano_bytes, mime_type, magic_bytes, creado_en)
           SELECT $1::uuid, $2::uuid, td.tipo_documental_id, $3,
                  $4, $5, $6, $7, $8, $9, now()
             FROM td
           ON CONFLICT DO NOTHING;`,
          [
            idAdjunto,
            datos.idExpediente,
            nombreDerivado,
            config.bucket,
            datos.s3Key,
            datos.sha256Hash.toLowerCase(),
            tamano,
            mime,
            verificacionS3.magicBytesHex,
          ],
        )
        .catch(() => null);
    }

    res.status(201).json({
      idDocumentoAdjunto: idAdjunto,
      s3Key: datos.s3Key,
      magicBytesHex: verificacionS3.magicBytesHex,
      confirmado: true,
      mensaje: 'Tu documento ha sido verificado y adjuntado correctamente.',
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

    const endpointParaCliente = new URL(config.endpoint);
    const origen = req.get('origin');
    if (endpointParaCliente.hostname === 'minio' && origen) {
      try {
        const urlOrigen = new URL(origen);
        if (urlOrigen.hostname === 'localhost' || urlOrigen.hostname === '127.0.0.1') {
          endpointParaCliente.hostname = urlOrigen.hostname;
        }
      } catch {
        // Un Origin inválido no altera el endpoint S3 configurado.
      }
    }
    const configBucket = { ...config, bucket, endpoint: endpointParaCliente.origin };
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
