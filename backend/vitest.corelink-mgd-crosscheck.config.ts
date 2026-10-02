import { defineConfig } from 'vitest/config';

/**
 * Paridad SQL <-> TypeScript del calendario institucional de MGD.
 *
 * Requiere `DATABASE_URL` apuntando a una base con aplicado
 * `docs/00_corelink/07_vistas_materializadas_mgd.sql`. Sin esa variable la suite
 * se omite. Se ejecuta con `fileParallelism: false` porque abre su propio pool y
 * las consultas son secuenciales.
 */
export default defineConfig({
  test: {
    include: ['tests/integration/domains/corelink/mgdTemporalCrosscheck.test.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 600_000,
    hookTimeout: 120_000,
  },
});
