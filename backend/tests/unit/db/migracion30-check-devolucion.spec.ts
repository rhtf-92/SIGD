import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migracion = fs.readFileSync(
  path.resolve(process.cwd(), 'migraciones/30_sigd_devolucion_monto_autorizado_check.sql'),
  'utf8',
);

describe('Migración 30: monto devuelto requiere autorización', () => {
  it('aborta si existen filas heredadas que incumplen el nuevo contrato', () => {
    expect(migracion).toMatch(/monto_devuelto\s+IS NOT NULL[\s\S]*monto_autorizado\s+IS NULL/i);
    expect(migracion).toMatch(/RAISE EXCEPTION/i);
  });

  it('reemplaza el CHECK con una implicación explícita', () => {
    expect(migracion).toMatch(/DROP CONSTRAINT IF EXISTS chk_tra_solicitud_devolucion_monto_dev/i);
    expect(migracion).toMatch(/monto_devuelto\s+IS NULL\s+OR\s*\(\s*monto_autorizado\s+IS NOT NULL/i);
    expect(migracion).toMatch(/monto_devuelto\s*<=\s*monto_autorizado/i);
  });
});
