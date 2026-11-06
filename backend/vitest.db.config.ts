import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/unit/domains/corelink/outbox.spec.ts',
      'tests/integration/domains/organicore/admin-postgres.test.ts',
      'tests/integration/domains/identicore/refresh-concurrency.test.ts',
      'tests/integration/domains/identicore/casilla-concurrency.test.ts',
    ],
    globalSetup: ['./tests/setup/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    pool: 'forks',
    env: {
      MIGRATIONS_EXCLUDE: '06_sigd_rut.sql,07_sigd_reportes.sql,11_sigd_mgd_contract.sql',
    },
  },
});
