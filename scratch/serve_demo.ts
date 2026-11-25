import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const require = createRequire(path.join(root, 'backend/package.json'));
  const { parse } = require('dotenv');
  const { Client } = require('pg');
  const Redis = require('ioredis');
  const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
  const runtime = path.join(process.env.LOCALAPPDATA || path.join(root, '.runtime'), 'SIGD/runtime');
  const privateFile = path.join(process.env.LOCALAPPDATA || '', 'SIGD/secrets/demo-runtime.env');
  const backendEnvFile = path.join(root, 'backend/.env');

  let config: Record<string, string> = {};
  if (privateFile && fs.existsSync(privateFile)) {
    config = parse(fs.readFileSync(privateFile));
  } else if (fs.existsSync(backendEnvFile)) {
    config = parse(fs.readFileSync(backendEnvFile));
  } else {
    config = {
      PORT: '3008',
      DATABASE_URL: 'postgres://postgres:postgres_password@127.0.0.1:5433/sigd_jacobo_demo',
      REDIS_URL: 'redis://127.0.0.1:6379',
      S3_ENDPOINT: 'http://127.0.0.1:9000',
      S3_ACCESS_KEY: 'minioadmin',
      S3_SECRET_KEY: 'minioadminpassword',
      S3_BUCKET: 'sigd-expedientes',
      AUTH_JWT_SECRET: 'sigd_institucional_jwt_secret_super_seguro_2026_iestp_suiza_32b',
      SIGD_SAFE_BOOT: 'false',
      MIGRATE_ON_BOOT: 'false',
      NODE_ENV: 'development',
      VITE_PORT: '5178',
      VITE_API_BASE_URL: 'http://127.0.0.1:3008',
      VITE_ENABLE_MOCKS: 'false',
      OUTBOX_WORKER_ENABLED: 'true',
      HOST: '127.0.0.1',
    };
  }

  const runtimeState = path.join(runtime, 'demo-processes.json');
  const previous = fs.existsSync(runtimeState) ? JSON.parse(fs.readFileSync(runtimeState, 'utf8').replace(/^\uFEFF/, '')) : null;
  const env = { ...process.env, ...config };

  if (previous?.root === root && previous?.demoOmitirPago !== undefined && previous?.demoOmitirPago !== null) {
    if (env.SIGD_DEMO_OMITIR_PAGO !== undefined && env.SIGD_DEMO_OMITIR_PAGO !== previous.demoOmitirPago) {
      throw new Error('La configuración de omisión de pago difiere del valor previamente verificado.');
    }
    env.SIGD_DEMO_OMITIR_PAGO = previous.demoOmitirPago;
  }

  const currentBranch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
  if (!['B_JACOBO', 'F_JESUS'].includes(currentBranch)) {
    console.warn(`[SIGD] Aviso: Ejecutando en rama '${currentBranch}'.`);
  }

  const db = new URL(env.DATABASE_URL || 'postgres://postgres:postgres_password@127.0.0.1:5433/sigd_jacobo_demo');
  if (!['postgres:', 'postgresql:'].includes(db.protocol)) {
    throw new Error('DATABASE_URL debe ser postgres.');
  }

  try {
    const client = new Client({ connectionString: env.DATABASE_URL, options: '-c default_transaction_read_only=on', connectionTimeoutMillis: 5000 });
    await client.connect();
    try {
      await client.query('BEGIN READ ONLY');
      const { rows: [identity] } = await client.query('SELECT current_database() db, current_user username');
      console.log(`PostgreSQL conectado: ${db.hostname}:${db.port}/${identity.db} (${identity.username}).`);
    } finally {
      await client.query('ROLLBACK');
      await client.end();
    }
  } catch (err: any) {
    console.warn(`[SIGD] Aviso PostgreSQL: ${err?.message || err}. Asegúrese de que el contenedor de base de datos esté corriendo.`);
  }

  if (env.REDIS_URL) {
    try {
      const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 3000 });
      await redis.connect();
      if (await redis.ping() === 'PONG') {
        console.log('Redis conectado correctamente.');
      }
      redis.disconnect();
    } catch (err: any) {
      console.warn(`[SIGD] Aviso Redis: ${err?.message || err}.`);
    }
  }

  if (env.S3_ENDPOINT && env.S3_BUCKET) {
    try {
      const storage = new S3Client({
        endpoint: env.S3_ENDPOINT,
        region: 'us-east-1',
        forcePathStyle: true,
        credentials: { accessKeyId: env.S3_ACCESS_KEY || 'minioadmin', secretAccessKey: env.S3_SECRET_KEY || 'minioadminpassword' },
      });
      await storage.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
      console.log(`S3 Bucket '${env.S3_BUCKET}' verificado.`);
      storage.destroy();
    } catch (err: any) {
      console.warn(`[SIGD] Aviso S3/MinIO: ${err?.message || err}.`);
    }
  }

  if (!process.argv.includes('--check')) {
    const components = [
      { name: 'backend', port: 3008, script: 'dev', directory: 'backend', requested: '--backend' },
      { name: 'frontend', port: 5178, script: 'dev', directory: 'frontend', requested: '--frontend' },
    ].filter(component => process.argv.includes(component.requested));
    if (components.length === 0) throw new Error('Use el lanzador central npm run dev. No se iniciaron procesos.');
    for (const { port } of components) {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createServer();
        socket.once('error', () => reject(new Error(`Puerto ${port} ocupado. No se sustituirá su proceso.`)));
        socket.listen(port, '127.0.0.1', () => socket.close(() => resolve()));
      });
    }
    fs.mkdirSync(runtime, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const managers = [];
    for (const component of components) {
      const log = path.join(runtime, `${component.name}-${stamp}.log`);
      const descriptor = fs.openSync(log, 'a');
      const args = ['/d', '/s', '/c', `npm.cmd run ${component.script}`];
      if (component.name === 'frontend') args[3] += ' -- --port 5178 --host 127.0.0.1 --strictPort';
      try {
        const child = spawn(process.env.ComSpec || 'cmd.exe', args, {
          cwd: path.join(root, component.directory),
          env: { ...env, BROWSER: 'none', VITE_PORT: '5178', VITE_API_BASE_URL: 'http://127.0.0.1:3008', VITE_ENABLE_MOCKS: 'false' },
          windowsHide: true, detached: true, stdio: ['ignore', descriptor, descriptor],
        });
        await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
        child.unref();
        managers.push({ component: component.name, pid: child.pid, log });
        fs.writeFileSync(path.join(runtime, 'pending-launch.json'), JSON.stringify({ root, nonce: process.env.SIGD_START_ID, managers }));
      } finally { fs.closeSync(descriptor); }
    }
    console.log('Supervisores npm creados exitosamente.');
  }
}

void main().catch((error: Error) => {
  console.error('No se inició SIGD:', error.message.replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+@/g, '$1[privado]@'));
  process.exitCode = 1;
});
