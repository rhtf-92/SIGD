import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

/**
 * Módulo Criptográfico para Protección de Secretos Temporales en el Transactional Outbox.
 * Utiliza Cifrado Autenticado AES-256-GCM para asegurar que tokens y secretos nunca
 * residan en texto plano en la base de datos o en eventos asíncronos.
 */

const ALGORITMO = 'aes-256-gcm';
const IV_BYTES = 12; // 96 bits recomendado para AES-GCM
const CLAVE_BYTES = 32; // 256 bits

/**
 * Obtiene o deriva la clave simétrica de 256 bits para cifrar secretos del outbox.
 * - Si existe OUTBOX_SECRETS_ENCRYPTION_KEY, la utiliza directamente (en hex o derivada).
 * - Si no, deriva una clave de 256 bits a partir de AUTH_JWT_SECRET con separación de dominio.
 * - Si no existe ninguna clave, falla de manera cerrada (fail-closed).
 */
export function obtenerClaveCifradoOutbox(): Buffer {
  const claveEnv = process.env.OUTBOX_SECRETS_ENCRYPTION_KEY;
  if (claveEnv && claveEnv.trim()) {
    const raw = claveEnv.trim();
    if (raw.length === 64 && /^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, 'hex');
    }
    return createHash('sha256').update(raw).digest();
  }

  const jwtSecret = process.env.AUTH_JWT_SECRET;
  if (jwtSecret && jwtSecret.trim()) {
    return createHmac('sha256', 'SIGD_OUTBOX_SECRETS_KEY_DERIVATION_V1')
      .update(jwtSecret.trim())
      .digest();
  }

  throw new Error(
    'OUTBOX_SECRETS_ENCRYPTION_KEY_MISSING: No se ha configurado la variable de entorno ' +
    'OUTBOX_SECRETS_ENCRYPTION_KEY ni AUTH_JWT_SECRET para el cifrado seguro de secretos.'
  );
}

/**
 * Cifra un texto plano utilizando AES-256-GCM.
 * Retorna una cadena con el formato: `iv_hex:tag_hex:cifrado_hex`.
 */
export function cifrarSecreto(textoPlano: string, clavePersonalizada?: Buffer): string {
  const clave = clavePersonalizada ?? obtenerClaveCifradoOutbox();
  if (clave.length !== CLAVE_BYTES) {
    throw new Error(`CLAVE_INVALIDA: La clave de cifrado debe tener exactamente ${CLAVE_BYTES} bytes.`);
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITMO, clave, iv);
  const cifrado = Buffer.concat([cipher.update(textoPlano, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${cifrado.toString('hex')}`;
}

/**
 * Descifra una cadena cifrada con formato `iv_hex:tag_hex:cifrado_hex` usando AES-256-GCM.
 * Lanza un error si el tag de autenticación no coincide o si el payload fue manipulado.
 */
export function descifrarSecreto(payloadCifrado: string, clavePersonalizada?: Buffer): string {
  const clave = clavePersonalizada ?? obtenerClaveCifradoOutbox();
  const partes = payloadCifrado.split(':');
  if (partes.length !== 3) {
    throw new Error('PAYLOAD_CIFRADO_INVALIDO: El formato debe ser iv:tag:cifrado.');
  }

  const [ivHex, tagHex, cifradoHex] = partes;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const cifrado = Buffer.from(cifradoHex, 'hex');

  if (iv.length !== IV_BYTES) {
    throw new Error('PAYLOAD_CIFRADO_INVALIDO: Longitud de IV no válida.');
  }

  const decipher = createDecipheriv(ALGORITMO, clave, iv);
  decipher.setAuthTag(tag);
  const descifrado = Buffer.concat([decipher.update(cifrado), decipher.final()]);
  return descifrado.toString('utf8');
}
