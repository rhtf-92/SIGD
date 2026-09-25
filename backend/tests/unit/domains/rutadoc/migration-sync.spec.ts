import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ESTADOS_RUTADOC,
  EVENTOS_RUTADOC,
  TRANSICIONES_RUTADOC,
} from '../../../../src/domains/rutadoc/rutadoc.fsm.js';

const ruta = path.resolve(process.cwd(), 'migraciones/06_sigd_rut.sql');
const documento = path.resolve(process.cwd(), 'docs/05_rutadoc/06_esquema_sigd_rut_fsm_v6.3.sql');
const sql = readFileSync(ruta, 'utf8');

function filas(tabla: string): string[][] {
  const inicio = sql.indexOf(`INSERT INTO sigd_rut.${tabla}`);
  expect(inicio).toBeGreaterThanOrEqual(0);
  const bloque = sql.slice(inicio, sql.indexOf('ON CONFLICT', inicio));
  const valores = bloque.slice(bloque.indexOf('VALUES') + 'VALUES'.length);
  return [...valores.matchAll(/\(([^()]+)\)/g)].map((coincidencia) =>
    [...coincidencia[1].matchAll(/'([^']+)'|\b(TRUE|FALSE)\b/g)].map((celda) => celda[1] ?? celda[2]),
  );
}

describe('DDL RutaDoc y FSM publicada', () => {
  it('mantiene idénticos el SQL ejecutable y el entregable documental', () => {
    const hash = (contenido: Buffer): string => createHash('sha256').update(contenido).digest('hex');
    expect(hash(readFileSync(ruta))).toBe(hash(readFileSync(documento)));
  });

  it('incluye exactamente los estados, eventos y transiciones de TypeScript', () => {
    expect(filas('estado_tramite').map(([codigo]) => codigo)).toEqual([...ESTADOS_RUTADOC]);
    expect(filas('estado_tramite').filter(([, terminal]) => terminal === 'TRUE'))
      .toEqual([['ARCHIVADO', 'TRUE']]);
    expect(filas('accion_tramite').map(([codigo]) => codigo)).toEqual([...EVENTOS_RUTADOC]);

    const esperadas = Object.entries(TRANSICIONES_RUTADOC).flatMap(([origen, eventos]) =>
      Object.entries(eventos).map(([evento, destino]) => [origen, evento, destino]),
    );
    expect(filas('transicion_estado_tramite')).toEqual(esperadas);
    expect(esperadas).toHaveLength(13);
  });
});
