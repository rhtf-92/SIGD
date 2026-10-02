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
export function crearFirmaRouter(servicio: ServicioFirmaService): Router {
  const router = Router();

  router.post("/invocar-refirma", async (req: Request, res: Response) => {
    try {
      const resultado = await servicio.invocarRefirma(leerSolicitud(req));
      res.status(200).json(resultado);
    } catch (error) {
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
