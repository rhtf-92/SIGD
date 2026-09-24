import 'dotenv/config';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearPool } from './database.js';
import { construirApp } from './app.js';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/sigd_prueba';
const port = Number(process.env.PORT ?? 3000);

const pool = crearPool(databaseUrl);
const app = construirApp(pool);

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

process.on('SIGINT', () => {
  if (viteProc) viteProc.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (viteProc) viteProc.kill();
  process.exit(0);
});