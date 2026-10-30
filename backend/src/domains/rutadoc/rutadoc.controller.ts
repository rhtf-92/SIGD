import type { Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../../shared/domain/errors/index.js';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { headObject, generarUrlPresigned } from '../../core/storage/s3-storage.service.js';
import { ValidationError } from '../../shared/domain/errors/validation-error.js';
import { z } from 'zod';
import { filtrosSchema, idSchema } from './rutadoc.schemas.js';
import { reversionSchema } from './rutadoc.reversion.schemas.js';
import type { ServicioReversionRutaDoc } from './rutadoc.reversion.service.js';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import type { ActorRutaDoc, SolicitanteResumen } from './rutadoc.types.js';
import type { ActorProviderRutaDoc } from './rutadoc.actor-provider.js';
import type { ServicioRutaDoc } from './rutadoc.service.js';
import type { ServicioSlaRutaDoc } from './sla.service.js';

/** El proveedor debe derivar el actor de una sesión/token verificado, nunca de headers libres. */
export type ObtenerActorRutaDoc = (req: Request) => ActorRutaDoc | null | Promise<ActorRutaDoc | null>;

export interface OpcionesControladorRutaDoc {
  sla?: ServicioSlaRutaDoc;
  pool?: Pool;
}

export function crearControladorRutaDoc(
  servicio: ServicioRutaDoc,
  reversion: ServicioReversionRutaDoc,
  actorProvider: ActorProviderRutaDoc,
  opciones: OpcionesControladorRutaDoc = {},
): {
  listar: RequestHandler;
  obtener: RequestHandler;
  resumen: RequestHandler;
  revertir: RequestHandler;
  obtenerUrlArchivo: RequestHandler;
} {
  const actorAutenticado = async (req: Request): Promise<ActorRutaDoc> => {
    const actor = await actorProvider.obtenerActor(req);
    if (!actor) throw new UnauthorizedError();
    return actor;
  };

  return {
    listar: async (req, res) => {
      const actor = await actorAutenticado(req);
      const filtros = filtrosSchema.parse(req.query);
      res.json(await servicio.listar(filtros, actor));
    },
    obtener: async (req, res) => {
      const actor = await actorAutenticado(req);
      const id = idSchema.parse(req.params.id);
      res.json(await servicio.obtener(id, actor));
    },
    resumen: async (req, res) => {
      const actor = await actorAutenticado(req);
      const id = idSchema.parse(req.params.id);
      const expediente = await servicio.obtener(id, actor);

      let tupaData = null;
      if (opciones.pool) {
        // Consulta SQL con esquema real de PostgreSQL sin silenciar errores (P1 - Codex Audit)
        const resTupa = await opciones.pool.query(
          `SELECT v.registro_version_id AS "registroVersionId",
                  COALESCE(tp.codigo_ref, rv.referencia_fila, rv.codigo_externo) AS "codigo",
                  COALESCE(tp.denominacion, rv.denominacion_original) AS "denominacion",
                  COALESCE(tp.categoria, 'PROCEDIMIENTO_APROBADO') AS "clasificacion",
                  COALESCE(tp.plazo_dias, 30)::int AS "plazoDias",
                  COALESCE(tp.monto, 0.00)::float AS "costo"
             FROM sigd_doc.expediente_tupa_vinculo v
             JOIN sigd_doc.tupa_registro_version rv ON rv.registro_version_id = v.registro_version_id
        LEFT JOIN sigd_doc.tupa_procedimiento tp ON tp.registro_version_id = rv.registro_version_id
            WHERE v.expediente_id = $1::uuid
              AND v.reemplaza_vinculo_id IS NULL
            ORDER BY v.vinculado_en DESC, v.vinculo_id DESC
            LIMIT 1`,
          [id],
        );
        tupaData = resTupa.rows[0] ?? null;
      }

      let documentos: any[] = [];
      if (opciones.pool) {
        try {
          const resDocs = await opciones.pool.query<{
            id_documento: string;
            nombre_archivo: string;
            tamano_bytes: string;
            mime_type: string;
            sha256: string | null;
            creado_en: Date;
            tipo_documental: string | null;
            folio_inicio: number | null;
            folio_fin: number | null;
          }>(
            `SELECT da.documento_adjunto_id::text AS id_documento,
                    da.nombre_archivo,
                    da.tamano_bytes::text,
                    da.mime_type,
                    da.sha256,
                    da.creado_en,
                    td.nombre AS tipo_documental,
                    f.folio_inicio,
                    f.folio_fin
               FROM sigd_doc.documento_adjunto da
          LEFT JOIN sigd_doc.tipo_documento td ON td.tipo_documental_id = da.tipo_documental_id
          LEFT JOIN sigd_tra.expediente_documento_folio f ON f.id_documento = da.documento_adjunto_id AND f.expediente_id = $1::uuid
              WHERE da.expediente_tra_id = $1::uuid OR da.expediente_id = $1::uuid
              ORDER BY da.creado_en ASC`,
            [id],
          );
          documentos = resDocs.rows.map((d) => ({
            idDocumento: d.id_documento,
            nombreArchivo: d.nombre_archivo,
            tamanoBytes: Number(d.tamano_bytes),
            mimeType: d.mime_type,
            sha256: d.sha256 ? d.sha256.trim() : null,
            tipoDocumental: d.tipo_documental ?? 'Documento Principal',
            creadoEn: d.creado_en instanceof Date ? d.creado_en.toISOString() : String(d.creado_en),
            foliado: d.folio_inicio !== null && d.folio_inicio !== undefined,
            folios:
              d.folio_inicio !== null && d.folio_inicio !== undefined
                ? `F. ${String(d.folio_inicio).padStart(4, '0')} - F. ${String(d.folio_fin).padStart(4, '0')}`
                : null,
          }));
        } catch {
          documentos = [];
        }
      }

      let solicitanteResumen: SolicitanteResumen | null = null;
      if (opciones.pool && expediente.solicitanteId) {
        try {
          const resSol = await opciones.pool.query<{
            id_persona: string;
            tipo: string;
            id_documento: string;
            nombre_completo: string | null;
            nombres: string | null;
            apellidos: string | null;
            correo: string | null;
            telefono: string | null;
            direccion: string | null;
          }>(
            `SELECT p.id_persona::text,
                    p.tipo,
                    p.id_documento,
                    pn.nombre_completo,
                    pn.nombres,
                    pn.apellidos,
                    pn.correo,
                    pn.telefono,
                    p.direccion
               FROM sigd_auth.persona p
          LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
              WHERE p.id_persona = $1::uuid`,
            [expediente.solicitanteId],
          );
          if (resSol.rows.length > 0) {
            const sol = resSol.rows[0];
            const numDoc = sol.id_documento ?? '';
            let docEnmascarado = numDoc;
            if (numDoc.length > 4) {
              docEnmascarado = `${numDoc.slice(0, 2)}***${numDoc.slice(-3)}`;
            } else if (numDoc.length > 0) {
              docEnmascarado = '***';
            }
            const nombre =
              sol.nombre_completo ||
              (sol.nombres || sol.apellidos ? `${sol.nombres ?? ''} ${sol.apellidos ?? ''}`.trim() : null) ||
              'Administrado';

            solicitanteResumen = {
              idPersona: sol.id_persona,
              nombreCompleto: nombre,
              tipoDocumento: sol.tipo === 'JURIDICA' ? 'RUC' : 'DNI',
              numeroDocumento: numDoc,
              documentoEnmascarado: docEnmascarado,
              correo: sol.correo ?? null,
              telefono: sol.telefono ?? null,
              direccion: sol.direccion ?? null,
            };
          }
        } catch {
          solicitanteResumen = null;
        }
      }

      const slaData = opciones.sla ? await opciones.sla.obtener(id).catch(() => null) : null;

      let pagoResumen = null;
      if (opciones.pool) {
        try {
          const resPago = await opciones.pool.query(
            `SELECT orden_pago_id AS "ordenPagoId",
                    codigo_pago AS "codigoPago",
                    expediente_id AS "expedienteId",
                    solicitante_id AS "solicitanteId",
                    concepto,
                    codigo_tupa AS "codigoTupa",
                    monto::float AS monto,
                    moneda,
                    estado,
                    metodo_pago AS "metodoPago",
                    referencia_operacion AS "referenciaOperacion",
                    monto_recibido::float AS "montoRecibido",
                    vuelto::float AS vuelto,
                    codigo_recibo AS "codigoRecibo",
                    fecha_creacion AS "fechaCreacion",
                    fecha_vencimiento AS "fechaVencimiento",
                    fecha_pago AS "fechaPago",
                    motivo_rechazo AS "motivoRechazo"
               FROM sigd_tra.orden_pago
              WHERE expediente_id = $1::uuid
              ORDER BY created_at DESC
              LIMIT 1`,
            [id],
          );
          if (resPago.rows.length > 0) {
            pagoResumen = resPago.rows[0];
          }
        } catch {
          pagoResumen = null;
        }
      }

      res.json({
        expediente,
        estado: expediente.estadoActual,
        slaResumen: slaData
          ? {
              estado: slaData.estado,
              diasHabilesRestantes: slaData.diasHabilesRestantes,
              porcentaje: slaData.porcentaje,
              fechaLimite: slaData.fechaLimite,
            }
          : null,
        foliacionResumen: {
          cantidadDocumentos: expediente.resumenDocumentos?.cantidadDocumentos ?? 0,
          totalFolios: expediente.resumenDocumentos?.totalFolios ?? 0,
          cantidadFoliados: expediente.resumenDocumentos?.cantidadFoliados ?? 0,
        },
        tupaResumen: tupaData,
        documentos,
        solicitanteResumen,
        pago: pagoResumen,
      });
    },
    revertir: async (req, res) => {
      const actor = await actorAutenticado(req);
      const id = idSchema.parse(req.params.id);
      const comando = reversionSchema.parse(req.body);
      const correlationId = getRequestContext()?.correlation_id;
      if (!correlationId || !z.string().uuid().safeParse(correlationId).success) {
        throw new ValidationError({
          invalidParams: [
            {
              name: 'x-correlation-id',
              reason: 'Debe ser un UUID para el outbox transaccional.',
            },
          ],
        });
      }
      res.json(await reversion.revertir(id, comando, actor, correlationId));
    },
    obtenerUrlArchivo: async (req: Request, res: Response) => {
      const actor = await actorAutenticado(req);
      const id = idSchema.parse(req.params.id);
      const documentoId = idSchema.parse(req.params.documentoId);

      // 1. Autorización de acceso al expediente (fail-closed)
      if (actor.puedeVerExpediente) {
        const puede = await actor.puedeVerExpediente(id);
        if (!puede) throw new ForbiddenError({ detail: 'No tiene permisos para ver documentos de este expediente.' });
      } else {
        const tieneRol = actor.roles.some((r) => ['ADMINISTRADOR', 'DIRECTOR', 'MESA_PARTES'].includes(r));
        if (!tieneRol) throw new ForbiddenError({ detail: 'No tiene permisos para ver documentos de este expediente.' });
      }

      if (!opciones.pool) {
        throw new ForbiddenError({ detail: 'Conexión a base de datos requerida para verificar el documento.' });
      }

      // 2. Validación BOLA / IDOR estricta: el documento debe pertenecer al expediente indicado
      const resDoc = await opciones.pool.query<{
        documento_adjunto_id: string;
        nombre_archivo: string;
        s3_bucket: string;
        s3_key: string;
        mime_type: string;
        sha256: string;
        tamano_bytes: string;
      }>(
        `SELECT documento_adjunto_id::text, nombre_archivo, s3_bucket, s3_key, mime_type, sha256, tamano_bytes
           FROM sigd_doc.documento_adjunto
          WHERE documento_adjunto_id = $1::uuid
            AND (expediente_tra_id = $2::uuid OR expediente_id = $2::uuid)`,
        [documentoId, id],
      );

      if (resDoc.rows.length === 0) {
        throw new NotFoundError({
          detail: 'El documento no existe o no se encuentra asociado al expediente indicado.',
        });
      }

      const doc = resDoc.rows[0];

      // 3. Verificación criptográfica y existencia real en MinIO (SEC-02: sin placeholders)
      const configS3 = obtenerConfiguracionS3();
      const configParaArchivo = {
        ...configS3,
        bucket: doc.s3_bucket || configS3.bucket,
      };

      const info = await headObject(doc.s3_key, configParaArchivo);
      if (!info.existe) {
        throw new NotFoundError({
          detail: 'El archivo físico no se encuentra disponible en el almacenamiento MinIO.',
        });
      }

      // 4. URL prefirmada temporal GET (15 minutos = 900 s)
      const url = generarUrlPresigned(doc.s3_key, configParaArchivo, {
        metodo: 'GET',
        expiraSegundos: 900,
      });

      res.status(200).json({
        url,
        downloadUrl: url,
        nombreArchivo: doc.nombre_archivo,
        mimeType: doc.mime_type,
        tamanoBytes: Number(doc.tamano_bytes),
        sha256: doc.sha256 ? doc.sha256.trim() : null,
        expiraEnSegundos: 900,
      });
    },
  };
}
