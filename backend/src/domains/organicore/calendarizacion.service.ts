/**
 * Catálogo informativo, versionado y de solo lectura de la Calendarización
 * Institucional 2026. No representa feriados ni modifica el cómputo SLA.
 *
 * Patrón reutilizado: catálogo TypeScript inmutable + servicio sustituible,
 * igual que el catálogo inicial de CCD de RutaDoc. La fuente disponible es una
 * extracción Markdown; su hash no se presenta como hash del original normativo.
 */

export type TipoFuenteCalendarizacion = 'EXTRACCION_DOCUMENTAL';

export interface FuenteCalendarizacion {
  readonly tipoFuente: TipoFuenteCalendarizacion;
  readonly nombre: string;
  readonly referenciaSeccion: string;
  readonly anio: number;
  readonly hashExtraccionSha256: string;
}

export interface ActividadCalendarizacionInstitucional {
  readonly numero: number;
  readonly actividad: string;
  readonly fechaInicio: string;
  readonly fechaFin: string;
  readonly fechaTextoOriginal: string;
  readonly responsables: string;
  readonly anio: number;
  readonly fuente: FuenteCalendarizacion;
  readonly referenciaSeccion: string;
}

export interface FiltroCalendarizacionInstitucional {
  anio?: number;
  desde?: string;
  hasta?: string;
}

export interface ContextoCalendarizacionTupa {
  readonly tipo: 'INFORMATIVO';
  readonly fechaInicio: string;
  readonly fechaFin: string;
  readonly actividad: string;
}

export const FUENTE_CALENDARIZACION_INSTITUCIONAL_2026: FuenteCalendarizacion = Object.freeze({
  tipoFuente: 'EXTRACCION_DOCUMENTAL',
  nombre: 'Calendarización Institucional 2026',
  referenciaSeccion: '7.2',
  anio: 2026,
  hashExtraccionSha256: '648c5ad1aea1abbe6a6eeb20586a7c172365ce29d41e3c33b0616b3873a0bec7',
});

function crearActividad(
  numero: number,
  actividad: string,
  fechaInicio: string,
  fechaFin: string,
  fechaTextoOriginal: string,
  responsables: string,
): ActividadCalendarizacionInstitucional {
  return Object.freeze({
    numero,
    actividad,
    fechaInicio,
    fechaFin,
    fechaTextoOriginal,
    responsables,
    anio: 2026,
    fuente: FUENTE_CALENDARIZACION_INSTITUCIONAL_2026,
    referenciaSeccion: '7.2',
  });
}

export const CALENDARIZACION_INSTITUCIONAL_2026: readonly ActividadCalendarizacionInstitucional[] = Object.freeze([
  crearActividad(
    1,
    'Reincorporación, Traslados Internos y Externos',
    '2026-03-03',
    '2026-03-31',
    'Del 03/03/2026 al 31/03/2026',
    'Dirección General, Secretaría Académica, Coordinadores de Programas de Estudios.',
  ),
  crearActividad(
    2,
    'Matrícula del III - V ciclo',
    '2026-03-16',
    '2026-04-30',
    'Del 16/03/2026 al 30/04/2026',
    'Dirección General, Unidad Administrativa, Unidad Académica, Coordinadores de Programas de Estudios y estudiantes.',
  ),
  crearActividad(
    3,
    'Matrícula del I ciclo (ingresantes)',
    '2026-04-06',
    '2026-04-30',
    'Del 06/04/2026 al 30/04/2026',
    'Dirección General, Unidad Académica, Coordinadores de Programas de Estudios y estudiantes.',
  ),
  crearActividad(
    4,
    'Matrícula Extemporánea 2026-I con 10% de recargo',
    '2026-05-04',
    '2026-05-29',
    'Del 04/05/2026 al 29/05/2026',
    'Dirección General, Unidad Administrativa, Unidad Académica, Coordinadores de Programas de Estudios y estudiantes.',
  ),
  crearActividad(
    5,
    'Inicio de Clases Semestre Académico 2026-I (I-III-V)',
    '2026-04-06',
    '2026-04-06',
    '06/04/2026',
    'Dirección General, Unidad Académica, Coordinadores de Programas de Estudios y estudiantes.',
  ),
  crearActividad(
    6,
    'Entrega de Registros de Matrícula 2026-I (físico y virtual)',
    '2026-05-15',
    '2026-05-15',
    '15/05/2026',
    'Secretaría Académica, Coordinadores de Programas de Estudios, personal administrativo y estudiantes.',
  ),
  crearActividad(
    7,
    'Evaluación Extraordinaria 2026-I',
    '2026-04-06',
    '2026-08-05',
    'Del 06/04/2026 al 05/08/2026',
    'Coordinadores de Programas de Estudios, docentes y estudiantes.',
  ),
  crearActividad(
    8,
    'Término del Semestre Académico 2026-I (I-III-V)',
    '2026-08-07',
    '2026-08-07',
    '07/08/2026',
    'Dirección General, Unidad Académica, Coordinadores de Programas de Estudios y estudiantes.',
  ),
  crearActividad(
    9,
    'Sustentación de Trabajo de Aplicación Profesional y/o Examen de Suficiencia Profesional',
    '2026-08-10',
    '2026-08-31',
    'Del 10/08/2026 al 31/08/2026',
    'Dirección General, Unidad Administrativa, Unidad Académica, Secretaría Académica, Coordinadores de Programas de Estudios y Estudiantes.',
  ),
  crearActividad(
    10,
    'Ingreso de notas finales en el Sistema Registra - MINEDU 2026-I',
    '2026-08-10',
    '2026-08-12',
    'Del 10/08/2026 al 12/08/2026',
    'Secretaría Académica, Coordinadores de Programas de Estudios y docentes.',
  ),
  crearActividad(
    11,
    'Entrega de Actas de Evaluación 2026-I',
    '2026-08-14',
    '2026-08-14',
    '14/08/2026',
    'Secretaría Académica, Coordinadores de Programas de Estudios, personal administrativo y estudiantes.',
  ),
  crearActividad(
    12,
    'Matrícula Semestre Académico 2026-II',
    '2026-08-17',
    '2026-09-11',
    'Del 17/08/2026 al 11/09/2026',
    'Dirección General, Unidad Administrativa, Unidad Académica, Coordinadores de Programas de Estudios y estudiantes.',
  ),
  crearActividad(
    13,
    'Matrícula Extemporánea 2026-II con 10% de recargo',
    '2026-09-14',
    '2026-10-09',
    'Del 14/09/2026 al 09/10/2026',
    'Dirección General, Unidad Administrativa, Unidad Académica, Coordinadores de Programas de Estudios y estudiantes.',
  ),
  crearActividad(
    14,
    'Inicio de Clases Semestre Académico 2026-II (II-IV-VI)',
    '2026-08-17',
    '2026-08-17',
    '17/08/2026',
    'Dirección General, Unidad Académica, Coordinadores de Programas de Estudios y estudiantes.',
  ),
  crearActividad(
    15,
    'Entrega de Registros de Matrícula 2026-II (físico y virtual)',
    '2026-09-30',
    '2026-09-30',
    '30/09/2026',
    'Secretaría Académica, Coordinadores de Programas de Estudios, personal administrativo y estudiantes.',
  ),
  crearActividad(
    16,
    'Semana Técnica',
    '2026-09-16',
    '2026-09-18',
    'Del 16/09/2026 al 18/09/2026',
    'Dirección General, Unidad Administrativa, Unidad Académica, Coordinadores de Programas de Estudios.',
  ),
  crearActividad(
    17,
    'Evaluación Extraordinaria 2026-II',
    '2026-08-17',
    '2026-12-11',
    'Del 17/08/2026 al 11/12/2026',
    'Coordinadores de Programas de Estudios, docentes y estudiantes.',
  ),
  crearActividad(
    18,
    'Término del Semestre Académico 2026-II',
    '2026-12-18',
    '2026-12-18',
    '18/12/2026',
    'Dirección General, Unidad Académica, Coordinadores de Programas de Estudios y estudiantes.',
  ),
  crearActividad(
    19,
    'Sustentación de Trabajo de Aplicación Profesional y/o Examen de Suficiencia Profesional',
    '2026-12-18',
    '2026-12-31',
    'Del 18/12/2026 al 31/12/2026',
    'Dirección General, Unidad Administrativa, Unidad Académica, Secretaría Académica, Coordinadores de Programas de Estudios y Estudiantes.',
  ),
  crearActividad(
    20,
    'Ingreso de notas finales en el Sistema Registra - MINEDU 2026-II',
    '2026-12-21',
    '2026-12-22',
    'Del 21/12/2026 al 22/12/2026',
    'Secretaría Académica, Coordinadores de Programas de Estudios y docentes.',
  ),
  crearActividad(
    21,
    'Entrega de Actas de Evaluación 2026-II',
    '2026-12-28',
    '2026-12-28',
    '28/12/2026',
    'Secretaría Académica, Coordinadores de Programas de Estudios, personal administrativo y estudiantes.',
  ),
  crearActividad(
    22,
    'Clausura del Año Académico 2026',
    '2026-12-28',
    '2026-12-28',
    '28/12/2026',
    'Dirección General, Unidad Administrativa, Unidad Académica.',
  ),
  crearActividad(
    23,
    'Registro de Egresados en el Sistema Conecta - MINEDU.',
    '2026-12-28',
    '2026-12-30',
    'Del 28/12/2026 al 30/12/2026',
    'Unidad de Bienestar y Empleabilidad, Coordinadores de Programas de Estudios.',
  ),
]);

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;

function esFechaCivilValida(fecha: string): boolean {
  if (!ISO_DIA.test(fecha)) return false;
  const instante = Date.parse(`${fecha}T00:00:00.000Z`);
  return Number.isFinite(instante) && new Date(instante).toISOString().slice(0, 10) === fecha;
}

export function validarCatalogoCalendarizacion(
  actividades: readonly ActividadCalendarizacionInstitucional[],
): void {
  if (actividades.length !== 23) {
    throw new Error(`La Calendarización Institucional debe contener exactamente 23 actividades; recibió ${actividades.length}.`);
  }

  const numeros = new Set<number>();
  for (const actividad of actividades) {
    if (!Number.isInteger(actividad.numero) || actividad.numero <= 0 || numeros.has(actividad.numero)) {
      throw new Error(`Número de actividad inválido o duplicado: ${actividad.numero}.`);
    }
    numeros.add(actividad.numero);
    if (actividad.actividad.trim() === '') throw new Error(`La actividad ${actividad.numero} no tiene denominación.`);
    if (actividad.responsables.trim() === '') throw new Error(`La actividad ${actividad.numero} no tiene responsables.`);
    if (!esFechaCivilValida(actividad.fechaInicio) || !esFechaCivilValida(actividad.fechaFin)) {
      throw new Error(`La actividad ${actividad.numero} contiene una fecha civil inválida.`);
    }
    if (actividad.fechaInicio > actividad.fechaFin) {
      throw new Error(`La actividad ${actividad.numero} termina antes de comenzar.`);
    }
    if (!actividad.fechaInicio.startsWith(`${actividad.anio}-`) || !actividad.fechaFin.startsWith(`${actividad.anio}-`)) {
      throw new Error(`La actividad ${actividad.numero} no corresponde al año declarado.`);
    }
  }
}

validarCatalogoCalendarizacion(CALENDARIZACION_INSTITUCIONAL_2026);

const ACTIVIDAD_POR_REFERENCIA_TUPA: Readonly<Record<string, number>> = Object.freeze({
  'p5-fila-20': 1,
  'p5-fila-21': 1,
});

function validarFiltro(filtro: FiltroCalendarizacionInstitucional): void {
  if (filtro.anio !== undefined && (!Number.isInteger(filtro.anio) || filtro.anio < 2000 || filtro.anio > 2999)) {
    throw new RangeError('El año de calendarización es inválido.');
  }
  if (filtro.desde !== undefined && !esFechaCivilValida(filtro.desde)) {
    throw new RangeError('La fecha desde es inválida.');
  }
  if (filtro.hasta !== undefined && !esFechaCivilValida(filtro.hasta)) {
    throw new RangeError('La fecha hasta es inválida.');
  }
  if (filtro.desde !== undefined && filtro.hasta !== undefined && filtro.desde > filtro.hasta) {
    throw new RangeError('El rango de calendarización es inválido.');
  }
}

export class CalendarizacionInstitucionalService {
  public listar(
    filtro: FiltroCalendarizacionInstitucional = {},
  ): readonly ActividadCalendarizacionInstitucional[] {
    validarFiltro(filtro);
    return Object.freeze(CALENDARIZACION_INSTITUCIONAL_2026.filter((actividad) => {
      if (filtro.anio !== undefined && actividad.anio !== filtro.anio) return false;
      if (filtro.desde !== undefined && actividad.fechaFin < filtro.desde) return false;
      if (filtro.hasta !== undefined && actividad.fechaInicio > filtro.hasta) return false;
      return true;
    }));
  }

  public obtenerPorNumero(numero: number): ActividadCalendarizacionInstitucional | null {
    if (!Number.isInteger(numero) || numero <= 0) return null;
    return CALENDARIZACION_INSTITUCIONAL_2026.find((actividad) => actividad.numero === numero) ?? null;
  }

  public obtenerContextoTupa(referenciaFila: string): ContextoCalendarizacionTupa | null {
    const numero = ACTIVIDAD_POR_REFERENCIA_TUPA[referenciaFila];
    if (numero === undefined) return null;
    const actividad = this.obtenerPorNumero(numero);
    if (!actividad) return null;
    return Object.freeze({
      tipo: 'INFORMATIVO',
      fechaInicio: actividad.fechaInicio,
      fechaFin: actividad.fechaFin,
      actividad: actividad.actividad,
    });
  }
}
