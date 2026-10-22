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
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned } from './s3-storage.service.js';
import { ValidationError, UnauthorizedError, ForbiddenError, NotFoundError } from '../../shared/domain/errors/index.js';
import { extraerTokenBearer, verificarTokenAcceso, type ClaimsJwt } from '../auth/jwt.service.js';

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
    idExpediente: z.string().uuid().optional(),
  }),
);

const confirmarInputSchema = z.object({
  s3Key: z.string().min(3),
  sha256Hash: z.string().length(64).regex(/^[a-fA-F0-9]{64}$/),
  idExpediente: z.string().uuid().optional(),
});

function autenticarActorStorage(req: Request): ClaimsJwt {
  const token = extraerTokenBearer(req.get('authorization'));
  if (!token) {
    throw new UnauthorizedError({ detail: 'Autenticación requerida para acceder al almacenamiento.' });
  }
  try {
    return verificarTokenAcceso(token);
  } catch {
    throw new UnauthorizedError({ detail: 'Token de acceso inválido o expirado.' });
  }
}

async function validarAccesoExpediente(
  pool: Pool | undefined,
  usuarioId: string,
  roles: string[],
  idExpediente: string,
): Promise<boolean> {
  if (roles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'MESA_PARTES'].includes(r))) {
    return true;
  }
  if (!pool) return true;

  try {
    const resUser = await pool.query<{ id_persona: string | null; area_id: string | null }>(
      `SELECT u.id_persona::text AS id_persona, p.area_id::text AS area_id
         FROM sigd_auth.cuenta_usuario u
    LEFT JOIN sigd_auth.perfil_usuario p ON p.id_usuario = u.id_usuario
        WHERE u.id_usuario = $1`,
      [usuarioId],
    );
    const idPersona = resUser.rows[0]?.id_persona;
    const areaId = resUser.rows[0]?.area_id;

    const resExp = await pool.query<{ solicitante_id: string | null; area_destino_id: string | null }>(
      `SELECT solicitante_id::text AS solicitante_id, area_destino_id::text AS area_destino_id
         FROM sigd_tra.expediente
        WHERE expediente_id = $1::uuid`,
      [idExpediente],
    );

    if (resExp.rows.length === 0) return false;
    const exp = resExp.rows[0];

    if (idPersona && exp.solicitante_id === idPersona) return true;
    if (areaId && exp.area_destino_id === areaId) return true;

    return false;
  } catch {
    return false;
  }
}

export function crearRouterStorage(pool?: Pool, s3Client?: S3Client): Router {
  const router = Router();
  const config = obtenerConfiguracionS3();

  // #18 — POST /storage/presigned-url
  router.post('/storage/presigned-url', async (req: Request, res: Response) => {
    const claims = autenticarActorStorage(req);
    const datos = presignedInputSchema.parse(req.body);

    if (datos.idExpediente) {
      const autorizado = await validarAccesoExpediente(
        pool,
        claims.sub,
        claims.roles ?? [],
        datos.idExpediente,
      );
      if (!autorizado) {
        throw new ForbiddenError({ detail: 'No tiene autorización para cargar documentos en este expediente.' });
      }
    }

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
    const claims = autenticarActorStorage(req);
    const datos = confirmarInputSchema.parse(req.body);

    if (datos.idExpediente) {
      const autorizado = await validarAccesoExpediente(
        pool,
        claims.sub,
        claims.roles ?? [],
        datos.idExpediente,
      );
      if (!autorizado) {
        throw new ForbiddenError({ detail: 'No tiene autorización sobre el expediente indicado.' });
      }
    }

    // SEC-02: Verificación criptográfica y estructural real del objeto en S3 antes de persistir
    const s3 = s3Client ?? new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: config.forcePathStyle,
    });

    let s3Objeto;
    try {
      s3Objeto = await s3.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: datos.s3Key,
        }),
      );
    } catch (err: any) {
      if (err?.name === 'NoSuchKey' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
        throw new NotFoundError({
          detail: `El archivo ${datos.s3Key} no existe en el almacenamiento institucional. Debe cargarlo previamente mediante la URL prefirmada.`,
        });
      }
      throw err;
    }

    if (!s3Objeto.Body) {
      throw new ValidationError({
        message: 'No se pudo leer el cuerpo del archivo en el almacenamiento.',
        invalidParams: [{ name: 's3Key', reason: 'El objeto en S3 se encuentra vacío o inaccesible.' }],
      });
    }

    const stream = s3Objeto.Body as any;
    const hasher = crypto.createHash('sha256');
    let totalBytes = 0;
    let primerChunk: Buffer | null = null;

    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (!primerChunk) {
        primerChunk = buf;
      }
      totalBytes += buf.length;
      if (totalBytes > 25 * 1024 * 1024) {
        throw new ValidationError({
          message: 'El archivo excede el tamaño máximo permitido de 25 MB.',
          invalidParams: [
            {
              name: 'tamanoBytes',
              reason: `El tamaño real (${totalBytes} bytes) supera el límite de 26214400 bytes.`,
            },
          ],
        });
      }
      hasher.update(buf);
    }

    if (!primerChunk || primerChunk.length < 5 || !primerChunk.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new ValidationError({
        message: 'El archivo cargado no es un documento PDF válido.',
        invalidParams: [
          {
            name: 'mimeType',
            reason: 'Los primeros bytes no coinciden con la firma mágica %PDF- (prevención de polyglots).',
          },
        ],
      });
    }

    const hashCalculado = hasher.digest('hex').toLowerCase();
    if (hashCalculado !== datos.sha256Hash.toLowerCase()) {
      throw new ValidationError({
        message: 'Discrepancia en la integridad criptográfica del documento cargado.',
        invalidParams: [
          {
            name: 'sha256Hash',
            reason: `El hash calculado del archivo en S3 (${hashCalculado}) no coincide con el declarado por el cliente (${datos.sha256Hash.toLowerCase()}).`,
          },
        ],
      });
    }

    const idAdjunto = crypto.randomUUID();

    if (pool) {
      // Registrar en sigd_doc.documento_adjunto. Si la base de datos falla, el error
      // debe propagarse hacia el middleware de errores RFC 7807/9457 sin responder 201 Created.
      await pool.query(
        `INSERT INTO sigd_doc.documento_adjunto
           (id_documento_adjunto, s3_bucket, s3_key, sha256_hash, creado_en)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT DO NOTHING;`,
        [idAdjunto, config.bucket, datos.s3Key, datos.sha256Hash.toLowerCase()],
      );
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
    const claims = autenticarActorStorage(req);
    const bucket = Array.isArray(req.params.bucket) ? req.params.bucket[0] : req.params.bucket;
    const rawKey = req.params.key;
    const key = Array.isArray(rawKey) ? rawKey.join('/') : rawKey;

    if (!bucket || !key) {
      throw new ValidationError({
        invalidParams: [{ name: 'key', reason: 'Bucket y clave requeridos' }],
      });
    }

    // Validación de bucket institucional (impedir buckets arbitrarios)
    if (bucket !== config.bucket) {
      throw new ValidationError({
        invalidParams: [
          {
            name: 'bucket',
            reason: `El bucket solicitado '${bucket}' no está autorizado. Use el bucket institucional configurado.`,
          },
        ],
      });
    }

    // Validar autorización del actor sobre el documento
    if (pool && !claims.roles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'MESA_PARTES'].includes(r))) {
      try {
        const resDoc = await pool.query<{ solicitante_id: string | null }>(
          `SELECT e.solicitante_id::text AS solicitante_id
             FROM sigd_doc.documento_adjunto da
             JOIN sigd_tra.expediente e ON e.expediente_id = da.expediente_id
            WHERE da.s3_key = $1`,
          [key],
        );
        if (resDoc.rows.length > 0) {
          const doc = resDoc.rows[0];
          const resUser = await pool.query<{ id_persona: string | null }>(
            `SELECT id_persona::text AS id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1`,
            [claims.sub],
          );
          const idPersona = resUser.rows[0]?.id_persona;
          if (!idPersona || doc.solicitante_id !== idPersona) {
            throw new ForbiddenError({ detail: 'No tiene permisos para descargar documentos de este expediente.' });
          }
        }
      } catch (err) {
        if (err instanceof ForbiddenError) throw err;
      }
    }

    const configBucket = { ...config, bucket: config.bucket };
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
