type Environment = Readonly<Record<string, string | undefined>>;

function requiredEnvironmentValue(name: string, env: Environment): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error('La variable requerida ' + name + ' no está configurada.');
  }
  return value;
}

/** URL del rol de runtime de la aplicación. No usar la cuenta bootstrap de PostgreSQL. */
export function requireDatabaseUrl(env: Environment = process.env): string {
  return requiredEnvironmentValue('DATABASE_URL', env);
}

/** URL exclusiva del proceso de migraciones; nunca se inyecta al backend normal. */
export function requireMigratorDatabaseUrl(env: Environment = process.env): string {
  return requiredEnvironmentValue('MIGRATOR_DATABASE_URL', env);
}

/**
 * Las migraciones se ejecutan solo desde el CLI y con --apply.
 * MIGRATE_ON_BOOT=true se rechaza para detectar configuración heredada insegura.
 */
export function assertMigrationsDisabledOnBoot(env: Environment = process.env): void {
  if (env.MIGRATE_ON_BOOT?.trim().toLowerCase() === 'true') {
    throw new Error(
      'MIGRATE_ON_BOOT=true ya no está permitido. Revise las migraciones y use el CLI explícito con --apply.',
    );
  }
}
