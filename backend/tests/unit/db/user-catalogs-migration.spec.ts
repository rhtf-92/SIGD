import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rutaMigracion = fileURLToPath(
  new URL('../../../migraciones/18_sigd_user_catalogs.sql', import.meta.url),
);

describe('migración de catálogos iniciales de personal', () => {
  it('provee áreas y cargos activos sin reemplazar registros institucionales existentes', () => {
    expect(existsSync(rutaMigracion)).toBe(true);
    const sql = readFileSync(rutaMigracion, 'utf8');
    expect(sql).toContain('INSERT INTO sigd_org.area');
    expect(sql).toContain('INSERT INTO sigd_org.cargo');
    expect(sql).toContain("'Dirección General'");
    expect(sql).toContain("'Secretaría Académica'");
    expect(sql).toContain("'Director General'");
    expect(sql).toContain("'Secretario Académico'");
    expect(sql.match(/ON CONFLICT \(codigo\) DO NOTHING/g)).toHaveLength(2);
  });
});
