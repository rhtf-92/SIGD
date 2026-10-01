import { describe, expect, it } from 'vitest';
import {
  calcularDigitoVerificadorRuc,
  validarDni,
  validarRuc,
} from '../../../../src/domains/identicore/modulo11.validator.js';

function encontrarBaseConDigito(digitoBuscado: 0 | 1): string {
  for (let sufijo = 0; sufijo < 100_000; sufijo += 1) {
    const base = `20${String(sufijo).padStart(8, '0')}`;
    if (calcularDigitoVerificadorRuc(base) === digitoBuscado) return base;
  }
  throw new Error(`No se encontró base de RUC con dígito ${digitoBuscado}.`);
}

describe('validador de DNI y RUC', () => {
  it('calcula el dígito verificador de un RUC conocido', () => {
    expect(calcularDigitoVerificadorRuc('2012345678')).toBe(6);
    expect(validarRuc('20123456786')).toEqual({ valido: true, tipo: 'RUC' });
  });

  it('distingue formato incorrecto de dígito verificador incorrecto', () => {
    expect(validarRuc('20123456780')).toEqual({
      valido: false,
      tipo: 'RUC',
      codigo: 'RUC_DIGITO_VERIFICADOR_INVALIDO',
    });
    expect(validarRuc('2012345678X')).toMatchObject({
      valido: false,
      codigo: 'RUC_FORMATO_INVALIDO',
    });
    expect(validarRuc('30123456786')).toMatchObject({
      valido: false,
      codigo: 'RUC_FORMATO_INVALIDO',
    });
  });

  it.each([0, 1] as const)('mapea el dígito verificador especial %i', (digito) => {
    const base = encontrarBaseConDigito(digito);
    expect(calcularDigitoVerificadorRuc(base)).toBe(digito);
    expect(validarRuc(`${base}${digito}`)).toEqual({ valido: true, tipo: 'RUC' });
  });

  it('rechaza entradas no numéricas o que no tengan diez dígitos base', () => {
    expect(calcularDigitoVerificadorRuc('201234567')).toBeNull();
    expect(calcularDigitoVerificadorRuc('201234567X')).toBeNull();
    expect(validarRuc('')).toMatchObject({ valido: false, codigo: 'RUC_FORMATO_INVALIDO' });
  });

  it('valida DNI únicamente por su formato oficial de ocho dígitos', () => {
    expect(validarDni('12345678')).toEqual({ valido: true, tipo: 'DNI' });
    expect(validarDni('1234567')).toMatchObject({
      valido: false,
      tipo: 'DNI',
      codigo: 'DNI_FORMATO_INVALIDO',
    });
    expect(validarDni('1234567A').valido).toBe(false);
  });
});