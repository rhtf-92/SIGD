import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware de Hardening HTTP (SEC-09)
 * Aplica cabeceras de seguridad defensivas en profundidad:
 * - X-Content-Type-Options: nosniff (evita MIME-sniffing)
 * - X-Frame-Options: DENY (mitiga Clickjacking)
 * - Referrer-Policy: strict-origin-when-cross-origin (evita fuga de tokens/IDs en URLs referer)
 * - Strict-Transport-Security: HSTS de 1 año con subdominios en producción
 * - Permissions-Policy: restringe APIs de hardware innecesarias
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (process.env.NODE_ENV === 'production' || req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}
