import { defineConfig } from 'vitest/config';

export default defineConfig({ test: {
  include: ['tests/performance/rutadoc-benchmark.test.ts'],
  pool: 'forks', fileParallelism: false,
  testTimeout: 300_000, hookTimeout: 300_000,
} });
