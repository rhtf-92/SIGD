import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { Client, Pool, type ClientConfig } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

const PREFIJO_DB_TEMPORAL = /^sigd_tmp_[0-9a-f]{16,}$/;

const VARIABLES_URL_EXTERNAS = [
  'DATABASE_URL',
  'MIGRATOR_DATABASE_URL',
  'MIGRATION_TEST_DATABASE_URL',
] as const;

const VARIABLES_PG_HEREDADAS = [
  'PGHOST',
  'PGHOSTADDR',
  'PGPORT',
  'PGDATABASE',
  'PGUSER',
  'PGPASSWORD',
  'PGPASSFILE',
  'PGSERVICE',
  'PGSERVICEFILE',
  'PGOPTIONS',
  'PGSSLMODE',
] as const;

export interface ContextoAislamientoTemporal {
  readonly expectedDbName: string;
  readonly expectedToken: string;
  readonly allowedHost: string;
  readonly allowedPort: number;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export interface SesionBaseTemporal {
  readonly cliente: Client;
  readonly crearPool: () => Pool;
  readonly dbName: string;
  readonly isolationToken: string;
  readonly contexto: ContextoAislamientoTemporal;
}

export interface ClusterPostgresEfimero {
  readonly modo: 'testcontainers' | 'local-ephemeral-initdb';
  readonly host: string;
  readonly port: number;
  conBaseTemporalAislada<T>(fn: (sesion: SesionBaseTemporal) => Promise<T>): Promise<T>;
  detener(): Promise<void>;
}

export function esNombreBaseTemporalValido(nombre: string): boolean {
  return PREFIJO_DB_TEMPORAL.test(nombre);
}

export function esHostAisladoPermitido(host: string): boolean {
  const limpio = host.trim().toLowerCase();
  return limpio === '127.0.0.1' || limpio === 'localhost' || limpio === '::1';
}

export function verificarNoColisionaConUrlsExternas(
  endpoint: { host: string; port: number; database: string },
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  for (const clave of VARIABLES_URL_EXTERNAS) {
    const cruda = env[clave]?.trim();
    if (!cruda) continue;

    let parseada: URL;
    try {
      parseada = new URL(cruda);
    } catch {
      continue;
    }

    const puertoExterno = parseada.port ? Number(parseada.port) : 5432;
    const dbExterna = decodeURIComponent(parseada.pathname.replace(/^\//, ''));
    const mismoHost =
      parseada.hostname.toLowerCase() === endpoint.host.toLowerCase() ||
      (esHostAisladoPermitido(parseada.hostname) && esHostAisladoPermitido(endpoint.host));

    if (mismoHost && puertoExterno === endpoint.port) {
      throw new Error(
        `Riesgo de seguridad bloqueado: el puerto ${endpoint.port} coincide con la conexión externa configurada en ${clave} (base "${dbExterna}").`,
      );
    }
  }
}

/**
 * Comprueba criptográfica y estructuralmente que la sesión activa pertenece a una
 * base de datos temporal y aislada creada por este arnés antes de permitir pruebas destructivas.
 */
export async function asegurarBaseTemporalAislada(
  cliente: Pick<Client, 'query'>,
  contexto: ContextoAislamientoTemporal,
): Promise<void> {
  if (!esNombreBaseTemporalValido(contexto.expectedDbName)) {
    throw new Error(
      `Operación rechazada: "${contexto.expectedDbName}" no cumple el prefijo obligatorio de base temporal aislada (sigd_tmp_<hex>).`,
    );
  }

  if (!esHostAisladoPermitido(contexto.allowedHost)) {
    throw new Error(
      `Operación rechazada: el host "${contexto.allowedHost}" no es un loopback efímero aislado.`,
    );
  }

  if (!Number.isInteger(contexto.allowedPort) || contexto.allowedPort <= 0) {
    throw new Error(`Operación rechazada: puerto efímero inválido (${contexto.allowedPort}).`);
  }

  verificarNoColisionaConUrlsExternas(
    {
      host: contexto.allowedHost,
      port: contexto.allowedPort,
      database: contexto.expectedDbName,
    },
    contexto.env ?? process.env,
  );

  const meta = await cliente.query<{ db: string; port: number | null }>(
    'SELECT current_database() AS db, inet_server_port() AS port',
  );
  const filaMeta = meta.rows[0];
  if (!filaMeta || filaMeta.db !== contexto.expectedDbName) {
    throw new Error(
      `Operación rechazada: la sesión apunta a "${filaMeta?.db ?? 'desconocida'}" en lugar de la base temporal "${contexto.expectedDbName}".`,
    );
  }
  if (filaMeta.port !== null && Number(filaMeta.port) !== contexto.allowedPort) {
    throw new Error(
      `Operación rechazada: el servidor reporta el puerto ${filaMeta.port}, distinto del puerto efímero aislado ${contexto.allowedPort}.`,
    );
  }

  const marcador = await cliente.query<{ token: string; db_name: string }>(
    'SELECT isolation_token::text AS token, db_name FROM public._sigd_ephemeral_isolation_marker LIMIT 1',
  );
  const filaMarcador = marcador.rows[0];
  if (
    !filaMarcador ||
    filaMarcador.token !== contexto.expectedToken ||
    filaMarcador.db_name !== contexto.expectedDbName
  ) {
    throw new Error(
      'Operación rechazada: la base conectada carece del marcador criptográfico de aislamiento efímero válido.',
    );
  }
}

function construirConfiguracionExplicita(params: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}): ClientConfig {
  return {
    host: params.host,
    port: params.port,
    database: params.database,
    user: params.user,
    password: params.password,
    ssl: false,
  };
}

function entornoSubprocesoSinOverridesPg(): NodeJS.ProcessEnv {
  const limpio: NodeJS.ProcessEnv = { ...process.env };
  for (const clave of VARIABLES_PG_HEREDADAS) {
    delete limpio[clave];
  }
  for (const clave of VARIABLES_URL_EXTERNAS) {
    delete limpio[clave];
  }
  delete limpio.TEST_DATABASE_URL;
  return limpio;
}

function reservarPuertoEfimeroLoopback(): Promise<number> {
  return new Promise((resolve, reject) => {
    const servidor = net.createServer();
    servidor.unref();
    servidor.on('error', reject);
    servidor.listen(0, '127.0.0.1', () => {
      const direccion = servidor.address();
      if (!direccion || typeof direccion === 'string') {
        servidor.close(() => reject(new Error('No fue posible obtener un puerto TCP efímero.')));
        return;
      }
      const puerto = direccion.port;
      servidor.close((err) => (err ? reject(err) : resolve(puerto)));
    });
  });
}

function resolverBinariosPostgresLocal(): { initdb: string; pgCtl: string } {
  const sufijo = process.platform === 'win32' ? '.exe' : '';
  const candidatosDir: string[] = [];

  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
    const basePg = path.join(programFiles, 'PostgreSQL');
    if (existsSync(basePg)) {
      const versiones = readdirSync(basePg).sort((a, b) => Number(b) - Number(a));
      for (const v of versiones) {
        candidatosDir.push(path.join(basePg, v, 'bin'));
      }
    }
  } else {
    const baseDebian = '/usr/lib/postgresql';
    if (existsSync(baseDebian)) {
      const versiones = readdirSync(baseDebian).sort((a, b) => Number(b) - Number(a));
      for (const v of versiones) {
        candidatosDir.push(path.join(baseDebian, v, 'bin'));
      }
    }
  }

  for (const dir of candidatosDir) {
    const initdb = path.join(dir, `initdb${sufijo}`);
    const pgCtl = path.join(dir, `pg_ctl${sufijo}`);
    if (existsSync(initdb) && existsSync(pgCtl)) {
      return { initdb, pgCtl };
    }
  }

  return { initdb: `initdb${sufijo}`, pgCtl: `pg_ctl${sufijo}` };
}

interface BackendEfimeroInterno {
  readonly modo: 'testcontainers' | 'local-ephemeral-initdb';
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  detener(): Promise<void>;
}

async function iniciarBackendEfimero(): Promise<BackendEfimeroInterno> {
  const password = randomBytes(24).toString('hex');

  try {
    const imagen = process.env.TESTCONTAINERS_IMAGE ?? 'postgres:18-alpine';
    const contenedor: StartedPostgreSqlContainer = await new PostgreSqlContainer(imagen)
      .withDatabase('postgres')
      .withUsername('postgres')
      .withPassword(password)
      .start();

    return {
      modo: 'testcontainers',
      host: contenedor.getHost(),
      port: contenedor.getPort(),
      user: contenedor.getUsername(),
      password: contenedor.getPassword(),
      detener: async () => {
        await contenedor.stop();
      },
    };
  } catch (errorContenedor) {
    const mensaje = errorContenedor instanceof Error ? errorContenedor.message : String(errorContenedor);
    if (!/container runtime|docker|socket|pipe/i.test(mensaje)) {
      throw errorContenedor;
    }
  }

  const { initdb, pgCtl } = resolverBinariosPostgresLocal();
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'sigd-ephemeral-pg18-'));
  const dataDir = path.join(rootDir, 'data');
  const pwFile = path.join(rootDir, 'pw.secret');
  const logFile = path.join(rootDir, 'postgres.log');
  const envLimpio = entornoSubprocesoSinOverridesPg();

  let puerto = await reservarPuertoEfimeroLoopback();
  for (let intento = 0; intento < 5; intento += 1) {
    try {
      verificarNoColisionaConUrlsExternas({ host: '127.0.0.1', port: puerto, database: 'postgres' });
      break;
    } catch {
      puerto = await reservarPuertoEfimeroLoopback();
    }
  }

  let detenido = false;
  const limpiarSincrono = () => {
    if (detenido) return;
    detenido = true;
    try {
      if (existsSync(path.join(dataDir, 'postmaster.pid'))) {
        execFileSync(pgCtl, ['-D', dataDir, '-m', 'immediate', '-w', 'stop'], {
          env: envLimpio,
          stdio: 'ignore',
          windowsHide: true,
        });
      }
    } catch {
      // Ignorar si el proceso efímero ya terminó.
    }
    try {
      rmSync(rootDir, { recursive: true, force: true });
    } catch {
      // Ignorar bloqueos transitorios del SO en cierre abrupto.
    }
  };

  process.once('exit', limpiarSincrono);

  try {
    writeFileSync(pwFile, `${password}\n`, { encoding: 'utf8', mode: 0o600 });
    execFileSync(
      initdb,
      ['-D', dataDir, '-U', 'postgres', '-A', 'scram-sha-256', `--pwfile=${pwFile}`, '-E', 'UTF8', '--no-locale'],
      { env: envLimpio, stdio: 'pipe', windowsHide: true },
    );
    rmSync(pwFile, { force: true });

    appendFileSync(
      path.join(dataDir, 'postgresql.conf'),
      [
        '',
        "listen_addresses = '127.0.0.1'",
        `port = ${puerto}`,
        'fsync = off',
        'synchronous_commit = off',
        'full_page_writes = off',
        'max_connections = 50',
        'shared_buffers = 32MB',
        '',
      ].join('\n'),
      'utf8',
    );

    execFileSync(pgCtl, ['-D', dataDir, '-l', logFile, '-w', '-t', '30', 'start'], {
      env: envLimpio,
      stdio: 'ignore',
      windowsHide: true,
    });

    return {
      modo: 'local-ephemeral-initdb',
      host: '127.0.0.1',
      port: puerto,
      user: 'postgres',
      password,
      detener: async () => {
        process.removeListener('exit', limpiarSincrono);
        limpiarSincrono();
      },
    };
  } catch (errorInicio) {
    process.removeListener('exit', limpiarSincrono);
    limpiarSincrono();
    throw errorInicio;
  }
}

/**
 * Levanta una instancia PostgreSQL 18 estrictamente temporal y aislada
 * (Testcontainers si hay runtime de contenedores, o clúster efímero con initdb
 * en directorio temporal descartable). Jamás consume URLs externas del entorno.
 */
export async function iniciarClusterPostgresEfimero(): Promise<ClusterPostgresEfimero> {
  const backend = await iniciarBackendEfimero();
  const clusterToken = randomUUID();

  verificarNoColisionaConUrlsExternas({
    host: backend.host,
    port: backend.port,
    database: 'postgres',
  });

  const adminClient = new Client(
    construirConfiguracionExplicita({
      host: backend.host,
      port: backend.port,
      database: 'postgres',
      user: backend.user,
      password: backend.password,
    }),
  );

  try {
    await adminClient.connect();
    await adminClient.query(`
      CREATE TABLE public._sigd_ephemeral_cluster_marker (
        cluster_token uuid PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await adminClient.query(
      'INSERT INTO public._sigd_ephemeral_cluster_marker (cluster_token) VALUES ($1::uuid)',
      [clusterToken],
    );
  } catch (error) {
    await adminClient.end().catch(() => undefined);
    await backend.detener();
    throw error;
  }

  async function verificarClusterEfimeroPropio(): Promise<void> {
    const res = await adminClient.query<{ token: string }>(
      'SELECT cluster_token::text AS token FROM public._sigd_ephemeral_cluster_marker LIMIT 1',
    );
    if (res.rows[0]?.token !== clusterToken) {
      throw new Error(
        'Operación rechazada: la conexión administrativa no corresponde al clúster efímero aislado.',
      );
    }
  }

  return {
    modo: backend.modo,
    host: backend.host,
    port: backend.port,

    async conBaseTemporalAislada<T>(fn: (sesion: SesionBaseTemporal) => Promise<T>): Promise<T> {
      await verificarClusterEfimeroPropio();

      const dbName = `sigd_tmp_${randomBytes(10).toString('hex')}`;
      if (!esNombreBaseTemporalValido(dbName)) {
        throw new Error(`Nombre de base temporal inválido generado: ${dbName}`);
      }

      const isolationToken = randomUUID();
      await adminClient.query(`CREATE DATABASE "${dbName}"`);

      const configDb = construirConfiguracionExplicita({
        host: backend.host,
        port: backend.port,
        database: dbName,
        user: backend.user,
        password: backend.password,
      });

      const cliente = new Client(configDb);
      const poolsAbiertos: Pool[] = [];

      const contexto: ContextoAislamientoTemporal = {
        expectedDbName: dbName,
        expectedToken: isolationToken,
        allowedHost: backend.host,
        allowedPort: backend.port,
      };

      try {
        await cliente.connect();
        await cliente.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
        await cliente.query(`
          CREATE TABLE public._sigd_ephemeral_isolation_marker (
            isolation_token uuid PRIMARY KEY,
            db_name text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
          )
        `);
        await cliente.query(
          'INSERT INTO public._sigd_ephemeral_isolation_marker (isolation_token, db_name) VALUES ($1::uuid, $2)',
          [isolationToken, dbName],
        );

        await asegurarBaseTemporalAislada(cliente, contexto);

        const crearPool = () => {
          const nuevoPool = new Pool({ ...configDb, max: 4 });
          poolsAbiertos.push(nuevoPool);
          return nuevoPool;
        };

        return await fn({
          cliente,
          crearPool,
          dbName,
          isolationToken,
          contexto,
        });
      } finally {
        for (const p of poolsAbiertos) {
          await p.end().catch(() => undefined);
        }
        await cliente.end().catch(() => undefined);
        await verificarClusterEfimeroPropio();
        await adminClient.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      }
    },

    async detener(): Promise<void> {
      await adminClient.end().catch(() => undefined);
      await backend.detener();
    },
  };
}
