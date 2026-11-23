import { Redis } from 'ioredis';
import { AppError } from '../../shared/domain/errors/index.js';
import type { PublicSubmissionStore } from './publicSubmission.store.js';

/**
 * Limitador de tasa distribuido institucional respaldado en Redis (Puerto 6379).
 * Implementa política Fail-Secure: si Redis no responde o no está configurado,
 * rechaza las solicitudes con HTTP 503 en lugar de degradarse a contadores en memoria.
 */

export interface RateLimiterOptions {
  maxPorIp?: number;
  ventanaIpSegundos?: number;
  maxPorCut?: number;
  ventanaCutSegundos?: number;
}

export class RateLimiterRedis {
  private conexion?: Promise<Redis>;
  private readonly maxPorIp: number;
  private readonly ventanaIpSegundos: number;
  private readonly maxPorCut: number;
  private readonly ventanaCutSegundos: number;

  constructor(
    private readonly store?: PublicSubmissionStore,
    opciones: RateLimiterOptions = {}
  ) {
    this.maxPorIp = opciones.maxPorIp ?? 30; // 30 req / minuto por IP
    this.ventanaIpSegundos = opciones.ventanaIpSegundos ?? 60;
    this.maxPorCut = opciones.maxPorCut ?? 60; // 60 req / hora por CUT
    this.ventanaCutSegundos = opciones.ventanaCutSegundos ?? 3600;
  }

  private cliente(): Promise<Redis> {
    this.conexion ??= (async () => {
      const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
      const redis = new Redis(url, {
        lazyConnect: true,
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      redis.on('error', () => {
        /* Se captura y traduce en el bloque de ejecución */
      });
      await redis.connect();
      return redis;
    })();
    return this.conexion;
  }

  private async ejecutarCuota(clave: string, max: number, ttlSegundos: number): Promise<boolean> {
    if (this.store) {
      return this.store.cuota(clave, max, ttlSegundos);
    }

    try {
      const redis = await this.cliente();
      const lua = `
        local n = redis.call('INCRBY', KEYS[1], ARGV[1]);
        if n == tonumber(ARGV[1]) then
          redis.call('EXPIRE', KEYS[1], ARGV[2]);
        end;
        return n <= tonumber(ARGV[3]) and 1 or 0;
      `;
      const res = await redis.eval(
        lua,
        1,
        `sigd:ratelimit:seguimiento:${clave}`,
        1,
        ttlSegundos,
        max
      );
      return Number(res) === 1;
    } catch {
      this.conexion = undefined;
      // Fail-Secure estricto: deniega el servicio si el subsistema de protección está caído
      throw new AppError({
        status: 503,
        code: 'PUBLIC_PROTECTION_UNAVAILABLE',
        message: 'El sistema de protección contra abusos no se encuentra disponible. Por favor intente más tarde.',
      });
    }
  }

  /**
   * Verifica los límites por IP y por CUT. Lanza HTTP 429 si se superan los límites.
   */
  async verificarLimiteSeguimiento(ip: string, cut?: string): Promise<void> {
    const ipLimpia = ip.trim() || 'unknown_ip';
    const ipAdmitida = await this.ejecutarCuota(`ip:${ipLimpia}`, this.maxPorIp, this.ventanaIpSegundos);
    if (!ipAdmitida) {
      throw new AppError({
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Demasiadas consultas de seguimiento público desde su dirección de red. Por favor espere antes de reintentar.',
      });
    }

    if (cut) {
      const cutLimpio = cut.trim().toUpperCase();
      const cutAdmitido = await this.ejecutarCuota(
        `cut:${cutLimpio}`,
        this.maxPorCut,
        this.ventanaCutSegundos
      );
      if (!cutAdmitido) {
        throw new AppError({
          status: 429,
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Se ha alcanzado el límite de consultas para este expediente. Por favor espere antes de reintentar.',
        });
      }
    }
  }
}
