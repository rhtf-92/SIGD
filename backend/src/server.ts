import 'dotenv/config';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';
import { crearPool } from './database.js';
import { construirApp } from './app.js';
import type { CacheDistribuida } from './domains/identicore/ubigeo.service.js';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/sigd_prueba';
const port = Number(process.env.PORT ?? 3000);

const pool = crearPool(databaseUrl);
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (intento) => (intento > 3 ? null : Math.min(intento * 100, 1_000)),
    })
  : undefined;
redis?.on('error', (error: Error) => {
  console.error('[Redis Ubigeo] caché no disponible:', error.message);
});

const ubigeoCache: CacheDistribuida | undefined = redis
  ? {
      get: (clave) => redis.get(clave),
      set: async (clave, valor, ttlSegundos) => {
        await redis.set(clave, valor, 'EX', ttlSegundos);
      },
    }
  : undefined;
const app = construirApp(pool, { ubigeoCache });

app.listen(port, () => {
  console.log(`SIGD Backend escuchando en http://localhost:${port}`);
});

// En desarrollo, iniciar concurrentemente el servidor Vite del Frontend en el puerto 5173
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');
const viteBin = path.resolve(frontendDir, 'node_modules/vite/bin/vite.js');

let viteProc: ReturnType<typeof spawn> | null = null;
try {
  viteProc = spawn(process.execPath, [viteBin, '--port', '5173', '--host', '0.0.0.0'], {
    cwd: frontendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      VITE_API_BASE_URL: 'http://localhost:3000/api',
      VITE_ENABLE_MOCKS: 'true',
    },
  });

  viteProc.stdout?.on('data', (data) => {
    console.log(`[Vite stdout] ${data}`);
  });

  viteProc.stderr?.on('data', (data) => {
    console.error(`[Vite stderr] ${data}`);
  });

  viteProc.on('error', (err) => {
    console.error('[Frontend Vite] Error al iniciar:', err);
  });

  viteProc.on('close', (code) => {
    console.log(`[Frontend Vite] Proceso cerrado con código ${code}`);
  });
} catch (e) {
  console.error('[Frontend Vite] Excepción al lanzar proceso:', e);
}

function cerrarServidor(): void {
  if (viteProc) viteProc.kill();
  void Promise.allSettled([pool.end(), redis?.quit() ?? Promise.resolve()]).finally(() => {
    process.exit(0);
  });
}

process.on('SIGINT', cerrarServidor);
process.on('SIGTERM', cerrarServidor);
