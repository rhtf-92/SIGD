import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.resolve(process.cwd(), 'tests/local/sql/25_sigd_radicacion_academica_privilegios.sql'),
  'utf8',
);

describe('migracion de privilegios de radicacion academica', () => {
  it('encapsula CUT y foliacion sin conceder UPDATE global sobre expediente', () => {
    expect(sql).toContain('ALTER FUNCTION sigd_tra.fn_generar_cut(integer) SECURITY DEFINER');
    expect(sql).toContain('ALTER FUNCTION sigd_tra.agregar_folio_expediente(uuid, uuid, integer, uuid)');
    expect(sql).toContain('SET search_path = pg_catalog, sigd_tra');
    expect(sql).not.toMatch(/GRANT\s+[^;]*UPDATE[^;]*ON TABLE sigd_tra\.expediente\b/i);
  });

  it('mantiene las tablas internas fuera de escritura directa de sigd_app', () => {
    expect(sql).toContain('REVOKE ALL ON TABLE sigd_tra.secuencia_anual_cut FROM sigd_app');
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE sigd_rut.movimiento_identidad FROM sigd_app');
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE sigd_rut.estado_actual_expediente FROM sigd_app');
  });
});
