import { defineConfig } from 'vitest/config';

// Config mínima para ejecutar el E2E de TramiCore contra el PostgreSQL local
// (TEST_DATABASE_URL), sin el globalSetup de Testcontainers que exige Docker.
export default defineConfig({
  test: {
    include: ['tests/e2e/domains/tramicore/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
  },
});
