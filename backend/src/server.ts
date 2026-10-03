import 'dotenv/config';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearPool } from './database.js';
import { construirApp } from './app.js';
import { API_PREFIX } from './config/rutas.js';
import { BusSse, HEARTBEAT_SEGUNDOS } from './modules/corelink/sseStream.service.js';
import { ejecutarMigraciones } from './db/migrate.js';
import { OutboxWorker } from './audit/outbox-worker.js';
import { crearDespachadorPorDefecto } from './audit/despachador-notificaciones.js';
import { BridgeNotificacion } from './core/realtime/bridge-notificacion.js';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/sigd_prueba';
const port = Number(process.env.PORT ?? 3000);

const pool = crearPool(databaseUrl);
const busSse = new BusSse();

if (process.env.MIGRATE_ON_BOOT !== 'false') {
  await ejecutarMigraciones(pool);
}

const app = construirApp(pool, busSse);
const servidor = app.listen(port, () => {
  console.log(`SIGD Backend escuchando en http://localhost:${port}`);
  console.log(`API canónica: http://localhost:${port}${API_PREFIX}`);
  console.log(`Sondas: http://localhost:${port}/health · http://localhost:${port}/ready`);
});

const intervaloHeartbeat = setInterval(
  () => busSse.emitirHeartbeat(),
  HEARTBEAT_SEGUNDOS * 1000,
);
intervaloHeartbeat.unref?.();

// Reparto de eventos entre réplicas: cada instancia suscribe su propio listener
// de NOTIFY y publica los eventos que su Outbox despacha.
const bridge = new BridgeNotificacion(databaseUrl, busSse);
await bridge.iniciar();

const outboxWorker = new OutboxWorker(
  pool,
  crearDespachadorPorDefecto(busSse, pool, bridge),
  {
    backoffBaseMs: Number(process.env.OUTBOX_BACKOFF_BASE_MS ?? 1000),
    backoffTechoMs: Number(process.env.OUTBOX_BACKOFF_TECHO_MS ?? 300_000),
    intervaloPollMs: Number(process.env.OUTBOX_POLL_MS ?? 5000),
  },
);
const cicloOutbox = outboxWorker.iniciar();
cicloOutbox.catch((error: unknown) => console.error('[OUTBOX] El poller terminó con error:', error));

const apagar = (senal: string): void => {
  console.log(`[SERVER] Señal ${senal} recibida; cerrando conexiones SSE.`);
  clearInterval(intervaloHeartbeat);
  outboxWorker.detener();
  void bridge.detener();
  busSse.cerrarTodos();
  servidor.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref?.();
};

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
      VITE_API_BASE_URL: `http://localhost:${port}${API_PREFIX}`,
      VITE_ENABLE_MOCKS: process.env.VITE_ENABLE_MOCKS ?? 'false',
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

process.on('SIGINT', () => {
  if (viteProc) viteProc.kill();
  apagar('SIGINT');
});

process.on('SIGTERM', () => {
  if (viteProc) viteProc.kill();
  apagar('SIGTERM');
});
