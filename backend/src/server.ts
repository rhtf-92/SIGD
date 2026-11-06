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
import { asegurarBucket } from './core/storage/s3-storage.service.js';
import { obtenerConfiguracionS3 } from './config/s3.config.js';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/sigd_prueba';
const port = Number(process.env.PORT ?? 3000);

const pool = crearPool(databaseUrl);
const busSse = new BusSse();

// Manejo de errores críticos para evitar cierres abruptos (ERR_EMPTY_RESPONSE)
process.on('uncaughtException', (error: Error) => {
  console.error('[FATAL] Excepción no capturada:', error);
  // No cerrar el proceso inmediatamente; dar tiempo a que Express responda
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[FATAL] Promesa rechazada sin manejo:', reason);
});

// Inicialización con manejo de errores: si una operación falla, el servidor
// sigue activo en lugar de cerrarse abruptamente.
async function inicializar(): Promise<void> {
  try {
    if (process.env.MIGRATE_ON_BOOT !== 'false') {
      await ejecutarMigraciones(pool);
      console.log('[DB] Migraciones aplicadas correctamente.');
    }
  } catch (error) {
    console.error('[DB] Error al ejecutar migraciones (el servicio continuará sin ellas):', error);
  }

  try {
    const bucketListo = await asegurarBucket(obtenerConfiguracionS3());
    console.log(bucketListo ? '[S3] Bucket de expedientes disponible.' : '[S3] Bucket no disponible; se operará solo con PostgreSQL.');
  } catch (error) {
    console.error('[S3] Error al inicializar bucket (el servicio continuará sin S3):', error);
  }

  const app = construirApp(pool, busSse);
  const servidor = app.listen(port, () => {
    console.log(`SIGD Backend escuchando en http://localhost:${port}`);
    console.log(`API canónica: http://localhost:${port}${API_PREFIX}`);
    console.log(`Sondas: http://localhost:${port}/health · http://localhost:${port}/ready`);
  });

  // Manejo de errores del servidor HTTP para evitar cierres abruptos
  servidor.on('error', (error: NodeJS.ErrnoException) => {
    console.error('[HTTP] Error del servidor:', error);
  });

  const intervaloHeartbeat = setInterval(
    () => busSse.emitirHeartbeat(),
    HEARTBEAT_SEGUNDOS * 1000,
  );
  intervaloHeartbeat.unref?.();

  // Bridge de notificaciones (no crítico)
  const bridge = new BridgeNotificacion(databaseUrl, busSse);
  try {
    await bridge.iniciar();
    console.log('[BRIDGE] Conexión de notificaciones activa.');
  } catch (error) {
    console.error('[BRIDGE] Error al iniciar bridge de notificaciones:', error);
  }

  // Outbox Worker (no crítico)
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

  const apagar = (signal: string): void => {
    console.log(`[SERVER] Señal ${signal} recibida; cerrando conexiones SSE.`);
    clearInterval(intervaloHeartbeat);
    outboxWorker.detener();
    void bridge.detener();
    busSse.cerrarTodos();
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref?.();
  };

  // En desarrollo, iniciar concurrentemente el servidor Vite del Frontend en el puerto 5173
  const SKIP_FRONTEND_AUTOSTART =
    (process.env.SKIP_FRONTEND_AUTOSTART ?? '').toLowerCase() === 'true' ||
    process.env.SKIP_FRONTEND_AUTOSTART === '1';

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const frontendDir = path.resolve(__dirname, '../../frontend');
  const viteBin = path.resolve(frontendDir, 'node_modules/vite/bin/vite.js');

  let viteProc: ReturnType<typeof spawn> | null = null;
  if (!SKIP_FRONTEND_AUTOSTART) {
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
  }

  process.on('SIGINT', () => {
    if (viteProc) viteProc.kill();
    apagar('SIGINT');
  });

  process.on('SIGTERM', () => {
    if (viteProc) viteProc.kill();
    apagar('SIGTERM');
  });
}

inicializar().catch((error) => {
  console.error('[FATAL] Error al inicializar el servidor:', error);
  // No cerrar el proceso; permitir que el administrador decida qué hacer
});