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
  private cliente(): Promise<Redis> {
    this.conexion ??= (async () => {
      if (!process.env.REDIS_URL) throw new Error('REDIS_NOT_CONFIGURED');
      const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 3000,
        maxRetriesPerRequest: 1, retryStrategy: () => null });
      redis.on('error', () => { /* Return a sanitized availability error below. */ });
      await redis.connect();
      return redis;
    })();
    return this.conexion;
  }
  private async ejecutar<T>(fn: (r: Redis) => Promise<T>): Promise<T> {
    try { return await fn(await this.cliente()); }
    catch { this.conexion = undefined; throw new AppError({ status: 503, code: 'PUBLIC_PROTECTION_UNAVAILABLE',
      message: 'La protección de Mesa de Partes no está disponible. Inténtelo más tarde.' }); }
  }
  leer(key: string) { return this.ejecutar(r => r.get(`sigd:public:v1:${key}`)); }
  async guardar(key: string, value: string, ttl: number) {
    await this.ejecutar(r => r.set(`sigd:public:v1:${key}`, value, 'EX', ttl));
  }
  consumir(key: string) { return this.ejecutar(r => r.getdel(`sigd:public:v1:${key}`)); }
  async cuota(key: string, max: number, ttl: number, amount = 1): Promise<boolean> {
    const result = await this.ejecutar(r => r.eval(`local n=redis.call('INCRBY',KEYS[1],ARGV[1]);
      if n==tonumber(ARGV[1]) then redis.call('EXPIRE',KEYS[1],ARGV[2]) end;
      return n<=tonumber(ARGV[3]) and 1 or 0`, 1, `sigd:public:v1:quota:${key}`, amount, ttl, max));
    return Number(result) === 1;
  }
}
