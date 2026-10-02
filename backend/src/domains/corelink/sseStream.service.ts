/**
 * Ruta canónica del plan maestro (`backend/src/domains/corelink/sseStream.service.ts`).
 * La implementación vive en `src/modules/corelink/` junto al enrutador SSE que
 * la consume; este módulo reexporta la superficie pública para respetar la ruta
 * documentada en el plan sin duplicar la lógica.
 */
export {
  BusSse,
  CANALES_SSE,
  EVENTO_CASILLA,
  EVENTO_SLA,
  EVENTO_TRANSICION,
  HEARTBEAT_SEGUNDOS,
  parsearCanales,
  type CanalSse,
} from '../../modules/corelink/sseStream.service.js';
