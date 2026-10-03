import type { Request, Response, NextFunction } from 'express';

const ORIGENES_DEFAULT = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const METODOS_PERMITIDOS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD';
const CABECERAS_PERMITIDAS =
  'Authorization, Content-Type, X-Correlation-ID, x-correlation-id, X-Usuario-ID, x-usuario-id, Accept';
const CABECERAS_EXPUESTAS = 'X-Correlation-ID, x-correlation-id, Date';

function parsearOrigenesPermitidos(): string[] {
  const origenesEnv = process.env.CORS_ORIGIN;
  if (!origenesEnv) return ORIGENES_DEFAULT;
  const configurados = origenesEnv
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  return Array.from(new Set([...ORIGENES_DEFAULT, ...configurados]));
}

function esOrigenPermitido(origin: string | undefined, origenesValidos: string[]): boolean {
  if (!origin) return true;
  if (origenesValidos.includes(origin)) return true;

  // En desarrollo o entornos de prueba se admiten orígenes locales sobre cualquier puerto
  if (process.env.NODE_ENV !== 'production') {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(origin)) {
      return true;
    }
  }

  return false;
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const origenesValidos = parsearOrigenesPermitidos();

  if (origin && esOrigenPermitido(origin, origenesValidos)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!origin && process.env.NODE_ENV !== 'production') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', METODOS_PERMITIDOS);
  res.setHeader('Access-Control-Allow-Headers', CABECERAS_PERMITIDAS);
  res.setHeader('Access-Control-Expose-Headers', CABECERAS_EXPUESTAS);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}
