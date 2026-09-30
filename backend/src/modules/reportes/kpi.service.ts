/**
 * Cálculo de los indicadores de gestión del Plan de Closed-Loop del SIGD.
 *
 * Las fórmulas son las definidas en el MGD y se reproducen aquí de forma
 * explícita para que el valor publicado por los endpoints #50-#54 sea auditable
 * y verificable con los mismos datos que alimentan los SP.
 */

/** Feriados no laborables de la región Ucayali (Ley N° 30709). */
export const FERIADOS_UCAYALI: string[] = [
  '01-01', // Año Nuevo
  '04-14', // Viernes Santo
  '05-01', // Día del Trabajo
  '06-24', // San Juan
  '08-30', // Santa Rosa de Lima
  '10-08', // Combate de Angamos
  '10-13', // Combatir el Terrorismo
  '11-01', // Todos los Santos
  '12-08', // Inmaculada Concepción
  '12-25', // Navidad
];

export const UMBRAL_VTEP = 95;
export const UMBRAL_TPR_HORAS = 24;
export const UMBRAL_TRO = 90;
export const UMBRAL_TEO = 5;

function diaDosDigitos(date: Date): string {
  return String(date.getUTCDate()).padStart(2, '0');
}

function mesDosDigitos(date: Date): string {
  return String(date.getUTCMonth() + 1).padStart(2, '0');
}

export function esFeriado(date: Date): boolean {
  return FERIADOS_UCAYALI.includes(`${mesDosDigitos(date)}-${diaDosDigitos(date)}`);
}

export function esDiaHabil(date: Date): boolean {
  const dia = date.getUTCDay();
  return dia !== 0 && dia !== 6 && !esFeriado(date);
}

export function redondear(valor: number, decimales = 2): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

/**
 * Horas hábiles entre dos instantes. Los fines de semana y los feriados de
 * Ucayali (24 de junio y 13 de octubre entre los relevantes) no consumen plazo,
 * por lo que el TPR se mide en horas hábiles y no en horas calendario.
 */
export function horasHabilesEntre(desde: Date, hasta: Date): number {
  if (hasta <= desde) return 0;

  const inicioDelDia = new Date(desde);
  inicioDelDia.setUTCHours(0, 0, 0, 0);

  let horas = 0;
  for (const cursor = new Date(inicioDelDia); cursor <= hasta; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (!esDiaHabil(cursor)) continue;

    const inicioVentana = cursor.getTime() > desde.getTime() ? cursor : desde;
    const finDia = cursor.getTime() + 86_400_000;
    const finVentana = finDia < hasta.getTime() ? new Date(finDia) : hasta;
    const horasDelDia = Math.max(0, (finVentana.getTime() - inicioVentana.getTime()) / 3_600_000);
    horas += horasDelDia;
  }

  return redondear(horas, 4);
}

/**
 * VTEP = (atendidos + archivados) / radicados × 100. Objetivo ≥ 95 %.
 * Sin radicaciones en el periodo el indicador es `null` (no calculable), nunca
 * 100: publicar un VTEP de 100 % sin expedientes atendidos falsearía el indicador.
 */
export function calcularVtep(radicados: number, atendidos: number, archivados: number): number | null {
  if (radicados <= 0) return null;
  return redondear(((atendidos + archivados) / radicados) * 100);
}

/** TPR = Σ(horas hábiles de atención) / N. Objetivo ≤ 24 horas hábiles. */
export function calcularTpr(horasTotales: number, cantidadResueltos: number): number | null {
  if (cantidadResueltos <= 0) return null;
  return redondear(horasTotales / cantidadResueltos);
}

/** TRO = resueltos dentro del plazo / resueltos × 100. Objetivo ≥ 90 %. */
export function calcularTro(dentroDePlazo: number, resueltos: number): number | null {
  if (resueltos <= 0) return null;
  return redondear((dentroDePlazo / resueltos) * 100);
}

/** TEO = observados / en trámite × 100. Objetivo ≤ 5 %. */
export function calcularTeo(observados: number, enTramite: number): number | null {
  if (enTramite <= 0) return null;
  return redondear((observados / enTramite) * 100);
}

export interface CumpleMeta {
  cumple: boolean | null;
  meta: string;
  valor: number | null;
}

export function evaluarMeta(valor: number | null, comparador: 'minimo' | 'maximo', objetivo: number): CumpleMeta {
  if (valor === null) {
    return { cumple: null, meta: `${comparador === 'minimo' ? '≥' : '≤'} ${objetivo}`, valor: null };
  }
  return {
    cumple: comparador === 'minimo' ? valor >= objetivo : valor <= objetivo,
    meta: `${comparador === 'minimo' ? '≥' : '≤'} ${objetivo}`,
    valor,
  };
}

export interface KpiMgd {
  codigo: 'VTEP' | 'TPR' | 'TRO' | 'TEO';
  nombre: string;
  valor: number | null;
  unidad: '%' | 'horas';
  meta: string;
  cumple: boolean | null;
  formula: string;
}

export interface IndicadoresMgd {
  vtep: KpiMgd;
  tpr: KpiMgd;
  tro: KpiMgd;
  teo: KpiMgd;
  cumpleTodas: boolean | null;
  generadoEn: string;
}

export interface InsumosKpi {
  radicados: number;
  atendidos: number;
  archivados: number;
  horasHabilesTotales: number;
  resueltos: number;
  resueltosDentroDePlazo: number;
  observados: number;
  enTramite: number;
  generadoEn?: Date;
}

export function calcularIndicadoresMgd(insumos: InsumosKpi): IndicadoresMgd {
  const valorVtep = calcularVtep(insumos.radicados, insumos.atendidos, insumos.archivados);
  const valorTpr = calcularTpr(insumos.horasHabilesTotales, insumos.resueltos);
  const valorTro = calcularTro(insumos.resueltosDentroDePlazo, insumos.resueltos);
  const valorTeo = calcularTeo(insumos.observados, insumos.enTramite);

  const vtep = evaluarMeta(valorVtep, 'minimo', UMBRAL_VTEP);
  const tpr = evaluarMeta(valorTpr, 'maximo', UMBRAL_TPR_HORAS);
  const tro = evaluarMeta(valorTro, 'minimo', UMBRAL_TRO);
  const teo = evaluarMeta(valorTeo, 'maximo', UMBRAL_TEO);

  const estados = [vtep.cumple, tpr.cumple, tro.cumple, teo.cumple].filter((v) => v !== null);

  return {
    vtep: {
      codigo: 'VTEP',
      nombre: 'Verdadero Tiempo de Escalamiento de Procesos',
      valor: valorVtep,
      unidad: '%',
      meta: vtep.meta,
      cumple: vtep.cumple,
      formula: '(atendidos + archivados) / radicados × 100',
    },
    tpr: {
      codigo: 'TPR',
      nombre: 'Tiempo Promedio de Resolución',
      valor: valorTpr,
      unidad: 'horas',
      meta: tpr.meta,
      cumple: tpr.cumple,
      formula: 'Σ(horas hábiles de atención) / N resueltos',
    },
    tro: {
      codigo: 'TRO',
      nombre: 'Tiempos de Respuesta Operativa',
      valor: valorTro,
      unidad: '%',
      meta: tro.meta,
      cumple: tro.cumple,
      formula: 'resueltos dentro del plazo / resueltos × 100',
    },
    teo: {
      codigo: 'TEO',
      nombre: 'Tasa de Expedientes Observados',
      valor: valorTeo,
      unidad: '%',
      meta: teo.meta,
      cumple: teo.cumple,
      formula: 'observados / en trámite × 100',
    },
    cumpleTodas: estados.length === 0 ? null : estados.every((estado) => estado),
    generadoEn: (insumos.generadoEn ?? new Date()).toISOString(),
  };
}
