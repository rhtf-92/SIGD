/**
 * Catálogo informativo de la Calendarización Institucional 2026.
 *
 * Este catálogo es independiente de `sigd_org.calendario_laboral`: no calcula
 * días hábiles ni modifica SLA, feriados, RutaDoc o la radicación.
 */

export interface ActividadCalendarizacion {
  readonly numero: number;
  readonly anio: number;
  readonly nombre: string;
  readonly fechaInicio: string;
  readonly fechaFin: string;
  readonly fuente: string;
  readonly seccionFuente: string;
}

export interface ContextoTupaCalendarizacion {
  readonly tipo: 'INFORMATIVO';
  readonly actividad: string;
  readonly fechaInicio: string;
  readonly fechaFin: string;
}

const FUENTE = 'Calendarización Institucional 2026';
const SECCION_FUENTE = '7.2';

function actividad(
  numero: number,
  nombre: string,
  fechaInicio: string,
  fechaFin: string,
): ActividadCalendarizacion {
  return Object.freeze({
    numero,
    anio: 2026,
    nombre,
    fechaInicio,
    fechaFin,
    fuente: FUENTE,
    seccionFuente: SECCION_FUENTE,
  });
}

const ACTIVIDADES: readonly ActividadCalendarizacion[] = Object.freeze([
  actividad(1, 'Reincorporación, Traslados Internos y Externos', '2026-03-03', '2026-03-31'),
  actividad(2, 'Matrícula del III - V ciclo', '2026-03-16', '2026-04-30'),
  actividad(3, 'Matrícula del I ciclo (ingresantes)', '2026-04-06', '2026-04-30'),
  actividad(4, 'Matrícula Extemporánea 2026-I con 10% de recargo', '2026-05-04', '2026-05-29'),
  actividad(5, 'Inicio de Clases Semestre Académico 2026-I (I-III-V)', '2026-04-06', '2026-04-06'),
  actividad(6, 'Entrega de Registros de Matrícula 2026-I (físico y virtual)', '2026-05-15', '2026-05-15'),
  actividad(7, 'Evaluación Extraordinaria 2026-I', '2026-04-06', '2026-08-05'),
  actividad(8, 'Término del Semestre Académico 2026-I (I-III-V)', '2026-08-07', '2026-08-07'),
  actividad(
    9,
    'Sustentación de Trabajo de Aplicación Profesional y/o Examen de Suficiencia Profesional',
    '2026-08-10',
    '2026-08-31',
  ),
  actividad(10, 'Ingreso de notas finales en el Sistema Registra - MINEDU 2026-I', '2026-08-10', '2026-08-12'),
  actividad(11, 'Entrega de Actas de Evaluación 2026-I', '2026-08-14', '2026-08-14'),
  actividad(12, 'Matrícula Semestre Académico 2026-II', '2026-08-17', '2026-09-11'),
  actividad(13, 'Matrícula Extemporánea 2026-II con 10% de recargo', '2026-09-14', '2026-10-09'),
  actividad(14, 'Inicio de Clases Semestre Académico 2026-II (II-IV-VI)', '2026-08-17', '2026-08-17'),
  actividad(15, 'Entrega de Registros de Matrícula 2026-II (físico y virtual)', '2026-09-30', '2026-09-30'),
  actividad(16, 'Semana Técnica', '2026-09-16', '2026-09-18'),
  actividad(17, 'Evaluación Extraordinaria 2026-II', '2026-08-17', '2026-12-11'),
  actividad(18, 'Término del Semestre Académico 2026-II', '2026-12-18', '2026-12-18'),
  actividad(
    19,
    'Sustentación de Trabajo de Aplicación Profesional y/o Examen de Suficiencia Profesional',
    '2026-12-18',
    '2026-12-31',
  ),
  actividad(20, 'Ingreso de notas finales en el Sistema Registra - MINEDU 2026-II', '2026-12-21', '2026-12-22'),
  actividad(21, 'Entrega de Actas de Evaluación 2026-II', '2026-12-28', '2026-12-28'),
  actividad(22, 'Clausura del Año Académico 2026', '2026-12-28', '2026-12-28'),
  actividad(23, 'Registro de Egresados en el Sistema Conecta - MINEDU.', '2026-12-28', '2026-12-30'),
]);

const CONTEXTO_TRASLADOS: ContextoTupaCalendarizacion = Object.freeze({
  tipo: 'INFORMATIVO',
  actividad: ACTIVIDADES[0].nombre,
  fechaInicio: ACTIVIDADES[0].fechaInicio,
  fechaFin: ACTIVIDADES[0].fechaFin,
});

const REFERENCIAS_TUPA_VERIFICADAS: ReadonlyMap<string, ContextoTupaCalendarizacion> = new Map([
  ['p5-fila-20', CONTEXTO_TRASLADOS],
  ['p5-fila-21', CONTEXTO_TRASLADOS],
]);

const FORMATO_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function validarFecha(fecha: string, campo: string): void {
  if (!FORMATO_FECHA_ISO.test(fecha)) {
    throw new RangeError(`${campo} debe tener formato YYYY-MM-DD.`);
  }

  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (anio < 1 || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    throw new RangeError(`${campo} no es una fecha calendárica válida.`);
  }

  const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fechaUtc.getUTCFullYear() !== anio ||
    fechaUtc.getUTCMonth() !== mes - 1 ||
    fechaUtc.getUTCDate() !== dia
  ) {
    throw new RangeError(`${campo} no es una fecha calendárica válida.`);
  }
}

function arregloInmutable(actividades: readonly ActividadCalendarizacion[]): readonly ActividadCalendarizacion[] {
  // Los registros también están congelados; la copia evita compartir el array interno.
  return Object.freeze([...actividades]);
}

export function listarTodas(): readonly ActividadCalendarizacion[] {
  return arregloInmutable(ACTIVIDADES);
}

export function listarPorAnio(anio: number): readonly ActividadCalendarizacion[] {
  if (!Number.isInteger(anio)) {
    throw new RangeError('El año debe ser un número entero.');
  }
  return arregloInmutable(ACTIVIDADES.filter((item) => item.anio === anio));
}

export function obtenerPorNumero(numero: number): ActividadCalendarizacion | null {
  if (!Number.isInteger(numero)) {
    throw new RangeError('El número de actividad debe ser un entero.');
  }
  return ACTIVIDADES.find((item) => item.numero === numero) ?? null;
}

export function listarPorRango(
  fechaInicio: string,
  fechaFin: string,
): readonly ActividadCalendarizacion[] {
  validarFecha(fechaInicio, 'fechaInicio');
  validarFecha(fechaFin, 'fechaFin');
  if (fechaInicio > fechaFin) {
    throw new RangeError('fechaInicio no puede ser posterior a fechaFin.');
  }

  return arregloInmutable(
    ACTIVIDADES.filter((item) => item.fechaInicio <= fechaFin && fechaInicio <= item.fechaFin),
  );
}

export function obtenerContextoTupa(referenciaFila: string): ContextoTupaCalendarizacion | null {
  return REFERENCIAS_TUPA_VERIFICADAS.get(referenciaFila) ?? null;
}

/** Fachada explícita de consulta del catálogo; no tiene operaciones de escritura. */
export const calendarizacionInstitucional2026 = Object.freeze({
  listarTodas,
  listarPorAnio,
  obtenerPorNumero,
  listarPorRango,
  obtenerContextoTupa,
});
