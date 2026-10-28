import { describe, expect, it } from 'vitest';
import {
  TUPA_SUIZA_2026_COMPLETO,
  type CategoriaTupa
} from '../../../src/data/tupaSuiza2026CatalogoCompleto';

describe('Catálogo TUPA Suiza 2026 Completo (72 Entradas)', () => {
  it('contiene exactamente 72 entradas oficiales', () => {
    expect(TUPA_SUIZA_2026_COMPLETO).toHaveLength(72);
  });

  it('cumple exactamente el conteo por categoría especificado', () => {
    const counts: Record<CategoriaTupa, number> = {
      PROCEDIMIENTO_APROBADO: 0,
      PROCEDIMIENTO_PENDIENTE: 0,
      SERVICIO_ACADEMICO: 0,
      SERVICIO_COMERCIAL: 0,
      BIEN_PRODUCTIVO: 0,
      ACTUACION_INTERNA: 0,
      OTRO_NO_RADICABLE: 0,
    };

    for (const item of TUPA_SUIZA_2026_COMPLETO) {
      counts[item.categoria] = (counts[item.categoria] || 0) + 1;
    }

    expect(counts.PROCEDIMIENTO_APROBADO).toBe(18);
    expect(counts.PROCEDIMIENTO_PENDIENTE).toBe(5);
    expect(counts.SERVICIO_ACADEMICO).toBe(17);
    expect(counts.SERVICIO_COMERCIAL).toBe(9);
    expect(counts.BIEN_PRODUCTIVO).toBe(9);
    expect(counts.ACTUACION_INTERNA).toBe(5);
    expect(counts.OTRO_NO_RADICABLE).toBe(9);

    const totalSum = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(totalSum).toBe(72);
  });

  it('cuenta con exactamente 18 radicables y 54 no radicables', () => {
    const radicables = TUPA_SUIZA_2026_COMPLETO.filter((item) => item.admiteRadicacionSigd);
    const noRadicables = TUPA_SUIZA_2026_COMPLETO.filter((item) => !item.admiteRadicacionSigd);

    expect(radicables).toHaveLength(18);
    expect(noRadicables).toHaveLength(54);

    // Todos los radicables deben ser PROCEDIMIENTO_APROBADO y estadoValidacion APROBADO
    for (const item of radicables) {
      expect(item.categoria).toBe('PROCEDIMIENTO_APROBADO');
      expect(item.estadoValidacion).toBe('APROBADO');
    }

    // Ningún no radicable puede ser PROCEDIMIENTO_APROBADO
    for (const item of noRadicables) {
      expect(item.categoria).not.toBe('PROCEDIMIENTO_APROBADO');
    }
  });

  it('garantiza unicidad de ID y formato pX-fila-YY en todas las entradas', () => {
    const idSet = new Set<string>();
    const idRegex = /^p\d+-fila-\d+$/;

    for (const item of TUPA_SUIZA_2026_COMPLETO) {
      expect(idRegex.test(item.id)).toBe(true);
      expect(item.id).toBe(item.referenciaFila);
      expect(idSet.has(item.id)).toBe(false);
      idSet.add(item.id);

      expect(item.pagina).toBeGreaterThanOrEqual(1);
      expect(item.pagina).toBeLessThanOrEqual(10);
      expect(item.denominacion.trim().length).toBeGreaterThan(0);
      expect(item.requisitos.length).toBeGreaterThan(0);
      expect(item.plazo.trim().length).toBeGreaterThan(0);
      expect(item.unidadResponsable.trim().length).toBeGreaterThan(0);
    }
    expect(idSet.size).toBe(72);
  });

  it('no contiene credenciales ni datos sensibles hardcodeados', () => {
    for (const item of TUPA_SUIZA_2026_COMPLETO) {
      expect(item.denominacion).not.toMatch(/password/i);
      expect(item.denominacion).not.toMatch(/api_key/i);
      expect(item.observacion).not.toMatch(/password/i);
      expect(item.observacion).not.toMatch(/bearer/i);
    }
  });
});
