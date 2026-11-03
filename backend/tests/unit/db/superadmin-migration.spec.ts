import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rutaMigracion = fileURLToPath(
  new URL('../../../migraciones/15_sigd_superadmin.sql', import.meta.url),
);

describe('migración de superadministrador', () => {
  it('crea la cuenta superadmin con perfil ADMINISTRADOR y todos los permisos', () => {
    expect(existsSync(rutaMigracion)).toBe(true);
    const sql = readFileSync(rutaMigracion, 'utf8');
    expect(sql).toContain("'superadmin'");
    expect(sql).toContain("r.codigo = 'ADMINISTRADOR'");
    expect(sql).toContain('INSERT INTO sigd_org.rol_permiso');
    expect(sql).toContain('CROSS JOIN sigd_org.permiso_sistema AS p');
    expect(sql).toContain('INSERT INTO sigd_org.usuario_rol');
    expect(sql).toContain('ON CONFLICT (usuario) DO NOTHING');
  });
});
