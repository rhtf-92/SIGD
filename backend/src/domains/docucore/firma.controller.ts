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
import type { Pool } from "pg";
import { z } from "zod";

import { autenticarJwt, verificarFacultadFirma } from "../../core/auth/auth.guard.js";
import { firmarTokenDescargaDocuCore, verificarTokenDescargaDocuCore } from "../../core/auth/jwt.service.js";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from "../../shared/domain/errors/index.js";
import {
  obtenerRolesActivos,
  requerirRolActivo,
  ROLES_DOCUCORE,
  verificarAccesoExpediente,
  verificarDocumentoDeExpediente,
} from "./docucore.security.js";
import { ErrorFirma } from "./firma.errors.js";
import type { ServicioFirmaService, SolicitudInvocarRefirma } from "./firma.service.js";
import type { ContenidoResolucion, MembreteInstitucional } from "./types.js";

/** Lee el correlationId dejado por el middleware de trazabilidad. */
function correlationIdDe(req: Request): string {
  const valor = (req as Request & { correlationId?: string }).correlationId;
  return typeof valor === "string" ? valor : "sin-correlation-id";
}

/** Traduce cualquier error al formato unificado del catalogo. */
function responderError(res: Response, req: Request, error: unknown): void {
  const correlationId = correlationIdDe(req);

  if (error instanceof AppError) {
    res.status(error.status).json({
      code: error.code,
      message: error.message,
      detail: error.detail,
      correlationId,
    });
    return;
  }

  if (error instanceof ErrorFirma) {
    res.status(error.estadoHttp).json(error.descripcion(correlationId));
    return;
  }

  if (error instanceof z.ZodError) {
    res.status(400).json({
      code: "ERR-FIR-400",
      message: "La solicitud de firma contiene datos inválidos.",
      category: "Validation",
      details: error.issues.map((issue) => ({
        field: issue.path.join("."),
        issue: issue.message,
      })),
      retryable: false,
      correlationId,
    });
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
function leerSolicitud(req: Request): SolicitudInvocarRefirma {
  const cuerpo = (req.body ?? {}) as Record<string, unknown>;

  const hostPublico =
    typeof cuerpo["hostPublico"] === "string" && cuerpo["hostPublico"].length > 0
      ? cuerpo["hostPublico"]
      : process.env["HOST_PUBLICO"] ?? "";

  const solicitud: SolicitudInvocarRefirma = {
    // El servicio valida la presencia y forma del firmante; aqui solo se
    // delimita el tipo para no arrastrar `unknown` a la capa de aplicacion.
    firmante: cuerpo["firmante"] as { id: string; nombre: string; documento: string },
    hostPublico,
  };

  if (typeof cuerpo["documentoId"] === "string") {
    solicitud.documentoId = cuerpo["documentoId"];
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
export function crearFirmaRouter(servicio: ServicioFirmaService, pool: Pool): Router {
  const router = Router();

  router.post(
    "/invocar-refirma",
    autenticarJwt,
    requerirRolActivo(pool, ...ROLES_DOCUCORE.FIRMAR),
    async (req: Request, res: Response) => {
      try {
        const datos = z.object({
          expedienteId: z.string().uuid(),
          resolucionId: z.string().uuid(),
          documentoId: z.string().uuid().optional(),
        }).parse(req.body);
        const cuenta = req.cuentaActual;
        if (!cuenta) throw new UnauthorizedError({ detail: "Autenticación requerida." });

        // SEC-02: la facultad y el estado de la resolución se consultan en cada invocación.
        await verificarAccesoExpediente(pool, cuenta.idUsuario, datos.expedienteId);
        if (datos.documentoId) {
          await verificarDocumentoDeExpediente(pool, datos.documentoId, datos.expedienteId);
        }

        const resolucion = await pool.query<{ tipo_resolucion: string }>(
          `SELECT tipo_resolucion
             FROM sigd_doc.resolucion
            WHERE resolucion_id = $1
              AND expediente_id = $2
              AND estado = 'EN_FIRMA'`,
          [datos.resolucionId, datos.expedienteId],
        );
        const filaResolucion = resolucion.rows[0];
        if (!filaResolucion) {
          throw new ConflictError({
            code: "RESOLUCION_NO_FIRMABLE",
            detail: "La resolución no pertenece al expediente o no está en estado EN_FIRMA.",
          });
        }

        const rolesActivos = await obtenerRolesActivos(pool, cuenta.idUsuario);
        const facultad = await verificarFacultadFirma(pool, cuenta.idUsuario, rolesActivos);
        if (
          !facultad.puedeFirmar ||
          (!facultad.facultadGlobal &&
            !facultad.tiposAutorizados.includes(filaResolucion.tipo_resolucion))
        ) {
          throw new ForbiddenError({
            detail: facultad.motivo ?? "No tiene facultad vigente para firmar esta resolución.",
          });
        }

        const solicitud = leerSolicitud(req);
        solicitud.documentoId = datos.documentoId;
        solicitud.firmante = {
          id: cuenta.idUsuario,
          nombre: solicitud.firmante?.nombre ?? "",
          documento: solicitud.firmante?.documento ?? "",
        };
        solicitud.usuarioId = cuenta.idUsuario;
        solicitud.expedienteId = datos.expedienteId;
        solicitud.tokenDescarga = firmarTokenDescargaDocuCore(cuenta.idUsuario, datos.expedienteId);

        const resultado = await servicio.invocarRefirma(solicitud);
        res.status(200).json(resultado);
      } catch (error) {
        responderError(res, req, error);
      }
    },
  );

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
      const jwt = typeof req.query["jwt"] === "string" ? req.query["jwt"] : "";
      if (!jwt) {
        throw new AppError({
          status: 401,
          code: "UNAUTHORIZED",
          message: "Se requiere un token JWT de descarga.",
          detail: "La URL de descarga no contiene el token de alcance requerido.",
        });
      }
      const claims = verificarTokenDescargaDocuCore(jwt);
      const expedienteId = claims.resource;
      await verificarAccesoExpediente(pool, claims.sub, expedienteId);

      const documento = await servicio.descargarDocumento(documentoId, token, {
        usuarioId: claims.sub,
        expedienteId,
      });

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
        `inline; filename="${documento.nombreArchivo.replace(/["\\\r\n]/gu, "_")}"`,
      );
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.send(Buffer.from(documento.bytes));
    } catch (error) {
      responderError(res, req, error);
    }
  });

  return router;
}

export default crearFirmaRouter;
