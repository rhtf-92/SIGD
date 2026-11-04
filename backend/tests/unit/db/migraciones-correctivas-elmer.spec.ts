import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rutaMigracion = (nombre: string) =>
  fileURLToPath(new URL('../../../migraciones/' + nombre, import.meta.url));

const leerMigracion = (nombre: string) => readFileSync(rutaMigracion(nombre), 'utf8');

describe('integridad migraciones correctivas PostgreSQL (Elmer)', () => {
  it('22: DO  válido, uses information_schema, idempotente', () => {
    const m = leerMigracion('22_sigd_refresh_token_idempotente.sql');
    expect(m).toContain('DO ');
    expect(m).toContain('LANGUAGE plpgsql');
    expect(m).toContain('information_schema.columns');
    expect(m).toContain('refresh_token');
    expect(m).toContain('TYPE TEXT');
    expect(m).not.toContain('\\$\\$');
    expect(m).not.toMatch(/\bBEGIN\s*;/);
    expect(m).not.toMatch(/\bCOMMIT\s*;/);
  });

  it('23: deshabilita la cuenta conocida y retira permisos masivos de forma segura', () => {
    const m = leerMigracion('23_sigd_superadmin_hardening.sql');
    expect(m).toContain('DO ');
    expect(m).toContain('LANGUAGE plpgsql');
    expect(m).not.toMatch(/\bBEGIN\s*;/);
    expect(m).not.toMatch(/\bCOMMIT\s*;/);
    expect(m).not.toContain('CROSS JOIN sigd_org.rol_permiso');
    expect(m).not.toContain('CROSS JOIN sigd_org.permiso_sistema');
    expect(m).toContain('ADMINISTRADOR');
    expect(m).toContain('activo = FALSE');
    expect(m).toContain('revocado_en');
    expect(m).toContain('DELETE FROM sigd_org.rol_permiso');
    expect(m).toContain('RAISE EXCEPTION');
  });

  it('24: valida conteo y lanza EXCEPTION con mapeo', () => {
    const m = leerMigracion('24_sigd_rut_actor_uuid_mapeo_seguro.sql');
    expect(m).toContain('DO ');
    expect(m).toContain('LANGUAGE plpgsql');
    expect(m).toContain('solicitud_compensacion_folios');
    expect(m).toContain('actor_id');
    expect(m).toContain('COUNT(*)');
    expect(m).toContain('RAISE EXCEPTION');
    expect(m).toMatch(/mapeo|IdentiCore/i);
    expect(m).toContain('actor_id_uuid_mapeo');
    expect(m).toContain('actor_uuid');
    expect(m).not.toMatch(/\bBEGIN\s*;/);
    expect(m).not.toMatch(/\bCOMMIT\s*;/);
  });
});
