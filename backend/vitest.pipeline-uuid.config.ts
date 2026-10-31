import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/domains/rutadoc/pipeline-uuid.test.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
