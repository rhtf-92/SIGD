/**
 * T-BE-TC-03 · Motor de horario de corte legal de la Mesa de Partes.
 *
 * Regla del Art. 138 del TUO de la Ley N° 27444 (LPAG): la recepcion documental
 * que ingressa despues del horario de atencion no empieza a correr en el dia
 * de la entrega, sino en el primer dia habil siguiente. Sin esta correccion los
 * plazos se computan desde la hora del sistema y el institute queda expuesto a
 * reclamaciones de ciudadanos por extemporaneidad o por presumido silencio
 * administrativo positivo.
 *
 * Convenciones fijadas aqui (identicas a las del frontend
 * `src/hooks/useHorarioCorte.ts`, para que servidor y cliente no discrepen):
 *   * Zona horaria institucional: `America/Lima` (UTC-05:00, sin horario de
 *     verano desde 2019).
 *   * Corte de recepcion: 16:30:00 en `America/Lima`.
 *   * Apertura: 08:00:00 del dia habil proyectado.
 *   * Dias no habiles: sabado, domingo y los feriados del calendario laboral.
 *
 * Todas las funciones son puras: reciben la fecha de entrada y el set de
 * feriados, y no leen el reloj del sistema. Eso las hace verificables sin
 * mocks y evita que la fecha de corte dependa de la zona horaria del servidor
 * de despliegue.
 */

export const ZONA_HORARIA_LIMA = 'America/Lima';

/** Minutos desde medianoche del horario de corte: 16:30. */
export const MINUTOS_CORTE = 16 * 60 + 30;

/** Minutos desde medianoche de la apertura: 08:00. */
export const MINUTOS_APERTURA = 8 * 60;

/** Desplazamiento de `America/Lima` respecto a UTC, en horas. */
export const OFFSET_HORARIO_LIMA = -5;

export interface PartesFechaLima {
  fecha: string;
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  diaSemana: number;
}

export interface ResultadoHorarioCorte {
  /** Momento real de recepcion tecnica. Metadato pericial inmutable. */
  envioReal: Date;
  /** Instante que inicia el computo de plazos. */
  radicacionLegal: Date;
  fechaLegal: string;
  /** Dia habil, dentro de 08:00 y 16:30. */
  dentroDeHorario: boolean;
  /** El envio cayo en sabado, domingo o feriado. */
  diaNoHabil: boolean;
  /** El envio supero las 16:30. */
  despuesDelCorte: boolean;
  /** Se aplico la proyeccion al dia habil siguiente. */
  requiereProyeccion: boolean;
}

const formateadorLima = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA_LIMA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

const NOMBRES_DIA = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** Descompone un instante en sus partes de calendario de `America/Lima`. */
export function obtenerPartesLima(instante: Date): PartesFechaLima {
  if (Number.isNaN(instante.getTime())) {
    throw new RangeError('FECHA_INVALIDA: se recibio un instante no valido.');
  }
  const partes = Object.fromEntries(
    formateadorLima.formatToParts(instante).map((parte) => [parte.type, parte.value]),
  );
  const anio = Number(partes.year);
  const mes = Number(partes.month);
  const dia = Number(partes.day);
  const diaSemana = NOMBRES_DIA.indexOf(
    (partes.weekday.toLowerCase() as (typeof NOMBRES_DIA)[number]),
  );
  if (diaSemana < 0) {
    throw new Error('No se pudo determinar el dia de la semana en America/Lima.');
  }
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    anio,
    mes,
    dia,
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
    diaSemana,
  };
}

/** Suma dias calendario a una fecha `YYYY-MM-DD` sin sufrir el corrimiento de zona. */
export function sumarDias(fecha: string, dias: number): string {
  const base = new Date(`${fecha}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) {
    throw new RangeError(`FECHA_INVALIDA: "${fecha}" no tiene formato YYYY-MM-DD.`);
  }
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

function diaSemanaDe(fecha: string): number {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay();
}

export function esDiaHabil(fecha: string, feriados: ReadonlySet<string>): boolean {
  const diaSemana = diaSemanaDe(fecha);
  return diaSemana !== 0 && diaSemana !== 6 && !feriados.has(fecha);
}

/** Primer dia habil estrictamente posterior a `fecha`. */
export function siguienteDiaHabil(fecha: string, feriados: ReadonlySet<string>): string {
  let candidato = sumarDias(fecha, 1);
  let guardia = 0;
  while (!esDiaHabil(candidato, feriados)) {
    candidato = sumarDias(candidato, 1);
    guardia += 1;
    // Un calendario con mas de 366 dias consecutivos no habiles es un dato
    // corrupto; fallar aqui es preferible a un bucle infinito en produccion.
    if (guardia > 366) {
      throw new Error(
        `CALENDARIO_LABORAL_INVALIDO: no se encontro dia habil tras ${fecha}. Revise el calendario de feriados.`,
      );
    }
  }
  return candidato;
}

/**
 * Instante de apertura (08:00 `America/Lima`) de una fecha dada. Se construye
 * desde la fecha civil mas el offset fijo de Lima para no depender de la zona
 * horaria del host.
 */
function aperturaEnLima(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const utcMs = Date.UTC(anio, mes - 1, dia, 0, 0, 0) - OFFSET_HORARIO_LIMA * 3_600_000;
  return new Date(utcMs + MINUTOS_APERTURA * 60_000);
}

/**
 * Aplica el Art. 138 LPAG a un instante de recepcion.
 *
 * @param envioReal    Instante de recepcion tecnica.
 * @param feriados    Feriados del calendario laboral en formato `YYYY-MM-DD`.
 */
export function calcularHorarioCorte(
  envioReal: Date,
  feriados: readonly string[] = [],
): ResultadoHorarioCorte {
  const partes = obtenerPartesLima(envioReal);
  const setFeriados = new Set(feriados);

  const diaNoHabil = partes.diaSemana === 0 || partes.diaSemana === 6
    || setFeriados.has(partes.fecha);
  const despuesDelCorte = partes.hora * 60 + partes.minuto >= MINUTOS_CORTE;
  const requiereProyeccion = diaNoHabil || despuesDelCorte;

  const fechaLegal = requiereProyeccion
    ? siguienteDiaHabil(partes.fecha, setFeriados)
    : partes.fecha;

  return {
    envioReal,
    radicacionLegal: aperturaEnLima(fechaLegal),
    fechaLegal,
    dentroDeHorario: !requiereProyeccion,
    diaNoHabil,
    despuesDelCorte,
    requiereProyeccion,
  };
}
