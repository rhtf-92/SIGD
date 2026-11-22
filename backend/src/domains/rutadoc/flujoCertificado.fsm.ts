import { AppError } from '../../shared/domain/errors/index.js';
import type { EstadoRutaDoc } from './rutadoc.fsm.js';

/** Estados de negocio del flujo de Certificado de Inglés (extensible a otros trámites documentarios). */
export const ESTADOS_FLUJO_CERTIFICADO = Object.freeze([
  'SOLICITUD_INICIADA',
  'VALIDADO_MESA_PARTES',
  'DERIVADO_SUBDIRECCION',
  'DERIVADO_CENTRO_IDIOMAS',
  'EN_EVALUACION_ESPECIALISTA',
  'EVALUACION_PROGRAMADA',
  'EVALUACION_CALIFICADA',
  'INASISTENCIA_REGISTRADA',
  'INFORME_DEVUELTO_SUBDIRECCION',
  'INFORME_NSP_DEVUELTO_SUBDIRECCION',
  'CERTIFICADO_EMITIDO_SDA',
  'IMPROCEDENTE',
  'ARCHIVADO_POR_INASISTENCIA',
  'ATENDIDO_NOTIFICADO',
  'LISTO_PARA_ENTREGA',
  'ARCHIVADO_NO_RECOGIDO',
] as const);

export type EstadoFlujoCertificado = (typeof ESTADOS_FLUJO_CERTIFICADO)[number];

/** Eventos de transición permitidos en el flujo de negocio. */
export const EVENTOS_FLUJO_CERTIFICADO = Object.freeze([
  'INICIAR_SOLICITUD',
  'VALIDAR_REQUISITOS_MP',
  'DERIVAR_A_SUBDIRECCION',
  'EMITIR_MEMORANDUM_CENTRO_IDIOMAS',
  'ASIGNAR_ESPECIALISTA_IDIOMA',
  'DERIVAR_A_ESPECIALISTA',
  'PROGRAMAR_EVALUACION',
  'CALIFICAR_SOLICITANTE',
  'REGISTRAR_INASISTENCIA',
  'EMITIR_INFORME_RESULTADOS',
  'EMITIR_INFORME_NSP',
  'EMITIR_Y_FIRMAR_CERTIFICADO_SDA',
  'DECLARAR_IMPROCEDENTE_NSP',
  'CERRAR_POR_INASISTENCIA',
  'VISAR_Y_FIRMAR_DIRECCION_DIGITAL',
  'VISAR_Y_FIRMAR_DIRECCION_PRESENCIAL',
  'CONFIRMAR_ENTREGA_PRESENCIAL',
  'ARCHIVAR_POR_NO_RECOJO',
] as const);

export type EventoFlujoCertificado = (typeof EVENTOS_FLUJO_CERTIFICADO)[number];

/** Estados terminales de la máquina de estados del flujo de negocio. */
export const ESTADOS_TERMINALES_FLUJO_CERTIFICADO: readonly EstadoFlujoCertificado[] = Object.freeze([
  'ARCHIVADO_POR_INASISTENCIA',
  'ATENDIDO_NOTIFICADO',
  'ARCHIVADO_NO_RECOGIDO',
]);

/** Matriz inmutable de transiciones válidas: EstadoActual + Evento -> NuevoEstado. */
export const TRANSICIONES_FLUJO_CERTIFICADO: Readonly<
  Record<EstadoFlujoCertificado, Readonly<Partial<Record<EventoFlujoCertificado, EstadoFlujoCertificado>>>>
> = Object.freeze({
  SOLICITUD_INICIADA: Object.freeze({
    VALIDAR_REQUISITOS_MP: 'VALIDADO_MESA_PARTES',
    DERIVAR_A_SUBDIRECCION: 'DERIVADO_SUBDIRECCION',
  }),
  VALIDADO_MESA_PARTES: Object.freeze({
    DERIVAR_A_SUBDIRECCION: 'DERIVADO_SUBDIRECCION',
  }),
  DERIVADO_SUBDIRECCION: Object.freeze({
    EMITIR_MEMORANDUM_CENTRO_IDIOMAS: 'DERIVADO_CENTRO_IDIOMAS',
    DERIVAR_A_ESPECIALISTA: 'EN_EVALUACION_ESPECIALISTA',
  }),
  DERIVADO_CENTRO_IDIOMAS: Object.freeze({
    ASIGNAR_ESPECIALISTA_IDIOMA: 'EN_EVALUACION_ESPECIALISTA',
    DERIVAR_A_ESPECIALISTA: 'EN_EVALUACION_ESPECIALISTA',
  }),
  EN_EVALUACION_ESPECIALISTA: Object.freeze({
    PROGRAMAR_EVALUACION: 'EVALUACION_PROGRAMADA',
    CALIFICAR_SOLICITANTE: 'EVALUACION_CALIFICADA',
    REGISTRAR_INASISTENCIA: 'INASISTENCIA_REGISTRADA',
    EMITIR_INFORME_RESULTADOS: 'INFORME_DEVUELTO_SUBDIRECCION',
    EMITIR_INFORME_NSP: 'INFORME_NSP_DEVUELTO_SUBDIRECCION',
  }),
  EVALUACION_PROGRAMADA: Object.freeze({
    PROGRAMAR_EVALUACION: 'EVALUACION_PROGRAMADA',
    CALIFICAR_SOLICITANTE: 'EVALUACION_CALIFICADA',
    REGISTRAR_INASISTENCIA: 'INASISTENCIA_REGISTRADA',
    EMITIR_INFORME_RESULTADOS: 'INFORME_DEVUELTO_SUBDIRECCION',
    EMITIR_INFORME_NSP: 'INFORME_NSP_DEVUELTO_SUBDIRECCION',
  }),
  EVALUACION_CALIFICADA: Object.freeze({
    EMITIR_INFORME_RESULTADOS: 'INFORME_DEVUELTO_SUBDIRECCION',
  }),
  INASISTENCIA_REGISTRADA: Object.freeze({
    EMITIR_INFORME_NSP: 'INFORME_NSP_DEVUELTO_SUBDIRECCION',
  }),
  INFORME_DEVUELTO_SUBDIRECCION: Object.freeze({
    EMITIR_Y_FIRMAR_CERTIFICADO_SDA: 'CERTIFICADO_EMITIDO_SDA',
  }),
  INFORME_NSP_DEVUELTO_SUBDIRECCION: Object.freeze({
    DECLARAR_IMPROCEDENTE_NSP: 'IMPROCEDENTE',
    CERRAR_POR_INASISTENCIA: 'ARCHIVADO_POR_INASISTENCIA',
  }),
  CERTIFICADO_EMITIDO_SDA: Object.freeze({
    VISAR_Y_FIRMAR_DIRECCION_DIGITAL: 'LISTO_PARA_ENTREGA',
    VISAR_Y_FIRMAR_DIRECCION_PRESENCIAL: 'LISTO_PARA_ENTREGA',
  }),
  IMPROCEDENTE: Object.freeze({
    CERRAR_POR_INASISTENCIA: 'ARCHIVADO_POR_INASISTENCIA',
  }),
  ARCHIVADO_POR_INASISTENCIA: Object.freeze({}),
  ATENDIDO_NOTIFICADO: Object.freeze({}),
  LISTO_PARA_ENTREGA: Object.freeze({
    CONFIRMAR_ENTREGA_PRESENCIAL: 'ATENDIDO_NOTIFICADO',
    ARCHIVAR_POR_NO_RECOJO: 'ARCHIVADO_NO_RECOGIDO',
  }),
  ARCHIVADO_NO_RECOGIDO: Object.freeze({}),
});

/** Matriz RBAC estricta de roles autorizados por evento de transición. */
export const ROLES_AUTORIZADOS_FLUJO_CERTIFICADO: Readonly<
  Record<EventoFlujoCertificado, readonly string[]>
> = Object.freeze({
  INICIAR_SOLICITUD: Object.freeze(['CIUDADANO', 'MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR']),
  VALIDAR_REQUISITOS_MP: Object.freeze(['MESA_PARTES', 'DIRECTOR']),
  DERIVAR_A_SUBDIRECCION: Object.freeze(['MESA_PARTES', 'DIRECTOR']),
  EMITIR_MEMORANDUM_CENTRO_IDIOMAS: Object.freeze(['SECRETARIO', 'DIRECTOR']),
  ASIGNAR_ESPECIALISTA_IDIOMA: Object.freeze(['ESPECIALISTA', 'SECRETARIO', 'DIRECTOR']),
  DERIVAR_A_ESPECIALISTA: Object.freeze(['SECRETARIO', 'DIRECTOR', 'ESPECIALISTA']),
  PROGRAMAR_EVALUACION: Object.freeze(['ESPECIALISTA']),
  CALIFICAR_SOLICITANTE: Object.freeze(['ESPECIALISTA']),
  REGISTRAR_INASISTENCIA: Object.freeze(['ESPECIALISTA']),
  EMITIR_INFORME_RESULTADOS: Object.freeze(['ESPECIALISTA']),
  EMITIR_INFORME_NSP: Object.freeze(['ESPECIALISTA']),
  EMITIR_Y_FIRMAR_CERTIFICADO_SDA: Object.freeze(['SECRETARIO', 'DIRECTOR']),
  DECLARAR_IMPROCEDENTE_NSP: Object.freeze(['SECRETARIO', 'DIRECTOR']),
  CERRAR_POR_INASISTENCIA: Object.freeze(['SECRETARIO', 'DIRECTOR']),
  VISAR_Y_FIRMAR_DIRECCION_DIGITAL: Object.freeze(['DIRECTOR']),
  VISAR_Y_FIRMAR_DIRECCION_PRESENCIAL: Object.freeze(['DIRECTOR']),
  CONFIRMAR_ENTREGA_PRESENCIAL: Object.freeze(['MESA_PARTES', 'SECRETARIO', 'DIRECTOR']),
  ARCHIVAR_POR_NO_RECOJO: Object.freeze(['MESA_PARTES', 'SECRETARIO', 'DIRECTOR', 'ADMINISTRADOR']),
});

/** Mapeo determinista del micro-estado de negocio al macro-estado canónico de RutaDoc. */
export const MAPEO_ESTADO_FLUJO_A_RUTADOC: Readonly<Record<EstadoFlujoCertificado, EstadoRutaDoc>> = Object.freeze({
  SOLICITUD_INICIADA: 'REGISTRADO',
  VALIDADO_MESA_PARTES: 'EN_CALIFICACION',
  DERIVADO_SUBDIRECCION: 'DERIVADO',
  DERIVADO_CENTRO_IDIOMAS: 'EN_REVISION',
  EN_EVALUACION_ESPECIALISTA: 'EN_REVISION',
  EVALUACION_PROGRAMADA: 'EN_REVISION',
  EVALUACION_CALIFICADA: 'EN_REVISION',
  INASISTENCIA_REGISTRADA: 'EN_REVISION',
  INFORME_DEVUELTO_SUBDIRECCION: 'EN_REVISION',
  INFORME_NSP_DEVUELTO_SUBDIRECCION: 'EN_REVISION',
  CERTIFICADO_EMITIDO_SDA: 'EN_FIRMA',
  IMPROCEDENTE: 'RESUELTO',
  ARCHIVADO_POR_INASISTENCIA: 'ARCHIVADO',
  ATENDIDO_NOTIFICADO: 'RESUELTO',
  LISTO_PARA_ENTREGA: 'RESUELTO',
  ARCHIVADO_NO_RECOGIDO: 'ARCHIVADO',
});

export class FlujoTransicionInvalidaError extends AppError {
  constructor(estadoActual: string, evento: string) {
    super({
      status: 422,
      code: 'FLUJO_TRANSICION_INVALIDA',
      message: `La transición '${evento}' no está permitida desde el estado '${estadoActual}'.`,
      detail: `Transición rechazada por la máquina de estados del trámite: estado actual '${estadoActual}', evento '${evento}'.`,
    });
  }
}

export class FlujoRolNoAutorizadoError extends AppError {
  constructor(evento: EventoFlujoCertificado, rolesPermitidos: readonly string[], rolesActor: readonly string[]) {
    super({
      status: 403,
      code: 'FLUJO_ROL_NO_AUTORIZADO',
      message: `Su rol (${rolesActor.join(', ') || 'SIN_ROL'}) no está autorizado para ejecutar '${evento}'.`,
      detail: `Se requiere uno de los siguientes roles autorizados: ${rolesPermitidos.join(', ')}.`,
    });
  }
}

export function esEstadoFlujoCertificado(valor: unknown): valor is EstadoFlujoCertificado {
  return typeof valor === 'string' && ESTADOS_FLUJO_CERTIFICADO.some((estado) => estado === valor);
}

export function esEventoFlujoCertificado(valor: unknown): valor is EventoFlujoCertificado {
  return typeof valor === 'string' && EVENTOS_FLUJO_CERTIFICADO.some((evento) => evento === valor);
}

export function esEstadoTerminalFlujoCertificado(estado: EstadoFlujoCertificado): boolean {
  return ESTADOS_TERMINALES_FLUJO_CERTIFICADO.includes(estado);
}

export function puedeTransicionarFlujoCertificado(estadoActual: unknown, evento: unknown): boolean {
  return (
    esEstadoFlujoCertificado(estadoActual) &&
    esEventoFlujoCertificado(evento) &&
    TRANSICIONES_FLUJO_CERTIFICADO[estadoActual][evento] !== undefined
  );
}

export function obtenerSiguienteEstadoFlujoCertificado(
  estadoActual: unknown,
  evento: unknown,
): EstadoFlujoCertificado {
  if (!esEstadoFlujoCertificado(estadoActual) || !esEventoFlujoCertificado(evento)) {
    throw new FlujoTransicionInvalidaError(String(estadoActual), String(evento));
  }

  const siguiente = TRANSICIONES_FLUJO_CERTIFICADO[estadoActual][evento];
  if (siguiente === undefined) {
    throw new FlujoTransicionInvalidaError(estadoActual, evento);
  }
  return siguiente;
}

export function validarRolAutorizadoFlujoCertificado(
  evento: EventoFlujoCertificado,
  rolesActor: readonly string[],
): string {
  const permitidos = ROLES_AUTORIZADOS_FLUJO_CERTIFICADO[evento];
  const rolEncontrado = rolesActor
    .map((r) => r.trim().toUpperCase())
    .find((r) => permitidos.includes(r));

  if (!rolEncontrado) {
    throw new FlujoRolNoAutorizadoError(evento, permitidos, rolesActor);
  }
  return rolEncontrado;
}

export interface DefinicionTransicionFlujo {
  estadoOrigen: EstadoFlujoCertificado | null;
  evento: EventoFlujoCertificado;
  estadoDestino: EstadoFlujoCertificado;
  rolesAutorizados: readonly string[];
  estadoRutaDocDestino: EstadoRutaDoc;
}

export function obtenerDefinicionMaquinaEstadosFlujoCertificado() {
  const transiciones: DefinicionTransicionFlujo[] = [
    {
      estadoOrigen: null,
      evento: 'INICIAR_SOLICITUD',
      estadoDestino: 'SOLICITUD_INICIADA',
      rolesAutorizados: ROLES_AUTORIZADOS_FLUJO_CERTIFICADO.INICIAR_SOLICITUD,
      estadoRutaDocDestino: MAPEO_ESTADO_FLUJO_A_RUTADOC.SOLICITUD_INICIADA,
    },
  ];

  for (const origen of ESTADOS_FLUJO_CERTIFICADO) {
    const mapa = TRANSICIONES_FLUJO_CERTIFICADO[origen];
    for (const [evento, destino] of Object.entries(mapa) as Array<[EventoFlujoCertificado, EstadoFlujoCertificado]>) {
      transiciones.push({
        estadoOrigen: origen,
        evento,
        estadoDestino: destino,
        rolesAutorizados: ROLES_AUTORIZADOS_FLUJO_CERTIFICADO[evento],
        estadoRutaDocDestino: MAPEO_ESTADO_FLUJO_A_RUTADOC[destino],
      });
    }
  }

  return {
    nombre: 'FlujoCertificadoInglesFSM',
    version: '1.0.0',
    extensible: true,
    estados: ESTADOS_FLUJO_CERTIFICADO,
    estadosTerminales: ESTADOS_TERMINALES_FLUJO_CERTIFICADO,
    mapeoRutaDoc: MAPEO_ESTADO_FLUJO_A_RUTADOC,
    transiciones,
  };
}
