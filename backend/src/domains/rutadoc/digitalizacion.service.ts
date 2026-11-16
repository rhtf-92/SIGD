import crypto, { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned } from '../../core/storage/s3-storage.service.js';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/domain/errors/index.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import type {
  AdjuntarDocumentoInput,
  ResultadoDigitalizacion,
} from './digitalizacion.schemas.js';

export class DigitalizacionService {
  constructor(private readonly pool: Pool) {}

  private async verificarArchivoEnStorage(
    input: AdjuntarDocumentoInput,
  ): Promise<{ bucket: string; key: string }> {
    const config = obtenerConfiguracionS3();
    const key = input.storagePath;
    if (!key || !/^expedientes\/\d{4}\/[0-9a-f-]+\.pdf$/i.test(key)) {
      throw new ValidationError({
        invalidParams: [{ name: 'storagePath', reason: 'ARCHIVO_NO_ALMACENADO: clave de almacenamiento no válida.' }],
      });
    }

    const url = generarUrlPresigned(key, config, { metodo: 'GET', expiraSegundos: 60 });
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!respuesta.ok || !respuesta.body) {
      await respuesta.body?.cancel();
      throw new ValidationError({
        invalidParams: [{ name: 'storagePath', reason: 'ARCHIVO_NO_DISPONIBLE: no se pudo verificar el objeto en el almacenamiento.' }],
      });
    }

    const lector = respuesta.body.getReader();
    const hash = createHash('sha256');
    let tamano = 0;
    let prefijo = Buffer.alloc(0);

    while (true) {
      const { done, value } = await lector.read();
      if (done) break;
      tamano += value.byteLength;
      if (tamano > input.tamanoBytes) {
        throw new ValidationError({
          invalidParams: [{ name: 'tamanoBytes', reason: 'ARCHIVO_NO_COINCIDE: el tamaño excede los bytes declarados.' }],
        });
      }
      if (prefijo.length < 5) {
        prefijo = Buffer.concat([prefijo, Buffer.from(value.subarray(0, 5 - prefijo.length))]);
      }
      hash.update(value);
    }

    if (tamano !== input.tamanoBytes) {
      throw new ValidationError({
        invalidParams: [{ name: 'tamanoBytes', reason: 'ARCHIVO_NO_COINCIDE: el tamaño obtenido no coincide con el declarado.' }],
      });
    }

    if (hash.digest('hex').toLowerCase() !== input.sha256Hash.toLowerCase()) {
      throw new ValidationError({
        invalidParams: [{ name: 'sha256Hash', reason: 'ARCHIVO_NO_COINCIDE: el hash SHA-256 no coincide con el archivo almacenado.' }],
      });
    }

    if (!prefijo.toString('utf-8').startsWith('%PDF-')) {
      throw new ValidationError({
        invalidParams: [{ name: 'mimeType', reason: 'ARCHIVO_INVALIDO: la cabecera no corresponde a un documento PDF íntegro.' }],
      });
    }

    return { bucket: config.bucket, key };
  }

  public async adjuntarDocumento(
    expedienteId: string,
    input: AdjuntarDocumentoInput,
    usuarioId: string,
    actor: ActorRutaDoc,
  ): Promise<ResultadoDigitalizacion> {
    // 1. Autorización: Ciudadano externo no puede digitalizar ni foliar trámites
    if (actor.roles?.includes('CIUDADANO') && !actor.roles.some((r) => r !== 'CIUDADANO')) {
      throw new ForbiddenError({ detail: 'No cuenta con facultades para digitalizar o foliar expedientes.' });
    }

    if (actor.puedeVerExpediente && !(await actor.puedeVerExpediente(expedienteId))) {
      throw new ForbiddenError({ detail: 'No cuenta con autorización para intervenir este expediente.' });
    }

    // 2. Verificar archivo en MinIO S3
    const archivoS3 = await this.verificarArchivoEnStorage(input);

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      // 3. Bloqueo pesimista del expediente en sigd_tra.expediente
      const traExpRes = await cliente.query<{
        expediente_id: string;
        codigo_expediente: string;
        tipo_documental_id: string;
        solicitante_id: string;
        estado: string;
        fecha_radicacion: Date;
      }>(
        `SELECT expediente_id, codigo_expediente, tipo_documental_id, solicitante_id, estado, fecha_radicacion
           FROM sigd_tra.expediente
          WHERE expediente_id = $1::uuid
          FOR UPDATE`,
        [expedienteId],
      );

      if (traExpRes.rowCount === 0 || !traExpRes.rows[0]) {
        throw new NotFoundError({ detail: `El expediente con ID ${expedienteId} no existe.` });
      }
      const expTra = traExpRes.rows[0];

      // 4. Prevenir duplicados de documento en el mismo expediente
      const duplicado = await cliente.query<{ existe: boolean }>(
        `SELECT EXISTS (
           SELECT 1
             FROM sigd_doc.documento_adjunto
            WHERE expediente_id = $1::uuid AND sha256 = $2
         ) AS existe`,
        [expedienteId, input.sha256Hash.toLowerCase()],
      );
      if (duplicado.rows[0]?.existe) {
        throw new ConflictError({
          code: 'DOCUMENTO_YA_ADJUNTO',
          message: 'Este documento PDF ya se encuentra registrado y foliado en el expediente.',
        });
      }

      // 5. Garantizar sincronización en sigd_doc.expediente
      const docExpRes = await cliente.query<{ expediente_id: string }>(
        `SELECT expediente_id FROM sigd_doc.expediente WHERE expediente_id = $1::uuid`,
        [expedienteId],
      );

      if (docExpRes.rowCount === 0) {
        // Obtener asunto de asiento_registro o tramite
        const asuntoRes = await cliente.query<{ asunto: string }>(
          `SELECT asunto FROM sigd_tra.asiento_registro WHERE expediente_id = $1::uuid ORDER BY numero_registro ASC LIMIT 1`,
          [expedienteId],
        );
        const asunto = asuntoRes.rows[0]?.asunto || `Expediente ${expTra.codigo_expediente}`;

        // Obtener un tipo_tramite_id válido del catálogo
        const tramiteTupa = await cliente.query<{ tipo_tramite_id: string }>(
          `SELECT tipo_tramite_id FROM sigd_doc.tipo_tramite_tupa WHERE vigente = TRUE ORDER BY codigo ASC LIMIT 1`,
        );
        const tipoTramiteId = tramiteTupa.rows[0]?.tipo_tramite_id;
        if (!tipoTramiteId) {
          throw new AppError({ status: 500, code: 'TUPA_CATALOG_UNAVAILABLE', message: 'No hay procedimientos TUPA vigentes.' });
        }

        await cliente.query(
          `INSERT INTO sigd_doc.expediente (
             expediente_id, tipo_tramite_id, codigo_expediente, asunto, solicitante_id, fecha_registro
           ) VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6)
           ON CONFLICT (expediente_id) DO NOTHING`,
          [expedienteId, tipoTramiteId, expTra.codigo_expediente, asunto, expTra.solicitante_id, expTra.fecha_radicacion],
        );
      }

      // 6. Resolver tipo documental
      let tipoDocumentalId = input.tipoDocumentalId;
      if (!tipoDocumentalId) {
        tipoDocumentalId = expTra.tipo_documental_id;
      }
      const tipoDocVal = await cliente.query<{ tipo_documental_id: string }>(
        `SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE tipo_documental_id = $1::uuid AND vigente = TRUE`,
        [tipoDocumentalId],
      );
      if (tipoDocVal.rowCount === 0) {
        throw new ValidationError({
          invalidParams: [{ name: 'tipoDocumentalId', reason: 'El tipo documental no existe o no está vigente en el catálogo.' }],
        });
      }

      // 7. Insertar en sigd_doc.documento_adjunto
      const docAdjuntoId = crypto.randomUUID();
      await cliente.query(
        `INSERT INTO sigd_doc.documento_adjunto (
           documento_adjunto_id, expediente_id, tipo_documental_id, nombre_archivo,
           s3_bucket, s3_key, sha256, tamano_bytes, mime_type, magic_bytes, subido_por, creado_en
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4,
           $5, $6, $7, $8, $9, '%PDF-', $10::uuid, now()
         )`,
        [
          docAdjuntoId,
          expedienteId,
          tipoDocumentalId,
          input.nombreArchivo,
          archivoS3.bucket,
          archivoS3.key,
          input.sha256Hash.toLowerCase(),
          input.tamanoBytes,
          input.mimeType,
          usuarioId,
        ],
      );

      // 8. Asignar folios correlativos secuenciales (protegido por row lock previo FOR UPDATE y trigger tr_folio_continuidad)
      const maxFolioRes = await cliente.query<{ max_fin: number | null }>(
        `SELECT MAX(folio_fin) AS max_fin
           FROM sigd_tra.expediente_documento_folio
          WHERE expediente_id = $1::uuid`,
        [expedienteId],
      );
      const folioInicio = (Number(maxFolioRes.rows[0]?.max_fin) || 0) + 1;
      const folioFin = folioInicio + input.folios - 1;

      await cliente.query(
        `INSERT INTO sigd_tra.expediente_documento_folio
           (expediente_id, id_documento, folio_inicio, folio_fin, asignado_por)
         VALUES ($1::uuid, $2::uuid, $3::integer, $4::integer, $5::uuid)`,
        [expedienteId, docAdjuntoId, folioInicio, folioFin, usuarioId],
      );

      await cliente.query('COMMIT');

      return {
        documentoId: docAdjuntoId,
        expedienteId,
        nombreArchivo: input.nombreArchivo,
        folios: {
          folioInicio,
          folioFin,
          cantidad: input.folios,
        },
        sha256: input.sha256Hash.toLowerCase(),
        s3Bucket: archivoS3.bucket,
        s3Key: archivoS3.key,
        creadoEn: new Date().toISOString(),
      };
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }
}
