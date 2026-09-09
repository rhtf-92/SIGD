import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { crearContexto, runWithContext } from '../shared/request-context/request-context.js';

export const CONTEXT_HEADER = 'x-correlation-id';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID_REGEX.test(valor);
}

export function contextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const recibido = req.get(CONTEXT_HEADER);

  let correlationId: string | undefined;
  if (recibido && recibido.trim() !== '') {
    const limpio = recibido.trim();
    if (esUuid(limpio)) {
      correlationId = limpio;
    } else {
      correlationId = randomUUID();
    }
  }

  const contexto = crearContexto({
    correlation_id: correlationId,
    ip_origen: req.ip || '',
    user_agent: req.get('user-agent') || '',
  });

  res.setHeader(CONTEXT_HEADER, contexto.correlation_id);

  runWithContext(contexto, () => next());
}
