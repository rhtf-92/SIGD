import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsearTupaMarkdown } from '../../../../src/domains/tupa/tupa.parser.js';

const directorioActual = path.dirname(fileURLToPath(import.meta.url));
const contenidoTupa = fs.readFileSync(
  path.resolve(directorioActual, '../../../../data/tupa/TUPA_2026_IESTP_Suiza_estructurado.md'),
  'utf8',
);

describe('parsearTupaMarkdown', () => {
  const tramites = parsearTupaMarkdown(contenidoTupa);

  it('lee las 81 fichas con los 37 trámites PRO y 44 ACA', () => {
    expect(tramites).toHaveLength(81);
    expect(tramites.filter((tramite) => tramite.codigo.startsWith('TUPA-PRO-'))).toHaveLength(37);
    expect(tramites.filter((tramite) => tramite.codigo.startsWith('TUPA-ACA-'))).toHaveLength(44);
  });

  it('conserva los montos, plazos y marcas de validación', () => {
    const iniciales = tramites.find((tramite) => tramite.codigo === 'TUPA-PRO-001');
    const mercado = tramites.find((tramite) => tramite.codigo === 'TUPA-PRO-016');
    const ambiguo = tramites.find((tramite) => tramite.codigo === 'TUPA-PRO-031');
    const notaMonto = tramites.find((tramite) => tramite.codigo === 'TUPA-PRO-021');

    expect(iniciales).toMatchObject({
      derecho_monto: 35,
      derecho_porcentaje_uit: 0.64,
      plazo_dias_habiles: 30,
    });
    expect(mercado?.derecho_monto).toBeNull();
    expect(mercado?.derecho_texto?.toLocaleLowerCase('es')).toContain('de acuerdo al mercado');
    expect(ambiguo?.derecho_texto).toContain('S/ 50.00 y S/ 55.00');
    expect(ambiguo?.observaciones).toContain('[REVISAR:');
    expect(notaMonto?.derecho_texto?.length).toBeGreaterThan(100);
  });

  it('valida la suma documentada de los trámites ACA-001 a ACA-014 y sus requisitos', () => {
    const montoTotal = tramites
      .filter((tramite) => /^TUPA-ACA-0(?:0[1-9]|1[0-4])$/.test(tramite.codigo))
      .reduce((total, tramite) => total + (tramite.derecho_monto ?? 0), 0);

    expect(montoTotal).toBe(917.5);
    expect(tramites.find((tramite) => tramite.codigo === 'TUPA-PRO-001')?.requisitos).toHaveLength(3);
    expect(Math.max(...tramites.map((tramite) => tramite.plazo_texto?.length ?? 0))).toBeLessThanOrEqual(300);
  });
});
