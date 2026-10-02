/**
 * Ruta canónica del plan maestro (`backend/src/workers/outbox.worker.ts`).
 * El worker implementado vive en `src/audit/outbox-worker.ts`; este módulo
 * reexporta su superficie pública para respetar la ruta documentada en el plan
 * sin duplicar la lógica del poller.
 */
export {
  OutboxWorker,
  type ConfiguracionWorker,
  type DespachadorEvento,
  type EstadoOutbox,
  type EventoPendiente,
} from '../audit/outbox-worker.js';
