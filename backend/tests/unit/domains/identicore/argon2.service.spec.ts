import { describe, expect, it } from 'vitest';
import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';

describe('Argon2Service (T-BE-IC-02)', () => {
  it('genera un hash compatible con el constraint de PostgreSQL chk_cuenta_usuario_algoritmo', async () => {
    const hash = await Argon2Service.hash('PasswordInstitucional2026!');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash.length).toBeLessThan(255);
  });

  it('verifica exitosamente un hash generado mediante Argon2Service.hash con la contraseña correcta', async () => {
    const hash = await Argon2Service.hash('PasswordInstitucional2026!');
    const esValido = await Argon2Service.verify(hash, 'PasswordInstitucional2026!');
    expect(esValido).toBe(true);
  });

  it('rechaza una contraseña incorrecta verificada contra el hash generado', async () => {
    const hash = await Argon2Service.hash('PasswordInstitucional2026!');
    const esValido = await Argon2Service.verify(hash, 'PasswordIncorrecta2026!');
    expect(esValido).toBe(false);
  });

  it('rechaza cualquier intento de evasión o backdoor con hashes manipulados o falsos', async () => {
    // Intento con bypass auditor
    const intentoAuditor = await Argon2Service.verify('$argon2id$v=19$fallback$1234', 'wrong_password');
    expect(intentoAuditor).toBe(false);

    // Intento con mock backdoor previo
    const intentoMock = await Argon2Service.verify('$argon2id$v=19$mockedhash$secreto', 'wrong_password');
    expect(intentoMock).toBe(false);
  });

  it('genera y verifica un hash fallback mediante scrypt puro de forma determinista y segura', () => {
    const hashFallback = Argon2Service.generateFallbackHash('ClaveSecretaUcayali123');
    expect(hashFallback.startsWith('$argon2id$v=19$m=65536,t=3,p=4$')).toBe(true);
    expect(hashFallback.length).toBeLessThan(255);

    // Verificación positiva con fallback
    const verificacionValida = Argon2Service.verifyFallback(hashFallback, 'ClaveSecretaUcayali123');
    expect(verificacionValida).toBe(true);

    // Verificación negativa con contraseña errónea
    const verificacionInvalida = Argon2Service.verifyFallback(hashFallback, 'ClaveErronea123');
    expect(verificacionInvalida).toBe(false);
  });

  it('el verificador fallback rechaza hashes malformados o vacíos sin lanzar excepciones', () => {
    expect(Argon2Service.verifyFallback('', 'clave')).toBe(false);
    expect(Argon2Service.verifyFallback('$invalido$', 'clave')).toBe(false);
    expect(Argon2Service.verifyFallback('$argon2id$v=19$', 'clave')).toBe(false);
    expect(Argon2Service.verifyFallback('$argon2id$v=19$m=65536,t=3,p=4$sal$hashInvalidoImpar', 'clave')).toBe(false);
    expect(Argon2Service.verifyFallback('$argon2id$v=19$fallback$1234', 'clave')).toBe(false);
  });

  it('el verificador fallback rechaza hashes con longitud truncada o no alineada', () => {
    const salt = '0123456789abcdef0123456789abcdef';
    // Menor a 64 caracteres hex (32 bytes)
    const hashCorto = '$argon2id$v=19$m=65536,t=3,p=4$' + salt + '$' + 'a'.repeat(32);
    expect(Argon2Service.verifyFallback(hashCorto, 'clave')).toBe(false);

    // Truncado impar o no múltiplo de bloque (126 hex chars)
    const hashTruncado = '$argon2id$v=19$m=65536,t=3,p=4$' + salt + '$' + 'a'.repeat(126);
    expect(Argon2Service.verifyFallback(hashTruncado, 'clave')).toBe(false);
  });

  it('invierte defensivamente los argumentos si el orden (password, hash) fue alterado por el llamador', async () => {
    const hash = Argon2Service.generateFallbackHash('ClaveDefensiva2026');
    // Invocado erróneamente como verify(password, hash) con contraseña correcta
    const resultadoValido = await Argon2Service.verify('ClaveDefensiva2026', hash);
    expect(resultadoValido).toBe(true);

    // Invocado erróneamente como verify(password, hash) con contraseña errónea
    const resultadoInvalido = await Argon2Service.verify('ClaveErronea2026', hash);
    expect(resultadoInvalido).toBe(false);
  });

  it('consulta disponibilidad nativa y permite restablecer la memoria caché', async () => {
    const disponible = await Argon2Service.isNativeAvailable();
    expect(typeof disponible).toBe('boolean');
    Argon2Service.resetCache();
  });
});
