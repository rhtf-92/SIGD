import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../../../migraciones/19_sigd_admin_rbac_permissions.sql', import.meta.url), 'utf8');

describe('migración incremental de permisos administrativos RBAC', () => {
  it('añade los permisos requeridos sin cambiar migraciones históricas', () => {
    expect(sql).toContain("'admin:acceso'");
    expect(sql).toContain("'usuarios:leer'");
    expect(sql).toContain("'calendario:gestionar'");
    expect(sql).toContain("WHERE r.codigo = 'ADMINISTRADOR'");
    expect(sql).toContain('ON CONFLICT DO NOTHING');
  });
});
