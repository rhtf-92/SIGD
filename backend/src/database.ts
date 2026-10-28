import { Pool, type PoolConfig } from 'pg';

export function crearPool(databaseUrl: string, configOverrides: Partial<PoolConfig> = {}): Pool {
  // DB_POOL_MAX = 20 por defecto (Optimizacion P2 - Codex Audit):
  // 1. PostgreSQL soporta típicamente max_connections = 100 en instancias estándar.
  // 2. Concurrencia estimada: 2-4 workers NodeJS (20 conexiones c/u = 40-80 conexiones totales).
  // 3. Reserva un margen de seguridad de 20-60 conexiones para migraciones, tareas en background y DBA.
  // 4. Equilibrio óptimo entre throughput de transacciones y prevención de saturación / thrashing de memoria.
  const pool = new Pool({
    connectionString: databaseUrl,
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    application_name: 'sigd_api',
    ...configOverrides,
  });

  pool.on('connect', (client) => {
    void client.query("SET statement_timeout = '15s'").catch(() => {});
  });

  pool.on('error', (err) => {
    console.error('[PG_POOL_ERROR] Error no capturado en conexión del pool:', err.message);
  });

  return pool;
}

export function obtenerMetricasPool(pool: Pool) {
  return {
    totalConexiones: pool?.totalCount ?? 0,
    conexionesInactivas: pool?.idleCount ?? 0,
    clientesEsperando: pool?.waitingCount ?? 0,
  };
}
