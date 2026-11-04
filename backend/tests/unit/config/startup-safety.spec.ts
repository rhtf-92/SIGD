import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  assertMigrationsDisabledOnBoot,
  requireDatabaseUrl,
  requireMigratorDatabaseUrl,
} from '../../../src/config/runtime-safety.js';
import { ejecutarMigracionesConAutorizacion } from '../../../src/db/migration-command.js';

describe('seguridad de configuración de arranque', () => {
  it('exige DATABASE_URL explícita y no usa credenciales predeterminadas', () => {
    expect(() => requireDatabaseUrl({})).toThrow('DATABASE_URL');
    expect(() => requireDatabaseUrl({ DATABASE_URL: '   ' })).toThrow('DATABASE_URL');
    expect(requireDatabaseUrl({ DATABASE_URL: 'postgres://sigd_app@db/sigd' }))
      .toBe('postgres://sigd_app@db/sigd');
  });

  it('mantiene deshabilitadas las migraciones de arranque por defecto', () => {
    expect(() => assertMigrationsDisabledOnBoot({})).not.toThrow();
    expect(() => assertMigrationsDisabledOnBoot({ MIGRATE_ON_BOOT: 'false' })).not.toThrow();
  });

  it('rechaza la configuración heredada MIGRATE_ON_BOOT=true sin ejecutar migraciones', () => {
    expect(() => assertMigrationsDisabledOnBoot({ MIGRATE_ON_BOOT: 'true' }))
      .toThrow('MIGRATE_ON_BOOT=true');
  });

  it('el entrypoint no importa ni invoca el runner de migraciones al arrancar', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/server.ts'), 'utf8');

    expect(source).not.toMatch(/from\s+['"][^'"]*db\/migrate\.js['"]/);
    expect(source).not.toContain('ejecutarMigraciones(');
  });
});

describe('ejecución explícita del CLI de migraciones', () => {
  it('no abre ni ejecuta nada si falta --apply', async () => {
    const aplicar = vi.fn(async (_databaseUrl: string) => undefined);

    await expect(ejecutarMigracionesConAutorizacion([], {}, aplicar)).resolves.toBe(false);
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('requiere una URL migradora explícita antes de llamar al runner', async () => {
    const aplicar = vi.fn(async (_databaseUrl: string) => undefined);

    await expect(ejecutarMigracionesConAutorizacion(['--apply'], {}, aplicar))
      .rejects.toThrow('MIGRATOR_DATABASE_URL');
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('no reutiliza DATABASE_URL de la aplicación como identidad migradora', async () => {
    const aplicar = vi.fn(async (_databaseUrl: string) => undefined);

    await expect(
      ejecutarMigracionesConAutorizacion(
        ['--apply'],
        { DATABASE_URL: 'postgres://sigd_app@db/sigd' },
        aplicar,
      ),
    ).rejects.toThrow('MIGRATOR_DATABASE_URL');
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('solo pasa MIGRATOR_DATABASE_URL al runner tras --apply', async () => {
    const aplicar = vi.fn(async (_databaseUrl: string) => undefined);
    const urlMigradora = 'postgres://sigd_migrator@db/sigd';

    await expect(
      ejecutarMigracionesConAutorizacion(
        ['--apply'],
        { MIGRATOR_DATABASE_URL: urlMigradora },
        aplicar,
      ),
    ).resolves.toBe(true);

    expect(requireMigratorDatabaseUrl({ MIGRATOR_DATABASE_URL: urlMigradora })).toBe(urlMigradora);
    expect(aplicar).toHaveBeenCalledOnce();
    expect(aplicar).toHaveBeenCalledWith(urlMigradora);
  });
});
