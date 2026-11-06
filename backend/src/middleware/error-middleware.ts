import type { NextFunction, Request, Response } from 'express';
import { serializeError } from '../errors/error-mapper.js';
import type { ApiErrorResponse } from '../shared/types/index.js';
import { getRequestContext } from '../shared/request-context/request-context.js';
import { CONTEXT_HEADER } from './context-middleware.js';

const BASE_TYPE_URI = 'https://sigd.iestpsuiza.edu.pe/errors';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorMiddleware(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  const serializado = serializeError(error);
  const contexto = getRequestContext();
  const correlation_id = contexto?.correlation_id ?? '';

  if (serializado.status >= 500) {
    console.error(
      `[ERROR 5xx] correlation_id=${correlation_id} method=${req.method} path=${req.originalUrl}`,
      error,
    );
  }

  res.setHeader(CONTEXT_HEADER, correlation_id);

  // Fallback de emergencia (desarrollo): evitar que errores 5xx no manejados rompan
  // la UI con "Network Error" por contratos inesperados. Devuelve JSON parseable.
  if (serializado.status >= 500 && process.env.NODE_ENV !== 'production' && req.originalUrl.startsWith('/api')) {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      ok: false,
      status: serializado.status,
      code: serializado.code,
      detail: serializado.detail,
      correlation_id,
      fallback: true,
    });
    return;
  }

  const ahoraIso = new Date().toISOString();

  const body: ApiErrorResponse = {
    type: `${BASE_TYPE_URI}/${serializado.code.toLowerCase()}`,
    title: titleForStatus(serializado.status, serializado.code),
    status: serializado.status,
    detail: serializado.detail,
    instance: req.originalUrl,
    code: serializado.code,
    codigo: serializado.code,
    correlation_id,
    correlationId: correlation_id,
    invalid_params: serializado.invalidParams,
    invalidParams: serializado.invalidParams,
    timestamp: ahoraIso,
  };

  res.setHeader('Content-Type', 'application/problem+json');
  res.status(serializado.status).json(body);
}

function titleForStatus(status: number, code: string): string {
  const map: Record<number, string> = {
    400: 'Validation Error',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    500: 'Internal Server Error',
  };
  return (map[status] ?? code) as string;
}