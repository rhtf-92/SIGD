import { requireMigratorDatabaseUrl } from '../config/runtime-safety.js';

type Environment = Readonly<Record<string, string | undefined>>;

/**
 * Ejecuta el callback solo cuando el operador invoca explícitamente --apply.
 * La URL migradora se lee después de comprobar la autorización, sin crear pool
 * ni abrir conexiones en modo de consulta/no aplicación.
 */
export async function ejecutarMigracionesConAutorizacion(
  argumentos: readonly string[],
  env: Environment,
  aplicar: (databaseUrl: string) => Promise<void>,
): Promise<boolean> {
  if (!argumentos.includes('--apply')) return false;

  const databaseUrl = requireMigratorDatabaseUrl(env);
  await aplicar(databaseUrl);
  return true;
}
