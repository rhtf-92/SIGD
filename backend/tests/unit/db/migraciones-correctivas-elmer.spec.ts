import crypto from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  asegurarBaseTemporalAislada,
  esHostAisladoPermitido,
  esNombreBaseTemporalValido,
  verificarNoColisionaConUrlsExternas,
} from '../../helpers/ephemeral-postgres.helper.js';

const dirMigraciones = fileURLToPath(new URL('../../../migraciones', import.meta.url));
const rutaMigracion = (nombre: string) => path.join(dirMigraciones, nombre);
const rutaTestIntegracion = fileURLToPath(
  new URL('../../integration/db/migraciones-correctivas.test.ts', import.meta.url),
);

const leerMigracion = (nombre: string) => readFileSync(rutaMigracion(nombre), 'utf8');
const sha256Lf = (nombre: string) =>
  crypto.createHash('sha256').update(leerMigracion(nombre).replace(/\r\n/g, '\n')).digest('hex');

/**
 * Huellas SHA-256 canónicas (LF) de las 21 migraciones históricas de F_BARTRA.
 * Garantiza que ninguna migración histórica sea alterada y que el ledger
 * public.sigd_migraciones conserve compatibilidad total.
 */
const MIGRACIONES_HISTORICAS_SHA256: Readonly<Record<string, string>> = {
  '01_sigd_audit.sql': '70b253962f4a262c702cbe6b473c425571dd8e75cb9144233a67a2cba08ce604',
  '02_sigd_auth.sql': 'ca12062af8029c793de4253db4f0519e4505bfa9f806452b7db22eb84ae9ddba',
  '03_sigd_org.sql': '393486ea55f30a18abd08a658517d9f980f08858938d4bfa17c0563e694d661d',
  '04_sigd_doc.sql': 'e09c83363492829f197fcc3b198c782991155d7e09ae450ee7a5b02e8014180a',
  '05_sigd_tra.sql': '034f86fe8426a48153d42234036132483e2cd733d563eb495f5ee4184bdf27af',
  '06_sigd_rut.sql': 'f3261804f0b832642b91d498d12020eb8daae93ab6a21ec3a93b516046ccea85',
  '07_sigd_reportes.sql': '9c6b81bed746aae50460fe989c3825fffeba1323edf21562520c696c2e0ac648',
  '08_sigd_auth_bloqueo_cuentas.sql': '408c09045829ee10497fc80e3c5eeb524babd00d8974b539208c5e2ae074ae6f',
  '08_sigd_tra_folio_function.sql': '7ee721c55d7ad1f6cdcd1df443781612a99b7ec0de956c2774fbe6e2df98f98e',
  '09_sigd_auth_perfil_activo.sql': '26d2d2291ba8c78092fa78386c36ed372276ecbd710fd6760c1fb29e70da8d10',
  '09_sigd_rut_actor_uuid.sql': '3a8ecae6b506b9a121f05239afca8e39f89034cf5429a71a3bb4c50ff3843947',
  '10_sigd_virtual.sql': '37475180526e06b45c25fcbc01131fdd6146a54bbf5dadd7bfcd52c3b5128b07',
  '11_sigd_mgd_contract.sql': '7df55fa30634808287cc280174e3f4cb438cb5d33023339f6ee473455a22f180',
  '12_sigd_autoregistro.sql': '07a2721ccda368022083b0a6585b41900faf257c03f1c23562b3e5a8866a1b05',
  '13_sigd_documentos_identidad.sql': '5de4e5551fb5f806e006528d98986971b60a3ae42e55615baeaa1d94968f93b3',
  '14_sigd_workflow_academico.sql': 'f83db9ea0581001c1369a83df4316458934c5971f54d1cef2eec3f8f6684ad13',
  '15_sigd_auth_refresh_token_text.sql': '4bde15fcf2c930a96d4f4016f6fb298c2076b642fbc722d594384b03a99ca5b1',
  '15_sigd_superadmin.sql': 'f182a54c196e6e4e382d7139d777a6afeb7c5cf78bc73b2ce317310e50e304be',
  '16_sigd_refresh_token_text.sql': '983aeeff5269bbec67d278db6df62a5d1d949a8aea63a93a3b29522b03089fb1',
  '17_sigd_admin_settings.sql': 'ac50fa4beb82b7c56c4bad7c1387be96c6b729f897e5db5de216d2f967541587',
  '18_sigd_user_catalogs.sql': 'a7f01d89a3c952d25394a7d6ed3dbe41c1f1176efae3966f7936745a85837f06',
};

describe('auditoría de las 21 migraciones históricas, prefijos, hashes y privilegios mínimos', () => {
  it('conserva intactas las 21 migraciones históricas con sus hashes SHA-256 canónicos', () => {
    expect(Object.keys(MIGRACIONES_HISTORICAS_SHA256)).toHaveLength(21);
    for (const [nombre, esperado] of Object.entries(MIGRACIONES_HISTORICAS_SHA256)) {
      expect(sha256Lf(nombre), `Checksum alterado en migración histórica ${nombre}`).toBe(esperado);
    }
  });

  it('impide nuevos prefijos numéricos duplicados a partir de la migración 19 y mantiene orden léxico determinista', () => {
    const archivos = readdirSync(dirMigraciones)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const vistosPosteriores = new Map<string, string>();
    for (const archivo of archivos) {
      const match = /^(\d+)_/.exec(archivo);
      expect(match, `Nombre fuera de convención numérica: ${archivo}`).not.toBeNull();
      const prefijo = match![1];
      if (Number(prefijo) >= 19) {
        expect(
          vistosPosteriores.has(prefijo),
          `Prefijo duplicado prohibido (${prefijo}): ${vistosPosteriores.get(prefijo)} vs ${archivo}`,
        ).toBe(false);
        vistosPosteriores.set(prefijo, archivo);
      }
    }

    // Orden relativo determinista de prefijos históricos duplicados 08, 09 y 15 y correctivas 22-24:
    expect(archivos.indexOf('08_sigd_auth_bloqueo_cuentas.sql')).toBeLessThan(
      archivos.indexOf('08_sigd_tra_folio_function.sql'),
    );
    expect(archivos.indexOf('09_sigd_auth_perfil_activo.sql')).toBeLessThan(
      archivos.indexOf('09_sigd_rut_actor_uuid.sql'),
    );
    expect(archivos.indexOf('15_sigd_auth_refresh_token_text.sql')).toBeLessThan(
      archivos.indexOf('15_sigd_superadmin.sql'),
    );
    expect(archivos.indexOf('18_sigd_user_catalogs.sql')).toBeLessThan(
      archivos.indexOf('22_sigd_refresh_token_idempotente.sql'),
    );
    expect(archivos.indexOf('22_sigd_refresh_token_idempotente.sql')).toBeLessThan(
      archivos.indexOf('23_sigd_superadmin_hardening.sql'),
    );
    expect(archivos.indexOf('23_sigd_superadmin_hardening.sql')).toBeLessThan(
      archivos.indexOf('24_sigd_rut_actor_uuid_mapeo_seguro.sql'),
    );
  });

  it('verifica separación de privilegios mínimos en auditoría WORM y revocación de funciones críticas a PUBLIC', () => {
    const audit = leerMigracion('01_sigd_audit.sql');
    expect(audit).toContain('REVOKE UPDATE, DELETE ON sigd_audit.bitacora_auditoria FROM sigd_app');
    expect(audit).toContain('REVOKE UPDATE, DELETE ON sigd_audit.bitacora_auditoria FROM sigd_worker');
    expect(audit).toContain('REVOKE DELETE ON sigd_audit.evento_outbox FROM sigd_worker');

    const folio = leerMigracion('08_sigd_tra_folio_function.sql');
    expect(folio).toContain('REVOKE EXECUTE ON FUNCTION sigd_tra.agregar_folio_expediente(UUID, UUID, INT, UUID) FROM PUBLIC');
  });
});

describe('integridad migraciones correctivas PostgreSQL (22, 23 y 24)', () => {
  it('22: bloque DO $$ válido en LF puro, verifica existencia/tipo en information_schema y es idempotente sin BEGIN/COMMIT internos', () => {
    const m = leerMigracion('22_sigd_refresh_token_idempotente.sql');
    expect(m).not.toContain('\r');
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

  it('23: verifica relevo ADMINISTRADOR funcional antes de deshabilitar superadmin, preserva permisos globales y arma transición automática', () => {
    const m = leerMigracion('23_sigd_superadmin_hardening.sql');
    expect(m).not.toContain('\r');
    expect(m).toContain('DO $$');
    expect(m).toContain('END $$ LANGUAGE plpgsql;');
    expect(m).not.toMatch(/\bBEGIN\s*;/i);
    expect(m).not.toMatch(/\bCOMMIT\s*;/i);
    expect(m).not.toContain('CROSS JOIN sigd_org.rol_permiso');
    expect(m).not.toContain('CROSS JOIN sigd_org.permiso_sistema');
    expect(m).not.toContain('DELETE FROM sigd_org.rol_permiso');
    expect(m).not.toMatch(/\bRAISE\s+EXCEPTION\b/i);
    expect(m).toContain('fn_endurecer_superadmin_si_hay_relevo');
    expect(m).toContain('v_admins_alternativos < 1');
    expect(m).toContain('tr_auto_hardening_superadmin');
    expect(m).toContain('REVOKE ALL ON FUNCTION sigd_org.fn_endurecer_superadmin_si_hay_relevo() FROM PUBLIC');
    expect(m).toContain('superadmin');
    expect(m).toContain('activo = FALSE');
    expect(m).toContain('revocado_en = now()');
    expect(m).toContain('permisos de ADMINISTRADOR preservados');
  });

  it('24: convierte actor_id in-place sin DROP COLUMN ni RENAME COLUMN, exige mapeo explícito y preserva vistas/dependencias', () => {
    const m = leerMigracion('24_sigd_rut_actor_uuid_mapeo_seguro.sql');
    expect(m).not.toContain('\r');
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
