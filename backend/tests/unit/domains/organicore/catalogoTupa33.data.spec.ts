import { describe, expect, it } from 'vitest';
import { CONCEPTOS_TUPA_33 } from '../../../../src/domains/organicore/catalogoTupa33.data.js';

describe('CONCEPTOS_TUPA_33', () => {
  it('mantiene los 33 conceptos importables con códigos únicos', () => {
    expect(CONCEPTOS_TUPA_33).toHaveLength(33);
    expect(new Set(CONCEPTOS_TUPA_33.map((concepto) => concepto.codigo)).size).toBe(33);
    expect(CONCEPTOS_TUPA_33.every((concepto) => concepto.nombre !== '' && concepto.requisitos.length > 0)).toBe(true);
  });
});
