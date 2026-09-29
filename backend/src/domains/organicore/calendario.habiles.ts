/**
 * Motor de cómputo de días hábiles del calendario laboral institucional.
 *
 * TUO de la Ley N° 27444 (LPAG), Art. 143: el plazo máximo supletorio de los
 * procedimientos administrativos es de 30 DÍAS HÁBILES. Del cómputo se deducen
 * sábados, domingos, feriados nacionales (D. Leg. N° 713), feriados regionales de
 * Ucayali y días de duelo nacional.
 *
 * Este módulo es PURO: no recibe `Pool`, no toca `req/res` y no lee variables de
 * entorno. El calendario se le inyecta como argumento, de modo que la única
 * fuente de verdad son las filas de `sigd_org.calendario_laboral`. Antes los
 * feriados vivían codificados en `frontend/src/utils/slaCalculator.ts` y había
 * que editar código cada ejercicio fiscal; ahora provienen de la base de datos.
 *
 * Reproduce la semántica de `frontend/src/utils/slaCalculator.ts`
 * (`isBusinessDay`, `addBusinessDays`, `countBusinessDays`) para que el semáforo
 * SLA del frontend y el backend no diverjan, pero usando fechas de calendario
 * en UTC (sin la ambigüedad de zona horaria del `Date` local del navegador).
 */

export const TIPOS_FERIADO = [
  'NACIONAL',
  'REGIONAL_UCAYALI',
  'INSTITUCIONAL',
  'DUELO_NACIONAL',
] as const;

export type TipoFeriado = (typeof TIPOS_FERIADO)[number];

export const UNIDADES_TERRITORIALES = ['NACIONAL', 'UCAYALI', 'IESTP_SUIZA'] as const;

export type UnidadTerritorial = (typeof UNIDADES_TERRITORIALES)[number];

/** Día de una fecha concreta según el calendario institucional. */
export interface DiaCalendario {
  id_calendario?: string;
  /** Fecha en formato ISO `YYYY-MM-DD`. */
  fecha: string;
  anio: number;
  /** `null` cuando el día es una habilitación laborable excepcional. */
  tipo_feriado: TipoFeriado | null;
  descripcion: string;
  unidad_territorial: UnidadTerritorial;
  es_laborable: boolean;
  base_legal: string | null;
  activo?: boolean;
}

const REGEXO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const DIAS_POR_MS = 86_400_000;

/** ¿El texto tiene forma de fecha ISO `YYYY-MM-DD`? No valida el calendario. */
export function tieneFormatoFecha(fecha: unknown): fecha is string {
  return typeof fecha === 'string' && REGEXO_FECHA.test(fecha);
}

/**
 * Valida que la fecha exista en el calendario gregoriano.
 * Rechaza, por ejemplo, `2026-02-30`, `2026-13-01` o `2025-02-29`.
 */
export function esFechaValida(fecha: string): boolean {
  if (!tieneFormatoFecha(fecha)) {
    return false;
  }
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return false;
  }
  const anioUtc = Date.UTC(anio, mes - 1, dia);
  const fechaUtc = new Date(anioUtc);
  return (
    fechaUtc.getUTCFullYear() === anio &&
    fechaUtc.getUTCMonth() === mes - 1 &&
    fechaUtc.getUTCDate() === dia
  );
}

/** Convierte `YYYY-MM-DD` a instante UTC medianoche (sin derivas de zona horaria). */
export function aInstanteUtc(fecha: string): number {
  if (!esFechaValida(fecha)) {
    throw new RangeError(`Fecha inválida: ${fecha}. Se espera el formato YYYY-MM-DD.`);
  }
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

/** Convierte un instante a `YYYY-MM-DD` en UTC. */
export function aFechaIso(instante: number): string {
  return new Date(instante).toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado (misma convención que `Date.prototype.getDay`). */
export function diaSemana(fecha: string): number {
  return new Date(aInstanteUtc(fecha)).getUTCDay();
}

export function esFinDeSemana(fecha: string): boolean {
  const dia = diaSemana(fecha);
  return dia === 0 || dia === 6;
}

/** Añade (o resta) días corridos a una fecha ISO. */
export function desplazarDias(fecha: string, dias: number): string {
  return aFechaIso(aInstanteUtc(fecha) + dias * DIAS_POR_MS);
}

/** Compara dos fechas ISO por orden cronológico. */
export function compararFechas(izquierda: string, derecha: string): number {
  return aInstanteUtc(izquierda) - aInstanteUtc(derecha);
}

/**
 * Normaliza la colección de excepciones a un índice por fecha, resolviendo el
 * caso en que coexisten varias filas para la misma fecha en unidades
 * territoriales distintas: la habilitación laborable (`es_laborable: true`)
 * prevalece por ser la resolución posterior. Es la misma regla que aplica
 * `sigd_org.es_dia_no_laborable` en la base de datos.
 */
export function indexarCalendario(calendario: readonly DiaCalendario[]): Map<string, DiaCalendario> {
  const indice = new Map<string, DiaCalendario>();
  for (const dia of calendario) {
    if (dia.activo === false) {
      continue;
    }
    const previo = indice.get(dia.fecha);
    if (previo === undefined || dia.es_laborable) {
      indice.set(dia.fecha, dia);
    }
  }
  return indice;
}

/**
 * Devuelve la excepción no laborable vigente para la fecha, o `null` si el día
 * es laborable (no hay excepción, o existe una habilitación expresa).
 */
export function buscarDia(
  fecha: string,
  indice: ReadonlyMap<string, DiaCalendario>,
): DiaCalendario | null {
  const encontrado = indice.get(fecha);
  if (!encontrado || encontrado.es_laborable) {
    return null;
  }
  return encontrado;
}

/** ¿La fecha es un feriado o día no laborable según el calendario institucional? */
export function esFeriado(fecha: string, calendario: readonly DiaCalendario[]): boolean {
  return buscarDia(fecha, indexarCalendario(calendario)) !== null;
}

/**
 * ¿La fecha es un día laborable? (Art. 143 LPAG)
 * Falso si es sábado, domingo, feriado nacional, feriado regional de Ucayali,
 * feriado institucional, duelo nacional o si el calendario así lo declara.
 */
export function esDiaLaborable(fecha: string, calendario: readonly DiaCalendario[] = []): boolean {
  if (!esFechaValida(fecha)) {
    return false;
  }
  if (esFinDeSemana(fecha)) {
    return false;
  }
  return buscarDia(fecha, indexarCalendario(calendario)) === null;
}

/**
 * Cuenta los días hábiles entre dos fechas.
 *
 * Cómputo legal del Art. 143: se excluye la fecha de inicio (el plazo corre a
 * partir del día hábil siguiente) y se incluye la fecha de fin. Devuelve un valor
 * negativo si `hasta` es anterior a `desde`, para preservar el orden del cómputo.
 */
export function contarDiasHabiles(
  desde: string,
  hasta: string,
  calendario: readonly DiaCalendario[] = [],
): number {
  if (!esFechaValida(desde) || !esFechaValida(hasta)) {
    throw new RangeError('Las fechas del rango deben ser válidas y tener formato YYYY-MM-DD.');
  }
  const indice = indexarCalendario(calendario);
  const inicio = aInstanteUtc(desde);
  const fin = aInstanteUtc(hasta);
  if (inicio === fin) {
    return 0;
  }

  const esInverso = fin < inicio;
  const [menor, mayor] = esInverso ? [fin, inicio] : [inicio, fin];

  let total = 0;
  for (let instante = menor; instante < mayor; instante += DIAS_POR_MS) {
    const fecha = aFechaIso(instante + DIAS_POR_MS);
    if (esHabilEnIndice(fecha, indice)) {
      total += 1;
    }
  }

  return esInverso ? -total : total;
}

function esHabilEnIndice(fecha: string, indice: ReadonlyMap<string, DiaCalendario>): boolean {
  if (esFinDeSemana(fecha)) {
    return false;
  }
  return buscarDia(fecha, indice) === null;
}

/**
 * Suma N días hábiles a una fecha (Art. 143 LPAG).
 * El cómputo arranca al día siguiente, por eso el resultado nunca es la fecha
 * de entrada, aunque ésta sea un fin de semana o un feriado.
 */
export function sumarDiasHabiles(
  desde: string,
  diasHabiles: number,
  calendario: readonly DiaCalendario[] = [],
): string {
  if (!esFechaValida(desde)) {
    throw new RangeError('La fecha de inicio debe ser válida y tener formato YYYY-MM-DD.');
  }
  if (!Number.isInteger(diasHabiles) || diasHabiles < 0) {
    throw new RangeError('El número de días hábiles debe ser un entero no negativo.');
  }

  const indice = indexarCalendario(calendario);
  let instante = aInstanteUtc(desde);
  let restantes = diasHabiles;
  while (restantes > 0) {
    instante += DIAS_POR_MS;
    if (esHabilEnIndice(aFechaIso(instante), indice)) {
      restantes -= 1;
    }
  }
  return aFechaIso(instante);
}

/** Primera fecha laborable estrictamente posterior a `fecha` (regla del Art. 138). */
export function proximoDiaHabil(fecha: string, calendario: readonly DiaCalendario[] = []): string {
  return sumarDiasHabiles(fecha, 1, calendario);
}

/** Primera fecha laborable igual o posterior a `fecha`. */
export function primerDiaHabil(fecha: string, calendario: readonly DiaCalendario[] = []): string {
  return esDiaLaborable(fecha, calendario) ? fecha : proximoDiaHabil(fecha, calendario);
}

/**
 * Enumera las fechas no laborables (fines de semana y feriados) del rango
 * `[desde, hasta]` inclusive. Es la lista que consume el semáforo SLA como
 * feriados personalizados.
 */
export function listarDiasNoLaborables(
  desde: string,
  hasta: string,
  calendario: readonly DiaCalendario[] = [],
): string[] {
  if (!esFechaValida(desde) || !esFechaValida(hasta)) {
    throw new RangeError('Las fechas del rango deben ser válidas y tener formato YYYY-MM-DD.');
  }
  const inicio = aInstanteUtc(desde);
  const fin = aInstanteUtc(hasta);
  if (inicio > fin) {
    throw new RangeError('El rango de fechas es inválido: "desde" es posterior a "hasta".');
  }

  const indice = indexarCalendario(calendario);
  const resultado: string[] = [];
  for (let instante = inicio; instante <= fin; instante += DIAS_POR_MS) {
    const fecha = aFechaIso(instante);
    if (!esHabilEnIndice(fecha, indice)) {
      resultado.push(fecha);
    }
  }
  return resultado;
}

/** Filtra el calendario a un ejercicio fiscal, para consultas por año indexadas. */
export function calendarioDelAnio(
  calendario: readonly DiaCalendario[],
  anio: number,
): DiaCalendario[] {
  return calendario.filter((dia) => dia.anio === anio);
}
