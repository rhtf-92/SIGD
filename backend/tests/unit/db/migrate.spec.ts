import { describe, expect, it } from 'vitest';
import { checksumMigracionCompatible } from '../../../src/db/migrate.js';

describe('compatibilidad de checksum de migraciones', () => {
  it('acepta únicamente el checksum histórico conocido de sigd_auth', () => {
    expect(
      checksumMigracionCompatible(
        '02_sigd_auth.sql',
        '8e04a8582283f135f50903c1778613d63802ac1d678ebbb41e94d266b34a2dba',
        'd8a04fa7b2c2958f9a1bb2a1e150fc4abd4a33479d89069154410517284cee64',
      ),
    ).toBe(true);
  });

  it('reconoce el checksum histórico de la migración 14 y exige la correctiva 15', () => {
    expect(
      checksumMigracionCompatible(
        '14_sigd_reportes_mgd_compatible.sql',
        '12fa5697814cc2a498a727401bf023913d88d857da31f6097f3afd6fd6831f77',
        '178b2c8b537daa71905ae490fd30e1b09e746d0ab134f0b284a3cada7903f719',
      ),
    ).toBe(true);
    expect(
      checksumMigracionCompatible(
        '14_sigd_reportes_mgd_compatible.sql',
        'checksum-desconocido',
        '178b2c8b537daa71905ae490fd30e1b09e746d0ab134f0b284a3cada7903f719',
      ),
    ).toBe(false);
  });

  it('sigue rechazando cambios no reconocidos en migraciones aplicadas', () => {
    expect(
      checksumMigracionCompatible(
        '02_sigd_auth.sql',
        'checksum-desconocido',
        'd8a04fa7b2c2958f9a1bb2a1e150fc4abd4a33479d89069154410517284cee64',
      ),
    ).toBe(false);
    expect(
      checksumMigracionCompatible('03_sigd_org.sql', 'checksum-desconocido', 'actual'),
    ).toBe(false);
  });
});
