import { describe, expect, it } from 'vitest';
import { validarBaseExclusivaDePruebas } from '../../setup/global-setup.js';

describe('protección de TEST_DATABASE_URL externa', () => {
  it('exige una habilitación explícita aunque el nombre parezca de pruebas', () => {
    expect(() => validarBaseExclusivaDePruebas(
      'postgres://postgres@127.0.0.1:55432/sigd_prueba_pr166',
      undefined,
    )).toThrow(/ALLOW_EXTERNAL_TEST_DATABASE=true/);
  });

  it.each(['latest', 'contestacion', 'produccion_prueba_copia']) (
    'rechaza el nombre no canónico %s incluso con habilitación explícita',
    (nombreBase) => {
      expect(() => validarBaseExclusivaDePruebas(
        `postgres://postgres@127.0.0.1:55432/${nombreBase}`,
        'true',
      )).toThrow(/sigd_(test|prueba)_/i);
    },
  );

  it('acepta únicamente el prefijo canónico y la habilitación explícita', () => {
    expect(() => validarBaseExclusivaDePruebas(
      'postgres://postgres@127.0.0.1:55432/sigd_prueba_pr166',
      'true',
    )).not.toThrow();
  });
});
