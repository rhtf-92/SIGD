import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  asegurarBaseTemporalAislada,
  esHostAisladoPermitido,
  esNombreBaseTemporalValido,
  verificarNoColisionaConUrlsExternas,
} from '../../helpers/ephemeral-postgres.helper.js';

const rutaMigracion = (nombre: string) =>
  fileURLToPath(new URL(`../../../migraciones/${nombre}`, import.meta.url));

const rutaTestIntegracion = fileURLToPath(
  new URL('../../integration/db/migraciones-correctivas.test.ts', import.meta.url),
);

const leerMigracion = (nombre: string) => readFileSync(rutaMigracion(nombre), 'utf8');

describe('integridad migraciones correctivas PostgreSQL (Elmer)', () => {
  it('22: bloque DO $$ válido, verifica existencia/tipo en information_schema y es idempotente sin BEGIN/COMMIT internos', () => {
    const m = leerMigracion('22_sigd_refresh_token_idempotente.sql');
    expect(m).toContain('DO $$');
    expect(m).toContain('END $$ LANGUAGE plpgsql;');
    expect(m).toContain("to_regclass('sigd_auth.sesion_usuario')");
    expect(m).toContain('information_schema.columns');
    expect(m).toContain('refresh_token');
    expect(m).toContain('ALTER COLUMN refresh_token TYPE TEXT');
    expect(m).not.toContain('\\$\\$');
    expect(m).not.toMatch(/\bBEGIN\s*;/i);
    expect(m).not.toMatch(/\bCOMMIT\s*;/i);
  });

  it('23: deshabilita la cuenta inicial superadmin sin eliminar permisos globales del rol ADMINISTRADOR ni fallar con otros administradores', () => {
    const m = leerMigracion('23_sigd_superadmin_hardening.sql');
    expect(m).toContain('DO $$');
    expect(m).toContain('END $$ LANGUAGE plpgsql;');
    expect(m).not.toMatch(/\bBEGIN\s*;/i);
    expect(m).not.toMatch(/\bCOMMIT\s*;/i);
    expect(m).not.toContain('CROSS JOIN sigd_org.rol_permiso');
    expect(m).not.toContain('CROSS JOIN sigd_org.permiso_sistema');
    expect(m).not.toContain('DELETE FROM sigd_org.rol_permiso');
    expect(m).not.toMatch(/\bRAISE\s+EXCEPTION\b/i);
    expect(m).toContain('superadmin');
    expect(m).toContain('activo = FALSE');
    expect(m).toContain('revocado_en = now()');
    expect(m).toContain('permisos de ADMINISTRADOR preservados');
  });

  it('24: convierte actor_id in-place sin DROP COLUMN ni RENAME COLUMN, exige mapeo explícito y preserva vistas/dependencias', () => {
    const m = leerMigracion('24_sigd_rut_actor_uuid_mapeo_seguro.sql');
    expect(m).toContain('DO $$');
    expect(m).toContain('END $$ LANGUAGE plpgsql;');
    expect(m).toContain('solicitud_compensacion_folios');
    expect(m).toContain('actor_id_uuid_mapeo');
    expect(m).toContain('COUNT(*)');
    expect(m).toContain('RAISE EXCEPTION');
    expect(m).toContain('ALTER COLUMN actor_id TYPE UUID');
    expect(m).toContain('USING sigd_rut._map_actor_id_uuid(actor_id)');
    expect(m).toContain('pg_get_viewdef');
    expect(m).not.toContain('DROP COLUMN actor_id');
    expect(m).not.toContain('RENAME COLUMN');
    expect(m).not.toMatch(/\bBEGIN\s*;/i);
    expect(m).not.toMatch(/\bCOMMIT\s*;/i);
  });

  it('suite de integración no usa DROP SCHEMA CASCADE ni acepta conexión externa por variable de entorno', () => {
    const testSrc = readFileSync(rutaTestIntegracion, 'utf8');
    expect(testSrc).not.toMatch(/DROP\s+SCHEMA/i);
    expect(testSrc).not.toMatch(/new\s+Client\(\s*\{\s*connectionString:\s*urlExterna/i);
    expect(testSrc).toContain('iniciarClusterPostgresEfimero');
    expect(testSrc).toContain('conBaseTemporalAislada');
  });
});

describe('guardas de aislamiento para bases temporales destructivas', () => {
  it('solo acepta nombres de bases temporales con prefijo sigd_tmp_<hex> y hosts loopback', () => {
    expect(esNombreBaseTemporalValido('sigd_tmp_0123456789abcdef0123')).toBe(true);
    expect(esNombreBaseTemporalValido('sigd_prueba')).toBe(false);
    expect(esNombreBaseTemporalValido('sigd')).toBe(false);
    expect(esNombreBaseTemporalValido('postgres')).toBe(false);

    expect(esHostAisladoPermitido('127.0.0.1')).toBe(true);
    expect(esHostAisladoPermitido('localhost')).toBe(true);
    expect(esHostAisladoPermitido('db.produccion.sigd.pe')).toBe(false);
  });

  it('bloquea cualquier colisión de puerto con DATABASE_URL, MIGRATOR_DATABASE_URL o MIGRATION_TEST_DATABASE_URL', () => {
    expect(() =>
      verificarNoColisionaConUrlsExternas(
        { host: '127.0.0.1', port: 5432, database: 'sigd_tmp_0123456789abcdef0123' },
        { DATABASE_URL: 'postgres://sigd_app:clave@localhost:5432/sigd' },
      ),
    ).toThrow(/coincide con la conexión externa/i);

    expect(() =>
      verificarNoColisionaConUrlsExternas(
        { host: '127.0.0.1', port: 5433, database: 'sigd_tmp_0123456789abcdef0123' },
        { MIGRATOR_DATABASE_URL: 'postgres://sigd_migrator:clave@127.0.0.1:5433/sigd' },
      ),
    ).toThrow(/coincide con la conexión externa/i);

    expect(() =>
      verificarNoColisionaConUrlsExternas(
        { host: '127.0.0.1', port: 59871, database: 'sigd_tmp_0123456789abcdef0123' },
        { DATABASE_URL: 'postgres://sigd_app:clave@localhost:5432/sigd' },
      ),
    ).not.toThrow();
  });

  it('asegurarBaseTemporalAislada rechaza sesiones sin marcador criptográfico válido', async () => {
    const clienteFalso = {
      query: async (sql: string) => {
        if (sql.includes('current_database()')) {
          return { rows: [{ db: 'sigd_tmp_0123456789abcdef0123', port: 59999 }] };
        }
        return { rows: [] };
      },
    } as unknown as Parameters<typeof asegurarBaseTemporalAislada>[0];

    await expect(
      asegurarBaseTemporalAislada(clienteFalso, {
        expectedDbName: 'sigd_tmp_0123456789abcdef0123',
        expectedToken: '11111111-1111-1111-1111-111111111111',
        allowedHost: '127.0.0.1',
        allowedPort: 59999,
        env: {},
      }),
    ).rejects.toThrow(/marcador criptográfico/i);
  });
});
