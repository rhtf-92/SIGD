import crypto from 'node:crypto';
import { Redis } from 'ioredis';
import type { Pool } from 'pg';
import { AppError } from '../../shared/domain/errors/index.js';

/** A transport must deliver to the stored contact. Never return/log the code. */
export interface EntregaOtp {
  enviar(destinatario: string, codigo: string): Promise<void>;
}
export interface AlmacenOtp {
  cuota(clave: string, limite: number, segundos: number): Promise<boolean>;
  guardar(clave: string, valor: string, segundos: number): Promise<void>;
  consumir(clave: string): Promise<string | null>;
  verificar(clave: string, digest: string): Promise<string | null>;
}
const prefijo = 'sigd:identicore:otp:v1:';
export class RedisAlmacenOtp implements AlmacenOtp {
  private redis?: Redis;
  private cliente(): Redis {
    if (!process.env.REDIS_URL) throw new Error('OTP_STORE_UNAVAILABLE');
    if (!this.redis) {
      this.redis = new Redis(process.env.REDIS_URL, { connectTimeout: 3000,
        commandTimeout: 5000, maxRetriesPerRequest: 1, retryStrategy: () => null });
      this.redis.on('error', () => { /* Availability is translated at the boundary. */ });
    }
    return this.redis;
  }
  async cuota(clave: string, limite: number, segundos: number): Promise<boolean> {
    const n = await this.cliente().eval(`local n=redis.call('INCR',KEYS[1]);
      if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n`, 1, prefijo + clave, segundos);
    return Number(n) <= limite;
  }
  async guardar(clave: string, valor: string, segundos: number): Promise<void> {
    await this.cliente().set(prefijo + clave, valor, 'EX', segundos);
  }
  consumir(clave: string): Promise<string | null> { return this.cliente().getdel(prefijo + clave); }
  async verificar(clave: string, digest: string): Promise<string | null> {
    // Atomic attempt counter and consume: concurrent successes cannot mint two proofs.
    const resultado = await this.cliente().eval(`local raw=redis.call('GET',KEYS[1]);
      if not raw then return nil end; local v=cjson.decode(raw);
      v.intentos=v.intentos+1;
      if v.digest==ARGV[1] then redis.call('DEL',KEYS[1]); return cjson.encode(v.prueba) end;
      if v.intentos>=5 then redis.call('DEL',KEYS[1]);
      else redis.call('SET',KEYS[1],cjson.encode(v),'KEEPTTL') end; return nil`, 1, prefijo + clave, digest);
    return typeof resultado === 'string' ? resultado : null;
  }
  async cerrar(): Promise<void> { this.redis?.disconnect(); this.redis = undefined; }
}
export interface IdentidadParaOtp {
  tipoDocumento: 'DNI' | 'CE'; numeroDocumento: string; nombres: string; apellidos: string;
}
interface PruebaTitularidad { persona: string; documento: string; contactoHash: string }
export const normalizarIdentidadOtp = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .trim().replace(/\s+/g, ' ').toUpperCase();
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const indisponible = () => new AppError({ status: 503, code: 'IDENTITY_VERIFICATION_UNAVAILABLE',
  message: 'La verificación del contacto no está disponible. Solicite validación institucional presencial.' });
const invalida = () => new AppError({ status: 400, code: 'IDENTITY_VERIFICATION_INVALID',
  message: 'El código o la verificación no son válidos, expiraron o ya fueron utilizados.' });

export class IdentidadOtpService {
  constructor(private readonly pool: Pool, private readonly store: AlmacenOtp = new RedisAlmacenOtp(),
    private readonly entrega?: EntregaOtp,
    private readonly secret = process.env.AUTH_JWT_SECRET ?? process.env.JWT_SECRET) {}
  disponible(): boolean { return Boolean(this.entrega && this.secret && this.secret.length >= 32); }
  private digest(desafio: string, codigo: string): string {
    if (!this.secret || this.secret.length < 32) throw indisponible();
    return crypto.createHmac('sha256', this.secret).update('identicore-otp:' + desafio + ':' + codigo).digest('hex');
  }

  async iniciar(datos: IdentidadParaOtp, ip: string): Promise<{ desafio: string; mensaje: string }> {
    if (!this.disponible() || !this.entrega) throw indisponible();
    try {
      if (!await this.store.cuota('solicitudes:ip:' + hash(ip), 10, 900) ||
          !await this.store.cuota('solicitudes:doc:' + hash(datos.tipoDocumento + ':' + datos.numeroDocumento), 3, 900)) {
        throw new AppError({ status: 429, code: 'IDENTITY_VERIFICATION_RATE_LIMIT', message: 'Espere antes de solicitar otro código.' });
      }
      const desafio = crypto.randomUUID();
      const mensaje = 'Si los datos coinciden y existe un contacto registrado, recibirá un código válido durante 10 minutos. Si no lo recibe, solicite validación institucional presencial.';
      const result = await this.pool.query<{ id_persona: string; nombres: string; apellidos: string; correo: string | null }>(`
        SELECT p.id_persona, pn.nombres, pn.apellidos, pn.correo
          FROM sigd_auth.persona p JOIN sigd_auth.persona_natural pn USING (id_persona)
         WHERE p.tipo='NATURAL' AND p.id_documento=$1
           AND NOT EXISTS (SELECT 1 FROM sigd_auth.persona_documento_historial h
             JOIN sigd_auth.tipos_documento t ON t.id_tipo_documento=h.tipo_documento
             WHERE h.id_persona=p.id_persona AND h.id_documento=p.id_documento AND t.codigo<>$2)`,
        [datos.numeroDocumento, datos.tipoDocumento]);
      const persona = result.rows[0];
      if (persona && persona.correo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(persona.correo) &&
          normalizarIdentidadOtp(persona.nombres) === normalizarIdentidadOtp(datos.nombres) &&
          normalizarIdentidadOtp(persona.apellidos) === normalizarIdentidadOtp(datos.apellidos)) {
        const codigo = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
        const prueba: PruebaTitularidad = { persona: persona.id_persona, documento: datos.numeroDocumento,
          contactoHash: hash(persona.correo.trim().toLowerCase()) };
        await this.store.guardar('desafio:' + desafio, JSON.stringify({ digest: this.digest(desafio, codigo), intentos: 0, prueba }), 600);
        try { await this.entrega.enviar(persona.correo, codigo); }
        catch { await this.store.consumir('desafio:' + desafio); throw indisponible(); }
      }
      // Same response for unknown document, mismatched PII or absent contact.
      return { desafio, mensaje };
    } catch (e) { if (e instanceof AppError) throw e; throw indisponible(); }
  }

  async verificar(desafio: string, codigo: string, ip: string): Promise<{ verificacionTitularidad: string }> {
    if (!this.disponible()) throw indisponible();
    try {
      if (!await this.store.cuota('verificaciones:ip:' + hash(ip), 30, 900))
        throw new AppError({ status: 429, code: 'IDENTITY_VERIFICATION_RATE_LIMIT', message: 'Espere antes de intentar otra verificación.' });
      const prueba = await this.store.verificar('desafio:' + desafio, this.digest(desafio, codigo));
      if (!prueba) throw invalida();
      const token = crypto.randomBytes(32).toString('hex');
      await this.store.guardar('prueba:' + hash(token), prueba, 300);
      return { verificacionTitularidad: token };
    } catch (e) { if (e instanceof AppError) throw e; throw indisponible(); }
  }

  /** Consumed under the database identity row lock; rollback requires a new OTP. */
  async consumir(token: string | undefined, persona: string, documento: string, correoOriginal: string | null): Promise<void> {
    if (!token || !/^[0-9a-f]{64}$/.test(token)) throw new AppError({ status: 409,
      code: 'CITIZEN_IDENTITY_VERIFICATION_REQUIRED', message: 'Verifique el contacto previamente registrado o solicite validación institucional presencial.' });
    try {
      const raw = await this.store.consumir('prueba:' + hash(token));
      if (!raw) throw invalida();
      const prueba = JSON.parse(raw) as PruebaTitularidad;
      if (prueba.persona !== persona || prueba.documento !== documento || !correoOriginal ||
          prueba.contactoHash !== hash(correoOriginal.trim().toLowerCase())) throw invalida();
    } catch (e) { if (e instanceof AppError) throw e; throw indisponible(); }
  }
}
