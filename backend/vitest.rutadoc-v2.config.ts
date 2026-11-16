import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/domains/rutadoc/postgres-v2.test.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
