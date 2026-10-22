import type { Request, Response, NextFunction } from 'express';

interface IntentosRegistro {
  count: number;
  primeraPeticion: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  maxIntentos: number;
  /** Límite global por IP para mitigar ataques de Password Spraying horizontal (default: maxIntentos * 5) */
  maxIntentosPorIp?: number;
  message?: string;
}

/**
 * Extrae la dirección IP del cliente respetando TRUST_PROXY cuando está explícitamente configurado.
 * Si TRUST_PROXY no está habilitado, ignora cabeceras x-forwarded-for para evitar suplantación (spoofing).
 */
export function extraerIpCliente(req: Request): string {
  const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';
  if (trustProxy) {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (typeof xForwardedFor === 'string') {
      const primerIp = xForwardedFor.split(',')[0].trim();
      if (primerIp) return primerIp;
    } else if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
      const primerIp = xForwardedFor[0].split(',')[0].trim();
      if (primerIp) return primerIp;
    }
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Rate Limiter en memoria con protección dual:
 * 1. Límite estricto por IP + Identificador (ej. 5 intentos / 15 min) contra fuerza bruta dirigida.
 * 2. Límite global por IP (ej. 25 intentos / 15 min) contra Password Spraying horizontal.
 *
 * NOTA DE ARQUITECTURA (SEC-10):
 * Este limitador opera en la memoria del proceso (Map con TTL y limpieza periódica), diseñado
 * para despliegues de un solo nodo. En clústeres multi-pod con escalamiento horizontal,
 * el estado debe respaldarse en Redis (ioredis) utilizando comandos atómicos INCR + EXPIRE.
 */
export function crearRateLimiter(options: RateLimiterOptions) {
  const registro = new Map<string, IntentosRegistro>();
  const maxPorIp = options.maxIntentosPorIp ?? Math.max(options.maxIntentos * 5, 20);

  // Limpieza periódica de entradas expiradas para evitar fugas de memoria
  const intervalo = setInterval(() => {
    const ahora = Date.now();
    for (const [clave, datos] of registro.entries()) {
      if (ahora - datos.primeraPeticion > options.windowMs) {
        registro.delete(clave);
      }
    }
  }, options.windowMs);

  if (intervalo.unref) {
    intervalo.unref();
  }

  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    // Si estamos en suite de pruebas y se solicita explícitamente bypass condicional
    if (process.env.NODE_ENV === 'test' && req.headers['x-skip-rate-limit'] === 'true') {
      return next();
    }

    const ip = extraerIpCliente(req);
    const identificador = req.body?.identificador ? String(req.body.identificador).trim().toLowerCase() : 'anon';
    const claveIpGlobal = `ip_global:${ip}`;
    const claveUsuario = `user:${ip}:${identificador}`;
    const ahora = Date.now();

    // 1. Verificación global por IP (Mitigación de Password Spraying horizontal)
    const actualIp = registro.get(claveIpGlobal);
    if (actualIp && (ahora - actualIp.primeraPeticion <= options.windowMs) && actualIp.count >= maxPorIp) {
      const tiempoRestanteMs = options.windowMs - (ahora - actualIp.primeraPeticion);
      const segundosRestantes = Math.max(1, Math.ceil(tiempoRestanteMs / 1000));

      res.setHeader('Retry-After', segundosRestantes);
      res.status(429).json({
        type: 'https://datatracker.ietf.org/doc/html/rfc9457',
        title: 'Too Many Requests',
        status: 429,
        code: 'RATE_LIMIT_IP_EXCEEDED',
        detail: `Demasiados intentos de autenticación globales desde esta IP. Bloqueo temporal por mitigación de password spraying (SEC-10). Reintente en ${segundosRestantes} segundos.`,
      });
      return;
    }

    // 2. Verificación por IP + Identificador (Fuerza bruta dirigida a cuenta específica)
    const actualUsuario = registro.get(claveUsuario);
    if (actualUsuario && (ahora - actualUsuario.primeraPeticion <= options.windowMs) && actualUsuario.count >= options.maxIntentos) {
      const tiempoRestanteMs = options.windowMs - (ahora - actualUsuario.primeraPeticion);
      const segundosRestantes = Math.max(1, Math.ceil(tiempoRestanteMs / 1000));

      res.setHeader('Retry-After', segundosRestantes);
      res.status(429).json({
        type: 'https://datatracker.ietf.org/doc/html/rfc9457',
        title: 'Too Many Requests',
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        detail: options.message || `Demasiados intentos de autenticación fallidos. Intente nuevamente en ${segundosRestantes} segundos.`,
      });
      return;
    }

    // Registrar / incrementar contador IP global
    if (!actualIp || (ahora - actualIp.primeraPeticion > options.windowMs)) {
      registro.set(claveIpGlobal, { count: 1, primeraPeticion: ahora });
    } else {
      actualIp.count += 1;
    }

    // Registrar / incrementar contador por cuenta
    if (!actualUsuario || (ahora - actualUsuario.primeraPeticion > options.windowMs)) {
      registro.set(claveUsuario, { count: 1, primeraPeticion: ahora });
    } else {
      actualUsuario.count += 1;
    }

    return next();
  };

  middleware.reset = () => {
    registro.clear();
  };

  return middleware;
}

// Limitador por defecto para autenticación: 5 intentos por cuenta, 25 globales por IP en 15 min (SEC-10)
export const loginRateLimiter = crearRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxIntentos: 5,
  maxIntentosPorIp: 25,
  message: 'Límite de intentos de inicio de sesión excedido. Bloqueo temporal por seguridad (SEC-10).',
});
