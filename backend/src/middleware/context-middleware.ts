import type { NextFunction, Request, Response } from 'express';
import { crearContexto, runWithContext } from '../shared/request-context/request-context.js';

export const CONTEXT_HEADER = 'x-correlation-id';

export function contextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const recibido = req.get(CONTEXT_HEADER);
  const contexto = crearContexto({
    correlation_id: recibido && recibido.trim() !== '' ? recibido.trim() : undefined,
    ip_origen: req.ip || '',
    user_agent: req.get('user-agent') || '',
  });

  res.setHeader(CONTEXT_HEADER, contexto.correlation_id);

  runWithContext(contexto, () => next());
}