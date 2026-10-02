/**
 * T-BE-DC-11 — Tokens de sesion de firma con vigencia efimera.
 *
 * Problema que resuelve: una sesion de firma podia quedar abierta de forma
 * indefinida si la invocacion inicial se interrumpia, y un tercero podia
 * completar la firma en nombre del director.
 *
 * Solucion aplicada:
 *   - Token criptografico univoco de 256 bits generado con `randomBytes`.
 *   - TTL estricto de 300 segundos (5 minutos) impuesto por Redis 7 mediante
 *     `SET ... EX`, de modo que el vencimiento lo controla el servidor y no el
 *     proceso de Node.
 *   - Consumo atomico y autodestruccion con `GETDEL` (Redis 6.2+): el primer
 *     callback firmado obtiene la sesion y todos los reintentos posteriores
 *     fallan, aunque lleguen dentro de la ventana de vigencia.
 *   - La clave se deriva de SHA-256 del token, nunca del token en claro, para
 *     que un dump del keyspace no exponga credenciales de sesion.
 *
 * Estado: PROPUESTO. El TTL de 300 segundos coincide con el `timeExpireToken`
 * queRENIEC documenta para su propio ReFirma Invoker; queda PENDIENTE que el
 * profesor confirme el valor oficial para el SIGD.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { Redis } from "ioredis";
import type { RedisOptions } from "ioredis";

/** Vigencia estricta de una sesion de firma, en segundos (5 minutos). */
export const TTL_SESION_FIRMA_SEGUNDOS = 300;

/** Prefijo del espacio de claves de DocuCore dentro de Redis. */
export const PREFIJO_SESION_FIRMA = "sigd:docucore:firma:sesion";

/** Datos del firmante que se conservan en la sesion. */
export interface Firmante {
  id: string;
  nombre: string;
  documento: string;
}

/** Sesion de firma persistida con vigencia efimera. */
export interface SesionFirma {
  /** Identificador de la sesion, unico por invocacion. */
  id: string;
  /** Token opaco entregado al agente de escritorio. */
  token: string;
  /** SHA-256 en hexadecimal del PDF a firmar. */
  hashDocumento: string;
  /** Identificador del documento en el repositorio documental. */
  documentoId: string;
  firmante: Firmante;
  /** Momento de emision, en ISO-8601. */
  creadaEn: string;
  /** Momento exacto de expiracion, en ISO-8601. */
  expiraEn: string;
}

/**
 * Contrato del almacen de sesiones.
 *
 * Se declara como interfaz para que las pruebas unitarias y el desarrollo local
 * puedan usar la implementacion en memoria sin levantar Redis.
 */
export interface FirmaSessionStore {
  /**
   * Publica la sesion con TTL. Si el token ya existe, no lo sobrescribe y
   * devuelve `false`; una colision implicaria un token comprometido.
   */
  crear(sesion: SesionFirma, ttlSegundos: number): Promise<boolean>;

  /**
   * Obtiene la sesion y la destruye en una sola operacion atomica.
   * Devuelve `null` si no existe, ya fue consumida o expiro.
   */
  consumir(token: string): Promise<SesionFirma | null>;

  /** Verifica si un token sigue vigente, sin consumirlo. */
  existe(token: string): Promise<boolean>;

  /** Libera los recursos de conexion. */
  cerrar(): Promise<void>;
}

/** Genera un token opaco de 256 bits en hexadecimal. */
export function generarTokenFirma(): string {
  return randomBytes(32).toString("hex");
}

/** Deriva la clave de Redis a partir del token, sin exponerlo en claro. */
export function claveSesionFirma(token: string, prefijo = PREFIJO_SESION_FIRMA): string {
  return `${prefijo}:${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

/** Comparacion en tiempo constante de dos cadenas del mismo contenido. */
function igualesEnTiempoConstante(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/** Cliente minimo de Redis que necesita el almacen. Permite inyectar dobles. */
export interface ClienteRedisMinimo {
  set(
    clave: string,
    valor: string,
    modo: "EX",
    ttl: number,
    condicion: "NX",
  ): Promise<"OK" | null>;
  getdel(clave: string): Promise<string | null>;
  exists(clave: string): Promise<number>;
  del(...claves: string[]): Promise<number>;
  quit(): Promise<unknown>;
}

/**
 * Almacen de sesiones sobre Redis 7.
 *
 * El vencimiento lo impone el propio Redis con `EX`, por lo que un reinicio del
 * proceso de Node no extiende ninguna sesion, y `GETDEL` garantiza que un
 * callback no pueda ejecutarse dos veces.
 */
export class RedisFirmaSessionStore implements FirmaSessionStore {
  constructor(
    private readonly redis: ClienteRedisMinimo,
    private readonly prefijo = PREFIJO_SESION_FIRMA,
  ) {}

  /**
   * Construye el almacen a partir de la configuracion del entorno.
   * [PENDIENTE] El proyecto aun no tiene modulo de configuracion; se lee
   * `REDIS_URL` de forma directa y se documenta el contrato esperado.
   */
  static desdeEntorno(url = process.env.REDIS_URL): RedisFirmaSessionStore {
    if (url === undefined || url.length === 0) {
      throw new Error(
        "Falta la variable de entorno REDIS_URL para el almacen de sesiones de firma.",
      );
    }
    const opciones: RedisOptions = { maxRetriesPerRequest: 2, enableReadyCheck: true };
    return new RedisFirmaSessionStore(new Redis(url, opciones) as ClienteRedisMinimo);
  }

  async crear(sesion: SesionFirma, ttlSegundos = TTL_SESION_FIRMA_SEGUNDOS): Promise<boolean> {
    const resultado = await this.redis.set(
      claveSesionFirma(sesion.token, this.prefijo),
      JSON.stringify(sesion),
      "EX",
      ttlSegundos,
      "NX",
    );
    return resultado === "OK";
  }

  async consumir(token: string): Promise<SesionFirma | null> {
    const clave = claveSesionFirma(token, this.prefijo);
    const crudo = await this.redis.getdel(clave);
    if (crudo === null) {
      return null;
    }

    let sesion: SesionFirma;
    try {
      sesion = JSON.parse(crudo) as SesionFirma;
    } catch {
      // Registro corrupto: ya fue destruido por GETDEL, no hay nada que hacer.
      return null;
    }

    // Refuerzo de la comparacion: la clave ya es un SHA-256 del token, pero
    // verificar tambien el token almacenado evita que un documento alterado a
    // mano en Redis se convierta en una sesion válida.
    if (!igualesEnTiempoConstante(sesion.token, token)) {
      return null;
    }

    return sesion;
  }

  async existe(token: string): Promise<boolean> {
    const resultado = await this.redis.exists(claveSesionFirma(token, this.prefijo));
    return resultado === 1;
  }

  async cerrar(): Promise<void> {
    await this.redis.quit();
  }
}

/**
 * Almacen de sesiones en memoria con el mismo contrato y el mismo TTL.
 *
 * Se usa en pruebas unitarias y en desarrollo local sin Redis. Reproduce la
 * expiracion por reloj para que los casos de prueba del TTL sean deterministas.
 */
export class InMemoryFirmaSessionStore implements FirmaSessionStore {
  private readonly sesiones = new Map<string, { sesion: SesionFirma; expiraEnMs: number }>();

  constructor(private readonly reloj: () => number = Date.now) {}

  async crear(sesion: SesionFirma, ttlSegundos = TTL_SESION_FIRMA_SEGUNDOS): Promise<boolean> {
    const clave = claveSesionFirma(sesion.token);
    if (this.sesiones.has(clave)) {
      return false;
    }
    this.sesiones.set(clave, {
      sesion,
      expiraEnMs: this.reloj() + ttlSegundos * 1000,
    });
    return true;
  }

  async consumir(token: string): Promise<SesionFirma | null> {
    const clave = claveSesionFirma(token);
    const registro = this.sesiones.get(clave);
    if (registro === undefined) {
      return null;
    }

    this.sesiones.delete(clave);

    if (registro.expiraEnMs <= this.reloj()) {
      return null;
    }

    return igualesEnTiempoConstante(registro.sesion.token, token) ? registro.sesion : null;
  }

  async existe(token: string): Promise<boolean> {
    const registro = this.sesiones.get(claveSesionFirma(token));
    if (registro === undefined) {
      return false;
    }
    return registro.expiraEnMs > this.reloj();
  }

  async cerrar(): Promise<void> {
    this.sesiones.clear();
  }
}
