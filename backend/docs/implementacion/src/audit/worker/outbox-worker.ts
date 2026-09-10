import 'dotenv/config';
import { crearPool } from '../../database.js';
import { OutboxWorker, EventoPendiente } from '../outbox-worker.js';

const despachadorDemostracion: { despachar: (evento: EventoPendiente) => Promise<void> } = {
  async despachar(evento) {
    console.log(`[DEMO] Despachador de demostración (no productivo): ${evento.tipo_evento} (${evento.id_evento})`);
  },
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    '[OUTBOX] DATABASE_URL no definida. Defínela de forma explícita antes de iniciar el worker.',
  );
}

const pool = crearPool(databaseUrl);

const worker = new OutboxWorker(pool, despachadorDemostracion, {
  lote: Number(process.env.OUTBOX_LOTE ?? 100),
  maxIntentos: Number(process.env.OUTBOX_MAX_INTENTOS ?? 5),
  backoffBaseMs: Number(process.env.OUTBOX_BACKOFF_BASE_MS ?? 1000),
  intervaloPollMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 5000),
});

process.on('SIGINT', () => {
  worker.detener();
  void pool.end().then(() => process.exit(0));
});

void worker.iniciar();