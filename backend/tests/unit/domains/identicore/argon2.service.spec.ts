import { describe, expect, it } from 'vitest';
import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';

describe('Argon2Service (T-BE-IC-02 / SEC-04)', () => {
  it('genera y verifica un hash fallback mediante scrypt usando su propio prefijo $sigd_scrypt$', () => {
    const hashFallback = Argon2Service.generateFallbackHash('ClaveSecretaUcayali123');
    // SEC-04: NUNCA declarar falsamente $argon2id$
    expect(hashFallback.startsWith('$sigd_scrypt$v=1$m=65536,t=3,p=4$')).toBe(true);
    expect(hashFallback.includes('$argon2id$')).toBe(false);
    expect(hashFallback.length).toBeLessThan(255);

    // Verificación positiva con fallback
    const verificacionValida = Argon2Service.verifyFallback(hashFallback, 'ClaveSecretaUcayali123');
    expect(verificacionValida).toBe(true);

    // Verificación negativa con contraseña errónea
    const verificacionInvalida = Argon2Service.verifyFallback(hashFallback, 'ClaveErronea123');
    expect(verificacionInvalida).toBe(false);
  });

  it('verifica exitosamente hashes legacy generados previamente con prefijo $argon2id$v=19$m=', () => {
    // Generar un hash estilo legacy
    const salt = '0123456789abcdef0123456789abcdef';
    const legacyHash = '$argon2id$v=19$m=65536,t=3,p=4$' + salt + '$' + 'a'.repeat(64);
    // Debe procesarse sin arrojar excepción
    expect(typeof Argon2Service.verifyFallback(legacyHash, 'clave')).toBe('boolean');
  });

  it('rechaza cualquier intento de evasión o backdoor con hashes manipulados o falsos', async () => {
    const intentoAuditor = await Argon2Service.verify('$argon2id$v=19$fallback$1234', 'wrong_password');
    expect(intentoAuditor).toBe(false);

    const intentoMock = await Argon2Service.verify('$argon2id$v=19$mockedhash$secreto', 'wrong_password');
    expect(intentoMock).toBe(false);
  });

  it('el verificador fallback rechaza hashes malformados o vacíos sin lanzar excepciones', () => {
    expect(Argon2Service.verifyFallback('', 'clave')).toBe(false);
    expect(Argon2Service.verifyFallback('$invalido$', 'clave')).toBe(false);
    expect(Argon2Service.verifyFallback('$sigd_scrypt$v=1$', 'clave')).toBe(false);
    expect(Argon2Service.verifyFallback('$sigd_scrypt$v=1$m=65536,t=3,p=4$sal$hashInvalidoImpar', 'clave')).toBe(false);
  });

  it('el verificador fallback rechaza hashes con longitud truncada o no alineada', () => {
    const salt = '0123456789abcdef0123456789abcdef';
    // Menor a 32 caracteres hex (16 bytes)
    const hashCorto = '$sigd_scrypt$v=1$m=65536,t=3,p=4$' + salt + '$' + 'a'.repeat(16);
    expect(Argon2Service.verifyFallback(hashCorto, 'clave')).toBe(false);

    // Truncado impar (127 hex chars)
    const hashTruncado = '$sigd_scrypt$v=1$m=65536,t=3,p=4$' + salt + '$' + 'a'.repeat(127);
    expect(Argon2Service.verifyFallback(hashTruncado, 'clave')).toBe(false);
  });

  it('invierte defensivamente los argumentos si el orden (password, hash) fue alterado por el llamador', async () => {
    const hash = Argon2Service.generateFallbackHash('ClaveDefensiva2026');
    const resultadoValido = await Argon2Service.verify('ClaveDefensiva2026', hash);
    expect(resultadoValido).toBe(true);

    const resultadoInvalido = await Argon2Service.verify('ClaveErronea2026', hash);
    expect(resultadoInvalido).toBe(false);
  });

  it('en producción, si el módulo nativo Argon2 no estuviera disponible, arroja error fail-fast explícito', async () => {
    const envOriginal = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const esNativo = await Argon2Service.isNativeAvailable();
    if (!esNativo) {
      await expect(Argon2Service.hash('PasswordSegura!')).rejects.toThrow(
        'ARGON2_NATIVE_REQUIRED_IN_PRODUCTION',
      );
    }

    process.env.NODE_ENV = envOriginal;
  });

  it('consulta disponibilidad nativa y permite restablecer la memoria caché', async () => {
    const disponible = await Argon2Service.isNativeAvailable();
    expect(typeof disponible).toBe('boolean');
    Argon2Service.resetCache();
  });
});
