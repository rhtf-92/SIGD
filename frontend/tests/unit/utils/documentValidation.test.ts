import { describe, it, expect } from 'vitest';
import {
  sanitizarNumeroDocumento,
  validarNumeroDocumento,
  obtenerTextoAyudaDocumento,
  obtenerPlaceholderDocumento,
} from '../../../src/utils/documentValidation';

describe('documentValidation Utility', () => {
  describe('DNI Peruano (8 dígitos)', () => {
    it('conserva ceros iniciales en DNI válido', () => {
      const valor = '00123456';
      const sanitizado = sanitizarNumeroDocumento(valor, 'DNI');
      expect(sanitizado).toBe('00123456');

      const res = validarNumeroDocumento(sanitizado, 'DNI');
      expect(res.esValido).toBe(true);
      expect(res.mensajeError).toBeUndefined();
    });

    it('descarta caracteres no numéricos en DNI', () => {
      const sanitizado = sanitizarNumeroDocumento('45A-87 23B15', 'DNI');
      expect(sanitizado).toBe('45872315');
      expect(validarNumeroDocumento(sanitizado, 'DNI').esValido).toBe(true);
    });

    it('limita longitud máxima a 8 dígitos en DNI', () => {
      const sanitizado = sanitizarNumeroDocumento('1234567890123', 'DNI');
      expect(sanitizado).toBe('12345678');
      expect(sanitizado.length).toBe(8);
    });

    it('informa con claridad cuando faltan dígitos', () => {
      const res = validarNumeroDocumento('1234', 'DNI');
      expect(res.esValido).toBe(false);
      expect(res.mensajeError).toContain('Faltan 4 dígitos');
    });

    it('muestra texto de ayuda oficial para DNI', () => {
      expect(obtenerTextoAyudaDocumento('DNI')).toBe('Ingrese los 8 dígitos del DNI');
      expect(obtenerPlaceholderDocumento('DNI')).toBe('45872315');
    });
  });

  describe('RUC (11 dígitos)', () => {
    it('valida RUC de 11 dígitos y conserva ceros iniciales', () => {
      const valor = '10001234567';
      const sanitizado = sanitizarNumeroDocumento(valor, 'RUC');
      expect(sanitizado).toBe('10001234567');

      const res = validarNumeroDocumento(sanitizado, 'RUC');
      expect(res.esValido).toBe(true);
    });

    it('descarta caracteres alfabéticos en RUC y trunca a 11', () => {
      const sanitizado = sanitizarNumeroDocumento('20-123456789-ABC', 'RUC');
      expect(sanitizado).toBe('20123456789');
      expect(sanitizado.length).toBe(11);
      expect(validarNumeroDocumento(sanitizado, 'RUC').esValido).toBe(true);
    });

    it('indica dígitos faltantes para completar RUC', () => {
      const res = validarNumeroDocumento('2012345', 'RUC');
      expect(res.esValido).toBe(false);
      expect(res.mensajeError).toContain('Faltan 4 dígitos');
    });

    it('muestra texto de ayuda oficial para RUC', () => {
      expect(obtenerTextoAyudaDocumento('RUC')).toBe('Ingrese los 11 dígitos del RUC');
      expect(obtenerPlaceholderDocumento('RUC')).toBe('20123456789');
    });
  });

  describe('Carné de Extranjería (CE - 8 a 12 caracteres alfanuméricos)', () => {
    it('valida número oficial de 9 dígitos (SBS / Migraciones) y conserva ceros iniciales', () => {
      const valor = '001234567';
      const sanitizado = sanitizarNumeroDocumento(valor, 'CE');
      expect(sanitizado).toBe('001234567');
      expect(sanitizado.length).toBe(9);

      const res = validarNumeroDocumento(sanitizado, 'CE');
      expect(res.esValido).toBe(true);
      expect(res.longitudActual).toBe(9);
      expect(res.longitudRequerida).toEqual([8, 12]);
    });

    it('admite y preserva letras en series alfanuméricas de Migraciones (ej. prefijo N)', () => {
      const sanitizado = sanitizarNumeroDocumento('n00123456', 'CE');
      expect(sanitizado).toBe('N00123456');
      expect(sanitizado.length).toBe(9);

      const res = validarNumeroDocumento(sanitizado, 'CE');
      expect(res.esValido).toBe(true);
    });

    it('admite formato histórico de 8 dígitos numéricos', () => {
      const sanitizado = sanitizarNumeroDocumento('00123456', 'CE');
      expect(sanitizado).toBe('00123456');
      expect(sanitizado.length).toBe(8);

      const res = validarNumeroDocumento(sanitizado, 'CE');
      expect(res.esValido).toBe(true);
    });

    it('admite formato extendido SUNAT de hasta 12 caracteres alfanuméricos', () => {
      const sanitizado = sanitizarNumeroDocumento('N01234567890', 'CE');
      expect(sanitizado).toBe('N01234567890');
      expect(sanitizado.length).toBe(12);

      const res = validarNumeroDocumento(sanitizado, 'CE');
      expect(res.esValido).toBe(true);
    });

    it('elimina truncamiento a 8 caracteres y tolera pegado con símbolos descartándolos', () => {
      // Simula pegar un carné de 9 dígitos con guiones y espacios
      const pegado = '  ce-001234567  ';
      const sanitizado = sanitizarNumeroDocumento(pegado, 'CE');
      // Debe conservar los 9 dígitos sin truncar a 8
      expect(sanitizado.length).toBeGreaterThan(8);
      expect(sanitizado).toContain('001234567');

      const res = validarNumeroDocumento('001234567', 'CE');
      expect(res.esValido).toBe(true);
    });

    it('rechaza CE menor a 8 caracteres indicando los faltantes', () => {
      const res = validarNumeroDocumento('12345', 'CE');
      expect(res.esValido).toBe(false);
      expect(res.mensajeError).toContain('Faltan 3 caracteres');
    });

    it('rechaza CE mayor a 12 caracteres', () => {
      const res = validarNumeroDocumento('1234567890123', 'CE');
      expect(res.esValido).toBe(false);
      expect(res.mensajeError).toContain('máximo 12 caracteres');
    });

    it('muestra texto de ayuda oficial y placeholder para CE', () => {
      expect(obtenerTextoAyudaDocumento('CE')).toContain('8 a 12 caracteres');
      expect(obtenerPlaceholderDocumento('CE')).toBe('001234567');
    });
  });
});
