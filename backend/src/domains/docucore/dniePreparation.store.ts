import { Redis } from 'ioredis';
import type { RedisOptions } from 'ioredis';
import type { ContextoPreparacionFirma } from './dnieFirma.service.js';
import { AppError } from '../../shared/domain/errors/index.js';

export const TTL_PREPARACION_DNIE_SEGUNDOS = 300; // 5 minutos
export const PREFIJO_PREPARACION_DNIE = 'sigd:docucore:dnie:prep';

export interface DniePreparationStore {
  guardar(prep: ContextoPreparacionFirma, ttlSegundos?: number): Promise<void>;
  obtener(preparacionId: string): Promise<ContextoPreparacionFirma | null>;
  consumir(preparacionId: string): Promise<ContextoPreparacionFirma | null>;
  eliminar(preparacionId: string): Promise<void>;
  limpiar?(): Promise<void>;
  obtenerTtl?(preparacionId: string): Promise<number>;
}

export class InMemoryDniePreparationStore implements DniePreparationStore {
  private readonly mapa = new Map<string, { prep: ContextoPreparacionFirma; expiraEnMs: number }>();

  constructor(private readonly reloj: () => number = Date.now) {}

  async guardar(prep: ContextoPreparacionFirma, ttlSegundos = TTL_PREPARACION_DNIE_SEGUNDOS): Promise<void> {
    this.mapa.set(prep.preparacionId, {
      prep: JSON.parse(JSON.stringify(prep)),
      expiraEnMs: this.reloj() + ttlSegundos * 1000,
    });
  }

  async obtener(preparacionId: string): Promise<ContextoPreparacionFirma | null> {
    const reg = this.mapa.get(preparacionId);
    if (!reg) return null;
    if (reg.expiraEnMs <= this.reloj()) {
      this.mapa.delete(preparacionId);
      return null;
    }
    return JSON.parse(JSON.stringify(reg.prep));
  }

  async consumir(preparacionId: string): Promise<ContextoPreparacionFirma | null> {
    const reg = await this.obtener(preparacionId);
    if (!reg) return null;
    reg.consumido = true;
    await this.guardar(reg);
    return reg;
  }

  async eliminar(preparacionId: string): Promise<void> {
    this.mapa.delete(preparacionId);
  }

  async limpiar(): Promise<void> {
    this.mapa.clear();
  }

  async obtenerTtl(preparacionId: string): Promise<number> {
    const reg = this.mapa.get(preparacionId);
    if (!reg) return -2;
    const restante = Math.ceil((reg.expiraEnMs - this.reloj()) / 1000);
    return restante > 0 ? restante : -2;
  }
}

export class RedisDniePreparationStore implements DniePreparationStore {
  private redis: Redis;

  constructor(urlOCliente: string | Redis) {
    if (typeof urlOCliente === 'string') {
      const opciones: RedisOptions = {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        enableReadyCheck: true,
        lazyConnect: false,
      };
      this.redis = new Redis(urlOCliente, opciones);
      this.redis.on('error', () => {
        // Silenciar emisión no controlada para manejar en try/catch
      });
    } else {
      this.redis = urlOCliente;
    }
  }

  private clave(id: string): string {
    return `${PREFIJO_PREPARACION_DNIE}:${id}`;
  }

  async guardar(prep: ContextoPreparacionFirma, ttlSegundos = TTL_PREPARACION_DNIE_SEGUNDOS): Promise<void> {
    const k = this.clave(prep.preparacionId);
    try {
      await this.redis.set(k, JSON.stringify(prep), 'EX', ttlSegundos);
    } catch (err: any) {
      throw new AppError({
        status: 503,
        code: 'FIRMA_PREPARATION_STORE_NO_DISPONIBLE',
        message: 'El almacén distribuido Redis no se encuentra disponible al registrar la preparación.',
        detail: err.message,
      });
    }
  }

  async obtener(preparacionId: string): Promise<ContextoPreparacionFirma | null> {
    const k = this.clave(preparacionId);
    try {
      const raw = await this.redis.get(k);
      if (!raw) return null;
      return JSON.parse(raw) as ContextoPreparacionFirma;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError({
        status: 503,
        code: 'FIRMA_PREPARATION_STORE_NO_DISPONIBLE',
        message: 'El almacén distribuido Redis no se encuentra disponible al consultar la preparación.',
        detail: err.message,
      });
    }
  }

  async consumir(preparacionId: string): Promise<ContextoPreparacionFirma | null> {
    const prep = await this.obtener(preparacionId);
    if (!prep) return null;
    prep.consumido = true;
    await this.guardar(prep);
    return prep;
  }

  async eliminar(preparacionId: string): Promise<void> {
    const k = this.clave(preparacionId);
    try {
      await this.redis.del(k);
    } catch (err: any) {
      throw new AppError({
        status: 503,
        code: 'FIRMA_PREPARATION_STORE_NO_DISPONIBLE',
        message: 'Error al eliminar preparación en Redis.',
        detail: err.message,
      });
    }
  }

  async obtenerTtl(preparacionId: string): Promise<number> {
    const k = this.clave(preparacionId);
    try {
      return await this.redis.ttl(k);
    } catch (err: any) {
      throw new AppError({
        status: 503,
        code: 'FIRMA_PREPARATION_STORE_NO_DISPONIBLE',
        message: 'Error al consultar TTL en Redis.',
        detail: err.message,
      });
    }
  }

  async limpiar(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${PREFIJO_PREPARACION_DNIE}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      // Ignorar en test
    }
  }

  async cerrar(): Promise<void> {
    await this.redis.quit().catch(() => {});
  }
}

let almacenActivo: DniePreparationStore | null = null;

export function obtenerDniePreparationStore(): DniePreparationStore {
  if (almacenActivo) return almacenActivo;
  const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
  const redisUrl = process.env.REDIS_URL;

  // En producción: salvaguarda fail-closed estricta. Jamás fallback silencioso a memoria
  if (isProduction) {
    if (!redisUrl || redisUrl.trim().length === 0) {
      throw new AppError({
        status: 503,
        code: 'FIRMA_PREPARATION_STORE_NO_DISPONIBLE',
        message: 'El almacén distribuido Redis (REDIS_URL) es estrictamente obligatorio en producción para firma digital institucional.',
      });
    }
    almacenActivo = new RedisDniePreparationStore(redisUrl);
    return almacenActivo;
  }

  // En desarrollo conectado a infraestructura o test con REDIS_URL explícita
  if (redisUrl && redisUrl.trim().length > 0) {
    try {
      almacenActivo = new RedisDniePreparationStore(redisUrl);
      return almacenActivo;
    } catch {
      // Continuar a fallback de memoria si no estamos en producción
    }
  }

  almacenActivo = new InMemoryDniePreparationStore();
  return almacenActivo;
}

export function establecerDniePreparationStore(store: DniePreparationStore | null): void {
  almacenActivo = store;
}
