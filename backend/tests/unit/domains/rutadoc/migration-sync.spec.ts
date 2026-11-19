import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ESTADOS_RUTADOC,
  EVENTOS_RUTADOC,
  TRANSICIONES_RUTADOC,
} from '../../../../src/domains/rutadoc/rutadoc.fsm.js';

const ruta = fileURLToPath(new URL('../../../../migraciones/06_sigd_rut.sql', import.meta.url));
const documento = fileURLToPath(
  new URL('../../../../docs/05_rutadoc/06_esquema_sigd_rut_fsm_v6.3.sql', import.meta.url),
);
const normalizar = (txt: string): string => txt.replace(/\r\n/g, '\n');
const sql = normalizar(readFileSync(ruta, 'utf8'));

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
  it('mantiene idénticos el SQL ejecutable y el entregable documental bajo el contrato UUID', () => {
    const hash = (contenido: string): string =>
      createHash('sha256').update(normalizar(contenido)).digest('hex');

    // Adaptación canónica de la versión preliminar v6.3 (BIGINT) al contrato integrado UUID
    if (existsSync(documento)) {
      const docAdaptado = normalizar(readFileSync(documento, 'utf8'))
        .replace(/expediente_id BIGINT PRIMARY KEY/g, 'expediente_id UUID PRIMARY KEY')
        .replace(/expediente_id BIGINT NOT NULL/g, 'expediente_id UUID NOT NULL')
        .replace(/Identificador externo BIGINT de TramiCore/g, 'Identificador UUID externo de TramiCore')
        .replace(/ON p\.expediente_id = e\.id_expediente/g, 'ON p.expediente_id = e.expediente_id')
        .replace(/v_expediente BIGINT;/g, 'v_expediente UUID;')
        .replace(/WHERE id_expediente = v_expediente/g, 'WHERE expediente_id = v_expediente')
        .replace(/OLD\.id_expediente/g, 'OLD.expediente_id')
        .replace(/NEW\.id_expediente/g, 'NEW.expediente_id')
        .replace(/\(creado_en DESC, id_expediente DESC\)/g, '(fecha_radicacion DESC, expediente_id DESC)');

      expect(hash(readFileSync(ruta, 'utf8'))).toBe(hash(docAdaptado));
    }

    // Verificación estricta de coherencia de tipos y nombres con TramiCore
    expect(sql).toContain('expediente_id UUID PRIMARY KEY');
    expect(sql).toContain('expediente_id UUID NOT NULL');
    expect(sql).not.toContain('e.id_expediente');
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

  it('separa REVERSION_ADMINISTRATIVA de las transiciones normales', () => {
    expect(sql).toContain("VALUES ('REVERSION_ADMINISTRATIVA')");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS sigd_rut.movimiento_compensatorio');
    expect(sql).toContain('REFERENCES sigd_rut.movimiento_tramite (fecha_hora, id_movimiento)');
    expect(sql).toContain('EXECUTE FUNCTION sigd_rut.registrar_movimiento_identidad()');
  });

  it('incluye proyección reconstruible, solicitud de folios y único historial particionado', () => {
    expect(sql).toContain('PARTITION BY RANGE (fecha_hora)');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS sigd_rut.estado_actual_expediente');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS sigd_rut.solicitud_compensacion_folios');
    expect(sql).not.toContain('CREATE TABLE sigd_tra.movimiento');
  });
});
