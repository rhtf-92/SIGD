import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rutaMigracion = (nombre: string) =>
  fileURLToPath(new URL(\../../../migraciones/\\, import.meta.url));

const leerMigracion = (nombre: string) => readFileSync(rutaMigracion(nombre), 'utf8');

describe('integridad migraciones correctivas (Elmer)', () => {
  it('22_sigd_refresh_token_idempotente.sql valida tipo antes de ALTER (idempotente)', () => {
    const m = leerMigracion('22_sigd_refresh_token_idempotente.sql');
    expect(m).toContain('information_schema.columns');
    expect(m).toContain('data_type');
    expect(m).toContain('refresh_token');
    expect(m).toContain('ALTER TABLE sigd_auth.sesion_usuario');
    expect(m).toContain('TYPE TEXT');
  });

  it('23_sigd_superadmin_hardening.sql no usa BEGIN/COMMIT internos ni CROSS JOIN masivo', () => {
    const m = leerMigracion('23_sigd_superadmin_hardening.sql');
    expect(m).not.toMatch(/\bBEGIN\b/i);
    expect(m).not.toMatch(/\bCOMMIT\b/i);
    expect(m).not.toContain('CROSS JOIN sigd_org.rol_permiso');
    expect(m).not.toContain('CROSS JOIN sigd_org.permiso_sistema');
  });

  it('24_sigd_rut_actor_uuid_mapeo_seguro.sql valida datos existentes antes de convertir', () => {
    const m = leerMigracion('24_sigd_rut_actor_uuid_mapeo_seguro.sql');
    expect(m).toContain('solicitud_compensacion_folios');
    expect(m).toContain('actor_id');
    expect(m).toContain('COUNT(*)');
    expect(m).toContain('EXCEPTION');
    expect(m).toContain('mapeo');
  });
});
