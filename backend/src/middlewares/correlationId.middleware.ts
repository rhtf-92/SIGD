/**
 * Propagacion del identificador de correlacion.
 *
 * Conforme a `docs/integracion/01_convenciones_api_backend.md`, el backend acepta
 * un identificador recibido o genera uno, lo propaga y lo devuelve en la
 * respuesta dentro de `correlationId` y en la cabecera `X-Correlation-ID`.
 */

import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

/** Longitud maxima admitida para un correlationId entrante. */
const LONGITUD_MAXIMA = 128;

export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const recibido = req.header("X-Correlation-ID");

  const esValido =
    typeof recibido === "string" &&
    recibido.length > 0 &&
    recibido.length <= LONGITUD_MAXIMA &&
    /^[\w.:-]+$/u.test(recibido);

  const correlationId = esValido ? (recibido as string) : randomUUID();

  (req as Request & { correlationId?: string }).correlationId = correlationId;
  res.setHeader("X-Correlation-ID", correlationId);

  next();
}

export default correlationId;
