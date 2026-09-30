import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createServer } from 'node:net';
import request from 'supertest';
import { construirApp } from '../../src/app.js';
import { sondearDependencias } from '../../src/salud/sonda.service.js';
import { obtenerPool, cerrarPool } from '../helpers/database.helper.js';

/**
 * E2E de las sondas operativas en su camino de fallo (T-BE-CL-05).
 *
 * `GET /health` es liveness y debe seguir en 200 aunque una dependencia este
 * caida: reiniciar el pod por una caida de MinIO o Redis convertiria un
 * incidente parcial en una interrupcion total. `GET /ready` es readiness y debe
 * retirar la replica del balanceador con 503 en cuanto una dependencia
 * configurada esta indisponible.
 *
 * Para provocar la caida se apuntan `S3_ENDPOINT` y `REDIS_URL` a un puerto
 * efimero que se abre y se cierra de inmediato, de forma que el rechazo es un
 * ECONNREFUSED real y no un mock. Ninguna prueba detiene el contenedor ni altera
 * el esquema.
 */

/** Reserva un puerto efimero y lo libera, garantizando que nadie escucha. */
async function puertoLibre(): Promise<number> {
  const servidor = createServer();
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', () => resolve()));
  const puerto = (servidor.address() as { port: number }).port;
  await new Promise<void>((resolve) => servidor.close(() => resolve()));
  return puerto;
}

const ENTORNO_ORIGINAL: Record<string, string | undefined> = {
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  REDIS_URL: process.env.REDIS_URL,
};

beforeAll(() => {
  delete process.env.S3_ENDPOINT;
  delete process.env.REDIS_URL;
});

afterEach(() => {
  for (const [clave, valor] of Object.entries(ENTORNO_ORIGINAL)) {
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
});

afterAll(async () => {
  await cerrarPool();
});

describe('E2E-15 · Sondas en su camino de fallo (T-BE-CL-05)', () => {
  it('GET /health sigue en 200 aunque MinIO y Redis esten caidos', async () => {
    const puerto = await puertoLibre();
    process.env.S3_ENDPOINT = `http://127.0.0.1:${puerto}`;
    process.env.REDIS_URL = `redis://127.0.0.1:${puerto}`;

    const respuesta = await request(construirApp(obtenerPool())).get('/health');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.status).toBe('ok');
    expect(respuesta.body.dependencias.minio_s3.estado).toBe('indisponible');
    expect(respuesta.body.dependencias.redis.estado).toBe('indisponible');
  });

  it('GET /ready responde 503 y marca indisponible cuando una dependencia cae', async () => {
    const puerto = await puertoLibre();
    process.env.S3_ENDPOINT = `http://127.0.0.1:${puerto}`;

    const respuesta = await request(construirApp(obtenerPool())).get('/ready');

    expect(respuesta.status).toBe(503);
    expect(respuesta.body.status).toBe('indisponible');
    expect(respuesta.body.dependencias.minio_s3.estado).toBe('indisponible');
  });

  it('GET /ready responde 200 si la unica dependencia configurada es PostgreSQL', async () => {
    const respuesta = await request(construirApp(obtenerPool())).get('/ready');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.status).toBe('ok');
  });

  it('clasifica la sonda global como degradado cuando solo cae una dependencia', async () => {
    const puerto = await puertoLibre();
    const resumen = await sondearDependencias(obtenerPool(), {
      S3_ENDPOINT: `http://127.0.0.1:${puerto}`,
    } as NodeJS.ProcessEnv);

    expect(resumen.estado).toBe('degradado');
    expect(resumen.dependencias.postgres.estado).toBe('ok');
    expect(resumen.dependencias.minio_s3.estado).toBe('indisponible');
    expect(resumen.dependencias.redis.estado).toBe('deshabilitado');
  });

  it('clasifica la sonda global como indisponible cuando cae tambien PostgreSQL', async () => {
    const puerto = await puertoLibre();
    // PostgreSQL se sondea siempre, asi que es la unica forma de que las tres
    // dependencias configuradas queden caidas y el agregado sea `indisponible`.
    const poolCaido = {
      query: () => Promise.reject(new Error('ECONNREFUSED al sondear PostgreSQL')),
    } as unknown as Parameters<typeof sondearDependencias>[0];

    const resumen = await sondearDependencias(poolCaido, {
      S3_ENDPOINT: `http://127.0.0.1:${puerto}`,
      REDIS_URL: `redis://127.0.0.1:${puerto}`,
    } as NodeJS.ProcessEnv);

    expect(resumen.estado).toBe('indisponible');
    expect(resumen.dependencias.postgres.estado).toBe('indisponible');
  });

  it('responde 503 en /ready cuando PostgreSQL es la dependencia caida', async () => {
    const respuesta = await request(
      construirApp({ query: () => Promise.reject(new Error('ECONNREFUSED')) } as never),
    ).get('/ready');

    expect(respuesta.status).toBe(503);
    expect(respuesta.body.status).toBe('indisponible');
    expect(respuesta.body.dependencias.postgres.estado).toBe('indisponible');
  });

  it('no sondea MinIO ni Redis cuando no estan configurados en el entorno', async () => {
    const resumen = await sondearDependencias(obtenerPool(), {} as NodeJS.ProcessEnv);

    expect(resumen.estado).toBe('ok');
    expect(resumen.dependencias.minio_s3.estado).toBe('deshabilitado');
    expect(resumen.dependencias.redis.estado).toBe('deshabilitado');
  });

  it('informa la latencia del sondeo a PostgreSQL', async () => {
    const resumen = await sondearDependencias(obtenerPool(), {} as NodeJS.ProcessEnv);
    const postgres = resumen.dependencias.postgres;

    expect(postgres.estado).toBe('ok');
    expect(postgres.latencia_ms).toBeGreaterThanOrEqual(0);
    expect(postgres.detalle).toMatch(/PostgreSQL/i);
  });
});
