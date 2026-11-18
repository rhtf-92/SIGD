import { describe, it, expect } from 'vitest';
import {
  obtenerInfoArea,
  formatearNombreArea,
  formatearCodigoArea,
  AREA_ID_SDA,
  AREA_ID_DIR,
} from '../../../src/utils/areaPresentacion';

describe('areaPresentacion — Transformación amigable de áreas institucionales', () => {
  it('1. Traduce UUID canónico de Subdirección Académica a SDA y su nombre completo', () => {
    const info = obtenerInfoArea(AREA_ID_SDA);
    expect(info.codigo).toBe('SDA');
    expect(info.nombre).toBe('Subdirección Académica');
    expect(info.badgeClase).toContain('sky');
    expect(formatearNombreArea(AREA_ID_SDA)).toBe('Subdirección Académica');
    expect(formatearCodigoArea(AREA_ID_SDA)).toBe('SDA');
  });

  it('2. Traduce código textual "SDA" sin importar mayúsculas/minúsculas', () => {
    const info = obtenerInfoArea('sda');
    expect(info.codigo).toBe('SDA');
    expect(info.nombre).toBe('Subdirección Académica');
  });

  it('3. Traduce UUID canónico de Dirección General para rol MESA_PARTES', () => {
    const info = obtenerInfoArea(AREA_ID_DIR, null, 'MESA_PARTES');
    expect(info.codigo).toBe('MESA');
    expect(info.nombre).toBe('Mesa de Partes');
    expect(info.badgeClase).toContain('blue');
  });

  it('4. Traduce UUID canónico de Dirección General para rol TESORERIA', () => {
    const info = obtenerInfoArea(AREA_ID_DIR, null, 'TESORERIA');
    expect(info.codigo).toBe('TES');
    expect(info.nombre).toBe('Tesorería');
    expect(info.badgeClase).toContain('emerald');
  });

  it('5. Traduce UUID canónico de Dirección General para DIRECTOR o ADMINISTRADOR', () => {
    const info = obtenerInfoArea(AREA_ID_DIR, null, 'DIRECTOR');
    expect(info.codigo).toBe('DIR');
    expect(info.nombre).toBe('Dirección General');
    expect(info.badgeClase).toContain('indigo');
  });

  it('6. Ante área nula o indefinida, asigna Mesa de Partes (etapa de radicación inicial)', () => {
    const info = obtenerInfoArea(null);
    expect(info.codigo).toBe('MESA');
    expect(info.nombre).toBe('Mesa de Partes');
    expect(info.badgeClase).toContain('blue');
  });

  it('7. Utiliza nombre explícito devuelto por backend si está disponible', () => {
    const info = obtenerInfoArea('custom-uuid', 'Área de Innovación Tecnológica');
    expect(info.nombre).toBe('Área de Innovación Tecnológica');
  });
});
