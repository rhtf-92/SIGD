import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/db/baseline-2026.test.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
