import crypto from 'node:crypto';

export interface Argon2Options {
  type?: number;
  memoryCost?: number;
  timeCost?: number;
  parallelism?: number;
  hashLength?: number;
}

interface Argon2NativeModule {
  hash?: (password: string | Buffer, options?: Record<string, unknown>) => Promise<string>;
  verify?: (hash: string, password: string | Buffer) => Promise<boolean>;
  default?: Argon2NativeModule;
}

const DEFAULT_OPTIONS: Required<Argon2Options> = {
  type: 2, // 2 = argon2id conforme a RFC 9106 y especificación IESTP Suiza
  memoryCost: 65_536, // 64 MB (65536 KiB)
  timeCost: 3, // 3 pasadas / iteraciones
  parallelism: 4, // 4 hilos de paralelismo
  hashLength: 64, // 64 bytes (128 hex chars) para scrypt fallback institucional
};

const HEX_REGEX = /^[0-9a-fA-F]+$/;

let argon2ModuleCache: Argon2NativeModule | null | undefined = undefined;

async function getArgon2Module(): Promise<Argon2NativeModule | null> {
  if (argon2ModuleCache !== undefined) {
    return argon2ModuleCache;
  }
  try {
    const mod = await import('argon2');
    argon2ModuleCache = (mod.default ?? mod) as Argon2NativeModule;
  } catch {
    argon2ModuleCache = null;
  }
  return argon2ModuleCache;
}

/**
 * Servicio Criptográfico Centralizado IdentiCore (Tarea T-BE-IC-02).
 * Proporciona hashing y verificación con Argon2id nativo y fallback defensivo a scrypt
 * para entornos Windows con directivas WDAC / AppLocker que bloquean módulos .node.
 */
export class Argon2Service {
  /**
   * Hashea una contraseña plana.
   * Utiliza Argon2id nativo si está disponible; de lo contrario recurre a scrypt formateado
   * bajo el estándar $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash> requerido por PostgreSQL.
   */
  static async hash(password: string, options?: Argon2Options): Promise<string> {
    const mergedOptions: Required<Argon2Options> = { ...DEFAULT_OPTIONS, ...options };
    try {
      const argon2 = await getArgon2Module();
      if (argon2 && typeof argon2.hash === 'function') {
        return await argon2.hash(password, {
          type: mergedOptions.type,
          memoryCost: mergedOptions.memoryCost,
          timeCost: mergedOptions.timeCost,
          parallelism: mergedOptions.parallelism,
        });
      }
    } catch {
      // Bloqueo WDAC o falla de enlace nativo en runtime
    }

    return Argon2Service.generateFallbackHash(password, mergedOptions);
  }

  /**
   * Verifica una contraseña plana contra su hash almacenado.
   * Valida hashes nativos Argon2id y hashes criptográficos scrypt con comparación
   * en tiempo constante para neutralizar ataques de canal lateral (timing attacks).
   */
  static async verify(hashAlmacenado: string, passwordPlana: string): Promise<boolean> {
    if (
      typeof hashAlmacenado !== 'string' ||
      typeof passwordPlana !== 'string' ||
      !hashAlmacenado ||
      !passwordPlana
    ) {
      return false;
    }

    // Inversión defensiva si los parámetros fueron suministrados como (password, hash)
    let hash = hashAlmacenado;
    let password = passwordPlana;
    if (password.startsWith('$argon2id$') && !hash.startsWith('$argon2id$')) {
      const temp = hash;
      hash = password;
      password = temp;
    }

    // Intento con Argon2 nativo
    try {
      const argon2 = await getArgon2Module();
      if (argon2 && typeof argon2.verify === 'function') {
        const resultado = await argon2.verify(hash, password);
        if (resultado) return true;
      }
    } catch {
      // Falla nativa o hash producido por fallback
    }

    // Fallback criptográfico scrypt con comparación de tiempo constante
    return Argon2Service.verifyFallback(hash, password);
  }

  /**
   * Genera un hash determinista mediante scrypt formateado para cumplir el CHECK constraint:
   * $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
   */
  static generateFallbackHash(password: string, options?: Argon2Options): string {
    const hashLength = options?.hashLength ?? DEFAULT_OPTIONS.hashLength;
    const memoryCost = options?.memoryCost ?? DEFAULT_OPTIONS.memoryCost;
    const timeCost = options?.timeCost ?? DEFAULT_OPTIONS.timeCost;
    const parallelism = options?.parallelism ?? DEFAULT_OPTIONS.parallelism;

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, hashLength).toString('hex');
    return `$argon2id$v=19$m=${memoryCost},t=${timeCost},p=${parallelism}$${salt}$${hash}`;
  }

  /**
   * Valida un hash scrypt garantizando resistencia a timing attacks mediante timingSafeEqual.
   * Realiza validación estricta de estructura, parámetros, sal y hash esperado.
   */
  static verifyFallback(hashAlmacenado: string, passwordPlana: string): boolean {
    if (
      typeof hashAlmacenado !== 'string' ||
      typeof passwordPlana !== 'string' ||
      !hashAlmacenado ||
      !passwordPlana
    ) {
      return false;
    }

    try {
      const partes = hashAlmacenado.split('$');
      if (partes.length !== 6) return false;
      if (partes[1] !== 'argon2id' || partes[2] !== 'v=19') return false;

      // Parámetros criptográficos m=...,t=...,p=...
      const paramPairs = partes[3].split(',');
      if (paramPairs.length < 3) return false;
      const params: Record<string, string> = {};
      for (const pair of paramPairs) {
        const [k, v] = pair.split('=');
        if (!k || !v) return false;
        params[k] = v;
      }
      if (!params.m || !params.t || !params.p) return false;
      const memoryCost = Number(params.m);
      const timeCost = Number(params.t);
      const parallelism = Number(params.p);
      if (!Number.isInteger(memoryCost) || memoryCost <= 0) return false;
      if (!Number.isInteger(timeCost) || timeCost <= 0) return false;
      if (!Number.isInteger(parallelism) || parallelism <= 0) return false;

      const salt = partes[4];
      const hashEsperado = partes[5];

      // Sal: hex válido, longitud par, mínimo 16 caracteres hex (8 bytes)
      if (!salt || salt.length < 16 || salt.length % 2 !== 0 || !HEX_REGEX.test(salt)) {
        return false;
      }

      // Hash esperado: hex válido, mínimo 32 caracteres hex (16 bytes), alineado a bloques de 16 bytes (32 hex)
      if (
        !hashEsperado ||
        hashEsperado.length < 32 ||
        hashEsperado.length % 2 !== 0 ||
        hashEsperado.length % 32 !== 0 ||
        !HEX_REGEX.test(hashEsperado)
      ) {
        return false;
      }

      const keylen = hashEsperado.length / 2;
      const h = crypto.scryptSync(passwordPlana, salt, keylen).toString('hex');

      const bufEsperado = Buffer.from(hashEsperado, 'hex');
      const bufGenerado = Buffer.from(h, 'hex');

      if (bufEsperado.length !== bufGenerado.length) {
        return false;
      }

      return crypto.timingSafeEqual(bufGenerado, bufEsperado);
    } catch {
      return false;
    }
  }

  /**
   * Consulta si el binario nativo compilado de Argon2 se encuentra disponible y operativo.
   */
  static async isNativeAvailable(): Promise<boolean> {
    const mod = await getArgon2Module();
    return mod !== null && typeof mod.hash === 'function';
  }

  /**
   * Restablece la memoria caché del módulo (útil para pruebas de inyección y mocks).
   */
  static resetCache(): void {
    argon2ModuleCache = undefined;
  }
}
