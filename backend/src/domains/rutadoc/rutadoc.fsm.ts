import { AppError } from '../../shared/domain/errors/app-error.js';

/** Estados canónicos de T-BE-RD-01 (plan maestro, sección 7.4.1). */
export const ESTADOS_RUTADOC = Object.freeze([
  'REGISTRADO',
  'RECEPCIONADO',
  'EN_CALIFICACION',
  'DERIVADO',
  'EN_REVISION',
  'OBSERVADO',
  'SUBSANADO',
  'EN_FIRMA',
  'RESUELTO',
  'ARCHIVADO',
] as const);

export type EstadoRutaDoc = (typeof ESTADOS_RUTADOC)[number];

/**
 * Se conservan los códigos compatibles del SQL anterior. REGISTRO_EXTERNO
 * origina REGISTRADO fuera de esta FSM, que siempre recibe un estado actual.
 * INICIAR_CALIFICACION, ENVIAR_A_FIRMA y FIRMA son decisiones mínimas: el plan
 * exige esas etapas pero no nombra sus eventos. No equivalen a ATENCION ni a
 * INICIAR_REVISION, que el SQL anterior usa con otro significado.
 */
export const EVENTOS_RUTADOC = Object.freeze([
  'RECEPCION',
  'INICIAR_CALIFICACION',
  'INICIAR_REVISION',
  'DERIVACION',
  'OBSERVACION',
  'CORRECCION',
  'ENVIAR_A_FIRMA',
  'FIRMA',
  'CIERRE',
] as const);

export type EventoRutaDoc = (typeof EVENTOS_RUTADOC)[number];

/**
 * Decisiones de transición no literales del plan:
 * - La recepción inicial abre la calificación; una derivación recibida abre
 *   revisión. La misma acción RECEPCION es determinista por estado de origen.
 * - La calificación puede continuar localmente o derivarse. También puede
 *   observarse antes de revisión; la corrección vuelve por SUBSANADO a revisión.
 * - Una revisión puede derivarse de nuevo o elevarse a firma. La firma lleva a
 *   RESUELTO; CIERRE archiva solo un expediente ya resuelto.
 * - No se modelan reapertura, rectificación ni devolución: sus reglas exceden
 *   los diez estados aprobados o requieren contratos de actuaciones externos.
 * Cada fila está congelada, además del contenedor, para impedir mutaciones.
 */
export const TRANSICIONES_RUTADOC: Readonly<
  Record<EstadoRutaDoc, Readonly<Partial<Record<EventoRutaDoc, EstadoRutaDoc>>>>
> = Object.freeze({
  REGISTRADO: Object.freeze({ RECEPCION: 'RECEPCIONADO' }),
  RECEPCIONADO: Object.freeze({ INICIAR_CALIFICACION: 'EN_CALIFICACION' }),
  EN_CALIFICACION: Object.freeze({
    INICIAR_REVISION: 'EN_REVISION',
    DERIVACION: 'DERIVADO',
    OBSERVACION: 'OBSERVADO',
  }),
  DERIVADO: Object.freeze({ RECEPCION: 'EN_REVISION' }),
  EN_REVISION: Object.freeze({
    DERIVACION: 'DERIVADO',
    OBSERVACION: 'OBSERVADO',
    ENVIAR_A_FIRMA: 'EN_FIRMA',
  }),
  OBSERVADO: Object.freeze({ CORRECCION: 'SUBSANADO' }),
  SUBSANADO: Object.freeze({ INICIAR_REVISION: 'EN_REVISION' }),
  EN_FIRMA: Object.freeze({ FIRMA: 'RESUELTO' }),
  RESUELTO: Object.freeze({ CIERRE: 'ARCHIVADO' }),
  ARCHIVADO: Object.freeze({}),
});

export function esEstadoRutaDoc(valor: unknown): valor is EstadoRutaDoc {
  return typeof valor === 'string' && ESTADOS_RUTADOC.some((estado) => estado === valor);
}

export function esEventoRutaDoc(valor: unknown): valor is EventoRutaDoc {
  return typeof valor === 'string' && EVENTOS_RUTADOC.some((evento) => evento === valor);
}

export function puedeTransicionar(estadoActual: unknown, evento: unknown): boolean {
  return (
    esEstadoRutaDoc(estadoActual) &&
    esEventoRutaDoc(evento) &&
    TRANSICIONES_RUTADOC[estadoActual][evento] !== undefined
  );
}

export class EstadoTransicionInvalidaError extends AppError {
  constructor() {
    super({
      status: 422,
      code: 'ESTADO_TRANSICION_INVALIDA',
      message: 'La transición de estado solicitada no está permitida.',
    });
  }
}

/** Función pura: devuelve el destino o rechaza toda pareja no definida. */
export function obtenerSiguienteEstado(estadoActual: unknown, evento: unknown): EstadoRutaDoc {
  if (!esEstadoRutaDoc(estadoActual) || !esEventoRutaDoc(evento)) {
    throw new EstadoTransicionInvalidaError();
  }

  const siguiente = TRANSICIONES_RUTADOC[estadoActual][evento];
  if (siguiente === undefined) {
    throw new EstadoTransicionInvalidaError();
  }
  return siguiente;
}
