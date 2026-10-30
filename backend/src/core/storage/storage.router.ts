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
    origenExpediente: z.enum(['DOC', 'TRA']).default('DOC'),
  }),
);

const confirmarInputSchema = z.object({
  s3Key: z.string().min(3),
  sha256Hash: z.string().length(64).regex(/^[a-fA-F0-9]{64}$/),
  idExpediente: z.string().uuid({ message: 'idExpediente es obligatorio y debe ser un UUID válido.' }),
  tipoDocumentalId: z.string().uuid({ message: 'tipoDocumentalId es obligatorio y debe ser un UUID válido.' }),
  nombreArchivo: z.string().min(1).max(255).optional(),
  origenExpediente: z.enum(['DOC', 'TRA']).default('DOC'),
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
  origenExpediente: 'DOC' | 'TRA',
): Promise<boolean> {
  if (!pool) return false;

  try {
    const tabla = origenExpediente === 'TRA' ? 'sigd_tra.expediente' : 'sigd_doc.expediente';
    const columnaArea = origenExpediente === 'TRA' ? 'area_destino_id' : 'area_actual_id';
    const resExp = await pool.query<{ solicitante_id: string | null; area_actual_id: string | null }>(
      `SELECT solicitante_id::text AS solicitante_id, ${columnaArea}::text AS area_actual_id
         FROM ${tabla}
        WHERE expediente_id = $1::uuid`,
      [idExpediente],
    );

    if (resExp.rows.length === 0) return false;
    if (roles.some((r) => ['ADMINISTRADOR', 'DIRECTOR', 'MESA_PARTES'].includes(r.toUpperCase()))) {
      return true;
    }
    const resUser = await pool.query<{ id_persona: string | null; area_id: string | null }>(
      `SELECT u.id_persona::text AS id_persona, p.area_id::text AS area_id
         FROM sigd_auth.cuenta_usuario u
    LEFT JOIN sigd_auth.perfil_usuario p ON p.id_usuario = u.id_usuario
        WHERE u.id_usuario = $1`,
      [usuarioId],
    );
    const idPersona = resUser.rows[0]?.id_persona;
    const areaId = resUser.rows[0]?.area_id;
    const exp = resExp.rows[0];

    if (idPersona && exp.solicitante_id === idPersona) return true;
    if (areaId && exp.area_actual_id === areaId) return true;

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
        datos.origenExpediente,
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

    if (!pool) {
      throw new ForbiddenError({
        detail: 'No es posible registrar ni verificar el almacenamiento sin conexión a la base de datos.',
      });
    }

    // La tabla padre se elige de forma explícita: el mismo UUID puede existir en DOC y TRA.
    const tablaExpediente = datos.origenExpediente === 'TRA' ? 'sigd_tra.expediente' : 'sigd_doc.expediente';
    const resExpediente = await pool.query<{ expediente_id: string }>(
      `SELECT expediente_id::text AS expediente_id
         FROM ${tablaExpediente}
        WHERE expediente_id = $1::uuid;`,
      [datos.idExpediente],
    );
    if (resExpediente.rows.length === 0) {
      throw new NotFoundError({
        detail: `El expediente ${datos.idExpediente} no existe en el registro institucional.`,
      });
    }

    const autorizado = await validarAccesoExpediente(
      pool,
      claims.sub,
      claims.roles ?? [],
      datos.idExpediente,
      datos.origenExpediente,
    );
    if (!autorizado) {
      throw new ForbiddenError({ detail: 'No tiene autorización sobre el expediente indicado.' });
    }

    // N-04: Validar existencia y vigencia de tipo documental en sigd_doc.tipo_documento (FK obligatoria)
    const resTipo = await pool.query<{ tipo_documental_id: string; vigente: boolean }>(
      `SELECT tipo_documental_id::text AS tipo_documental_id, vigente
         FROM sigd_doc.tipo_documento
        WHERE tipo_documental_id = $1::uuid;`,
      [datos.tipoDocumentalId],
    );
    if (resTipo.rows.length === 0) {
      throw new NotFoundError({
        detail: `El tipo documental ${datos.tipoDocumentalId} no existe en el catálogo institucional.`,
      });
    }
    if (!resTipo.rows[0].vigente) {
      throw new ValidationError({
        message: 'El tipo documental seleccionado no está vigente.',
        invalidParams: [
          {
            name: 'tipoDocumentalId',
            reason: 'El tipo documental se encuentra inactivo o no vigente en el catálogo.',
          },
        ],
      });
    }

    // Reintento seguro: una confirmación ya persistida para este expediente y SHA
    // conserva el documento original y evita duplicar metadatos.
    const columnaExpediente = datos.origenExpediente === 'TRA' ? 'expediente_tra_id' : 'expediente_id';
    const adjuntoExistente = await pool.query<{
      documento_adjunto_id: string; s3_key: string; sha256: string;
    }>(
      `SELECT documento_adjunto_id::text, s3_key, sha256
         FROM sigd_doc.documento_adjunto
        WHERE ${columnaExpediente} = $1::uuid AND sha256 = $2 AND s3_bucket = $3`,
      [datos.idExpediente, datos.sha256Hash.toLowerCase(), config.bucket],
    );
    if (adjuntoExistente.rows[0]) {
      const existente = adjuntoExistente.rows[0];
      res.status(200).json({
        documentoId: existente.documento_adjunto_id,
        idDocumentoAdjunto: existente.documento_adjunto_id,
        s3Key: existente.s3_key,
        sha256: existente.sha256.trim(),
        confirmado: true,
        mensaje: 'Documento PDF previamente verificado y registrado.',
      });
      return;
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
    const nombreArchivo = datos.nombreArchivo || datos.s3Key.split('/').pop() || 'documento.pdf';
    const magicHex = primerChunk.subarray(0, 4).toString('hex').toUpperCase();

    // Registrar en sigd_doc.documento_adjunto con DDL real y FKs obligatorias validadas
    const insertRes = await pool.query<{ documento_adjunto_id: string; sha256: string }>(
      `INSERT INTO sigd_doc.documento_adjunto (
         documento_adjunto_id,
         expediente_id,
         expediente_tra_id,
         tipo_documental_id,
         nombre_archivo,
         s3_bucket,
         s3_key,
         sha256,
         tamano_bytes,
         mime_type,
         magic_bytes,
         subido_por,
         creado_en
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
       RETURNING documento_adjunto_id::text, sha256;`,
      [
        idAdjunto,
        datos.origenExpediente === 'DOC' ? datos.idExpediente : null,
        datos.origenExpediente === 'TRA' ? datos.idExpediente : null,
        datos.tipoDocumentalId,
        nombreArchivo,
        config.bucket,
        datos.s3Key,
        datos.sha256Hash.toLowerCase(),
        totalBytes,
        'application/pdf',
        magicHex,
        claims.sub,
      ],
    );

    const filaGuardada = insertRes.rows[0];

    res.status(201).json({
      documentoId: filaGuardada?.documento_adjunto_id ?? idAdjunto,
      idDocumentoAdjunto: filaGuardada?.documento_adjunto_id ?? idAdjunto,
      s3Key: datos.s3Key,
      sha256: filaGuardada?.sha256 ?? datos.sha256Hash.toLowerCase(),
      confirmado: true,
      mensaje: 'Documento PDF verificado y registrado en el almacenamiento institucional.',
    });
  });

  // GET /storage/download/:bucket/:key (soporta claves con barras con sintaxis path-to-regexp v8)
  router.get('/storage/download/:bucket{/*key}', async (req: Request, res: Response) => {
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

    // Validar autorización del actor sobre el documento (FAIL-CLOSED)
    if (!pool) {
      throw new ForbiddenError({
        detail: 'No es posible verificar la autorización documental sin conexión a la base de datos.',
      });
    }

    const resDoc = await pool.query<{ expediente_id: string; origen_expediente: 'DOC' | 'TRA' }>(
      `SELECT COALESCE(da.expediente_tra_id, da.expediente_id)::text AS expediente_id,
              CASE WHEN da.expediente_tra_id IS NOT NULL THEN 'TRA' ELSE 'DOC' END AS origen_expediente
         FROM sigd_doc.documento_adjunto da
        WHERE da.s3_bucket = $1 AND da.s3_key = $2`,
      [bucket, key],
    );

    if (resDoc.rows.length === 0) {
      throw new NotFoundError({
        detail: 'El documento solicitado no existe o no se encuentra asociado a un expediente válido.',
      });
    }

    const autorizado = await validarAccesoExpediente(
      pool, claims.sub, claims.roles ?? [], resDoc.rows[0].expediente_id,
      resDoc.rows[0].origen_expediente ?? 'DOC',
    );
    if (!autorizado) {
      throw new ForbiddenError({ detail: 'No tiene permisos para descargar documentos de este expediente.' });
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
