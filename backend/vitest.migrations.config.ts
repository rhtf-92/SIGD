import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/db/migraciones-correctivas.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    pool: 'forks',
  },
});
