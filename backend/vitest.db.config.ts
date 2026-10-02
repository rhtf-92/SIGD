import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/domains/corelink/migrate.spec.ts', 'tests/unit/domains/corelink/outbox.spec.ts'],
    globalSetup: ['./tests/setup/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    pool: 'forks',
  },
});
