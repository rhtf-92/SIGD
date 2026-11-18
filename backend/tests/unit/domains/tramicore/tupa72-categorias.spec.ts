import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIA_TUPA_72 } from '../../../../src/domains/tramicore/tupa72.categorias.js';

describe('clasificación TUPA compartida con formularios', () => {
  it('coincide fila por fila con la fuente frontend de 72 entradas', () => {
    const source = readFileSync(resolve(process.cwd(), '../frontend/src/data/tupaSuiza2026CatalogoCompleto.ts'), 'utf8');
    const start = source.indexOf('= [');
    const end = source.lastIndexOf('];');
    const filas = JSON.parse(source.slice(start + 2, end + 1)) as Array<{ codigo: string; categoria: string }>;
    expect(filas).toHaveLength(72);
    expect(Object.entries(CATEGORIA_TUPA_72)).toEqual(filas.map((fila) => [fila.codigo, fila.categoria]));
    expect(filas[0]?.codigo).toBe('p1-fila-01');
    expect(filas.at(-1)?.codigo).toBe('p6-fila-07');
    expect(filas.filter((fila) => fila.categoria === 'ACTUACION_INTERNA')).toHaveLength(5);
    expect(filas.filter((fila) => fila.categoria === 'PROCEDIMIENTO_APROBADO')).toHaveLength(18);
    expect(filas.filter((fila) => fila.categoria !== 'ACTUACION_INTERNA' && fila.categoria !== 'PROCEDIMIENTO_APROBADO')).toHaveLength(49);
  });
});
