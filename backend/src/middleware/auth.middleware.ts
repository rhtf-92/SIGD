import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';
import { esRolUsuario } from '../models/User.js';

export interface AuthenticatedRequest extends Request {
  authenticatedUser: {
    id: string;
    role: string;
  };
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authorization = req.get('authorization');
  const [scheme, token, ...extra] = authorization?.trim().split(/\s+/) ?? [];
  if (scheme?.toLowerCase() !== 'bearer' || !token || extra.length > 0) {
    res.status(401).json({ message: 'Se requiere un token Bearer válido.' });
    return;
  }

  const secret = getJwtSecret();
  let payload: string | JwtPayload;
  try {
    payload = jwt.verify(token, secret);
  } catch {
    res.status(401).json({ message: 'El token es inválido o ha expirado.' });
    return;
  }

  if (typeof payload === 'string' || typeof payload.sub !== 'string' || !esRolUsuario(payload.rol)) {
    res.status(401).json({ message: 'El token no contiene una identidad válida.' });
    return;
  }

  (req as AuthenticatedRequest).authenticatedUser = {
    id: payload.sub,
    role: payload.rol,
  };
  next();
}
