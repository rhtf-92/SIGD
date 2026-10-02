import 'dotenv/config';
import { crearPool } from '../../database.js';
import { OutboxWorker } from '../outbox-worker.js';
import { crearDespachadorPorDefecto } from '../despachador-notificaciones.js';
import { BusSse } from '../../modules/corelink/sseStream.service.js';
import { BridgeNotificacion } from '../../core/realtime/bridge-notificacion.js';

/**
 * Entrypoint del worker Outbox como proceso independiente (`npm run
 * worker:outbox`).
 *
 * Usa el mismo despachador compuesto que el proceso del servidor (SSE + Casilla
 * Electrónica) en lugar de un despachador de pruebas que solo registra en
 * consola: si este proceso consumiera el outbox con un despachador ficticio,
 * marcaría los eventos como `PROCESADO` sin haber notificado a nadie y el
 * evento se perdería de forma silenciosa, que es exactamente lo que el patrón
 * Transactional Outbox debe impedir.
 *
 * El bus SSE de este proceso no tiene suscriptores propios: su función es la de
 * `publicar` el evento por `NOTIFY` para que lo repartan las réplicas del
 * servidor que sí tienen clientes conectados. Si `OUTBOX_BRIDGE_ENABLED=false`
 * el worker opera de forma aislada, útil para una ejecución de un solo proceso.
 */

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/sigd_prueba';

const pool = crearPool(databaseUrl);
const busSse = new BusSse();

const bridge =
  (process.env.OUTBOX_BRIDGE_ENABLED ?? 'true') === 'true'
    ? new BridgeNotificacion(databaseUrl, busSse, { nombreInstancia: 'worker-outbox' })
    : null;

await bridge?.iniciar().catch((error: unknown) => {
  console.error('[OUTBOX] El puente de notificación no arrancó; los eventos no llegarán a otras réplicas:', error);
});

const worker = new OutboxWorker(pool, crearDespachadorPorDefecto(busSse, pool, bridge), {
  lote: Number(process.env.OUTBOX_LOTE ?? 100),
  maxIntentos: Number(process.env.OUTBOX_MAX_INTENTOS ?? 5),
  backoffBaseMs: Number(process.env.OUTBOX_BACKOFF_BASE_MS ?? 1000),
  backoffTechoMs: Number(process.env.OUTBOX_BACKOFF_TECHO_MS ?? 300000),
  intervaloPollMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 5000),
});

const apagar = async (senal: string): Promise<void> => {
  console.log(`[OUTBOX] Señal ${senal} recibida; deteniendo el worker.`);
  worker.detener();
  await bridge?.detener();
  await pool.end().catch(() => undefined);
  process.exit(0);
};

process.on('SIGINT', () => void apagar('SIGINT'));
process.on('SIGTERM', () => void apagar('SIGTERM'));

const ciclo = worker.iniciar();
ciclo.catch((error: unknown) => {
  console.error('[OUTBOX] El ciclo de polling terminó con error:', error);
  void apagar('error');
});
