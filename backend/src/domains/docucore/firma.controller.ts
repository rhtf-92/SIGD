/**
 * T-BE-DC-11 / endpoint #35 — Controladores REST de invocacion a firma digital.
 *
 * Endpoints expuestos:
 *   POST /api/v1/firma/invocar-refirma
 *         Genera el token de sesion, la URI protocolar `refirma://` y la URL
 *         temporal de descarga del documento a firmar.
 *   POST /api/v1/firma/callback-refirma/:sesionId
 *         Callback que entrega el agente de escritorio de RENIEC al terminar de
 *         firmar. Consume la sesion de forma atomica.
 *   GET  /api/v1/firma/documento/:documentoId?token=...
 *         Descarga temporal del PDF a firmar, acotada a la vigencia de la sesion.
 *
 * Respuestas de error conforme al catalogo unificado
 * `docs/integracion/02_catalogo_errores_backend.md`.
 *
 * Estado: PROPUESTO. El prefijo `/api/v1` y el nombre en `kebab-case` siguen las
 * convenciones de API del backend; el correlationId se propaga desde el
 * middleware y aparece en toda respuesta de error.
 */

import { Router, type Request, type Response } from "express";
import type { Pool } from 'pg';
import { z } from 'zod';
import { Readable } from 'node:stream';
import { resolverIdentidad, verificarFacultadFirma } from '../../core/auth/auth.guard.js';
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/domain/errors/index.js';
import { generarDescargaAutorizada } from '../../core/storage/storage.router.js';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned, validarMagicBytes } from '../../core/storage/s3-storage.service.js';
import { HashIntegrityService } from './hashIntegrity.service.js';
import type { ActorProviderRutaDoc } from '../rutadoc/rutadoc.actor-provider.js';

import { ErrorFirma } from "./firma.errors.js";
import type { ServicioFirmaService } from "./firma.service.js";
import type { ContenidoResolucion, MembreteInstitucional } from "./types.js";

/** Lee el correlationId dejado por el middleware de trazabilidad. */
function correlationIdDe(req: Request): string {
  const valor = (req as Request & { correlationId?: string }).correlationId;
  return typeof valor === "string" ? valor : "sin-correlation-id";
}

/** Traduce cualquier error al formato unificado del catalogo. */
function responderError(res: Response, req: Request, error: unknown): void {
  const correlationId = correlationIdDe(req);

  if (error instanceof ErrorFirma) {
    res.status(error.estadoHttp).json(error.descripcion(correlationId));
    return;
  }

  // No se filtra el mensaje interno ni la traza: se registra y se responde de
  // forma generica, conforme a la regla de seguridad del catalogo.
  console.error(`[${correlationId}] Error no controlado en el modulo de firma:`, error);
  res.status(500).json({
    code: "ERR-FIR-500",
    message: "Ocurrio un error interno al procesar la solicitud de firma.",
    category: "Internal",
    retryable: true,
    correlationId,
  });
}

/** Extrae y valida el cuerpo de la solicitud de invocacion. */
function leerSolicitud(req: Request): {
  documentoId?: string;
  expedienteId?: string;
  firmante: { id: string; nombre: string; documento: string };
  contenido?: ContenidoResolucion;
  membrete?: MembreteInstitucional;
  titulo?: string;
  subtitulo?: string;
  hostPublico: string;
} {
  const cuerpo = (req.body ?? {}) as Record<string, unknown>;

  const hostPublico =
    typeof cuerpo["hostPublico"] === "string" && cuerpo["hostPublico"].length > 0
      ? cuerpo["hostPublico"]
      : process.env["HOST_PUBLICO"] ?? "";

  const solicitud: {
    documentoId?: string;
    expedienteId?: string;
    firmante: { id: string; nombre: string; documento: string };
    contenido?: ContenidoResolucion;
    membrete?: MembreteInstitucional;
    titulo?: string;
    subtitulo?: string;
    hostPublico: string;
  } = {
    // El servicio valida la presencia y forma del firmante; aqui solo se
    // delimita el tipo para no arrastrar `unknown` a la capa de aplicacion.
    firmante: cuerpo["firmante"] as { id: string; nombre: string; documento: string },
    hostPublico,
  };

  if (typeof cuerpo["documentoId"] === "string") {
    solicitud.documentoId = cuerpo["documentoId"];
  }
  if (typeof cuerpo["expedienteId"] === "string") {
    solicitud.expedienteId = cuerpo["expedienteId"];
  }
  if (cuerpo["contenido"] !== undefined) {
    solicitud.contenido = cuerpo["contenido"] as ContenidoResolucion;
  }
  if (cuerpo["membrete"] !== undefined) {
    solicitud.membrete = cuerpo["membrete"] as MembreteInstitucional;
  }
  if (typeof cuerpo["titulo"] === "string") {
    solicitud.titulo = cuerpo["titulo"];
  }
  if (typeof cuerpo["subtitulo"] === "string") {
    solicitud.subtitulo = cuerpo["subtitulo"];
  }

  return solicitud;
}

/** Construye el router de firma a partir del servicio ya configurado. */
export function crearFirmaRouter(servicio: ServicioFirmaService, pool: Pool, actores: ActorProviderRutaDoc): Router {
  const router = Router();

  const autorizarFirmante = async (req: Request) => {
    const identidad = resolverIdentidad(req);
    if (!z.string().uuid().safeParse(identidad.idUsuario).success) throw new ForbiddenError();
    const cuenta = await pool.query<{ nombre: string; documento: string }>(
      `SELECT pn.nombre_completo AS nombre, p.id_documento AS documento
       FROM sigd_auth.cuenta_usuario cu
       JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
       JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
       WHERE cu.id_usuario = $1::uuid AND cu.activo = TRUE`, [identidad.idUsuario],
    );
    if (cuenta.rows.length !== 1) throw new ForbiddenError();
    // La facultad se obtiene de PostgreSQL; los roles declarados por el cliente
    // no sustituyen las asignaciones institucionales persistidas.
    const facultad = await verificarFacultadFirma(pool, identidad.idUsuario);
    if (!facultad.puedeFirmar || !facultad.facultadGlobal) {
      throw new ForbiddenError({ detail: 'Se requiere facultad global o una asociación verificable con el tipo de resolución autorizado.' });
    }
    return { id: identidad.idUsuario, ...cuenta.rows[0] };
  };
  const obtenerDocumentoAutorizado = async (req: Request, documentoId: string) => {
    if (!z.string().uuid().safeParse(documentoId).success) throw new NotFoundError();
    const doc = await pool.query<{
      documento_adjunto_id: string; expediente_id: string; nombre_archivo: string;
      s3_bucket: string; s3_key: string; sha256: string; mime_type: string;
    }>(`SELECT documento_adjunto_id, expediente_id, nombre_archivo, s3_bucket, s3_key, sha256, mime_type
        FROM sigd_doc.documento_adjunto WHERE documento_adjunto_id = $1::uuid`, [documentoId]);
    if (doc.rows.length !== 1) {
      throw new NotFoundError();
    }
    const actor = await actores.obtenerActor(req);
    if (!actor || !actor.puedeVerExpediente) {
      throw new NotFoundError();
    }
    const puedeVer = await actor.puedeVerExpediente(doc.rows[0].expediente_id);
    if (!puedeVer) {
      throw new NotFoundError();
    }
    return doc.rows[0];
  };

  router.get('/documento/:documentoId/estado', async (req: Request, res: Response, next) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      await autorizarFirmante(req);
      const documentoId = String(req.params.documentoId ?? '');
      await obtenerDocumentoAutorizado(req, documentoId);
      const evidencia = await servicio.consultarResultadoPersistido(pool, documentoId);
      res.json({ documentoId, estado: evidencia?.estado ?? null,
        resultado: evidencia ? { cvd: evidencia.cvd, timestamp: evidencia.timestamp,
          urlFirmado: generarDescargaAutorizada(evidencia.bucket, evidencia.key, req) } : null,
        integridadVerificada: evidencia !== null,
        validacionCriptografica: false,
      });
    } catch (error) { next(error); }
  });

  router.post("/invocar-refirma", async (req: Request, res: Response, next) => {
    try {
      const firmante = await autorizarFirmante(req);
      const solicitud = leerSolicitud(req);
      solicitud.firmante = firmante;
      if (solicitud.documentoId && solicitud.contenido === undefined) {
        const documento = await obtenerDocumentoAutorizado(req, solicitud.documentoId);

        // H-02: Validar correspondencia exacta entre documentoId y expedienteId
        if (solicitud.expedienteId && solicitud.expedienteId !== documento.expediente_id) {
          throw new ConflictError({
            code: 'SIGN_DOCUMENT_EXPEDIENTE_MISMATCH',
            message: 'El documento indicado no pertenece al expediente especificado.',
            detail: `El documento ${solicitud.documentoId} pertenece al expediente ${documento.expediente_id}, no coincide con ${solicitud.expedienteId}.`,
          });
        }
        solicitud.expedienteId = documento.expediente_id;

        // H-01: Validar que el expediente se encuentre formalmente en estado EN_FIRMA en RutaDoc
        const estadoExpRes = await pool.query<{ estado_nuevo: string }>(
          `SELECT estado_nuevo FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid`,
          [documento.expediente_id],
        );
        const estadoActual = estadoExpRes.rows[0]?.estado_nuevo;
        if (!estadoActual || estadoActual !== 'EN_FIRMA') {
          throw new ConflictError({
            code: 'EXPEDIENTE_ESTADO_INVALIDO_PARA_FIRMA',
            message: 'El expediente no se encuentra en estado formal para firma digital (EN_FIRMA).',
            detail: `El expediente ${documento.expediente_id} se encuentra en estado '${estadoActual ?? 'SIN_ESTADO'}' y no en 'EN_FIRMA'.`,
          });
        }

        // H-02: Validar correspondencia con borrador de resolución y convención de clave S3
        const resolucionRes = await pool.query<{ resolucion_id: string; numero_borrador: string }>(
          `SELECT resolucion_id, numero_borrador
           FROM sigd_doc.resolucion
           WHERE expediente_id = $1::uuid
             AND estado = 'BORRADOR_PENDIENTE_FIRMA'
             AND ('resoluciones/' || numero_borrador || '.pdf') = $2`,
          [documento.expediente_id, documento.s3_key],
        );
        if (resolucionRes.rows.length === 0) {
          throw new ConflictError({
            code: 'SIGN_DOCUMENT_NOT_A_RESOLUTION',
            message: 'El documento indicado no corresponde a una resolución pendiente de firma para este expediente.',
            detail: `El documento adjunto con clave ${documento.s3_key} no corresponde a un borrador de resolución activo del expediente.`,
          });
        }

        const config = obtenerConfiguracionS3();
        if (documento.s3_bucket !== config.bucket || documento.mime_type !== 'application/pdf' ||
            documento.s3_key.split('/').some(p => !p || p === '.' || p === '..')) throw new ForbiddenError();
        let bytes: Buffer;
        try {
          const respuesta = await fetch(generarUrlPresigned(documento.s3_key, config, { metodo: 'GET', expiraSegundos: 60 }),
            { signal: AbortSignal.timeout(10000), redirect: 'error' });
          if (!respuesta.ok || !respuesta.body) throw new Error('Objeto no disponible');
          const partes: Buffer[] = [];
          let tamano = 0;
          for await (const parte of Readable.fromWeb(respuesta.body as never)) {
            const contenido = Buffer.from(parte);
            tamano += contenido.length;
            if (tamano > 26_214_400) throw new Error('Documento demasiado grande');
            partes.push(contenido);
          }
          bytes = Buffer.concat(partes);
        } catch {
          throw new AppError({ status: 503, code: 'SIGN_DOCUMENT_UNAVAILABLE', message: 'El PDF no está disponible para firma.' });
        }
        const sha256 = new HashIntegrityService().calculateFromBuffer(bytes).sha256;
        if (!validarMagicBytes(bytes, 'PDF') || sha256 !== documento.sha256.toLowerCase()) {
          throw new AppError({ status: 409, code: 'SIGN_DOCUMENT_INTEGRITY', message: 'El PDF no coincide con el documento registrado.' });
        }
        await servicio.registrarDocumentoFirmable({ id: documento.documento_adjunto_id,
          nombreArchivo: documento.nombre_archivo, mimeType: documento.mime_type, bytes, sha256 });
      }
      const resultado = await servicio.invocarRefirma(solicitud);
      res.status(200).json(resultado);
    } catch (error) {
      if (error instanceof AppError) return next(error);
      responderError(res, req, error);
    }
  });

  router.post("/callback-refirma/:sesionId", async (req: Request, res: Response) => {
    try {
      const cuerpo = (req.body ?? {}) as Record<string, unknown>;
      const token = typeof cuerpo["token"] === "string" ? cuerpo["token"] : "";
      const hashDocumento =
        typeof cuerpo["hashDocumento"] === "string" ? cuerpo["hashDocumento"] : "";

      if (token.length === 0) {
        res.status(400).json({
          code: "ERR-FIR-400",
          message: "La solicitud de callback a firma es invalida.",
          category: "Validation",
          details: [
            {
              field: "token",
              issue: "El token de sesion es obligatorio en el callback.",
            },
          ],
          retryable: false,
          correlationId: correlationIdDe(req),
        });
        return;
      }

      const resultado = await servicio.recibirCallback(
        token,
        String(req.params["sesionId"] ?? ""),
        hashDocumento,
      );

      res.status(200).json(resultado);
    } catch (error) {
      responderError(res, req, error);
    }
  });

  router.get("/documento/:documentoId", async (req: Request, res: Response) => {
    try {
      const documentoId = String(req.params["documentoId"] ?? "");
      const token = typeof req.query["token"] === "string" ? req.query["token"] : "";

      const documento = await servicio.descargarDocumento(documentoId, token);

      if (documento === null) {
        res.status(404).json({
          code: "ERR-FIR-404",
          message:
            "El documento no esta disponible o el enlace de descarga expiro. Las URL temporales de firma duran 300 segundos.",
          category: "NotFound",
          retryable: false,
          correlationId: correlationIdDe(req),
        });
        return;
      }

      res.status(200);
      res.setHeader("Content-Type", documento.mimeType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${documento.nombreArchivo.replace(/["\\]/gu, "_")}"`,
      );
      res.setHeader("Cache-Control", "no-store");
      res.send(Buffer.from(documento.bytes));
    } catch (error) {
      responderError(res, req, error);
    }
  });

  return router;
}

export default crearFirmaRouter;
