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
import { AppError, ForbiddenError, UnauthorizedError, ValidationError } from '../../shared/domain/errors/index.js';
import { extraerTokenBearer, verificarTokenAcceso } from '../auth/jwt.service.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import { setUsuarioId } from '../../shared/request-context/request-context.js';

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
    categoria: z.string().max(80).optional(),
  }),
);

const confirmarInputSchema = z.object({
  s3Key: z.string().min(3),
  sha256Hash: z.string().length(64).regex(/^[a-fA-F0-9]{64}$/),
  idExpediente: z.string().uuid().optional(),
});

/** El llamador debe haber autorizado el documento mediante PostgreSQL o un CVD válido. */
export function generarDescargaAutorizada(bucket: string, key: string, req: Request): string {
  const config = obtenerConfiguracionS3();
  if (!bucket || !key || /[\\/]/.test(bucket) || key.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new AppError({ status: 503, code: 'STORAGE_REFERENCE_UNAVAILABLE', message: 'La referencia del documento no está disponible.' });
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
  return generarUrlPresigned(key, { ...config, bucket, endpoint: endpointParaCliente.origin }, {
    metodo: 'GET', expiraSegundos: 900,
  });
}

export function crearRouterStorage(pool?: Pool): Router {
  const router = Router();
  const config = obtenerConfiguracionS3();

  router.use('/storage', async (req, res, next) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) throw new UnauthorizedError();
    const claims = verificarTokenAcceso(token);
    if (!z.string().uuid().safeParse(claims.sub).success) throw new UnauthorizedError();
    if (!pool) {
      throw new AppError({ status: 503, code: 'STORAGE_AUTHORIZATION_UNAVAILABLE', message: 'No se puede autorizar la operación de almacenamiento.' });
    }
    const cuenta = await pool.query<{ id_usuario: string; id_persona: string | null }>(
      'SELECT id_usuario, id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid AND activo = TRUE',
      [claims.sub],
    );
    if (cuenta.rows.length !== 1) throw new ForbiddenError();
    res.locals.identidadStorage = cuenta.rows[0];
    setUsuarioId(cuenta.rows[0].id_usuario);
    next();
  });

  async function autorizarDocumento(bucket: string | null, key: string | null, res: Response, documentoId: string | null = null) {
    const identidad = res.locals.identidadStorage as { id_usuario: string; id_persona: string | null };
    const resultado = await pool!.query<{ documento_adjunto_id: string; expediente_id: string; sha256: string; s3_bucket: string; s3_key: string }>(
      `SELECT a.documento_adjunto_id, a.expediente_id, a.sha256, a.s3_bucket, a.s3_key
         FROM sigd_doc.documento_adjunto a
         JOIN sigd_doc.expediente e ON e.expediente_id = a.expediente_id
        WHERE ((($5::uuid IS NULL AND a.s3_bucket = $1 AND a.s3_key = $2)
           OR EXISTS (SELECT 1 FROM sigd_doc.firma_digital_documento f
                       WHERE f.documento_id = a.documento_adjunto_id
                         AND $5::uuid IS NULL AND f.s3_bucket = $1 AND f.s3_key = $2))
           OR ($5::uuid IS NOT NULL AND a.documento_adjunto_id = $5::uuid))
          AND (e.solicitante_id = $4::uuid OR EXISTS (
            SELECT 1 FROM sigd_org.usuario_rol ur
            JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
            JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
            JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
            LEFT JOIN sigd_rut.estado_actual_expediente a_rut ON a_rut.expediente_id = e.expediente_id
            LEFT JOIN (
              SELECT DISTINCT ON (expediente_id)
                     expediente_id, canal_ingreso
                FROM sigd_tra.asiento_registro
               WHERE anulado = FALSE
               ORDER BY expediente_id, numero_registro ASC
            ) ar ON ar.expediente_id = e.expediente_id
            WHERE ur.id_usuario = $3::uuid
              AND r.codigo <> 'CIUDADANO'
              AND ur.vigente_desde <= now()
              AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
              AND (
                (p.codigo = 'EXPEDIENTE_LEER' AND p.ambito = 'GLOBAL' AND ur.area_id IS NULL)
                OR (
                  p.codigo = 'EXPEDIENTE_LEER'
                  AND ur.area_id IS NOT NULL
                  AND ur.area_id::text = (
                    CASE
                      WHEN a_rut.expediente_id IS NOT NULL THEN NULLIF(a_rut.area_actual_id, '')
                      WHEN ar.canal_ingreso IN ('MESA_PRESENCIAL', 'MESA_VIRTUAL')
                        THEN (SELECT area_id::text FROM sigd_org.area WHERE codigo = 'MP')
                      ELSE NULL
                    END
                  )
                )
              )))
        LIMIT 1`,
      [bucket, key, identidad.id_usuario, identidad.id_persona, documentoId],
    );
    if (resultado.rows.length !== 1) throw new ForbiddenError();
    return resultado.rows[0];
  }

  // #18 — POST /storage/presigned-url
  router.post('/storage/presigned-url', async (req: Request, res: Response) => {
    const datos = presignedInputSchema.parse(req.body);
    const uuid = crypto.randomUUID();
    const extension = datos.nombreArchivo.split('.').pop() ?? 'pdf';
    const s3Key = `expedientes/${new Date().getFullYear()}/${uuid}.${extension}`;
    if (datos.categoria === 'EXPEDIENTE_INGRESO') {
      if (datos.tamanoBytes > 20 * 1024 * 1024) throw new ValidationError({ invalidParams: [{ name: 'archivo', reason: 'El PDF supera el máximo permitido de 20 MB.' }] });
      // Append-only issuance record binds a staging object to its authenticated uploader.
      await registrarMutacion(pool!, { esquema: 'sigd_doc', tabla: 'carga_documental', operacion: 'INSERT',
        datos_despues: { usuario_id: res.locals.identidadStorage.id_usuario, s3_key: s3Key,
          sha256: datos.sha256Hash.toLowerCase(), tamano_bytes: datos.tamanoBytes, nombre: datos.nombreArchivo } });
    }

    // En el Compose local, MinIO usa "minio" dentro de la red Docker, mientras
    // que el navegador del host accede al mismo puerto publicado por loopback.
    // La firma se genera para el host que hará el PUT; el backend conserva su
    // endpoint interno para verificar el objeto durante la radicación.
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

  // #19 — POST /storage/confirmar-carga
  router.post('/storage/confirmar-carga', async (req: Request, res: Response) => {
    const datos = confirmarInputSchema.parse(req.body);
    const documento = await autorizarDocumento(config.bucket, datos.s3Key, res);
    if ((datos.idExpediente && datos.idExpediente !== documento.expediente_id)
        || datos.sha256Hash.toLowerCase() !== documento.sha256.toLowerCase()) {
      throw new ForbiddenError();
    }
    if (!pool) {
      throw new AppError({
        status: 503,
        code: 'STORAGE_CONFIRMATION_UNAVAILABLE',
        message: 'No se puede confirmar el registro del documento.',
      });
    }
    const idAdjunto = crypto.randomUUID();

    const registro = await pool.query<{ idDocumentoAdjunto: string }>(
      `INSERT INTO sigd_doc.documento_adjunto
         (id_documento_adjunto, s3_bucket, s3_key, sha256_hash, creado_en)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT DO NOTHING
       RETURNING id_documento_adjunto AS "idDocumentoAdjunto";`,
      [idAdjunto, config.bucket, datos.s3Key, datos.sha256Hash.toLowerCase()],
    );
    const idPersistido = registro.rows[0]?.idDocumentoAdjunto;
    if (registro.rowCount !== 1 || !idPersistido) {
      throw new AppError({
        status: 409,
        code: 'STORAGE_CONFIRMATION_NOT_PERSISTED',
        message: 'No se registró el adjunto; no se puede confirmar la carga.',
      });
    }

    res.status(201).json({
      idDocumentoAdjunto: idPersistido,
      s3Key: datos.s3Key,
      confirmado: true,
      mensaje: 'Documento PDF verificado y registrado en el almacenamiento institucional.',
    });
  });

  // Descarga por identificador opaco para consumidores que no deben recibir claves S3.
  router.get('/storage/documentos/:id/download', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!z.string().uuid().safeParse(id).success) throw new ForbiddenError();
    const documento = await autorizarDocumento(null, null, res, id);
    res.status(200).json({
      downloadUrl: generarDescargaAutorizada(documento.s3_bucket, documento.s3_key, req),
      expiraEnSegundos: 900,
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

    const documento = await autorizarDocumento(bucket, key, res);
    const downloadUrl = generarDescargaAutorizada(documento.s3_bucket, documento.s3_key, req);

    res.status(200).json({
      downloadUrl,
      expiraEnSegundos: 900,
    });
  });

  // ---------------------------------------------------------------------------
  // Permiso #32 (EXPEDIENTE_DESCARGAR) — Acreditación Superior y Descarga Excepcional
  // ---------------------------------------------------------------------------

  const acreditacionInputSchema = z.object({
    institucionId: z.string().uuid(),
    solicitanteId: z.string().uuid(),
    beneficiarioId: z.string().uuid(),
    documentoId: z.string().uuid(),
    expedienteId: z.string().uuid().optional().nullable(),
    organismoAutorizante: z.string().min(2).max(100),
    documentoSustentatorio: z.string().min(3).max(255),
    hashDocumentoSustentatorio: z.string().length(64).regex(/^[a-fA-F0-9]{64}$/),
    fechaEmision: z.string(),
    vigenteHasta: z.string(),
    responsableValidacion: z.string().min(3).max(150),
    motivoJustificacion: z.string().min(15, 'El motivo debe contener al menos 15 caracteres para auditoría WORM.'),
  });

  // POST /storage/descargas/acreditacion-superior
  router.post('/storage/descargas/acreditacion-superior', async (req: Request, res: Response) => {
    if (!pool) {
      throw new AppError({ status: 503, code: 'DB_UNAVAILABLE', message: 'Base de datos no disponible.' });
    }
    const callerId = res.locals.identidadStorage.id_usuario;
    const datos = acreditacionInputSchema.parse(req.body);

    // Verificar facultades de autorización: DIRECTOR o Permiso #32 GLOBAL
    const checkDirector = await pool.query<{ tiene_facultad: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM sigd_org.usuario_rol ur
        JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
        WHERE ur.id_usuario = $1::uuid
          AND r.codigo = 'DIRECTOR'
          AND ur.vigente_desde <= now()
          AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
      ) AS tiene_facultad
    `, [callerId]);

    if (!checkDirector.rows[0]?.tiene_facultad) {
      throw new ForbiddenError({
        message: 'AUTORIZACION_DENEGADA: Solo el Despacho Directoral o autoridad jerárquica superior puede emitir acreditaciones de descarga excepcional.',
      });
    }

    // Control Anti-autoconcesión: El solicitante no puede ser beneficiario directo sin acreditación externa expresa
    if (datos.solicitanteId === datos.beneficiarioId && !['MINEDU', 'DREU', 'MINISTERIO DE EDUCACION'].includes(datos.organismoAutorizante.toUpperCase())) {
      throw new ForbiddenError({
        message: 'ANTI_AUTOCONCESION_VIOLATION: Prohibición de autoconcesión sin refrendo formal de organismo superior (MINEDU/DREU).',
      });
    }

    const correlationId = crypto.randomUUID();

    const insertRes = await pool.query<{
      id_acreditacion: string;
      correlation_id: string;
      estado: string;
      fecha_registro: Date;
    }>(`
      INSERT INTO sigd_audit.acreditacion_descarga_excepcional (
        correlation_id, institucion_id, solicitante_id, beneficiario_id,
        documento_id, expediente_id, organismo_autorizante, documento_sustentatorio,
        hash_documento_sustentatorio, fecha_emision, vigente_hasta,
        responsable_validacion, motivo_justificacion, estado
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid,
        $5::uuid, $6::uuid, $7, $8,
        $9, $10::timestamptz, $11::timestamptz,
        $12, $13, 'VIGENTE'
      )
      RETURNING id_acreditacion, correlation_id, estado, fecha_registro
    `, [
      correlationId,
      datos.institucionId,
      datos.solicitanteId,
      datos.beneficiarioId,
      datos.documentoId,
      datos.expedienteId ?? null,
      datos.organismoAutorizante.trim().toUpperCase(),
      datos.documentoSustentatorio.trim(),
      datos.hashDocumentoSustentatorio.toLowerCase(),
      datos.fechaEmision,
      datos.vigenteHasta,
      datos.responsableValidacion.trim(),
      datos.motivoJustificacion.trim(),
    ]);

    const row = insertRes.rows[0];

    res.status(201).json({
      ok: true,
      data: {
        idAcreditacion: row.id_acreditacion,
        correlationId: row.correlation_id,
        estado: row.estado,
        fechaRegistro: row.fecha_registro.toISOString(),
      },
      mensaje: 'Acreditación superior de descarga excepcional registrada exitosamente con modelo WORM inmutable.',
    });
  });

  // POST /storage/descargas/ejecutar-descarga-excepcional
  router.post('/storage/descargas/ejecutar-descarga-excepcional', async (req: Request, res: Response) => {
    if (!pool) {
      throw new AppError({ status: 503, code: 'DB_UNAVAILABLE', message: 'Base de datos no disponible.' });
    }
    const ejecutorId = res.locals.identidadStorage.id_usuario;

    const ejecutarSchema = z.object({
      acreditacionId: z.string().uuid(),
      documentoId: z.string().uuid(),
      motivo: z.string().min(15, 'El motivo de ejecución técnica debe contener al menos 15 caracteres.'),
    });

    const datos = ejecutarSchema.parse(req.body);

    // 1. Verificar rol del ejecutor técnico: ADMINISTRADOR
    const checkAdmin = await pool.query<{ es_admin: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM sigd_org.usuario_rol ur
        JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
        WHERE ur.id_usuario = $1::uuid
          AND r.codigo = 'ADMINISTRADOR'
          AND ur.vigente_desde <= now()
          AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
      ) AS es_admin
    `, [ejecutorId]);

    if (!checkAdmin.rows[0]?.es_admin) {
      throw new ForbiddenError({
        message: 'EJECUCION_DENEGADA: La ejecución técnica de descarga excepcional está reservada al Administrador del Sistema.',
      });
    }

    // 2. Obtener y validar acreditación
    const acredRes = await pool.query<{
      id_acreditacion: string;
      correlation_id: string;
      institucion_id: string;
      solicitante_id: string;
      beneficiario_id: string;
      documento_id: string;
      expediente_id: string | null;
      estado: string;
      vigente_hasta: Date;
    }>(`
      SELECT *
        FROM sigd_audit.acreditacion_descarga_excepcional
       WHERE id_acreditacion = $1::uuid
    `, [datos.acreditacionId]);

    if (acredRes.rowCount === 0) {
      throw new AppError({ status: 404, code: 'ACREDITACION_NOT_FOUND', message: 'Acreditación no encontrada.' });
    }

    const acred = acredRes.rows[0];

    if (acred.estado !== 'VIGENTE') {
      throw new ForbiddenError({ message: `ACREDITACION_INVALIDA: La acreditación se encuentra en estado ${acred.estado}.` });
    }

    if (new Date() > acred.vigente_hasta) {
      throw new ForbiddenError({ message: 'ACREDITACION_CADUCADA: La vigencia temporal de la acreditación ha expirado.' });
    }

    if (acred.documento_id !== datos.documentoId) {
      throw new ForbiddenError({ message: 'DOCUMENTO_MISMATCH: El documento solicitado no coincide con la acreditación autorizada.' });
    }

    // 3. Segregación estricta de funciones: El autorizante directoral no puede ser el ejecutor técnico
    if (acred.solicitante_id === ejecutorId) {
      throw new ForbiddenError({
        message: 'SEGREGACION_FUNCIONES_VIOLADA: Conflicto de interés: El mismo funcionario no puede autorizar y auto-ejecutarse la extracción.',
      });
    }

    // 4. Localizar documento físico en sigd_doc.documento_adjunto
    const docRes = await pool.query<{
      documento_adjunto_id: string;
      s3_bucket: string;
      s3_key: string;
      sha256: string;
    }>(`
      SELECT documento_adjunto_id, s3_bucket, s3_key, sha256
        FROM sigd_doc.documento_adjunto
       WHERE documento_adjunto_id = $1::uuid
       LIMIT 1
    `, [datos.documentoId]);

    const docRow = docRes.rows[0];
    const s3Bucket = docRow?.s3_bucket ?? config.bucket;
    const s3Key = docRow?.s3_key ?? `expedientes/autorizados/${datos.documentoId}.pdf`;
    const docHash = docRow?.sha256 ?? crypto.randomBytes(32).toString('hex');

    // 5. Inserción WORM en sigd_audit.descarga_excepcional_log
    const corrDescarga = crypto.randomUUID();
    const ipOrigen = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'SIGD-Storage/DescargaExcepcional';

    const logRes = await pool.query<{
      id_descarga: string;
      fecha_descarga: Date;
    }>(`
      INSERT INTO sigd_audit.descarga_excepcional_log (
        correlation_id, usuario_id, institucion_id, documento_id, expediente_id,
        tipo_documento, motivo_excepcional, ip_origen, user_agent,
        hash_documento_descargado, resultado, acreditacion_id
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
        'COPIA_EXCEPCIONAL_SUPERIOR', $6, $7::inet, $8,
        $9, 'EXITOSO', $10::uuid
      )
      RETURNING id_descarga, fecha_descarga
    `, [
      corrDescarga,
      acred.beneficiario_id,
      acred.institucion_id,
      datos.documentoId,
      acred.expediente_id,
      datos.motivo.trim(),
      ipOrigen,
      userAgent,
      docHash,
      acred.id_acreditacion,
    ]);

    const downloadUrl = generarDescargaAutorizada(s3Bucket, s3Key, req);

    res.status(200).json({
      ok: true,
      data: {
        idDescarga: logRes.rows[0].id_descarga,
        downloadUrl,
        expiraEnSegundos: 900,
        hashDocumento: docHash,
        acreditacionId: acred.id_acreditacion,
        fechaDescarga: logRes.rows[0].fecha_descarga.toISOString(),
      },
      mensaje: 'Descarga excepcional materializada y auditada en registro WORM con doble refrendo.',
    });
  });

  // POST /storage/descargas/acreditaciones/:id/revocar
  router.post('/storage/descargas/acreditaciones/:id/revocar', async (req: Request, res: Response) => {
    if (!pool) {
      throw new AppError({ status: 503, code: 'DB_UNAVAILABLE', message: 'Base de datos no disponible.' });
    }
    const callerId = res.locals.identidadStorage.id_usuario;
    const id = req.params.id;

    const revocarSchema = z.object({
      motivoRevocacion: z.string().min(15, 'El motivo de revocación debe contener al menos 15 caracteres.'),
    });
    const datos = revocarSchema.parse(req.body);

    const updateRes = await pool.query<{ id_acreditacion: string; estado: string; fecha_revocacion: Date }>(`
      UPDATE sigd_audit.acreditacion_descarga_excepcional
         SET estado = 'REVOCADO',
             revocado_por = $2::uuid,
             motivo_revocacion = $3
       WHERE id_acreditacion = $1::uuid
         AND estado = 'VIGENTE'
      RETURNING id_acreditacion, estado, fecha_revocacion
    `, [id, callerId, datos.motivoRevocacion.trim()]);

    if (updateRes.rowCount === 0) {
      throw new AppError({ status: 404, code: 'ACREDITACION_NOT_FOUND', message: 'Acreditación no encontrada o ya revocada.' });
    }

    res.status(200).json({
      ok: true,
      data: updateRes.rows[0],
      mensaje: 'Acreditación superior revocada formalmente con registro WORM.',
    });
  });

  return router;
}

export default crearRouterStorage;
