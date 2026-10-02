import net from 'node:net';
import type { Pool } from 'pg';

export type EstadoDependencia = 'ok' | 'degradado' | 'indisponible' | 'deshabilitado';

export interface ResultadoSonda {
  estado: EstadoDependencia;
  detalle: string;
  latencia_ms: number;
}

export interface ResumenSondas {
  estado: 'ok' | 'degradado' | 'indisponible';
  dependencias: Record<string, ResultadoSonda>;
}

const TIMEOUT_SONDA_MS = 2000;

async function cronometrar<T>(operacion: () => Promise<T>): Promise<{ valor: T; latencia_ms: number }> {
  const inicio = performance.now();
  const valor = await operacion();
  return { valor, latencia_ms: Math.round(performance.now() - inicio) };
}

/**
 * Sondea PostgreSQL a través del pool de la aplicación. Se evita una conexión
 * dedicada por request: un sondeo de salud repetido (liveness/readiness cada
 * pocos segundos) agotaría el pool en despliegues con varias réplicas.
 */
async function sondearPostgres(pool: Pool): Promise<ResultadoSonda> {
  const { valor, latencia_ms } = await cronometrar(async () => {
    const resultado = await pool.query<{ version: string }>('SELECT version()');
    return (resultado.rows[0]?.version ?? 'desconocida').split(',')[0];
  });
  return { estado: 'ok', detalle: valor, latencia_ms };
}

async function sondearMinio(endpoint: string): Promise<ResultadoSonda> {
  const base = endpoint.replace(/\/+$/, '');
  const url = `${base}/minio/health/live`;
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_SONDA_MS);
  try {
    const respuesta = await fetch(url, { signal: controlador.signal });
    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status}`);
    }
    return { estado: 'ok', detalle: url, latencia_ms: 0 };
  } finally {
    clearTimeout(temporizador);
  }
}

async function sondearRedis(url: string): Promise<ResultadoSonda> {
  const { hostname, port } = new URL(url);
  return new Promise<ResultadoSonda>((resolve, reject) => {
    const inicio = performance.now();
    const socket = net.createConnection({ host: hostname, port: Number(port) || 6379 });
    const finalizar = (error?: Error): void => {
      socket.destroy();
      const latencia_ms = Math.round(performance.now() - inicio);
      if (error) reject(error);
      else resolve({ estado: 'ok', detalle: `${hostname}:${port}`, latencia_ms });
    };
    socket.setTimeout(TIMEOUT_SONDA_MS, () => finalizar(new Error(`timeout ${TIMEOUT_SONDA_MS} ms`)));
    socket.on('error', (error) => finalizar(error));
    socket.on('connect', () => {
      socket.write('*1\r\n$4\r\nPING\r\n');
    });
    socket.on('data', (datos: Buffer) => {
      if (datos.toString('utf8').startsWith('+PONG')) {
        finalizar();
      } else {
        finalizar(new Error(`respuesta inesperada: ${datos.toString('utf8').trim()}`));
      }
    });
  });
}

async function ejecutarSonda(
  nombre: string,
  habilitado: boolean,
  operacion: () => Promise<ResultadoSonda>,
): Promise<ResultadoSonda> {
  if (!habilitado) {
    return { estado: 'deshabilitado', detalle: `${nombre}: no configurado en el entorno`, latencia_ms: 0 };
  }
  try {
    return await operacion();
  } catch (error) {
    return {
      estado: 'indisponible',
      detalle: `${nombre}: ${error instanceof Error ? error.message : String(error)}`,
      latencia_ms: 0,
    };
  }
}

export async function sondearDependencias(
  pool: Pool,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResumenSondas> {
  const [postgres, minio, redis] = await Promise.all([
    ejecutarSonda('PostgreSQL', true, () => sondearPostgres(pool)),
    ejecutarSonda('MinIO S3', Boolean(env.S3_ENDPOINT), () => sondearMinio(env.S3_ENDPOINT as string)),
    ejecutarSonda('Redis 7', Boolean(env.REDIS_URL), () => sondearRedis(env.REDIS_URL as string)),
  ]);

  const dependencias: Record<string, ResultadoSonda> = {
    postgres,
    minio_s3: minio,
    redis,
  };

  const configuradas = Object.values(dependencias).filter((d) => d.estado !== 'deshabilitado');
  const caidas = configuradas.filter((d) => d.estado === 'indisponible');

  const estado: ResumenSondas['estado'] =
    caidas.length === 0 ? 'ok' : caidas.length === configuradas.length ? 'indisponible' : 'degradado';

  return { estado, dependencias };
}
