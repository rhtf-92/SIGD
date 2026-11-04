import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rutaMigracion = (nombre: string) =>
  fileURLToPath(new URL('../migraciones/' + nombre, import.meta.url));

const leerMigracion = (nombre: string) => readFileSync(rutaMigracion(nombre), 'utf8');

describe('integridad migraciones correctivas PostgreSQL (Elmer)', () => {
  it('22: DO \$\$ válido, usa information_schema, idempotente y filtra por tipo', () => {
    const m = leerMigracion('22_sigd_refresh_token_idempotente.sql');
    expect(m).toMatch(/DO\s+\$\$/i);
    expect(m).toMatch(/\$\$\s+LANGUAGE\s+plpgsql/i);
    expect(m).toContain('information_schema.columns');
    expect(m).toContain('data_type');
    expect(m).toContain('refresh_token');
    expect(m).toMatch(/v_type\s+IS\s+NOT\s+NULL/i);
    expect(m).toMatch(/v_type\s*<>\s*'text'/i);
    expect(m).toContain('ALTER TABLE sigd_auth.sesion_usuario');
    expect(m).toContain('TYPE TEXT');
    expect(m).toMatch(/EXCEPTION/i);
  });

  it('23: DO \$\$ válido, sin BEGIN/COMMIT internos, sin CROSS JOIN masivo, con hallazgo efectivo', () => {
    const m = leerMigracion('23_sigd_superadmin_hardening.sql');
    expect(m).toMatch(/DO\s+\$\$/i);
    expect(m).toMatch(/\$\$\s+LANGUAGE\s+plpgsql/i);
    expect(m).not.toMatch(/\bBEGIN\b\s*;/i);
    expect(m).not.toMatch(/\bCOMMIT\b\s*;/i);
    expect(m).not.toContain('CROSS JOIN sigd_org.rol_permiso');
    expect(m).not.toContain('CROSS JOIN sigd_org.permiso_sistema');
    expect(m).toContain('ADMINISTRADOR');
    expect(m).toMatch(/>=\s*\(.*0\.9\)/);
    expect(m).toMatch(/RAISE\s+NOTICE/i);
    expect(m).toMatch(/EXCEPTION/i);
  });

  it('24: DO \$\$ válido, valida conteo, lanza EXCEPTION, evita conversión silenciosa', () => {
    const m = leerMigracion('24_sigd_rut_actor_uuid_mapeo_seguro.sql');
    expect(m).toMatch(/DO\s+\$\$/i);
    expect(m).toMatch(/\$\$\s+LANGUAGE\s+plpgsql/i);
    expect(m).toContain('sigd_rut');
    expect(m).toContain('solicitud_compensacion_folios');
    expect(m).toContain('actor_id');
    expect(m).toContain('COUNT(*)');
    expect(m).toMatch(/v_count\s*>\s*0/i);
    expect(m).toMatch(/RAISE\s+EXCEPTION/i);
    expect(m).toMatch(/mapeo|IdentiCore/i);
    expect(m).toMatch(/EXCEPTION/i);
  });
});
