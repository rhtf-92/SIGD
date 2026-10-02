import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // .spec.ts es la convencion de entregables del plan de trabajo; .test.ts
    // se conserva para las suites previas sin romper.
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.spec.ts'],
    pool: 'forks',
    // §6.3 del plan: mismos umbrales que en vitest.config.ts, de modo que la
    // suite unitaria también falla si la cobertura de src/ se degrada.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.schemas.ts', 'src/types/**', 'src/server.ts'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
