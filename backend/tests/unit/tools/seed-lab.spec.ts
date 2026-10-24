import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { ejecutarSeedLab } from '../../../src/tools/seed-lab.js';

const ENV_VARS_LAB = [
  'LAB_CIUDADANO_PASSWORD',
  'LAB_MESA_PARTES_PASSWORD',
  'LAB_ESPECIALISTA_PASSWORD',
  'LAB_SECRETARIO_PASSWORD',
  'LAB_DIRECTOR_PASSWORD',
  'LAB_ADMINISTRADOR_PASSWORD',
];

describe('seed-lab: salvaguardas y comportamiento', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.DATABASE_URL;
    for (const v of ENV_VARS_LAB) {
      delete process.env[v];
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('aborta y lanza error fatal si NODE_ENV es production', async () => {
    process.env.NODE_ENV = 'production';
    await expect(ejecutarSeedLab({} as unknown as Pool)).rejects.toThrow(
      'FATAL: seed-lab cannot run in production environment.',
    );
  });

  it('falla con mensaje claro si falta alguna variable de entorno de password (fail-closed)', async () => {
    // Solo definimos una variable y dejamos las demás vacías
    process.env.LAB_CIUDADANO_PASSWORD = 'TestPassword123#';
    await expect(ejecutarSeedLab({} as unknown as Pool)).rejects.toThrow(
      /Falta definir la variable de entorno obligatoria para la cuenta demo: LAB_MESA_PARTES_PASSWORD/,
    );
  });

  it('falla con error claro si no se proporciona poolParam y falta DATABASE_URL', async () => {
    for (const v of ENV_VARS_LAB) {
      process.env[v] = 'MockSecretPassword#2026';
    }
    delete process.env.DATABASE_URL;

    await expect(ejecutarSeedLab()).rejects.toThrow(
      'Falta definir DATABASE_URL para ejecutar el seed de laboratorio.',
    );
  });

  it('no requiere DATABASE_URL si se provee un poolParam inyectado por tests', async () => {
    for (const v of ENV_VARS_LAB) {
      process.env[v] = 'MockSecretPassword#2026';
    }
    delete process.env.DATABASE_URL;

    const mockQuery = vi.fn().mockImplementation((queryText: string) => {
      if (queryText.includes('INSERT INTO sigd_auth.persona (')) {
        return Promise.resolve({ rows: [{ id_persona: 'a0000000-0000-0000-0000-000000000001' }] });
      }
      if (queryText.includes('INSERT INTO sigd_auth.cuenta_usuario')) {
        return Promise.resolve({ rows: [{ id_usuario: 'b0000000-0000-0000-0000-000000000001' }] });
      }
      if (queryText.includes('SELECT rol_id FROM sigd_org.rol_sistema')) {
        return Promise.resolve({ rows: [{ rol_id: 'c0000000-0000-0000-0000-000000000001' }] });
      }
      if (queryText.includes('SELECT area_id FROM sigd_org.area')) {
        return Promise.resolve({ rows: [{ area_id: 'd0000000-0000-0000-0000-000000000001' }] });
      }
      if (queryText.includes('SELECT id_usuario_rol FROM sigd_org.usuario_rol')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const mockPool = {
      query: mockQuery,
      end: vi.fn(),
    } as unknown as Pool;

    await expect(ejecutarSeedLab(mockPool)).resolves.toBeUndefined();
    expect(mockQuery).toHaveBeenCalled();
  });
});
