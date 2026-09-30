import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    globalSetup: ['./tests/setup/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
    // La API nativa `EventSource` no admite cabeceras personalizadas, asi que
    // `auth.guard` solo acepta `x-usuario-id` si se habilita de forma explicita.
    // Se activa solo en la suite para poder afirmar identidad sin firmar un JWT,
    // y el valor por defecto en produccion sigue siendo `false`.
    env: {
      ALLOW_HEADER_IDENTITY: 'true',
    },
    // §6.3 del plan: umbrales de fallo de cobertura con @vitest/coverage-v8.
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
