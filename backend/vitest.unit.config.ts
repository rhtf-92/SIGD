import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `.spec.ts` es la convención de entregables del plan de trabajo; `.test.ts`
    // se conserva para las suites previas sin romper.
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.spec.ts'],
    pool: 'forks',
  },
});