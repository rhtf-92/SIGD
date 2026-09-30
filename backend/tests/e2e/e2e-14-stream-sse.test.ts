import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { construirApp } from '../../src/app.js';
import { BusSse } from '../../src/modules/corelink/sseStream.service.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';
import { obtenerPool, cerrarPool } from '../helpers/database.helper.js';

/**
 * E2E del endpoint #55 (`GET /api/v1/realtime/stream`).
 *
 * La suite abre un stream SSE real contra un puerto efímero porque
 * supertest/superagent bufferiza la respuesta y no puede observar las tramas de
 * un stream que permanece abierto. Se usa el `fetch` nativo de Node 20 y se lee
 * el cuerpo como flujo, de modo que lo verificado son los bytes que un
 * `EventSource` recibiría en producción: cabeceras, trama de conexión, entrega
 * de eventos, heartbeat y reproducción por `Last-Event-ID`.
 */

const SECRETO = 'sigd-e2e-secreto-de-prueba-32-caracteres-minimo';
const USUARIO = '11111111-1111-4111-8111-111111111111';

interface StreamAbierto {
  respuesta: Response;
  cuerpo: ReadableStream<Uint8Array>;
  cancelar: () => void;
}

let bus: BusSse;
let servidor: Server;
let origen: string;

function token(expiraSegundos = 900): string {
  return firmarTokenAcceso({ sub: USUARIO, roles: ['DIRECTOR'], expiraSegundos, secreto: SECRETO });
}

async function abrirStream(consulta = '', cabeceras: Record<string, string> = {}): Promise<StreamAbierto> {
  const controlador = new AbortController();
  const respuesta = await fetch(`${origen}/api/v1/realtime/stream${consulta}`, {
    headers: { Authorization: `Bearer ${token()}`, ...cabeceras },
    signal: controlador.signal,
  });
  return {
    respuesta,
    cuerpo: respuesta.body as ReadableStream<Uint8Array>,
    cancelar: () => controlador.abort(),
  };
}

/** Lee tramas del stream hasta que `cumpla` las satisfaga o venza el plazo. */
async function leerHasta(
  abierto: StreamAbierto,
  cumple: (acumulado: string) => boolean,
  ms = 5000,
): Promise<string> {
  const lector = abierto.cuerpo.getReader();
  const decodificador = new TextDecoder();
  let acumulado = '';
  const vencido = Date.now() + ms;

  try {
    while (Date.now() < vencido && !cumple(acumulado)) {
      const pendiente = lector.read();
      const guardia = new Promise<{ done: true; value: undefined }>((resolve) =>
        setTimeout(() => resolve({ done: true, value: undefined }), Math.max(25, vencido - Date.now())),
      );
      const ganador = await Promise.race([pendiente, guardia]);
      if (ganador.value) {
        acumulado += decodificador.decode(ganador.value, { stream: true });
      } else if (ganador.done) {
        break;
      }
    }
  } finally {
    void lector.cancel().catch(() => undefined);
  }

  return acumulado;
}

async function esperarHasta(condicion: () => boolean, ms = 3000): Promise<void> {
  const vencido = Date.now() + ms;
  while (!condicion() && Date.now() < vencido) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

beforeAll(() => {
  process.env.AUTH_JWT_SECRET = SECRETO;
  bus = new BusSse();
  servidor = construirApp(obtenerPool(), bus).listen(0);
  origen = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterEach(() => {
  bus.cerrarTodos();
});

afterAll(async () => {
  bus.cerrarTodos();
  await new Promise<void>((resolve) => servidor.close(() => resolve()));
  await cerrarPool();
});

describe('E2E-14 · Stream SSE del endpoint #55', () => {
  it('rechaza la conexión sin identidad verificable con 401', async () => {
    const respuesta = await fetch(`${origen}/api/v1/realtime/stream`);

    expect(respuesta.status).toBe(401);
    await respuesta.text();
  });

  it('rechaza un token expirado con 401 antes de abrir el stream', async () => {
    const vencido = firmarTokenAcceso({ sub: USUARIO, expiraSegundos: -60, secreto: SECRETO });
    const respuesta = await fetch(`${origen}/api/v1/realtime/stream`, {
      headers: { Authorization: `Bearer ${vencido}` },
    });

    expect(respuesta.status).toBe(401);
    await respuesta.text();
  });

  it('rechaza un token firmado con otro secreto con 401', async () => {
    const falso = firmarTokenAcceso({
      sub: USUARIO,
      secreto: 'otro-secreto-falso-que-tiene-32-caracteres-minimo',
    });
    const respuesta = await fetch(`${origen}/api/v1/realtime/stream`, {
      headers: { Authorization: `Bearer ${falso}` },
    });

    expect(respuesta.status).toBe(401);
    await respuesta.text();
  });

  it('rechaza el parametro canales fuera del contrato con 400', async () => {
    const respuesta = await fetch(`${origen}/api/v1/realtime/stream?canales=casilla;drop`, {
      headers: { Authorization: `Bearer ${token()}` },
    });

    expect(respuesta.status).toBe(400);
    await respuesta.text();
  });

  it('publica las cuatro cabeceras de text/event-stream exigidas por el plan', async () => {
    const abierto = await abrirStream();

    expect(abierto.respuesta.status).toBe(200);
    expect(abierto.respuesta.headers.get('content-type')).toMatch(/^text\/event-stream/);
    expect(abierto.respuesta.headers.get('cache-control')).toBe('no-cache, no-transform');
    expect(abierto.respuesta.headers.get('connection')).toBe('keep-alive');
    expect(abierto.respuesta.headers.get('x-accel-buffering')).toBe('no');

    abierto.cancelar();
  });

  it('abre el stream con la trama de conexion y la identidad efectiva', async () => {
    const abierto = await abrirStream();
    const trama = await leerHasta(abierto, (t) => t.includes(':conectado'));
    abierto.cancelar();

    expect(trama).toContain('canales=casilla,expedientes,sla');
    expect(trama).toContain(`usuario=${USUARIO}`);
    expect(trama).toContain('via=bearer');
  });

  it('entrega en el cable los eventos publicados por el bus con id, event y data', async () => {
    const abierto = await abrirStream('?canales=casilla');

    bus.emitirEvento('casilla_notificacion', {
      expediente_id: '22222222-2222-4222-8222-222222222222',
      correlationId: 'corr-e2e-14',
    });

    const trama = await leerHasta(abierto, (t) => t.includes('event: casilla_notificacion'));
    abierto.cancelar();

    expect(trama).toMatch(/^id: \d+$/m);
    expect(trama).toMatch(/^event: casilla_notificacion$/m);
    expect(trama).toMatch(/^data: /m);
    expect(trama).toContain('corr-e2e-14');
    expect(trama.endsWith('\n\n')).toBe(true);
  });

  it('no entrega a un suscriptor los eventos de otro canal', async () => {
    const abierto = await abrirStream('?canales=sla');

    bus.emitirEvento('casilla_notificacion', { expediente_id: 'no-debe-llegar' });
    bus.emitirEvento('sla_alerta', { nivel: 'ROJO' });

    const trama = await leerHasta(abierto, (t) => t.includes('event: sla_alerta'));
    abierto.cancelar();

    expect(trama).toContain('ROJO');
    expect(trama).not.toContain('no-debe-llegar');
  });

  it('emite la trama de heartbeat al suscriptor conectado', async () => {
    const abierto = await abrirStream();

    bus.emitirHeartbeat();
    const trama = await leerHasta(abierto, (t) => t.includes(':heartbeat'));

    abierto.cancelar();
    expect(trama).toMatch(/^:heartbeat \d{4}-\d{2}-\d{2}T/m);
  });

  it('reproduce los eventos perdidos al reconectar con Last-Event-ID', async () => {
    // Bus aislado: el bus compartido ya acumuló eventos de los casos anteriores
    // y el buffer de replay devolvería además los ids ajenos a este corte.
    const busAislado = new BusSse();
    const servidorAislado = construirApp(obtenerPool(), busAislado).listen(0);
    const origenAislado = `http://127.0.0.1:${(servidorAislado.address() as AddressInfo).port}`;
    const controlador = new AbortController();

    try {
      busAislado.emitirEvento('expediente_transicion', { expediente_id: 'antes-del-corte' });
      busAislado.emitirEvento('expediente_transicion', { expediente_id: 'durante-el-corte' });

      const respuesta = await fetch(`${origenAislado}/api/v1/realtime/stream?canales=expedientes`, {
        headers: { Authorization: `Bearer ${token()}`, 'Last-Event-ID': '1' },
        signal: controlador.signal,
      });
      const cuerpo = respuesta.body as ReadableStream<Uint8Array>;
      const trama = await leerHasta(
        { respuesta, cuerpo, cancelar: () => controlador.abort() },
        (t) => t.includes(':replay'),
      );

      expect(trama).toContain(':replay 1 evento(s) desde 1');
      expect(trama).toContain('id: 2');
      expect(trama).toContain('event: expediente_transicion');
      expect(trama).toContain('durante-el-corte');
      expect(trama).not.toContain('antes-del-corte');
    } finally {
      controlador.abort();
      busAislado.cerrarTodos();
      await new Promise<void>((resolve) => servidorAislado.close(() => resolve()));
    }
  });

  it('libera la suscripcion cuando el cliente cierra la conexion', async () => {
    const abierto = await abrirStream();
    await esperarHasta(() => bus.cantidadSuscriptores() === 1);
    expect(bus.cantidadSuscriptores()).toBe(1);

    abierto.cancelar();
    await esperarHasta(() => bus.cantidadSuscriptores() === 0);

    expect(bus.cantidadSuscriptores()).toBe(0);
  });
});
