import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const snapshot = dirname(fileURLToPath(import.meta.url));
const root = dirname(snapshot);
const manifest = readFileSync(join(snapshot, 'SHA256SUMS'), 'utf8').trim().split(/\r?\n/);
for (const line of manifest) {
  const match = /^([0-9a-f]{64})  ([\w./-]+)$/.exec(line);
  if (!match) throw new Error('Invalid snapshot manifest.');
  const actual = createHash('sha256').update(readFileSync(join(snapshot, match[2]))).digest('hex');
  if (actual !== match[1]) throw new Error(`Snapshot verification failed: ${match[2]}`);
}

if (process.argv.includes('--verify-only')) {
  console.log(`Snapshot verified (${manifest.length} files).`);
  process.exit(0);
}

const envPath = join(root, '.env.academico');
if (!existsSync(envPath)) {
  const secret = (bytes) => randomBytes(bytes).toString('hex');
  const env = {
    ACADEMIC_POSTGRES_PASSWORD: secret(24),
    ACADEMIC_APP_DB_PASSWORD: secret(24),
    ACADEMIC_JWT_SECRET: secret(32),
    ACADEMIC_WEBHOOK_SECRET: secret(32),
    ACADEMIC_S3_ACCESS_KEY: secret(12),
    ACADEMIC_S3_SECRET_KEY: secret(24),
    ACADEMIC_DEMO_PASSWORD: secret(12),
    ACADEMIC_POSTGRES_PORT: '5434',
    ACADEMIC_REDIS_PORT: '6380',
    ACADEMIC_S3_PORT: '9001',
    ACADEMIC_S3_UI_PORT: '8889',
    ACADEMIC_BACKEND_PORT: '3001',
    ACADEMIC_FRONTEND_PORT: '5174',
  };
  writeFileSync(envPath, Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
  console.log('Local academic credentials generated in .env.academico (ignored by Git).');
}

const docker = process.platform === 'win32' ? 'docker.exe' : 'docker';
const result = spawnSync(docker, ['compose', '--env-file', envPath, '-f', join(root, 'docker-compose.academico.yml'), 'up', '-d', '--build'], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const envText = readFileSync(envPath, 'utf8');
const configuredPort = /^ACADEMIC_FRONTEND_PORT=(\d+)$/m.exec(envText)?.[1] ?? '5174';
const frontendPort = process.env.ACADEMIC_FRONTEND_PORT ?? configuredPort;
console.log(`SIGD academic: http://localhost:${frontendPort}/login`);
console.log('Demo user: demo.academico. Password: ACADEMIC_DEMO_PASSWORD in .env.academico.');
