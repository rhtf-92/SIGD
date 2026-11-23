import crypto from 'node:crypto';
import { AppError } from '../../shared/domain/errors/index.js';

export interface PayloadTokenCifrado {
  readonly v: 1;
  readonly alg: 'aes-256-gcm';
  readonly iv: string; // 12 bytes en hexadecimal
  readonly tag: string; // 16 bytes en hexadecimal
  readonly ct: string; // texto cifrado en hexadecimal
}

const CONTEXTO_DERIVACION_DEFAULT = 'SIGD_RENATO_OUTBOX_PAYLOAD_CIPHER_V1';

/**
 * Obtiene la clave simétrica de 256 bits (32 bytes) para cifrado AES-GCM.
 * Prioridad:
 * 1. Variable de entorno protegida TOKEN_ENCRYPTION_KEY / OUTBOX_ENCRYPTION_KEY.
 * 2. Si no se especificó directamente pero existe AUTH_JWT_SECRET en el entorno,
 *    se deriva una clave criptográfica de 32 bytes dedicada mediante HMAC-SHA256.
 * 3. Si falta la clave y no puede derivarse de una variable de entorno protegida,
 *    falla de forma segura arrojando AppError (prohibición de fallback a texto plano).
 */
export function obtenerClaveCifrado(): Buffer {
  const claveEnv = process.env.TOKEN_ENCRYPTION_KEY ?? process.env.OUTBOX_ENCRYPTION_KEY;

  if (claveEnv && typeof claveEnv === 'string' && claveEnv.trim().length > 0) {
    const trimmed = claveEnv.trim();
    // Hexadecimal de 64 caracteres (32 bytes)
    if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
      return Buffer.from(trimmed, 'hex');
    }
    // Base64 de 44 caracteres (32 bytes)
    if (trimmed.length === 44 && /^[0-9a-zA-Z+/=]+$/.test(trimmed)) {
      const buf = Buffer.from(trimmed, 'base64');
      if (buf.length === 32) return buf;
    }
    // Cadena UTF-8 de 32 bytes exactos
    const bufUtf8 = Buffer.from(trimmed, 'utf8');
    if (bufUtf8.length === 32) {
      return bufUtf8;
    }
    // Derivación determinista mediante SHA-256 para cadenas de otra longitud
    return crypto.createHash('sha256').update(trimmed, 'utf8').digest();
  }

  // Fallback seguro derivado exclusivamente de la variable protegida AUTH_JWT_SECRET existente
  const secretBase = process.env.AUTH_JWT_SECRET;
  if (secretBase && typeof secretBase === 'string' && secretBase.trim().length >= 16) {
    return crypto
      .createHmac('sha256', CONTEXTO_DERIVACION_DEFAULT)
      .update(secretBase.trim(), 'utf8')
      .digest();
  }

  throw new AppError({
    code: 'ENCRYPTION_KEY_MISSING',
    status: 500,
    message: 'Clave de cifrado de tokens no configurada en el entorno (TOKEN_ENCRYPTION_KEY).',
  });
}

/**
 * Cifra un token en texto plano utilizando AES-256-GCM con IV aleatorio de 12 bytes
 * y etiqueta de autenticación de 16 bytes.
 */
export function cifrarTokenPayload(tokenRaw: string): PayloadTokenCifrado {
  if (!tokenRaw || typeof tokenRaw !== 'string' || tokenRaw.trim().length === 0) {
    throw new AppError({
      code: 'TOKEN_INVALID',
      status: 400,
      message: 'El token a cifrar no puede ser nulo o vacío.',
    });
  }

  const key = obtenerClaveCifrado();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ct = Buffer.concat([
    cipher.update(tokenRaw, 'utf8'),
    cipher.final(),
  ]).toString('hex');

  const tag = cipher.getAuthTag().toString('hex');

  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('hex'),
    tag,
    ct,
  };
}

/**
 * Descifra un payload cifrado con AES-256-GCM.
 * Verifica versión, algoritmo, integridad y autenticación.
 * Falla de forma segura si la clave es errónea o el contenido fue manipulado.
 */
export function descifrarTokenPayload(cifrado: unknown): string {
  if (!cifrado || typeof cifrado !== 'object') {
    throw new AppError({
      code: 'CIPHERTEXT_INVALID',
      status: 400,
      message: 'El payload cifrado de token no tiene la estructura esperada.',
    });
  }

  const p = cifrado as Record<string, unknown>;

  if (p.v !== 1 || p.alg !== 'aes-256-gcm') {
    throw new AppError({
      code: 'CIPHERTEXT_UNSUPPORTED_VERSION',
      status: 400,
      message: `Versión o algoritmo de cifrado no soportado (v: ${String(p.v)}, alg: ${String(p.alg)}).`,
    });
  }

  if (
    typeof p.iv !== 'string' ||
    !/^[0-9a-fA-F]{24}$/.test(p.iv) ||
    typeof p.tag !== 'string' ||
    !/^[0-9a-fA-F]{32}$/.test(p.tag) ||
    typeof p.ct !== 'string' ||
    p.ct.length === 0 ||
    !/^[0-9a-fA-F]+$/.test(p.ct)
  ) {
    throw new AppError({
      code: 'CIPHERTEXT_MALFORMED',
      status: 400,
      message: 'Los parámetros criptográficos del token cifrado son inválidos o están corruptos.',
    });
  }

  try {
    const key = obtenerClaveCifrado();
    const iv = Buffer.from(p.iv, 'hex');
    const tag = Buffer.from(p.tag, 'hex');
    const ct = Buffer.from(p.ct, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ct),
      decipher.final(),
    ]).toString('utf8');

    return decrypted;
  } catch (error) {
    throw new AppError({
      code: 'DECRYPTION_FAILED',
      status: 500,
      message: 'Fallo al autenticar y descifrar el token protegido (clave incorrecta o datos manipulados).',
    });
  }
}

/**
 * Función utilitaria para sanitizar objetos y payloads antes de emitirlos a registros o logs.
 * Reemplaza recursivamente cualquier propiedad que coincida con patrones sensibles.
 */
export function sanitizarObjetoParaLog(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizarObjetoParaLog);
  }

  const res: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (/token|password|secret|secreto|key|credencial|authorization/i.test(k)) {
      res[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      res[k] = sanitizarObjetoParaLog(v);
    } else {
      res[k] = v;
    }
  }
  return res;
}
