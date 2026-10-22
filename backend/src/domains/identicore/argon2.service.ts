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
 * Servicio Criptográfico Centralizado IdentiCore (Tarea T-BE-IC-02 / Remediación SEC-04).
 *
 * Política de Hashing Institucional:
 * 1. En producción (NODE_ENV=production): El módulo nativo Argon2id es estrictamente OBLIGATORIO.
 *    Si el binario nativo no está disponible, el servicio falla de forma inmediata (fail-fast).
 * 2. En entornos de desarrollo/test: Si el módulo nativo no está presente (p. ej. directivas WDAC en Windows),
 *    se permite un algoritmo alternativo scrypt explícitamente identificado como `$sigd_scrypt$v=1$...`,
 *    quedando TERMINANTEMENTE PROHIBIDO fingir la firma de `$argon2id$`.
 * 3. Compatibilidad de lectura: El método `verify` valida hashes nativos `$argon2id$`, hashes de fallback
 *    `$sigd_scrypt$v=1$`, y hashes de fallback históricos para no invalidar credenciales ya emitidas.
 */
export class Argon2Service {
  /**
   * Hashea una contraseña plana.
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

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ARGON2_NATIVE_REQUIRED_IN_PRODUCTION: Módulo nativo Argon2id obligatorio en producción. Se prohíbe el uso de algoritmos degradados.',
      );
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
    if (
      (password.startsWith('$argon2id$') || password.startsWith('$sigd_scrypt$') || password.startsWith('$scrypt$')) &&
      !hash.startsWith('$argon2id$') && !hash.startsWith('$sigd_scrypt$') && !hash.startsWith('$scrypt$')
    ) {
      const temp = hash;
      hash = password;
      password = temp;
    }

    // Si es hash Argon2id nativo
    if (hash.startsWith('$argon2id$')) {
      try {
        const argon2 = await getArgon2Module();
        if (argon2 && typeof argon2.verify === 'function') {
          const resultado = await argon2.verify(hash, password);
          if (resultado) return true;
        }
      } catch {
        // Falla nativa o hash producido por fallback legacy
      }
      // Si falló el nativo, comprobar si es un hash de fallback legacy generado con prefijo falso previo
      return Argon2Service.verifyFallback(hash, password);
    }

    // Hashes explícitos de fallback scrypt ($sigd_scrypt$ o $scrypt$)
    if (hash.startsWith('$sigd_scrypt$') || hash.startsWith('$scrypt$')) {
      return Argon2Service.verifyFallback(hash, password);
    }

    return false;
  }

  /**
   * Genera un hash determinista mediante scrypt utilizando su identificador propio inequívoco:
   * $sigd_scrypt$v=1$m=65536,t=3,p=4$<salt>$<hash>
   * (NUNCA declara falsamente $argon2id$).
   */
  static generateFallbackHash(password: string, options?: Argon2Options): string {
    const hashLength = options?.hashLength ?? DEFAULT_OPTIONS.hashLength;
    const memoryCost = options?.memoryCost ?? DEFAULT_OPTIONS.memoryCost;
    const timeCost = options?.timeCost ?? DEFAULT_OPTIONS.timeCost;
    const parallelism = options?.parallelism ?? DEFAULT_OPTIONS.parallelism;

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, hashLength).toString('hex');
    return `$sigd_scrypt$v=1$m=${memoryCost},t=${timeCost},p=${parallelism}$${salt}$${hash}`;
  }

  /**
   * Valida un hash scrypt garantizando resistencia a timing attacks mediante timingSafeEqual.
   * Admite formato canónico `$sigd_scrypt$v=1$` y compatibilidad con formato legacy `$argon2id$v=19$m=`.
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

      const alg = partes[1];
      const ver = partes[2];

      const esSigdScrypt = (alg === 'sigd_scrypt' || alg === 'scrypt') && ver === 'v=1';
      const esLegacyArgon2idFallback = alg === 'argon2id' && ver === 'v=19';

      if (!esSigdScrypt && !esLegacyArgon2idFallback) {
        return false;
      }

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

      // Hash esperado: hex válido, mínimo 32 caracteres hex (16 bytes), alineado a bloques de 16 bytes
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
