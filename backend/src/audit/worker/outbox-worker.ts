import 'dotenv/config';
import { crearPool } from '../../database.js';
import { OutboxWorker, EventoPendiente } from '../outbox-worker.js';

const despachadorDemo: { despachar: (evento: EventoPendiente) => Promise<void> } = {
  async despachar(evento) {
    console.log(`[OUTBOX] Despachando ${evento.tipo_evento} (${evento.id_evento})`);
  },
};

const pool = crearPool(
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/sigd_prueba',
);

const worker = new OutboxWorker(pool, despachadorDemo, {
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