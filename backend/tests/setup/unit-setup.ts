import crypto from 'node:crypto';
import { vi } from 'vitest';

process.env.AUTH_JWT_SECRET ??= 'test-jwt-secret-minimo-32-caracteres-para-sigd-auth';
process.env.JWT_SECRET ??= 'test-jwt-secret-minimo-32-caracteres-para-sigd-auth';

/**
 * Mock criptográfico limpio de la librería 'argon2' para entorno de pruebas unitarias.
 * Evita la invocación de binarios compilados C++ (.node) que son bloqueados por directivas
 * Windows Defender Application Control (WDAC) / AppLocker en el entorno de desarrollo y CI.
 *
 * Implementa hashing y verificación genuina mediante crypto.scryptSync y crypto.timingSafeEqual,
 * generando hashes que cumplen con el formato institucional:
 * $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
 * sin requerir cadenas de evasión ni puertas traseras ('mockedhash', 'fallback').
 */
vi.mock('argon2', () => {
  const hash = vi.fn(async (password: string | Buffer) => {
    const pwd = typeof password === 'string' ? password : password.toString('utf8');
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(pwd, salt, 64).toString('hex');
    return `$argon2id$v=19$m=65536,t=3,p=4$${salt}$${derived}`;
  });

  const verify = vi.fn(async (hashAlmacenado: string, passwordPlana: string | Buffer) => {
    const pwd = typeof passwordPlana === 'string' ? passwordPlana : passwordPlana.toString('utf8');
    if (!hashAlmacenado || !pwd) return false;

    try {
      const partes = hashAlmacenado.split('$');
      if (partes.length !== 6) return false;
      if (partes[1] !== 'argon2id' || partes[2] !== 'v=19') return false;

      const salt = partes[4];
      const hashEsperado = partes[5];

      if (!salt || salt.length < 16 || salt.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(salt)) {
        return false;
      }

      if (
        !hashEsperado ||
        hashEsperado.length < 64 ||
        hashEsperado.length % 2 !== 0 ||
        hashEsperado.length % 32 !== 0 ||
        !/^[0-9a-fA-F]+$/.test(hashEsperado)
      ) {
        return false;
      }

      const keylen = hashEsperado.length / 2;
      const derived = crypto.scryptSync(pwd, salt, keylen).toString('hex');

      const bufEsperado = Buffer.from(hashEsperado, 'hex');
      const bufGenerado = Buffer.from(derived, 'hex');

      if (bufEsperado.length !== bufGenerado.length) {
        return false;
      }

      return crypto.timingSafeEqual(bufGenerado, bufEsperado);
    } catch {
      return false;
    }
  });

  return {
    default: { hash, verify },
    hash,
    verify,
  };
});
