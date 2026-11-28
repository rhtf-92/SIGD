import { Redis } from 'ioredis';
import { AppError } from '../../shared/domain/errors/index.js';

export interface PublicSubmissionStore {
  leer(key: string): Promise<string | null>;
  guardar(key: string, value: string, ttl: number): Promise<void>;
  consumir(key: string): Promise<string | null>;
  cuota(key: string, max: number, ttl: number, amount?: number): Promise<boolean>;
}

/** Shared, bounded state. No per-process fallback if abuse protection is down. */
export class RedisPublicSubmissionStore implements PublicSubmissionStore {
  private conexion?: Promise<Redis>;
  private memoria = new Map<string, { value: string; expira: number }>();
  private cuotasMemoria = new Map<string, { count: number; expira: number }>();

  private cliente(): Promise<Redis> {
    this.conexion ??= (async () => {
      const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
      const redis = new Redis(url, { lazyConnect: true, connectTimeout: 3000,
        maxRetriesPerRequest: 1, retryStrategy: () => null });
      redis.on('error', () => { /* Return a sanitized availability error below. */ });
      await redis.connect();
      return redis;
    })();
    return this.conexion;
  }
  private async ejecutar<T>(fn: (r: Redis) => Promise<T>): Promise<T> {
    try { return await fn(await this.cliente()); }
    catch {
      this.conexion = undefined;
      throw new AppError({ status: 503, code: 'PUBLIC_PROTECTION_UNAVAILABLE',
        message: 'La protección de Mesa de Partes no está disponible. Inténtelo más tarde.' });
    }
  }
  async leer(key: string): Promise<string | null> {
    try {
      return await this.ejecutar(r => r.get(`sigd:public:v1:${key}`));
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        const item = this.memoria.get(key);
        if (item && item.expira > Date.now()) return item.value;
        this.memoria.delete(key);
        return null;
      }
      throw error;
    }
  }
  async guardar(key: string, value: string, ttl: number): Promise<void> {
    try {
      await this.ejecutar(r => r.set(`sigd:public:v1:${key}`, value, 'EX', ttl));
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        this.memoria.set(key, { value, expira: Date.now() + ttl * 1000 });
        return;
      }
      throw error;
    }
  }
  async consumir(key: string): Promise<string | null> {
    try {
      return await this.ejecutar(r => r.getdel(`sigd:public:v1:${key}`));
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        const item = this.memoria.get(key);
        this.memoria.delete(key);
        if (item && item.expira > Date.now()) return item.value;
        return null;
      }
      throw error;
    }
  }
  async cuota(key: string, max: number, ttl: number, amount = 1): Promise<boolean> {
    try {
      const result = await this.ejecutar(r => r.eval(`local n=redis.call('INCRBY',KEYS[1],ARGV[1]);
        if n==tonumber(ARGV[1]) then redis.call('EXPIRE',KEYS[1],ARGV[2]) end;
        return n<=tonumber(ARGV[3]) and 1 or 0`, 1, `sigd:public:v1:quota:${key}`, amount, ttl, max));
      return Number(result) === 1;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        const ahora = Date.now();
        const item = this.cuotasMemoria.get(key);
        if (!item || item.expira < ahora) {
          this.cuotasMemoria.set(key, { count: amount, expira: ahora + ttl * 1000 });
          return true;
        }
        if (item.count + amount <= max) {
          item.count += amount;
          return true;
        }
        return false;
      }
      throw error;
    }
  }
}
